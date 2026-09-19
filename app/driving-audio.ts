type DrivingSound = {
  active: boolean;
  bus: boolean;
  speed: number;
  throttle: boolean;
  braking: boolean;
  rain?: number;
  wind?: number;
  daylight?: number;
  storm?: boolean;
  lightning?: boolean;
  inside?: boolean;
};

export function createDrivingAudio() {
  let ctx: AudioContext | undefined,
    master: GainNode,
    engine: GainNode,
    road: GainNode,
    brake: GainNode;
  let motor: OscillatorNode, harmonic: OscillatorNode, filter: BiquadFilterNode;
  let muted = false,
    paused = false,
    disposed = false,
    lastHorn = -10,
    lastCrash = -10,
    nextReverse = 0;
  let state: DrivingSound = {
    active: false,
    bus: true,
    speed: 0,
    throttle: false,
    braking: false,
  };
  const sources: AudioScheduledSourceNode[] = [];
  const request = new AbortController();
  let diesel: AudioBufferSourceNode,
    dieselGain: GainNode,
    rain: GainNode,
    wind: GainNode;
  let ambience: GainNode,
    ambienceFilter: BiquadFilterNode,
    windFilter: BiquadFilterNode;
  let noiseBuffer: AudioBuffer,
    dieselReady = false,
    nextBird = 0,
    thunderAt = Infinity;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  function unlock() {
    if (disposed || muted || paused || document.hidden) return;
    if (!ctx) {
      if (!window.AudioContext) return;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.32;
      const limiter = ctx.createDynamicsCompressor();
      master.connect(limiter);
      limiter.connect(ctx.destination);
      engine = ctx.createGain();
      engine.gain.value = 0;
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;
      engine.connect(filter);
      filter.connect(master);
      motor = ctx.createOscillator();
      motor.type = 'sawtooth';
      motor.connect(engine);
      motor.start();
      harmonic = ctx.createOscillator();
      harmonic.type = 'triangle';
      harmonic.connect(engine);
      harmonic.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
        samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      road = ctx.createGain();
      road.gain.value = 0;
      const roadFilter = ctx.createBiquadFilter();
      roadFilter.type = 'lowpass';
      roadFilter.frequency.value = 500;
      noise.connect(roadFilter);
      roadFilter.connect(road);
      road.connect(master);
      brake = ctx.createGain();
      brake.gain.value = 0;
      const brakeFilter = ctx.createBiquadFilter();
      brakeFilter.type = 'bandpass';
      brakeFilter.frequency.value = 2200;
      brakeFilter.Q.value = 1.4;
      noise.connect(brakeFilter);
      brakeFilter.connect(brake);
      brake.connect(master);
      noise.start();
      sources.push(motor, harmonic, noise);
      noiseBuffer = buffer;
      ambience = ctx.createGain();
      ambience.gain.value = 1;
      ambienceFilter = ctx.createBiquadFilter();
      ambienceFilter.type = 'lowpass';
      ambienceFilter.frequency.value = 10000;
      ambience.connect(ambienceFilter);
      ambienceFilter.connect(master);
      rain = ctx.createGain();
      rain.gain.value = 0;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 650;
      noise.connect(rainFilter);
      rainFilter.connect(rain);
      rain.connect(ambience);
      wind = ctx.createGain();
      wind.gain.value = 0;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 280;
      noise.connect(windFilter);
      windFilter.connect(wind);
      wind.connect(ambience);
      dieselGain = ctx.createGain();
      dieselGain.gain.value = 0;
      dieselGain.connect(master);
      diesel = ctx.createBufferSource();
      diesel.loop = true;
      diesel.connect(dieselGain);
      const context = ctx;
      // Existing CC0 bus field recording; trim, normalise and crossfade the loop seam.
      void fetch('/audio/bus-diesel-recording.mp3', { signal: request.signal })
        .then((r) => {
          if (!r.ok) throw Error('Engine recording unavailable');
          return r.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .then((recording) => {
          if (disposed) return;
          const start = Math.min(
            Math.floor(recording.sampleRate * 3),
            Math.floor(recording.length / 4),
          );
          const length = Math.min(
            Math.floor(recording.sampleRate * 10),
            recording.length - start,
          );
          const fade = Math.min(
            Math.floor(recording.sampleRate * 0.2),
            Math.floor(length / 4),
          );
          const mono = new Float32Array(length);
          for (let c = 0; c < recording.numberOfChannels; c++) {
            const data = recording.getChannelData(c);
            for (let i = 0; i < length; i++)
              mono[i] += data[start + i] / recording.numberOfChannels;
          }
          const loop = context.createBuffer(
              1,
              length - fade,
              recording.sampleRate,
            ),
            data = loop.getChannelData(0);
          data.set(mono.subarray(fade));
          for (let i = 0; i < fade; i++) {
            const blend = i / Math.max(1, fade - 1);
            data[data.length - fade + i] =
              mono[length - fade + i] * (1 - blend) + mono[i] * blend;
          }
          let sum = 0,
            peak = 0;
          for (const sample of data) {
            sum += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
          }
          const gain = Math.min(
            0.22 / Math.max(0.0001, Math.sqrt(sum / data.length)),
            0.9 / Math.max(0.0001, peak),
          );
          for (let i = 0; i < data.length; i++) data[i] *= gain;
          diesel.buffer = loop;
          diesel.start();
          sources.push(diesel);
          dieselReady = true;
        })
        .catch(() => {
          /* Synth engine stays available if the recording cannot load. */
        });
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }
  function tone(hz: number, duration: number, volume: number, endHz = hz) {
    if (!ctx || ctx.state !== 'running' || muted || paused || !state.active)
      return;
    const t = ctx.currentTime,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(endHz, t + duration);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(t + duration + 0.02);
    sources.push(o);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      const i = sources.indexOf(o);
      if (i >= 0) sources.splice(i, 1);
    };
  }
  function remember(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    sources.push(source);
    source.onended = () => {
      source.disconnect();
      nodes.forEach((n) => n.disconnect());
      const i = sources.indexOf(source);
      if (i >= 0) sources.splice(i, 1);
    };
  }
  function bird(level: number) {
    if (!ctx) return;
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.16,
        o = ctx.createOscillator(),
        g = ctx.createGain(),
        pan = ctx.createStereoPanner();
      const hz = 1800 + Math.random() * 1200;
      o.type = 'sine';
      o.frequency.setValueAtTime(hz, t);
      o.frequency.exponentialRampToValueAtTime(hz * 1.5, t + 0.045);
      o.frequency.exponentialRampToValueAtTime(hz * 0.8, t + 0.12);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(level, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g);
      g.connect(pan);
      pan.connect(ambience);
      o.start(t);
      o.stop(t + 0.16);
      remember(o, [g, pan]);
    }
  }
  function thunder() {
    if (!ctx) return;
    const t = ctx.currentTime,
      n = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    n.buffer = noiseBuffer;
    n.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1600, t);
    f.frequency.exponentialRampToValueAtTime(95, t + 4);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.85, t + 0.045);
    g.gain.exponentialRampToValueAtTime(0.23, t + 0.7);
    g.gain.linearRampToValueAtTime(0.4, t + 1.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 5);
    n.connect(f);
    f.connect(g);
    g.connect(ambience);
    n.start();
    n.stop(t + 5.1);
    remember(n, [f, g]);
  }
  function horn() {
    unlock();
    if (!ctx || !state.active || ctx.currentTime - lastHorn < 0.45) return;
    lastHorn = ctx.currentTime;
    tone(state.bus ? 220 : 380, 0.5, 0.3);
    tone(state.bus ? 277 : 480, 0.5, 0.2);
  }
  const visibility = () => {
    if (document.hidden) void ctx?.suspend().catch(() => {});
    else unlock();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', visibility);
  return {
    horn,
    crash(speed: number) {
      if (!ctx || Math.abs(speed) < 1 || ctx.currentTime - lastCrash < 0.5)
        return;
      lastCrash = ctx.currentTime;
      tone(100, 0.3, Math.min(0.6, Math.abs(speed) / 20), 30);
    },
    mute(value: boolean) {
      muted = value;
      if (value) thunderAt = Infinity;
      if (!value) unlock();
      if (ctx)
        master.gain.setTargetAtTime(value ? 0 : 0.32, ctx.currentTime, 0.025);
    },
    pause(value: boolean) {
      paused = value;
      if (value) void ctx?.suspend().catch(() => {});
      else unlock();
    },
    update(next: DrivingSound) {
      state = next;
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime,
        s = Math.abs(next.speed),
        active = next.active && !paused;
      // Lower diesel rumble for the bus; a higher, smoother note for the car.
      const revs =
        (next.bus ? 32 : 55) +
        Math.min(s, 40) * (next.bus ? 2 : 3) +
        (next.throttle ? 12 : 0);
      motor.frequency.setTargetAtTime(revs, t, 0.12);
      harmonic.frequency.setTargetAtTime(revs * 2.01, t, 0.12);
      filter.frequency.setTargetAtTime(
        (next.bus ? 260 : 440) + s * 18,
        t,
        0.15,
      );
      engine.gain.setTargetAtTime(
        active && (!next.bus || !dieselReady)
          ? (next.bus ? 0.16 : 0.1) + (next.throttle ? 0.05 : 0)
          : 0,
        t,
        0.12,
      );
      dieselGain.gain.setTargetAtTime(
        active && next.bus && dieselReady
          ? 0.65 + (next.throttle ? 0.12 : 0)
          : 0,
        t,
        0.18,
      );
      diesel.playbackRate.setTargetAtTime(
        0.92 + Math.min(s / 24, 1) * 0.35 + (next.throttle ? 0.08 : 0),
        t,
        0.3,
      );
      const wet = clamp(next.rain ?? 0),
        breeze = clamp((next.wind ?? 0) / 50),
        day = clamp(next.daylight ?? 0);
      ambience.gain.setTargetAtTime(next.inside ? 0.4 : 1, t, 0.35);
      ambienceFilter.frequency.setTargetAtTime(
        next.inside ? 1800 : 10000,
        t,
        0.35,
      );
      rain.gain.setTargetAtTime(
        wet * (0.24 + 0.08 * Math.sin(t * 0.73) ** 2),
        t,
        1.2,
      );
      wind.gain.setTargetAtTime(
        breeze * (0.16 + 0.1 * Math.sin(t * 0.37) ** 2) + wet * 0.025,
        t,
        1.5,
      );
      windFilter.frequency.setTargetAtTime(
        180 + breeze * 650 + 120 * Math.sin(t * 0.21) ** 2,
        t,
        0.6,
      );
      if (!next.storm) thunderAt = Infinity;
      if (next.lightning && next.storm && !muted)
        thunderAt = t + 1.2 + Math.random() * 2.8;
      if (t >= thunderAt && !muted) {
        thunder();
        thunderAt = Infinity;
      }
      if (t > nextBird && !muted && !paused) {
        const birdLevel = day * (1 - wet) ** 3 * (1 - breeze * 0.7);
        if (!next.storm && birdLevel > 0.08) bird(0.055 * birdLevel);
        nextBird = t + 4 + Math.random() * 8;
      }
      road.gain.setTargetAtTime(
        active ? Math.min(s / 34, 1) * 0.18 : 0,
        t,
        0.1,
      );
      brake.gain.setTargetAtTime(
        active && next.braking ? Math.min(s / 12, 1) * 0.22 : 0,
        t,
        0.06,
      );
      if (active && next.bus && next.speed < -0.3 && t > nextReverse) {
        tone(980, 0.24, 0.16);
        nextReverse = t + 0.8;
      }
    },
    dispose() {
      disposed = true;
      request.abort();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
      for (const s of sources) {
        s.stop();
        s.disconnect();
      }
      void ctx?.close().catch(() => {});
    },
  };
}
