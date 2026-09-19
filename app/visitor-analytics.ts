import {
  getWorldAnalyticsConfig,
  isWorldMultiplayerConfigured,
} from './realtime';

function uuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function createVisitorAnalytics() {
  if (!isWorldMultiplayerConfigured()) return undefined;
  const config = getWorldAnalyticsConfig();
  let visitorId = uuid();
  try {
    const saved = localStorage.getItem('open-world-visitor-id');
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) visitorId = saved;
    else localStorage.setItem('open-world-visitor-id', visitorId);
  } catch {
    /* Per-visit identity when storage is unavailable. */
  }
  const id = uuid(),
    token = uuid();
  let name = '',
    area = '',
    enteredWorld = false,
    playing = false;
  let activeMs = 0,
    lastTick = performance.now(),
    visible = !document.hidden;
  let started = false,
    disposed = false,
    sequence = 0,
    warned = false;
  const metadata = {
    device: /iPad|Tablet/i.test(navigator.userAgent)
      ? 'tablet'
      : /Mobi|Android/i.test(navigator.userAgent)
        ? 'mobile'
        : 'desktop',
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: (() => {
      try {
        return new URL(document.referrer).origin;
      } catch {
        return '';
      }
    })(),
  };
  const accrue = () => {
    const now = performance.now();
    if (visible && playing)
      activeMs += Math.max(0, Math.min(now - lastTick, 35000));
    lastTick = now;
  };
  const send = (ending = false) => {
    accrue();
    const body = {
      id,
      visitorId,
      token,
      sequence: sequence++,
      ...metadata,
      name,
      area,
      enteredWorld,
      activeSeconds: Math.floor(activeMs / 1000),
      visible: !ending && visible,
      action: ending ? 'end' : started ? 'update' : 'start',
    };
    void fetch(`${config.url}/functions/v1/world-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.key! },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then((response) => {
        if (response.ok) started = true;
        else {
          if (response.status === 404) started = false;
          throw Error('Visit was not saved');
        }
      })
      .catch(() => {
        if (!warned) {
          warned = true;
          console.warn(
            'Visitor analytics could not sync; it will retry while this page is open.',
          );
        }
      });
  };
  const visibility = () => {
    accrue();
    visible = !document.hidden;
    send();
  };
  const hide = () => send(true);
  const show = () => {
    visible = !document.hidden;
    lastTick = performance.now();
    send();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  const timer = setInterval(() => {
    if (!document.hidden) send();
  }, 30000);
  send();
  return {
    identify(value: string) {
      name = value;
      send();
    },
    enterArea(value: string) {
      area = value;
      enteredWorld = true;
      send();
    },
    setPlaying(value: boolean) {
      accrue();
      playing = value;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      send(true);
    },
  };
}
export type VisitorAnalytics = ReturnType<typeof createVisitorAnalytics>;
