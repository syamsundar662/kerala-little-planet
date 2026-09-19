import { stops, type Point } from './alappuzha-map';

export function nearestLocationTown(point: Point) {
 const [lon, lat] = point;
 if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
 const radians = Math.PI / 180;
 let town = 0, km = Infinity;
 stops.forEach((stop, index) => {
  const [x, y] = stop.geo;
  const a = Math.sin((y - lat) * radians / 2) ** 2 + Math.cos(lat * radians) * Math.cos(y * radians) * Math.sin((x - lon) * radians / 2) ** 2;
  const distance = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (distance < km) { km = distance; town = index; }
 });
 return { town, km };
}
export function locationError(code: number) {
 if (code === 1) return 'Location permission was denied. Allow location in your browser’s site settings and try again, or choose a town below.';
 if (code === 3) return 'Finding your location took too long. Try again or choose a town below.';
 return 'Your location is unavailable. Check your device’s location services and try again, or choose a town below.';
}
