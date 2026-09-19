# Live users

The active open-world scene uses Supabase project `qogewfdbxlcllcfjsykt`.
The project MCP endpoint is configured in `.mcp.json`; its OAuth login is for development tools, separate from the browser's publishable API key.

Set `VITE_SUPABASE_URL=https://qogewfdbxlcllcfjsykt.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and the deployment build environment. Never use a service-role/secret key. Restart the dev server or rebuild the deployment after changing these values. The old planet project's credentials are not accepted by the open-world scene.

Supabase Presence tracks connected guest sessions; Broadcast carries game position, heading, speed and vehicle type. Movement is not written to a database table. No table migration or Postgres replication is needed. Public Realtime channels must be enabled for this guest multiplayer mode. See [Presence](https://supabase.com/docs/guides/realtime/presence) and [Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

Each game instance has its own session ID. Nearby channels cover a .02-degree grid and adjacent cells, so players can meet even when they loaded different map origins. Only in-game coordinates are sent, not a separate device GPS feed. The counter reports connected sessions in the nearby subscribed cells (including you), not a global visitor count. NPCs are never counted. Avatars are rendered within 300 metres with a cap of 24; excess sessions remain represented by the nearby counter. Walking avatars carry umbrellas in rain; driving sessions render their vehicle.

These are anonymous, client-authoritative guest sessions, not authenticated user accounts. Names and position packets are untrusted and validated. Membership, stale packet rejection and bounded rendering protect normal client behaviour; this does not implement anti-cheat or exclusive vehicle ownership. Disconnects remove presence automatically, and the client clears stale avatars and reconnects after channel errors. Movement history is not stored. Separate [visitor analytics](visitor-analytics.md) saves entered names and basic visit activity for the protected owner overview.

Checks:

- `node scripts/verify-world-presence.mjs`: deterministic two-client transport/lifecycle tests.
- `node scripts/verify-world-realtime-live.mjs`: actual project connection with two ephemeral guest test sessions, vehicle update and disconnect cleanup.
- `node scripts/verify-world-realtime-browser.mjs`: real Supabase guest avatar, motion, vehicle and disconnect rendering in Chrome.
- `npx tsc --noEmit --incremental false`: types.

To authenticate development tools, run `claude /mcp`, select Supabase, then Authenticate. The installed Supabase plugin already supplies agent guidance; installing another optional skill package is not required for the runtime connection.
