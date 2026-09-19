const providers = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const cooldown = new Map<string, number>();
export async function downloadMap(
  query: string,
  signal: AbortSignal,
): Promise<string> {
  let last = 'The map providers are temporarily unavailable.';
  for (const provider of providers) {
    signal.throwIfAborted();
    if ((cooldown.get(provider) ?? 0) > Date.now()) continue;
    try {
      const response = await fetch(provider, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'LittleKerala/1.0',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
      });
      if ([429, 406].includes(response.status)) {
        cooldown.set(
          provider,
          Date.now() +
            Math.max(
              30,
              Math.min(300, Number(response.headers.get('retry-after')) || 30),
            ) *
              1000,
        );
        last = 'The map providers are busy. Please retry in a minute.';
        continue;
      }
      if (!response.ok) {
        last =
          'The map provider could not complete the download. Please retry.';
        continue;
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error('Empty response');
      const decoder = new TextDecoder();
      let body = '',
        size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 24_000_000) {
            await reader.cancel();
            throw new RangeError(
              'This area is too dense to download. Choose a nearby location.',
            );
          }
          body += decoder.decode(next.value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
      body += decoder.decode();
      const payload = JSON.parse(body);
      if (!Array.isArray(payload.elements) || payload.remark) {
        last = 'The map provider returned incomplete data. Please retry.';
        continue;
      }
      return JSON.stringify(payload);
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof RangeError) throw error;
      last =
        'Could not reach the map providers. Check your connection and retry.';
    }
  }
  throw Error(last);
}
