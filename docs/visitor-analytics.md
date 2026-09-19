# Visitor analytics

The active app records visits in Supabase project `qogewfdbxlcllcfjsykt` through the deployed `world-visits` Edge Function. The welcome screen starts a visit; submitting a name updates that same row. Entering an area records a world entry. Changing areas or retrying does not create a new visit; reloading the page does.

## Owner overview

Open `/admin` (locally, http://localhost:3002/admin). The generated password is stored in the ignored, owner-readable `.env.analytics.local` file under `WORLD_ANALYTICS_ADMIN_PASSWORD`. It is not a Supabase service key and is never bundled into the app. Enter it in the admin form. Refresh retrieves current totals; Lock clears the displayed data and password from React state. No admin password is saved by the application in browser storage.

The overview shows all-time visits, unique and returning browsers, online pages, world entries, visits in the last 24 hours and 7 days, average active play time, daily counts over the last 30 days (Asia/Kolkata), areas, devices, and the latest 100 visits. Daily/area/device breakdowns are computed in Postgres rather than estimated from the recent-visit list. Each selected area counts once per visit, up to 30 distinct areas. Worldwide custom starts are grouped as “Nearby world”; exact coordinates are not stored.

## Stored fields and meaning

- Random visit ID and random browser ID; browser ID persists in localStorage. Blocked storage falls back to a per-visit identity. These are estimates of browser visits, not verified people or accounts.
- Entered name (up to 24 characters), or null for visitors who leave before submitting it.
- Server-generated arrival, last-seen and optional exit timestamps; visibility and world-entry flags.
- Cumulative active play seconds: visible, loaded and unpaused world time. Menus, loading, background tabs and paused play do not count. Updates are sent every 30 seconds and on lifecycle changes. Unexpected disconnects may lose the last interval.
- Selected area labels, broad device type, language, browser time zone, and referrer hostname only. No URL query strings, raw IPs, exact GPS locations, movement history, or full user-agent strings are saved to visit records.

A page is “online” when visible, not explicitly ended, and last seen within 90 seconds. It is a recent activity estimate, distinct from multiplayer's nearby player count. Crashes become inactive automatically through this query. An exit timestamp is best-effort; `pagehide` uses a keepalive request. Page restoration resumes the session. Client sequence numbers stop delayed heartbeats from overwriting later state. Writes are idempotent by visit ID and require the session's random write token.

Records are retained until the project owner deletes them; no automatic retention schedule is configured. Names/activity are self-reported guest analytics and can be falsified by a determined client. This is usage reporting, not an audit of authenticated identities.

## Database and security

`supabase/migrations/20260919123334_world_visitor_analytics.sql` creates three tables in the unexposed `analytics_private` schema: visits, admin_access and rate_limits. All enable RLS and revoke browser-role permissions. There are deliberately no public RLS policies; only the server connection accesses these tables. The Supabase advisor therefore reports three informational “RLS Enabled No Policy” entries; this is intentional deny-by-default, not a missing visitor-read policy.

The Edge Function uses Supabase's injected database URL and parameterized SQL. It checks the project's public API key on every request. Guest POSTs can only start/update their own random session token; GET requires the admin password. Only a SHA-256 hash of the generated high-entropy admin password is stored. A short-lived salted hash of network address and minute supports request limits; raw addresses are never persisted. Rates are a basic abuse bound, not bot prevention. No service-role key is shipped to the frontend.

The function's `verify_jwt` setting is false because publishable keys are not JWTs; explicit API-key, session-token and admin-password checks are in the function body. Keep these checks when redeploying. Database collection and the Edge Function are live; the frontend changes still need the normal site deployment to affect a hosted site.

## Validation and maintenance

- `node scripts/verify-visitor-analytics.mjs` exercises actual persistence, session ownership, stale update rejection, private data and admin authentication.
- `node scripts/verify-visitor-analytics-browser.mjs` exercises welcome → name → world → repeat visit → protected admin on desktop/mobile. Requires the local preview on port 3002.
- Both tests create clearly named QA visits; IDs are recorded in `/tmp/world-analytics-test-ids.json` for precise cleanup through authenticated SQL after running.
- `npx tsc --noEmit --incremental false` checks app types. Deno function sources are deployed separately and excluded from the app's TS build.

To rotate the overview password, generate a new high-entropy value, replace its SHA-256 hash in `analytics_private.admin_access` using authenticated database access, and update the ignored local password file. No frontend rebuild is needed for password rotation.
