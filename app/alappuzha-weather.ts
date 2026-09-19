export type Weather = {
  temperature: number;
  precipitation: number;
  cloud: number;
  wind: number;
  code: number;
  observedAt: number;
  fetchedAt: number;
};
export function parseWeather(
  data: { current?: Record<string, unknown> },
  now = Date.now(),
): Weather {
  const c = data.current;
  if (
    !c ||
    ![
      'temperature_2m',
      'precipitation',
      'cloud_cover',
      'wind_speed_10m',
      'weather_code',
      'time',
    ].every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]))
  )
    throw Error('Incomplete weather data');
  const observedAt = Number(c.time) * 1000;
  if (Math.abs(now - observedAt) > 90 * 60_000)
    throw Error('Weather reading is out of date');
  return {
    temperature: Number(c.temperature_2m),
    precipitation: Math.max(0, Number(c.precipitation)),
    cloud: Math.min(1, Math.max(0, Number(c.cloud_cover) / 100)),
    wind: Math.max(0, Number(c.wind_speed_10m)),
    code: Number(c.weather_code),
    observedAt,
    fetchedAt: now,
  };
}
export function rainAmount(w: Weather | null) {
  if (!w || Date.now() - w.observedAt > 90 * 60_000) return 0;
  const rainy = [
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
  ].includes(w.code);
  return rainy || w.precipitation > 0
    ? Math.min(1, Math.max(0.15, w.precipitation / 5))
    : 0;
}
export function weatherLabel(w: Weather) {
  return w.code >= 95
    ? 'Thunderstorms'
    : rainAmount(w) > 0
      ? 'Rain'
      : [45, 48].includes(w.code)
        ? 'Fog'
        : w.cloud > 0.75
          ? 'Overcast'
          : w.cloud > 0.25
            ? 'Partly cloudy'
            : 'Clear';
}
// NOAA fractional-year approximation. World axes: east +X, south +Z.
export function solarPosition(
  date: Date,
  latitude = 9.4981,
  longitude = 76.3388,
) {
  const day =
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000;
  const hour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (Math.floor(day) + (hour - 12) / 24);
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const dec =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const ha = (((hour * 60 + 4 * longitude + eq) / 4 - 180) * Math.PI) / 180,
    lat = (latitude * Math.PI) / 180;
  const y =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return {
    x: -Math.cos(dec) * Math.sin(ha),
    y,
    z: -(
      Math.cos(lat) * Math.sin(dec) -
      Math.sin(lat) * Math.cos(dec) * Math.cos(ha)
    ),
    elevation: (Math.asin(y) * 180) / Math.PI,
  };
}
