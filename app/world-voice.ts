export type WorldVoiceState = {
  status: 'off' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';
  transmitting: boolean;
  connected: number;
  connecting: number;
  speaking: string[];
  localSpeaking: boolean;
  playbackBlocked: boolean;
  relay: boolean;
  error: string;
  peers: { id: string; name: string; muted: boolean; speaking: boolean }[];
};
export const initialVoiceState: WorldVoiceState = {
  status: 'off',
  transmitting: false,
  connected: 0,
  connecting: 0,
  speaking: [],
  localSpeaking: false,
  playbackBlocked: false,
  relay: false,
  error: '',
  peers: [],
};
type Nearby = { id: string; name: string; distance: number };
type Signal = {
  t: 'ready' | 'bye' | 'offer' | 'answer' | 'ice';
  call?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};
type Peer = {
  pc: RTCPeerConnection;
  call: string;
  audio: HTMLAudioElement;
  gain?: GainNode;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  buffer?: Float32Array<ArrayBuffer>;
  created: number;
  outgoing: RTCIceCandidateInit[];
  sent: boolean;
  pending: RTCIceCandidateInit[];
  speaking: boolean;
};
export const VOICE_RANGE = 55;
const MAX_PEERS = 6;
function validSignal(value: unknown): value is Signal {
  if (!value || typeof value !== 'object') return false;
  const m = value as Signal;
  if (m.t === 'ready' || m.t === 'bye') return true;
  if (typeof m.call !== 'string' || m.call.length > 64) return false;
  if (m.t === 'offer' || m.t === 'answer')
    return typeof m.sdp === 'string' && m.sdp.length < 24000;
  return (
    m.t === 'ice' &&
    !!m.candidate &&
    typeof m.candidate.candidate === 'string' &&
    m.candidate.candidate.length < 2048
  );
}
export function createWorldVoice(options: {
  id: string;
  send: (to: string, message: Signal) => void;
  onState: (state: WorldVoiceState) => void;
}) {
  let state = { ...initialVoiceState },
    disposed = false,
    generation = 0;
  let stream: MediaStream | undefined,
    context: AudioContext | undefined,
    localMeter: AnalyserNode | undefined;
  let localSource: MediaStreamAudioSourceNode | undefined,
    localBuffer: Float32Array<ArrayBuffer> | undefined;
  let iceServers: RTCIceServer[] = [],
    openMic = false,
    held = false,
    suspended = false;
  let lastAnnounce = 0,
    lastEmit = '';
  const nearby = new Map<string, Nearby>(),
    peers = new Map<string, Peer>(),
    muted = new Set<string>();
  const willing = new Map<string, number>(),
    queues = new Map<string, Promise<void>>();
  const earlyIce = new Map<
    string,
    { call: string; candidates: RTCIceCandidateInit[] }
  >();
  const emit = () => {
    if (disposed) return;
    const live = [...peers].filter(
      ([, p]) => p.pc.connectionState === 'connected',
    );
    const next: WorldVoiceState = {
      ...state,
      connected: live.length,
      connecting: peers.size - live.length,
      speaking: live
        .filter(([id, p]) => p.speaking && !muted.has(id))
        .map(([id]) => id),
      peers: live.map(([id, p]) => ({
        id,
        name: nearby.get(id)?.name || 'Explorer',
        muted: muted.has(id),
        speaking: p.speaking && !muted.has(id),
      })),
    };
    const serialized = JSON.stringify(next);
    if (serialized !== lastEmit) {
      lastEmit = serialized;
      options.onState(next);
    }
  };
  const gainFor = (id: string) => {
    if (muted.has(id)) return 0;
    const distance = nearby.get(id)?.distance ?? VOICE_RANGE;
    return Math.max(
      0,
      Math.min(1, (VOICE_RANGE - distance) / (VOICE_RANGE - 8)),
    );
  };
  const close = (id: string) => {
    const peer = peers.get(id);
    if (!peer) return;
    peers.delete(id);
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.source?.disconnect();
    peer.analyser?.disconnect();
    peer.gain?.disconnect();
    peer.audio.srcObject = null;
    peer.audio.remove();
    emit();
  };
  const transmit = () => {
    state.transmitting =
      state.status === 'ready' &&
      !suspended &&
      !document.hidden &&
      (openMic || held);
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = state.transmitting;
    });
    if (!state.transmitting) state.localSpeaking = false;
    emit();
  };
  const makePeer = (id: string, call: string) => {
    close(id);
    const pc = new RTCPeerConnection({ iceServers });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.muted = true;
    audio.style.display = 'none';
    audio.setAttribute('playsinline', '');
    document.body.appendChild(audio);
    const peer: Peer = {
      pc,
      call,
      audio,
      created: performance.now(),
      outgoing: [],
      pending: [],
      sent: false,
      speaking: false,
    };
    peers.set(id, peer);
    for (const track of stream?.getAudioTracks() || [])
      pc.addTrack(track, stream!);
    pc.onicecandidate = (event) => {
      if (!event.candidate || peers.get(id) !== peer) return;
      const candidate = event.candidate.toJSON();
      if (peer.sent) options.send(id, { t: 'ice', call, candidate });
      else peer.outgoing.push(candidate);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        state.error = 'A voice connection failed. Retrying…';
        close(id);
      } else {
        if (pc.connectionState === 'connected') state.error = '';
        emit();
      }
    };
    pc.ontrack = (event) => {
      if (!context || peers.get(id) !== peer) return;
      const remote = event.streams[0] || new MediaStream([event.track]);
      audio.srcObject = remote;
      void audio.play().catch(() => {
        state.playbackBlocked = true;
        emit();
      });
      peer.source = context.createMediaStreamSource(remote);
      peer.gain = context.createGain();
      peer.gain.gain.value = gainFor(id);
      peer.analyser = context.createAnalyser();
      peer.analyser.fftSize = 256;
      peer.buffer = new Float32Array(256);
      peer.source.connect(peer.analyser);
      peer.analyser.connect(peer.gain);
      peer.gain.connect(context.destination);
      if (context.state !== 'running') {
        state.playbackBlocked = true;
        emit();
      }
    };
    emit();
    return peer;
  };
  const sendDescription = (id: string, peer: Peer, t: 'offer' | 'answer') => {
    if (peers.get(id) !== peer || state.status !== 'ready') return;
    options.send(id, {
      t,
      call: peer.call,
      sdp: peer.pc.localDescription!.sdp,
    });
    peer.sent = true;
    peer.outgoing
      .splice(0)
      .forEach((candidate) =>
        options.send(id, { t: 'ice', call: peer.call, candidate }),
      );
  };
  const offer = async (id: string) => {
    if (
      peers.has(id) ||
      !nearby.has(id) ||
      peers.size >= MAX_PEERS ||
      state.status !== 'ready'
    )
      return;
    const peer = makePeer(
      id,
      `${options.id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      sendDescription(id, peer, 'offer');
    } catch {
      if (peers.get(id) === peer) close(id);
    }
  };
  const flushIce = async (peer: Peer, id: string) => {
    const early = earlyIce.get(id);
    if (early?.call === peer.call) {
      peer.pending.push(...early.candidates);
      earlyIce.delete(id);
    }
    for (const candidate of peer.pending.splice(0))
      await peer.pc.addIceCandidate(candidate).catch(() => {});
  };
  const signal = async (id: string, message: Signal) => {
    if (state.status !== 'ready' || disposed || !nearby.has(id)) return;
    if (message.t === 'bye') {
      willing.delete(id);
      earlyIce.delete(id);
      close(id);
      return;
    }
    if (message.t === 'ready') {
      const first = !willing.has(id);
      willing.set(id, performance.now());
      if (first) options.send(id, { t: 'ready' });
      if (options.id < id) await offer(id);
      return;
    }
    if (message.t === 'offer') {
      if (options.id < id || (peers.size >= MAX_PEERS && !peers.has(id)))
        return;
      let peer = peers.get(id);
      if (peer?.call === message.call) return;
      peer = makePeer(id, message.call!);
      willing.set(id, performance.now());
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
      await flushIce(peer, id);
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      sendDescription(id, peer, 'answer');
    } else {
      const peer = peers.get(id);
      if (
        message.t === 'answer' &&
        peer &&
        peer.call === message.call &&
        peer.pc.signalingState === 'have-local-offer'
      ) {
        await peer.pc.setRemoteDescription({
          type: 'answer',
          sdp: message.sdp,
        });
        await flushIce(peer, id);
      } else if (message.t === 'ice') {
        if (peer && peer.call === message.call) {
          if (peer.pc.remoteDescription)
            await peer.pc.addIceCandidate(message.candidate!).catch(() => {});
          else if (peer.pending.length < 64)
            peer.pending.push(message.candidate!);
        } else if (!peer) {
          const early = earlyIce.get(id);
          if (early && early.call === message.call) {
            if (early.candidates.length < 64)
              early.candidates.push(message.candidate!);
          } else
            earlyIce.set(id, {
              call: message.call!,
              candidates: [message.candidate!],
            });
        }
      }
    }
  };
  const release = () => {
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream = undefined;
    for (const id of peers.keys()) close(id);
    localSource?.disconnect();
    localMeter?.disconnect();
    localSource = undefined;
    localMeter = undefined;
    localBuffer = undefined;
    void context?.close().catch(() => {});
    context = undefined;
    willing.clear();
    earlyIce.clear();
    queues.clear();
  };
  const disable = () => {
    generation++;
    for (const id of nearby.keys()) options.send(id, { t: 'bye' });
    openMic = false;
    held = false;
    state = { ...initialVoiceState };
    release();
    emit();
  };
  const enable = async () => {
    if (disposed || state.status === 'ready' || state.status === 'requesting')
      return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !globalThis.RTCPeerConnection ||
      !window.isSecureContext
    ) {
      state.status = 'unsupported';
      state.error =
        'Voice needs HTTPS (or localhost) and a browser with microphone support.';
      emit();
      return;
    }
    const attempt = ++generation;
    state.status = 'requesting';
    state.error = '';
    emit();
    try {
      context = new AudioContext();
      await context.resume();
      const media = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (disposed || attempt !== generation) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        track.onended = () => {
          disable();
          state.status = 'error';
          state.error = 'Microphone disconnected. Join voice again.';
          emit();
        };
      });
      let config: { iceServers?: RTCIceServer[]; relay?: boolean } = {};
      try {
        const response = await fetch('/api/voice-config', {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) config = await response.json();
      } catch {
        /* Direct connections remain available. */
      }
      if (disposed || attempt !== generation) return;
      iceServers = config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
      ];
      state.relay = !!config.relay;
      localSource = context!.createMediaStreamSource(media);
      localMeter = context!.createAnalyser();
      localMeter.fftSize = 256;
      localBuffer = new Float32Array(256);
      localSource.connect(localMeter);
      state.status = 'ready';
      state.playbackBlocked = context!.state !== 'running';
      lastAnnounce = 0;
      transmit();
      tick();
    } catch (error) {
      if (disposed || attempt !== generation) return;
      release();
      state.status =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'denied'
          : 'error';
      state.error =
        state.status === 'denied'
          ? 'Microphone blocked. Allow it in your browser settings, then retry.'
          : 'Could not open your microphone. Check the device and retry.';
      emit();
    }
  };
  const level = (analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) => {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const value of buffer) sum += value * value;
    return Math.sqrt(sum / buffer.length);
  };
  const tick = () => {
    if (state.status !== 'ready') return;
    const now = performance.now();
    if (now - lastAnnounce > 3000 || !lastAnnounce) {
      lastAnnounce = now;
      for (const id of nearby.keys()) options.send(id, { t: 'ready' });
      for (const [id, peer] of peers) {
        if (
          (peer.pc.connectionState !== 'connected' &&
            now - peer.created > 18000) ||
          now - (willing.get(id) || 0) > 15000
        )
          close(id);
      }
    }
    state.localSpeaking = !!(
      state.transmitting &&
      localMeter &&
      localBuffer &&
      level(localMeter, localBuffer) > 0.018
    );
    for (const [id, peer] of peers) {
      peer.speaking = !!(
        peer.analyser &&
        peer.buffer &&
        !muted.has(id) &&
        level(peer.analyser, peer.buffer) > 0.018
      );
      if (peer.gain && context)
        peer.gain.gain.setTargetAtTime(gainFor(id), context.currentTime, 0.08);
    }
    emit();
  };
  const timer = setInterval(tick, 150);
  const blur = () => {
    held = false;
    openMic = false;
    transmit();
  };
  const visibility = () => {
    if (document.hidden) blur();
  };
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  return {
    enable,
    disable,
    handleSignal(id: string, message: unknown) {
      if (state.status !== 'ready' || !nearby.has(id) || !validSignal(message))
        return;
      const previous = queues.get(id) || Promise.resolve();
      const epoch = generation;
      const next = previous
        .then(() => {
          if (epoch === generation) return signal(id, message);
        })
        .catch(() => {
          if (epoch === generation) close(id);
        });
      queues.set(id, next);
      void next.finally(() => {
        if (queues.get(id) === next) queues.delete(id);
      });
    },
    updateNearby(values: Nearby[]) {
      nearby.clear();
      for (const p of values
        .filter((p) => p.distance < VOICE_RANGE && Number.isFinite(p.distance))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_PEERS))
        nearby.set(p.id, p);
      for (const id of peers.keys())
        if (!nearby.has(id)) {
          options.send(id, { t: 'bye' });
          close(id);
        }
      for (const id of willing.keys()) if (!nearby.has(id)) willing.delete(id);
      for (const id of earlyIce.keys())
        if (!nearby.has(id)) earlyIce.delete(id);
    },
    setMicrophone(on: boolean) {
      openMic = on;
      held = false;
      void context?.resume();
      transmit();
    },
    hold(on: boolean) {
      held = on;
      if (on) void context?.resume();
      transmit();
    },
    suspend(on: boolean) {
      suspended = on;
      if (on) {
        held = false;
        openMic = false;
      }
      transmit();
    },
    mutePeer(id: string, value: boolean) {
      if (value) muted.add(id);
      else muted.delete(id);
      tick();
    },
    async resumePlayback() {
      await context?.resume();
      for (const p of peers.values()) await p.audio.play().catch(() => {});
      state.playbackBlocked = context?.state !== 'running';
      emit();
    },
    dispose() {
      disable();
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
