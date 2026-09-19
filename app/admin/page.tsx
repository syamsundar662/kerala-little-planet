'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  getWorldAnalyticsConfig,
  isWorldMultiplayerConfigured,
} from '../realtime';
import './visitors.css';

type Group = { label: string; count: number };
type Stats = {
  totals: {
    visits: number;
    visitors: number;
    world_entries: number;
    last_24h: number;
    last_7d: number;
    online: number;
    avg_active_seconds: number;
    returning_visitors: number;
  };
  byDay: Group[];
  byArea: Group[];
  byDevice: Group[];
  recent: {
    id: string;
    name: string | null;
    started_at: string;
    last_seen_at: string;
    ended_at: string | null;
    active_seconds: number;
    entered_world: boolean;
    areas: string[];
    device: string;
    language: string;
    timezone: string;
    referrer_host: string;
    online: boolean;
  }[];
};
const duration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
function Breakdown({ title, values }: { title: string; values: Group[] }) {
  const max = Math.max(1, ...values.map((v) => v.count));
  return (
    <section className="visits-panel">
      <h2>{title}</h2>
      {values.length ? (
        values.map((value) => (
          <div className="visits-bar" key={value.label}>
            <span>{value.label}</span>
            <strong>{value.count}</strong>
            <div style={{ width: `${(value.count / max) * 100}%` }} />
          </div>
        ))
      ) : (
        <p>No visits yet.</p>
      )}
    </section>
  );
}
export default function Admin() {
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState('');
  const load = async () => {
    setError('');
    setLoading(true);
    try {
      if (!isWorldMultiplayerConfigured())
        throw Error('Visitor analytics is not configured for this build.');
      const config = getWorldAnalyticsConfig();
      const response = await fetch(`${config.url}/functions/v1/world-visits`, {
        headers: { apikey: config.key!, 'x-admin-key': password },
        cache: 'no-store',
      });
      const data = (await response.json()) as Stats & {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok)
        throw Error(data.error || 'Could not load visits.');
      setStats(data);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : 'Could not load visits.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="visits-admin">
      <div className="visits-content">
        <header>
          <div>
            <Link href="/">← Back to world</Link>
            <h1>Visitor overview</h1>
            <p>Who visited, who returned, and how they explored.</p>
          </div>
          {stats && (
            <button
              onClick={() => {
                setStats(null);
                setPassword('');
                setUpdated('');
              }}
            >
              Lock overview
            </button>
          )}
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
          className="visits-login"
        >
          <label htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button disabled={loading || !password}>
            {loading
              ? 'Loading…'
              : stats
                ? 'Refresh overview'
                : 'View overview'}
          </button>
        </form>
        {error && (
          <p role="alert" className="visits-error">
            {error}
          </p>
        )}
        {stats && (
          <>
            <p className="visits-caption">
              Updated {updated}. Online means a visible page seen in the last 90
              seconds. Visits include the welcome screen.
            </p>
            <div className="visits-metrics">
              {[
                ['Total visits', stats.totals.visits],
                ['Unique browsers', stats.totals.visitors],
                ['Returning browsers', stats.totals.returning_visitors],
                ['Online now', stats.totals.online],
                ['Entered world', stats.totals.world_entries],
                ['Last 24 hours', stats.totals.last_24h],
                ['Last 7 days', stats.totals.last_7d],
                [
                  'Average active time',
                  duration(stats.totals.avg_active_seconds),
                ],
              ].map(([label, value]) => (
                <section className="visits-panel" key={label}>
                  <h2>{label}</h2>
                  <strong className="visits-number">{value}</strong>
                </section>
              ))}
            </div>
            <div className="visits-breakdowns">
              <Breakdown
                title="Daily visits · last 30 days (India time)"
                values={stats.byDay}
              />
              <Breakdown title="Areas explored" values={stats.byArea} />
              <Breakdown title="Devices" values={stats.byDevice} />
            </div>
            <section className="visits-panel">
              <h2>Recent visits · latest {stats.recent.length}</h2>
              <div className="visits-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        'Visitor',
                        'Arrived',
                        'Last seen',
                        'Status',
                        'Active time',
                        'Areas',
                        'Device',
                        'Language / time zone',
                        'Source',
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((visit) => (
                      <tr key={visit.id}>
                        <td>{visit.name || 'Name not entered'}</td>
                        <td>{new Date(visit.started_at).toLocaleString()}</td>
                        <td>{new Date(visit.last_seen_at).toLocaleString()}</td>
                        <td>
                          {visit.online
                            ? 'Online'
                            : visit.ended_at
                              ? 'Left'
                              : 'Inactive'}
                        </td>
                        <td>{duration(visit.active_seconds)}</td>
                        <td>
                          {visit.areas.join(', ') ||
                            (visit.entered_world
                              ? 'World'
                              : 'Welcome / area picker')}
                        </td>
                        <td>{visit.device}</td>
                        <td>
                          {visit.language || '—'} / {visit.timezone || '—'}
                        </td>
                        <td>{visit.referrer_host || 'Direct / unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!stats.recent.length && <p>No visits yet.</p>}
            </section>
            <p className="visits-caption">
              Names are self-entered. A saved browser ID estimates repeat
              visits; clearing storage or switching devices counts separately.
              Active time counts visible, unpaused play. Each area is counted
              once per visit; exact routes and GPS coordinates are not stored.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
