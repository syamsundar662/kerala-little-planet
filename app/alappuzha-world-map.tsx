'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Minus, LocateFixed } from 'lucide-react';
import type { MapPlayer } from './world-map-players';
import type { LiveStatus } from './world-presence';
import CurrentLocation, { type UserLocation } from './current-location';
import { type MapData, type Point, mapProjection, stops as defaultStops } from './alappuzha-map';
export default function WorldMap({
  data,
  players,
  liveStatus,
  position,
  path,
  onClose,
  onTravel,
  onExplore,
}: {
  data: MapData;
  players: MapPlayer[];
  liveStatus: LiveStatus;
  position: Point;
  path: Point[];
  onClose: () => void;
  onTravel: (town: number) => void;
  onExplore: (point:Point) => void;
}) {
  const project = useMemo(()=>mapProjection(data),[data]);
  const stops = data.stops ?? defaultStops;
  const bounds=data.viewBounds;
  const mapWidth = bounds ? bounds[2]-bounds[0] : data.origin ? (data.radiusKm ?? 1.2)*2 : 56;
  const mapHeight = bounds ? bounds[3]-bounds[1] : data.origin ? (data.radiusKm ?? 1.2)*2 : 94;
  const centerX = bounds ? (bounds[0]+bounds[2])/2 : data.origin ? 0 : 20;
  const centerZ = bounds ? (bounds[1]+bounds[3])/2 : 0;
  const playerCanvas = useRef<HTMLCanvasElement>(null);
  const pathKey = JSON.stringify(path);
  const stablePath: Point[] = useMemo(() => JSON.parse(pathKey), [pathKey]);
  const [positionX, positionZ] = position;
  const canvas = useRef<HTMLCanvasElement>(null),
    drag = useRef<Point | null>(null);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<Point>([0, 0]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const draw = () => {
      const { width: w, height: h } = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 2);
      el.width = w * dpr;
      el.height = h * dpr;
      const c = el.getContext('2d')!;
      c.scale(dpr, dpr);
      const scale = Math.min((w - 55) / mapWidth, (h - 60) / mapHeight) * zoom;
      const screen = (p: Point): Point => [
        (p[0] - centerX) * scale + w / 2 + pan[0],
        (p[1] - centerZ) * scale + h / 2 + pan[1],
      ];
      c.fillStyle = '#d5e5df';
      c.fillRect(0, 0, w, h);
      const line = (p: Point[], color: string, width: number, fill = false) => {
        if (p.length < 2) return;
        c.beginPath();
        p.forEach((v, i) => {
          const [x, y] = screen(v);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.lineWidth = width;
        c.strokeStyle = color;
        if (fill) {
          c.fillStyle = color;
          c.fill();
        } else c.stroke();
      };
      const chains = data.boundary.map((p) => [...p]);
      while (chains.length) {
        const chain = chains.pop()!;
        let changed = true;
        while (changed) {
          changed = false;
          for (let i = 0; i < chains.length; i++) {
            const part = chains[i],
              end = chain.at(-1)!;
            const match = (p: Point) =>
              Math.hypot(p[0] - end[0], p[1] - end[1]) < 0.000001;
            if (match(part[0])) {
              chain.push(...part.slice(1));
              chains.splice(i, 1);
              changed = true;
              break;
            }
            if (match(part.at(-1)!)) {
              chain.push(...part.reverse().slice(1));
              chains.splice(i, 1);
              changed = true;
              break;
            }
          }
        }
        line(chain.map(project), '#edf0dd', 1, true);
        line(chain.map(project), '#a9bfa7', 1);
      }
      for (const water of data.water)
        line(water.points.map(project), '#aad0d1', 1, water.area);
      for (const building of data.buildings ?? []) line(building.points.map(project), '#c5bfab', 1, true);
      for (const r of data.roads) {
        const major = /motorway|trunk|primary|secondary|tertiary/.test(r.kind);
        if (!major && zoom < 2 && !data.origin) continue;
        line(
          r.points.map(project),
          major ? '#aaa991' : '#c6cbb5',
          major ? 1.4 : 0.6,
        );
      }
      if (stablePath.length)
        line(
          stablePath.map((p) => [p[0] / 1000, p[1] / 1000]),
          '#d78b3c',
          3,
        );
      for (const stop of stops) {
        const [x, y] = screen(project(stop.geo));
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fillStyle = '#325b43';
        c.fill();
        c.font = 'bold 11px Arial';
        c.textAlign = 'left';
        c.strokeStyle = '#edf0dd';
        c.lineWidth = 3;
        c.strokeText(stop.name, x + 8, y + 4);
        c.fillText(stop.name, x + 8, y + 4);
      }
      const [x, y] = screen([positionX / 1000, positionZ / 1000]);
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fillStyle = '#ce6544';
      c.fill();
      c.strokeStyle = '#fff9df';
      c.lineWidth = 3;
      c.stroke();
      c.font = 'bold 10px Arial';
      c.fillStyle = '#a34830';
      c.fillText('IN GAME', x + 11, y - 8);
      if (userLocation) {
        const [gx, gy] = screen(project(userLocation.point));
        c.beginPath(); c.arc(gx, gy, Math.max(10, Math.min(150, userLocation.accuracy / 1000 * scale)), 0, Math.PI * 2);
        c.fillStyle = '#287bd32b'; c.fill();
        c.beginPath(); c.arc(gx, gy, 7, 0, Math.PI * 2);
        c.fillStyle = '#176ccd'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
        c.font = 'bold 11px Arial'; c.fillStyle = '#144e8f';
        c.fillText('YOUR LOCATION', gx + 12, gy - 12);
      }
      c.fillStyle = '#537966';
      c.font = '10px Arial';
      c.fillText(50 / scale < 1 ? `${Math.round(50000 / scale)} m` : `${(50 / scale).toFixed(1)} km`, 18, h - 25);
      c.fillRect(18, h - 20, 50, 2);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    draw();
    return () => observer.disconnect();
  }, [data, positionX, positionZ, stablePath, zoom, pan, userLocation, project, stops, mapWidth, mapHeight, centerX, centerZ]);
  useEffect(() => {
    const el = playerCanvas.current;
    if (!el) return;
    const draw = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 2);
      el.width = w * dpr; el.height = h * dpr;
      const c = el.getContext('2d')!;
      c.scale(dpr, dpr);
      const scale = Math.min((w - 55) / mapWidth, (h - 60) / mapHeight) * zoom;
      for (const player of players) {
        const x = (player.position[0] / 1000 - centerX) * scale + w / 2 + pan[0];
        const y = (player.position[1] / 1000 - centerZ) * scale + h / 2 + pan[1];
        if (x < 0 || x > w || y < 0 || y > h) continue;
        c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2);
        c.fillStyle = '#7651b9'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        c.font = 'bold 11px Arial'; c.textAlign = x > w - 120 ? 'right' : 'left';
        const labelX = x + (x > w - 120 ? -10 : 10);
        const labelY = y < 20 ? y + 20 : y - 10;
        c.lineWidth = 3; c.strokeText(player.name, labelX, labelY);
        c.fillStyle = '#50357e'; c.fillText(player.name, labelX, labelY);
      }
    };
    const observer = new ResizeObserver(draw); observer.observe(el); draw();
    return () => observer.disconnect();
  }, [players, zoom, pan, mapWidth, mapHeight, centerX, centerZ]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const close = document.querySelector<HTMLButtonElement>('.world-map-close');
    close?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '.world-map-overlay button:not(:disabled)',
          ),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handle);
    return () => {
      window.removeEventListener('keydown', handle);
      prior?.focus();
    };
  }, [onClose]);
  return (
    <dialog
      open
      className="world-map-overlay"
      aria-modal="true"
      aria-label={data.origin ? "Nearby world map" : "Alappuzha district map"}
    >
      <div className="world-map-heading">
        <div>
          <small>YOUR OPEN WORLD</small>
          <h2>{data.title ?? 'Alappuzha district'}</h2>
        </div>
        <button
          className="world-map-close"
          onClick={onClose}
          aria-label="Close district map"
        >
          <X />
        </button>
      </div>
      <div className="world-map-content">
        <div className="world-map-canvas">
          <canvas
            ref={canvas}
            aria-label="Real district roads, water and your position"
            onPointerDown={(e) => {
              drag.current = [e.clientX, e.clientY];
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current[0],
                dy = e.clientY - drag.current[1];
              drag.current = [e.clientX, e.clientY];
              setPan((p) => [p[0] + dx, p[1] + dy]);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onWheel={(e) =>
              setZoom((z) =>
                Math.max(0.7, Math.min(20, z * (e.deltaY < 0 ? 1.15 : 0.87))),
              )
            }
          />
          <canvas ref={playerCanvas} aria-label="Live nearby players" data-player-count={players.length}
            style={{position:'absolute', inset:0, pointerEvents:'none'}} />
          <div className="world-map-zoom">
            <button
              aria-label="Zoom map in"
              onClick={() => setZoom((z) => Math.min(20, z * 1.5))}
            >
              <Plus />
            </button>
            <button
              aria-label="Zoom map out"
              onClick={() => setZoom((z) => Math.max(0.7, z / 1.5))}
            >
              <Minus />
            </button>
            <button
              aria-label="Fit district"
              onClick={() => {
                setZoom(1);
                setPan([0, 0]);
              }}
            >
              <LocateFixed />
            </button>
          </div>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors · {data.timestamp.slice(0, 10)}
          </a>
        </div>
        <aside>
          <section aria-label="Nearby players">
            <h3>Nearby players</h3>
            <p>{liveStatus === 'online' ? `${players.length + 1} online · including you` : liveStatus === 'unconfigured' ? 'Multiplayer unavailable' : liveStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p>
            {liveStatus === 'online' && players.length === 0 && <p>No other players nearby yet.</p>}
            {players.length > 0 && <ul>{players.map((player) => <li key={player.id} data-player-id={player.id}>{player.name} · {player.vehicle ?? 'On foot'}</li>)}</ul>}
          </section>

          <CurrentLocation onExplore={onExplore} onTravel={onTravel} onLocate={(location) => {
            if (!location) { setUserLocation(null); return false; }
            const [x, y] = project(location.point);
            // The fitted map covers this rectangle in projected kilometres.
            const visible = Math.abs(x - centerX) <= mapWidth/2 && Math.abs(y-centerZ) <= mapHeight/2;
            setUserLocation(visible ? location : null);
            if (visible && canvas.current) {
              const {width, height} = canvas.current.getBoundingClientRect();
              const scale = Math.min((width - 55) / mapWidth, (height - 60) / mapHeight) * 2;
              setZoom(2); setPan([-(x - centerX) * scale, -(y-centerZ) * scale]);
            }
            return visible;
          }} />
          <p>Nearby roads load automatically in your direction of travel.</p>
          <h3>Explore nearby</h3>
          <p>
            Select a town to travel there, or close the map and explore freely.
          </p>
          {stops.map((s, i) => (
            <button key={s.name} onClick={() => onTravel(i)}>
              {s.name}
              <span>Travel ↗</span>
            </button>
          ))}
          <small>
            Drag to pan · Scroll to zoom
            <br />
            Orange: you · Purple: live players · Blue: real location
            <br />M / Esc: back to the world
          </small>
        </aside>
      </div>
    </dialog>
  );
}
