'use client';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { stops, type Point } from './alappuzha-map';
import { nearestLocationTown, locationError } from './location-utils';

export type UserLocation = { point: Point; accuracy: number };
export default function CurrentLocation({ onLocate, onTravel, onExplore }: {
  onLocate: (location: UserLocation | null) => boolean;
  onTravel: (town: number) => void;
  onExplore?: (point: Point) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ location: UserLocation; town: number; km: number; visible: boolean } | null>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { request.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const locate = () => {
    if (busy.current) return;
    setError(''); setResult(null); onLocate(null);
    if (!window.isSecureContext) { setError('Location needs a secure connection. Open this site with HTTPS, or use localhost.'); return; }
    if (!navigator.geolocation) { setError('This browser does not support location. Choose a town below instead.'); return; }
    const id = ++request.current;
    busy.current = true; setPending(true);
    const finish = () => {
      if (request.current !== id) return false;
      request.current++; busy.current = false; setPending(false);
      if (timer.current) clearTimeout(timer.current);
      return true;
    };
    const fail = (code: number) => { if (finish()) setError(locationError(code)); };
    // Also bounds a permission prompt left unanswered; late callbacks are ignored.
    timer.current = setTimeout(() => fail(3), 25000);
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (!finish()) return;
        const point: Point = [coords.longitude, coords.latitude];
        const nearest = nearestLocationTown(point);
        if (!nearest || !Number.isFinite(coords.accuracy) || coords.accuracy < 0) {
          setError('Your location could not be read. Try again or choose a town.'); return;
        }
        const location = { point, accuracy: coords.accuracy };
        setResult({ location, ...nearest, visible: onLocate(location) });
      }, e => fail(e.code), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch { fail(2); }
  };
  return <section className="current-location" aria-label="Current real-world location">
    <button type="button" onClick={locate} disabled={pending} aria-busy={pending}>
      <LocateFixed size={17} />{pending ? 'Finding your location…' : 'Use my location'}
    </button>
    <small>{onExplore ? 'Location stays in this session. Exploring sends the nearby area to map and weather services.' : 'One-time location request. Not stored or shared by this app.'}</small>
    <output aria-live="polite">
      {pending && 'Allow location access in your browser to continue.'}
      {error}
      {result && <>
        <strong>{result.visible ? 'Your location is marked in blue.' : onExplore ? 'Location found. Load the nearby streets to explore here.' : 'You are outside this map’s view. Only Alappuzha is available to explore.'}</strong>
        {!onExplore && <span>Nearest mapped town: {stops[result.town].name} · {result.km < 1 ? `${Math.round(result.km * 1000)} m` : `${result.km.toFixed(1)} km`} away (straight-line).</span>}
        <span>Location accuracy: about {Math.round(result.location.accuracy)} m.{result.location.accuracy > 1000 ? ' This is an approximate location.' : ''}</span>
      </>}
    </output>
    {result && (onExplore ? <button type="button" onClick={() => onExplore(result.location.point)}>Explore around my location ↗</button> : <button type="button" onClick={() => onTravel(result.town)}>Travel in game to {stops[result.town].name} ↗</button>)}
  </section>;
}
