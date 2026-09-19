'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  Globe2,
  Users,
  Volume2,
  VolumeX,
  Megaphone,
  Lightbulb,
  Camera,
  RotateCcw,
  Pause,
  Play,
  MapPin,
} from 'lucide-react';
import { stops as defaultStops, type MapData } from './alappuzha-map';
import type { createAlappuzhaWorld, WorldHud } from './alappuzha-world';
import './alappuzha-drive.css';
import './drive-hud.css';
import DriveJoystick from './drive-joystick';
import WorldMap from './alappuzha-world-map';
import { parseWeather, weatherLabel, type Weather } from './alappuzha-weather';
import type { createWorldStream, StreamStatus } from './world-stream';
import WorldAreaPicker, { type WorldArea } from './world-area-picker';
import { createVisitorAnalytics, type VisitorAnalytics } from './visitor-analytics';
import WorldVoiceControls from './world-voice-controls';
import { initialVoiceState } from './world-voice';

export default function AlappuzhaDrive() {
  const analytics = useRef<VisitorAnalytics>(undefined);
  useEffect(() => {
    analytics.current = createVisitorAnalytics();
    return () => analytics.current?.dispose();
  }, []);
  const onPlaying = useCallback((playing: boolean) => analytics.current?.setPlaying(playing), []);
  const onEntered = useCallback((area: string) => analytics.current?.enterArea(area), []);
  const [playerName, setPlayerName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [selection, setSelection] = useState<{
    area: WorldArea;
    id: number;
  } | null>(null);
  const choose = (area: WorldArea) => setSelection({ area, id: Date.now() });
  if (!playerName) return (
    <main className="area-picker"><section className="area-picker-card player-name-card">
      <small>WELCOME</small>
      <h1>What’s your name?</h1>
      <p id="player-name-help">Nearby players will see this name above your character or the vehicle you’re driving.</p>
      <form onSubmit={event => {
        event.preventDefault();
        const name = draftName.trim().replace(/\s+/g, ' ').slice(0, 24);
        if (name) { analytics.current?.identify(name); setPlayerName(name); }
      }}>
        <label htmlFor="player-name">Your name</label>
        <input id="player-name" name="playerName" autoComplete="name" required maxLength={24}
          aria-describedby="player-name-help" placeholder="Enter your name" value={draftName}
          onChange={event => setDraftName(event.target.value)} />
        <button type="submit" disabled={!draftName.trim()}>Continue</button>
      </form>
      <p className="area-note">We save your name and basic visit activity to understand how the world is used. A browser ID helps recognise returning visits.</p>
    </section></main>
  );
  return selection ? (
    <AreaDrive
      key={selection.id}
      area={selection.area}
      playerName={playerName}
      onPlaying={onPlaying}
      onEntered={onEntered}
      onChangeArea={() => setSelection(null)}
      onRetry={() => choose(selection.area)}
      onExplore={(point) => choose({ point })}
    />
  ) : (
    <WorldAreaPicker onSelect={choose} />
  );
}
function AreaDrive({
  area,
  playerName,
  onPlaying,
  onEntered,
  onChangeArea,
  onRetry,
  onExplore,
}: {
  area: WorldArea;
  playerName: string;
  onPlaying: (playing: boolean) => void;
  onEntered: (area: string) => void;
  onChangeArea: () => void;
  onRetry: () => void;
  onExplore: (point: import('./alappuzha-map').Point) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createAlappuzhaWorld> | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('ready');
  const [voiceState, setVoiceState] = useState(initialVoiceState);
  const [voiceApi, setVoiceApi] = useState<ReturnType<typeof createAlappuzhaWorld>['voice']>();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [hud, setHud] = useState<WorldHud | null>(null),
    [town, setTown] = useState(0),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(false),
    [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    engine.current?.voice.suspend(paused || mobileMenu);
  }, [paused, mobileMenu, ready]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenu(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const [mapOpen, setMapOpen] = useState(false),
    [mapData, setMapData] = useState<MapData | null>(null);
  const stops = mapData?.stops ?? defaultStops;
  const areaName =
    area.region === 'kerala'
      ? `Kerala · from ${area.name}`
      : area.point
        ? 'Nearby world'
        : 'Alappuzha';
  useEffect(() => {
    onPlaying(ready && !paused && !mapOpen);
    return () => onPlaying(false);
  }, [ready, paused, mapOpen, onPlaying]);
  useEffect(() => {
    if (ready) onEntered(areaName);
  }, [ready, areaName, onEntered]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${area.point?.[1] ?? 9.4981}&longitude=${area.point?.[0] ?? 76.3388}&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&timeformat=unixtime&forecast_days=1`,
          { signal: controller.signal },
        );
        if (!response.ok) throw Error('Weather unavailable');
        const result = parseWeather(await response.json());
        if (active) {
          setWeather(result);
          setWeatherFailed(false);
        }
      } catch {
        if (active) setWeatherFailed(true);
      } finally {
        clearTimeout(timeout);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10 * 60_000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [area.point]);
  useEffect(() => {
    engine.current?.setWeather(weather);
  }, [weather, ready]);
  const timeText = (value: number) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  const weatherStale =
    weather && now !== null && now - weather.observedAt > 90 * 60_000;
  const mapWasPaused = useRef(false);
  const openMap = useCallback(() => {
    if (!engine.current) return;
    mapWasPaused.current = paused;
    if (!paused) setPaused(engine.current.pause());
    setMapOpen(true);
  }, [paused]);
  const closeMap = useCallback(() => {
    setMapOpen(false);
    if (!mapWasPaused.current) setPaused(engine.current?.pause() ?? false);
  }, []);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        e.preventDefault();
        if (mapOpen) closeMap();
        else openMap();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [mapOpen, openMap, closeMap]);
  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    let instance: ReturnType<typeof createAlappuzhaWorld> | null = null;
    let stream: ReturnType<typeof createWorldStream> | null = null;
    const resources = area.point
      ? import('./world-area').then((m) =>
          m.loadWorldArea(area.point!, abort.signal),
        )
      : Promise.all([
          import('./alappuzha-terrain').then((m) =>
            m.loadTerrain(abort.signal),
          ),
          fetch('/maps/alappuzha.json', { signal: abort.signal }).then((r) => {
            if (!r.ok) throw Error('Map download failed');
            return r.json() as Promise<MapData>;
          }),
        ]).then(([terrain, data]) => ({ terrain, data }));
    Promise.all([
      import('./alappuzha-world'),
      resources,
      area.point ? import('./world-stream') : Promise.resolve(null),
    ])
      .then(([module, { terrain, data }, streaming]) => {
        if (cancelled || !host.current) return;
        setMapData(data);
        instance = module.createAlappuzhaWorld(
          host.current,
          data,
          (state) => {
            setHud(state);
            if (!document.hidden) stream?.update(state.position);
          },
          terrain,
          playerName,
          setVoiceState,
        );
        if (streaming && data.origin)
          stream = streaming.createWorldStream(data, {
            onData: (next) => {
              if (cancelled) return;
              instance?.updateMap(next);
              setMapData(next);
              setTown(0);
            },
            onStatus: (status) => {
              if (!cancelled) setStreamStatus(status);
            },
          });
        engine.current = instance;
        setVoiceApi(instance.voice);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : 'The world could not load.',
          );
      });
    return () => {
      cancelled = true;
      abort.abort();
      stream?.dispose();
      instance?.dispose();
      engine.current = null;
    };
  }, [area.point, playerName]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  const mapPath = hud?.path
    .map(
      (p) =>
        `${100 + (p[0] - hud.position[0]) * 0.16},${100 + (p[1] - hud.position[1]) * 0.16}`,
    )
    .join(' ');
  return (
    <main
      className={`drive-game${mobileMenu ? ' mobile-menu-open' : ''}`}
      data-mode={hud?.mode || 'walk'}
    >
      <div
        ref={host}
        className="drive-world"
        aria-label={`Playable 3D ${areaName} world`}
      />
      <WorldVoiceControls voice={voiceApi} state={voiceState} available={ready && hud?.liveStatus === 'online'} paused={paused || mobileMenu} />
      <aside
        className="drive-weather"
        aria-label="Local time and weather"
        title={
          weather
            ? `Weather estimate updated ${timeText(weather.observedAt)} · Open-Meteo`
            : 'Weather unavailable'
        }
      >
        <strong>{now ? timeText(now) : 'India time'} · IST</strong>
        <span>
          {weather && !weatherStale
            ? `${Math.round(weather.temperature)}°C · ${weatherLabel(weather)}`
            : weatherFailed || weatherStale
              ? 'Weather unavailable'
              : 'Loading weather…'}
        </span>
        <small>
          {weather && !weatherStale
            ? `${weatherFailed ? 'Last reading' : 'Updated'} ${timeText(weather.observedAt)} · `
            : ''}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{' '}
          · {areaName} estimate
        </small>
      </aside>
      {mobileMenu && (
        <button
          className="drive-menu-scrim"
          aria-label="Dismiss game menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="drive-mobile-toolbar">
        <button
          disabled={!ready}
          aria-label="Open full district map"
          onClick={openMap}
        >
          <MapPin size={19} />
          <span>Map</span>
        </button>
        <button
          disabled={!ready}
          aria-label={mobileMenu ? 'Close game menu' : 'Open game menu'}
          aria-expanded={mobileMenu}
          aria-controls="game-actions"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          {mobileMenu ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <output className="drive-live" data-state={hud?.liveStatus??'connecting'} aria-live="polite" title="Live player sessions in this area">
        <Users size={14}/>
        {hud?.liveStatus==='online'?`${hud.livePlayers} online nearby`:hud?.liveStatus==='unconfigured'?'Multiplayer unavailable':hud?.liveStatus==='reconnecting'?'Reconnecting…':'Connecting…'}
      </output>
      <header className="drive-header">
        <div className="drive-logo">
          <Globe2 size={25} />
          <div>
            OPEN WORLD<small>{areaName.toUpperCase()} · OPEN WORLD</small>
          </div>
        </div>
        <div className="drive-place">
          <MapPin size={15} />
          <select
            aria-label="Travel to town"
            value={town}
            disabled={!ready}
            onChange={(e) => {
              const n = Number(e.target.value);
              setTown(n);
              engine.current?.travel(n);
            }}
          >
            {stops.map((s, i) => (
              <option key={s.name} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      <section className="drive-mission">
        <span>
          {hud?.mode === 'walk' ? 'EXPLORE ON FOOT' : 'EXPLORE BY VEHICLE'}
        </span>
        <h1>{areaName}</h1>
        <p>
          Go wherever you like. Walk or drive, discover nearby streets, and
          explore the map. Drag to look around. Scroll or pinch to zoom.
        </p>
      </section>
      <section
        id="game-actions"
        className="drive-actions"
        aria-label="Game controls"
      >
        <label className="drive-vehicle-choice">
          Drive a vehicle
          <select
            aria-label="Choose vehicle"
            value={hud?.mode === 'drive' ? hud.vehicle : ''}
            disabled={
              !ready ||
              paused ||
              (hud?.mode === 'drive' && (hud.speed || 0) > 7)
            }
            onChange={(event) => {
              if (
                engine.current?.chooseVehicle(
                  event.target.value as 'bus' | 'car' | 'bike' | 'lorry',
                )
              )
                setMobileMenu(false);
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="car">Car</option>
            <option value="bike">Bike</option>
            <option value="lorry">Lorry</option>
            <option value="bus">Bus</option>
          </select>
        </label>
        <button
          className="drive-map-button"
          onClick={onChangeArea}
          aria-label="Change world location"
          title="Choose another location"
        >
          <MapPin size={17} />
          <span>Location</span>
        </button>
        <button
          disabled={!ready}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={muted}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            engine.current?.mute(next);
          }}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          <span className="mobile-action-label">
            {muted ? 'Unmute' : 'Mute'}
          </span>
        </button>
        <button
          disabled={!ready || paused || hud?.mode !== 'drive'}
          aria-label="Sound horn"
          title="Horn · H"
          onClick={() => engine.current?.horn()}
        >
          <Megaphone size={19} />
          <span className="mobile-action-label">Horn</span>
        </button>
        <button disabled={!ready || hud?.mode !== 'drive'} aria-label="Headlights" aria-pressed={hud?.headlights ?? true}
          title="Headlights · L" onClick={() => engine.current?.headlights()}>
          <Lightbulb size={19} /><span className="mobile-action-label">Headlights</span><kbd>L</kbd>
        </button>
        <button
          disabled={!ready}
          className="drive-map-button"
          aria-label="Open full district map"
          title="District map (M)"
          onClick={openMap}
        >
          <MapPin size={17} />
          <span>Full map</span>
          <kbd>M</kbd>
        </button>
        <button
          disabled={!ready}
          aria-label="Change camera"
          title="Change camera (C)"
          onClick={() => engine.current?.camera()}
        >
          <Camera size={19} />
          <span className="mobile-action-label">Camera</span>
        </button>
        <button
          disabled={!ready}
          aria-label="Recover to road"
          title="Recover to road (R)"
          onClick={() => engine.current?.recover()}
        >
          <RotateCcw size={19} />
          <span className="mobile-action-label">Back to road</span>
        </button>
        <button
          disabled={!ready}
          aria-label={paused ? 'Resume game' : 'Pause game'}
          onClick={() => setPaused(engine.current?.pause() ?? false)}
        >
          {paused ? <Play size={19} /> : <Pause size={19} />}
          <span className="mobile-action-label">
            {paused ? 'Resume' : 'Pause'}
          </span>
        </button>
      </section>
      {notice && <output className="drive-notice">{notice}</output>}
      {paused && !mapOpen && (
        <div className="drive-paused">
          <h2>Taking a breather.</h2>
          <button onClick={() => setPaused(engine.current?.pause() ?? false)}>
            Back to the road
          </button>
        </div>
      )}
      <div className="drive-navigation">
        <svg viewBox="0 0 200 200" aria-label="Nearby streets">
          <defs>
            <pattern
              id="nav-grid"
              width="25"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 25 0 L 0 0 0 25"
                fill="none"
                stroke="#ffffff0a"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="#183d36" />
          <rect width="200" height="200" fill="url(#nav-grid)" />
          {hud?.roads.map((r, i) => (
            <polyline
              key={i}
              points={r
                .map(
                  (p) =>
                    `${100 + (p[0] - hud.position[0]) * 0.16},${100 + (p[1] - hud.position[1]) * 0.16}`,
                )
                .join(' ')}
              fill="none"
              stroke="#738e79"
              strokeWidth="2"
            />
          ))}
          <polyline
            points={mapPath}
            fill="none"
            stroke="#edc278"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {hud?.mapPlayers.map((player) => {
            const x = 100 + (player.position[0] - hud.position[0]) * 0.16;
            const y = 100 + (player.position[1] - hud.position[1]) * 0.16;
            if (x < 5 || x > 195 || y < 5 || y > 195) return null;
            return <g key={player.id} data-player-id={player.id}>
              <title>{player.name} · {player.vehicle ?? 'On foot'}</title>
              <circle cx={x} cy={y} r="4.5" fill="#b898ff" stroke="#fff" strokeWidth="1.5" />
            </g>;
          })}
          <circle cx="100" cy="100" r="12" fill="#ffffff15" />
          <path
            d="M100 91 L106 107 L100 104 L94 107Z"
            fill="#f8f3d9"
            transform={`rotate(${180 - ((hud?.heading || 0) * 180) / Math.PI},100,100)`}
          />
          <text x="180" y="20" fill="#adc4b6" fontSize="10">
            N
          </text>
        </svg>
        <span>{hud?.road || 'Loading real roads…'}</span>
      </div>
      <div className="drive-speed">
        <strong>{hud?.speed || 0}</strong>
        <span>KM/H</span>
        <small>
          {hud?.mode === 'walk'
            ? 'ON FOOT · SHIFT TO RUN'
            : hud?.offroad
              ? 'OFF ROAD · SLOW DOWN'
              : 'FREE ROAM'}
        </small>
      </div>
      <div className="drive-touch">
        <DriveJoystick
          disabled={!ready || paused || mapOpen || mobileMenu}
          onMove={(x, y) => engine.current?.joystick(x, y)}
        />
      </div>
      <div className="drive-bottom-stack">
        {ready && (
          <button
            className="drive-enter"
            disabled={!hud?.canEnter}
            onClick={() => engine.current?.enterExit()}
          >
            <b>F</b>{' '}
            {hud?.mode === 'drive'
              ? hud.canEnter
                ? 'Exit vehicle'
                : 'Stop to exit'
              : hud?.canEnter
                ? `Enter ${hud.vehicle}`
                : 'Walk to a vehicle'}
          </button>
        )}
        {area.point && streamStatus !== 'ready' && (
          <output
            className="area-coverage"
            data-state={streamStatus}
            aria-live="polite"
          >
            {streamStatus === 'loading'
              ? 'Loading roads ahead…'
              : streamStatus === 'retrying'
                ? 'Map unavailable · retrying automatically'
                : 'Live map · loads ahead as you travel'}
          </output>
        )}
        <div className="drive-help">
          <span>
            <b>W A S D</b> move
          </span>
          <span>
            <b>SPACE</b> brake
          </span>
          <span>
            <b>M</b> map / <b>C</b> camera
          </span>
          <span>
            <b>F</b> enter / exit
          </span>
        </div>
      </div>
      <div className="drive-source">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          Roads © OpenStreetMap
        </a>
        {' · '}
        <a
          href={
            area.point
              ? 'https://www.openstreetmap.org/copyright'
              : '/maps/terrain/credits.txt'
          }
          target="_blank"
          rel="noreferrer"
        >
          {area.point
            ? 'Simplified flat terrain'
            : 'Terrain: Mapzen / USGS / NOAA'}
        </a>
        {area.point
          ? ' · Mapped buildings; facade details estimated'
          : ' · Generated scenery'}
      </div>
      {mapOpen && mapData && (
        <WorldMap
          data={mapData}
          players={hud?.mapPlayers ?? []}
          liveStatus={hud?.liveStatus ?? 'connecting'}
          onExplore={onExplore}
          position={hud?.position || [0, 0]}
          path={hud?.path || []}
          onClose={closeMap}
          onTravel={(index) => {
            setTown(index);
            engine.current?.travel(index);
            closeMap();
          }}
        />
      )}
      {!ready && (
        <div className="drive-loading">
          <Globe2 size={40} />
          <h2>
            {error ? 'Couldn’t start the world' : 'Your world is almost ready.'}
          </h2>
          <p>
            {error ||
              (area.point
                ? 'Downloading nearby roads and buildings… Trying available map services; this can take up to a minute.'
                : 'Loading Alappuzha’s real streets and your driving world…')}
          </p>
          {error && <button onClick={onRetry}>Retry this location</button>}
          <button onClick={onChangeArea}>
            {error ? 'Choose a location and retry' : 'Cancel loading'}
          </button>
        </div>
      )}
    </main>
  );
}
