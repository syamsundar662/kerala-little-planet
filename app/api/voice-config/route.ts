// Optional coturn-compatible shared-secret relay. The shared secret stays server-side.
export async function GET() {
  const urls = (process.env.VOICE_TURN_URLS || '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => /^turns?:/.test(v));
  const secret = process.env.VOICE_TURN_SECRET;
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (urls.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${crypto.randomUUID()}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username)),
    );
    const credential = btoa(String.fromCharCode(...signature));
    iceServers.push({ urls, username, credential });
  }
  return Response.json(
    { iceServers, relay: iceServers.length > 1 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
