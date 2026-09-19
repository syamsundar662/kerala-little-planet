import postgres from 'npm:postgres@3.4.7';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10 });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-admin-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, '0')).join('');
const equal = (a: string, b: string) => { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
  try {
    // Explicit API-key authentication allows current publishable keys, which are not JWTs.
    const keys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'));
    keys.push(Deno.env.get('SUPABASE_ANON_KEY') || '');
    const supplied = req.headers.get('apikey') || '';
    if (!supplied || !keys.some(k => typeof k === 'string' && k && equal(k, supplied))) return json({ error: 'Invalid API key' }, 401);
    const [admin] = await sql`select password_hash from analytics_private.admin_access where id = true`;
    if (!admin) return json({ error: 'Analytics is not configured' }, 503);
    const minute = Math.floor(Date.now() / 60000);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const bucket = await hash(`${admin.password_hash}:${ip}:${minute}:${req.method}`);
    const [rate] = await sql`insert into analytics_private.rate_limits (bucket, expires_at) values (${bucket}, now() + interval '2 minutes') on conflict (bucket) do update set count = analytics_private.rate_limits.count + 1 returning count`;
    await sql`delete from analytics_private.rate_limits where expires_at < now()`;
    if (rate.count > (req.method === 'GET' ? 20 : 240)) return json({ error: 'Too many requests. Try again shortly.' }, 429);
    if (req.method === 'GET') {
      const password = req.headers.get('x-admin-key') || '';
      if (!password || !equal(await hash(password), admin.password_hash)) return json({ error: 'Incorrect admin password' }, 401);
      const [totals] = await sql`
        select count(*)::int as visits, count(distinct visitor_id)::int as visitors,
        count(*) filter (where entered_world)::int as world_entries,
        count(*) filter (where started_at > now() - interval '24 hours')::int as last_24h,
        count(*) filter (where started_at > now() - interval '7 days')::int as last_7d,
        count(*) filter (where ended_at is null and visible and last_seen_at > now() - interval '90 seconds')::int as online,
        coalesce(round(avg(active_seconds)), 0)::int as avg_active_seconds,
        (select count(*)::int from (select visitor_id from analytics_private.visits group by visitor_id having count(*) > 1) r) as returning_visitors
        from analytics_private.visits`;
      const byDay = await sql`select to_char(started_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as label, count(*)::int as count from analytics_private.visits where started_at >= now() - interval '30 days' group by 1 order by 1`;
      const byArea = await sql`select area as label, count(*)::int as count from analytics_private.visits cross join lateral unnest(areas) area group by area order by count desc limit 20`;
      const byDevice = await sql`select device as label, count(*)::int as count from analytics_private.visits group by device order by count desc`;
      const recent = await sql`select id, name, started_at, last_seen_at, ended_at, active_seconds, entered_world, areas, device, language, timezone, referrer_host, (ended_at is null and visible and last_seen_at > now() - interval '90 seconds') as online from analytics_private.visits order by started_at desc limit 100`;
      return json({ ok: true, totals, byDay, byArea, byDevice, recent });
    }
    if (Number(req.headers.get('content-length') || 0) > 4096) return json({ error: 'Payload too large' }, 413);
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'Payload too large' }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!data || !uuid(data.id) || !uuid(data.visitorId) || !uuid(data.token)) return json({ error: 'Invalid session' }, 400);
    if (!Number.isSafeInteger(data.sequence) || data.sequence < 0 || data.sequence > 2147483647) return json({ error: 'Invalid sequence' }, 400);
    if (!['start', 'update', 'end'].includes(data.action)) return json({ error: 'Invalid action' }, 400);
    const tokenHash = await hash(data.token);
    const name = clean(data.name, 24) || null;
    const area = clean(data.area, 80);
    const active = Number.isFinite(data.activeSeconds) ? Math.max(0, Math.min(86400 * 7, Math.floor(data.activeSeconds))) : 0;
    const visible = data.visible === true;
    const device = ['mobile', 'tablet', 'desktop'].includes(data.device) ? data.device : 'desktop';
    let referrer = '';
    try { referrer = new URL(data.referrer).hostname.slice(0, 253); } catch { /* Direct visit */ }
    if (data.action === 'start') {
      await sql`insert into analytics_private.visits (id, visitor_id, token_hash, name, device, language, timezone, referrer_host, visible) values (${data.id}, ${data.visitorId}, ${tokenHash}, ${name}, ${device}, ${clean(data.language, 35)}, ${clean(data.timezone, 80)}, ${referrer}, ${visible}) on conflict (id) do nothing`;
    }
    const rows = await sql`update analytics_private.visits set
      sequence = ${data.sequence}, name = coalesce(${name}, name), last_seen_at = now(),
      ended_at = case when ${data.action === 'end'} then now() else null end,
      visible = ${visible}, entered_world = entered_world or ${data.enteredWorld === true},
      active_seconds = greatest(active_seconds, least(${active}, greatest(0, floor(extract(epoch from now() - started_at)))::int)),
      areas = case when ${area} <> '' and not ${area} = any(areas) and cardinality(areas) < 30 then array_append(areas, ${area}) else areas end
      where id = ${data.id} and visitor_id = ${data.visitorId} and token_hash = ${tokenHash} and sequence < ${data.sequence} returning id`;
    if (!rows.length) {
      const existing = await sql`select id from analytics_private.visits where id = ${data.id} and visitor_id = ${data.visitorId} and token_hash = ${tokenHash}`;
      if (!existing.length) return json({ error: 'Session not found' }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    console.error('Visitor analytics failed:', error instanceof Error ? error.name : 'Unknown error');
    return json({ error: 'Analytics temporarily unavailable' }, 503);
  }
});
