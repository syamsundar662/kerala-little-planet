'use client';
import { useState } from 'react';
import { getSupabase, isMultiplayerConfigured } from '../realtime';

type Stats = {
  totals: { joins: number; uniquePlayers: number; uniqueNames: number; last24h: number; last7d: number };
  byCountry: [string, number][];
  byDay: [string, number][];
  recent: Array<{
    id: string; name: string | null; gender: number | null; country: string | null;
    country_code: string | null; region: string | null; city: string | null;
    org: string | null; language: string | null; referrer: string | null; created_at: string;
  }>;
};

const box: React.CSSProperties = { border: '1px solid #2a2f3a', borderRadius: 12, padding: 16, background: '#12151c' };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', color: '#8b93a7', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #2a2f3a', position: 'sticky', top: 0, background: '#12151c' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #1c202a', fontSize: 13, whiteSpace: 'nowrap' };

export default function Admin() {
  const [key, setKey] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setErr(''); setLoading(true);
    try {
      if (!isMultiplayerConfigured()) { setErr('Supabase env vars are not configured for this build.'); return; }
      const { data, error } = await getSupabase().functions.invoke('visits', { method: 'GET', headers: { 'x-admin-key': key } });
      if (error) { setErr('Wrong password or request failed.'); return; }
      if (!data?.ok) { setErr(data?.error ?? 'Request failed.'); return; }
      setStats(data as Stats);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally { setLoading(false); }
  };

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  const place = (r: Stats['recent'][number]) => [r.city, r.region, r.country].filter(Boolean).join(', ') || '—';

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d12', color: '#e6e9f0', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.3 }}>Little Kerala · Usage</h1>
          <span style={{ color: '#8b93a7', fontSize: 13 }}>Who walked in, from where, and how many.</span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin password"
            style={{ flex: '1 1 240px', padding: '10px 12px', borderRadius: 10, border: '1px solid #2a2f3a', background: '#12151c', color: '#e6e9f0', fontSize: 14 }}
          />
          <button type="submit" disabled={loading || !key} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #3355ff', background: loading ? '#1c2333' : '#2340e6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Loading…' : stats ? 'Refresh' : 'View data'}
          </button>
        </form>
        {err && <div style={{ ...box, borderColor: '#5a2330', background: '#1c1214', color: '#ff9aa8' }}>{err}</div>}

        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {[
                ['Total joins', stats.totals.joins],
                ['Unique visitors', stats.totals.uniquePlayers],
                ['Unique names', stats.totals.uniqueNames],
                ['Last 24 hours', stats.totals.last24h],
                ['Last 7 days', stats.totals.last7d],
              ].map(([label, val]) => (
                <div key={String(label)} style={box}>
                  <div style={{ fontSize: 12, color: '#8b93a7', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{val as number}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div style={box}>
                <h2 style={{ margin: '0 0 10px', fontSize: 14, color: '#c7cddb' }}>By country</h2>
                {stats.byCountry.length === 0 ? <p style={{ color: '#8b93a7' }}>No data yet.</p> : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {stats.byCountry.map(([c, n]) => (
                      <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{c}</span><span style={{ color: '#8b93a7' }}>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={box}>
                <h2 style={{ margin: '0 0 10px', fontSize: 14, color: '#c7cddb' }}>By day</h2>
                {stats.byDay.length === 0 ? <p style={{ color: '#8b93a7' }}>No data yet.</p> : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {stats.byDay.map(([d, n]) => (
                      <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{d}</span><span style={{ color: '#8b93a7' }}>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...box, padding: 0, overflow: 'hidden' }}>
              <h2 style={{ margin: 0, padding: '14px 16px', fontSize: 14, color: '#c7cddb', borderBottom: '1px solid #2a2f3a' }}>
                Recent visitors ({stats.recent.length})
              </h2>
              <div style={{ maxHeight: 460, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={th}>When</th><th style={th}>Name</th><th style={th}>Character</th><th style={th}>From</th><th style={th}>Network</th><th style={th}>Lang</th></tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((r) => (
                      <tr key={r.id}>
                        <td style={td}>{fmt(r.created_at)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.name || '—'}</td>
                        <td style={td}>{r.gender === 1 ? '👧 Girl' : r.gender === 0 ? '👦 Boy' : '—'}</td>
                        <td style={td}>{place(r)}{r.country_code ? ` (${r.country_code})` : ''}</td>
                        <td style={{ ...td, color: '#8b93a7' }}>{r.org || '—'}</td>
                        <td style={{ ...td, color: '#8b93a7' }}>{r.language || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
