# Little Kerala — Scaling to 300+ concurrent users (with audio)

Planning document · 11 September 2026. Proposed work, not yet implemented. The live site (minikerala.in, Cloudflare Worker `sites-project`) is currently in maintenance mode.

## Goal & targets

Support **300 concurrent visitors comfortably, design for ~1000**, with proximity voice, without melting mid-range phones. Concretely:

- **Rendering:** stable 30 FPS on a mid Android / 60 FPS desktop *regardless of how many people are online* — the client's cost must depend on *nearby* density, not total population.
- **Voice:** clear proximity audio for the ~8–12 people around you, even in a 300-person world; graceful when a crowd packs one spot.
- **Presence:** each client's network + CPU cost scales with local density (interest-managed), not O(n²).
- **Cost:** predictable; a firm monthly ceiling before we open the doors.

## Why the current build can't do it (baseline)

- **Voice** = P2P WebRTC full mesh, proximity-gated (`app/voice.ts`). Fine for small dispersed clusters; a crowd of 15–30 in one place opens that many peer connections per client → CPU/bandwidth blow-up. No SFU, no TURN.
- **Presence** = one Supabase Realtime channel, position broadcast at 5–10 Hz (`app/multiplayer.ts`). Fan-out is O(n²): 300 movers ≈ ~450k msgs/sec — far past any standard plan.
- **Rendering** = one skinned avatar per remote (`app/player-avatar.ts`), no cap/LOD/instancing. ~300 skinned meshes is unrenderable at frame rate.

## Architecture: three pillars + supporting work

### Pillar A — Voice via SFU (LiveKit) with selective subscription
Replace the mesh with a **Selective Forwarding Unit**. Each client publishes **one** mic track to the server; the server forwards. The client **subscribes only to the audio tracks of the ~10 nearest avatars** (interest management for audio), and applies the existing distance→gain curve locally. This is exactly how Gather/proximity-chat scales.
- **Recommended:** **LiveKit** (open-source SFU; managed *LiveKit Cloud* to start, self-hostable later on Fly/Railway/VM to cut cost). Alternatives: Daily, Agora (managed, pricier), mediasoup (more DIY).
- **Token auth:** LiveKit needs a signed JWT per join. We already deploy a Cloudflare Worker — add a `/voice-token` route that mints a room token from the API secret (secret stored as a Worker secret, never in the client bundle).
- **TURN:** required for reliability behind strict NAT (LiveKit Cloud includes it; self-host needs coturn).
- **`app/voice.ts` becomes a thin LiveKit client**: publish mic, dynamically subscribe/unsubscribe by proximity, set per-participant volume by distance, keep the same speaking-detection + `VoiceState` UI contract so `planet.ts`/`page.tsx` barely change.

### Pillar B — Presence via spatial sharding + interest management
Stop putting everyone on one channel.
- **Shard by district.** `app/districts.ts` already defines 14 districts **with a neighbour graph** — reuse it. Channel key `little-kerala:region:<districtId>`. A client subscribes to its **current district + immediate neighbours** only, and re-subscribes as it crosses boundaries (gateways already fire `onDistrict`).
- Each client therefore sees/syncs only the people in its local region → cost ∝ local density, not total. 300 spread across 14 districts ≈ ~20/region.
- **Snapshot interpolation** already exists in `multiplayer.ts` (keep it). Add a **hard cap**: sync at most the nearest ~30 avatars; ignore the rest.
- Optional later: move presence off Supabase to **PartyKit or Colyseus** (both Cloudflare-friendly, purpose-built for game rooms) if Supabase quotas/cost bite. Keep the wire format from `app/multiplayer-math.ts`.

### Pillar C — Avatar rendering scalability
Decouple frame cost from population.
- **Cap visible avatars** to the nearest N (~30). Beyond that: cheap billboard/impostor or hide.
- **LOD:** full skinned rig up close → simplified/static or 2D sprite far away. Skinned-mesh animation is the cost; only animate the nearest ~10–15.
- **Instance / pool** avatar bodies where possible; reuse the shared rig (`player-avatar.ts` already shares source geometry).
- Reuse the driving-view culling pattern we added in `planet.ts` (distance/hemisphere visibility) for avatars.

### Supporting work
- **Auth & abuse control (safety-critical, see risks):** per-user identity/token, server-side mute/kick, client **block/report + mute**, rate limits.
- **Observability:** live concurrent-user gauge, per-region counts, SFU/room stats, error rates. A `/health` + metrics.
- **Load-test harness:** headless bot swarm (Node `@supabase/supabase-js` + LiveKit server SDK fake publishers) to simulate 300–1000 and measure before launch — extends the existing `scripts/verify-multiplayer.mjs` fake-peer approach.
- **Graceful degradation:** if a region overflows, cap voice subscriptions, drop presence rate, and show "busy area" rather than crashing.

## Phased delivery

**Phase 0 — Instrument & measure (0.5–1 day).** Concurrent-user + per-region counters, a bot load-test harness, written FPS/bandwidth/cost budgets and named test devices. *Exit:* we can drive N synthetic users and read real numbers; today's true ceiling is documented.

**Phase 1 — Rendering scalability. ✅ DONE (12 Sep 2026).** Avatar cap + LOD + nearest-N animation implemented in `planet.ts`: only the nearest `AVATAR_ANIM_CAP=14` are fully animated, up to `AVATAR_RENDER_CAP=44` are drawn (throttled animation), the rest hidden. Avatars are excluded from the generic hemisphere cull (LOD owns their visibility). Dev/load-test hooks added: `?bots=N` spawns N synthetic walkers; `?bots`/`?autowalk=Name` auto-joins walk mode (skips the dialog). *Measured (headless draw-call profiler):* 10 avatars → 2,025 draws/frame, **250 avatars → 3,653** (bounded, ~1.8×, not the ~12,000+ an uncapped 250 would cost). Verify scripts + build green.
- *Follow-up (Pillar C stretch):* per-avatar draw cost is high (~40 draws each — CesiumMan/Michelle GLBs have many sub-meshes), so a dense crowd still sits near ~3.6k draws. Merging each avatar's sub-meshes and/or a 2D-impostor far tier, or lowering `AVATAR_RENDER_CAP` on weak devices, would cut this further. Not blocking.

**Phase 2 — Presence sharding. ✅ DONE (12 Sep 2026).** `multiplayer.ts` rewritten to a multi-channel client: position is published only to the player's current district channel (`little-kerala:region:<id>`), and it subscribes to that region + the two **longitude-adjacent** regions (spatial neighbours, not the road-connectivity graph — new `regionAt`/`regionChannels` in `districts.ts`). Remotes = union of presence across subscribed channels, rebuilt on every sync (region hops don't flicker). Smooth re-shard hand-off (untrack old region / track new) driven from `send()`. Voice signalling moved to its own low-traffic global channel (`little-kerala:voice:v1`) so it survives sharding. Per-client cost now scales with local density, not total population. *Verified:* new pure assertions in `verify-multiplayer.mjs` (interest management is symmetric, two regions share a channel iff within 2 ring-steps, `regionAt` seam-safe); live single-client smoke test joined exactly its 3 region channels + voice channel with zero errors. tsc + build green.
- *Note:* server-side aggregate message count is lower than the old single channel but still grows with crowd size; if Supabase quotas/cost bite at 300, either shard finer or move presence to PartyKit/Colyseus (open decision #2). Client-side bottleneck is solved.

**Phase 3 — Voice SFU. ⛔ BLOCKED (needs decision, 12 Sep 2026).** Cannot ship a *working* SFU without a chosen provider + credentials (I can't create the account). Recommendation stands: **LiveKit Cloud** to launch (TURN included), then `/voice-token` Cloudflare Worker route + rewrite `voice.ts` as a LiveKit client with proximity-based selective subscription. The current `voice.ts` mesh already exposes the exact interface (proximity gain, speaking, block, push-to-talk) the LiveKit client will re-implement, so it's a clean drop-in once creds exist. *To unblock:* pick LiveKit Cloud vs self-hosted and provide the URL + API key/secret. *Exit (unchanged):* 300 synthetic + real clients; clear nearest-~10 audio; a 30-person huddle stable; strict-NAT via TURN.

**Phase 4 — Safety, auth, resilience (2–4 days). 🟡 STARTED (12 Sep 2026).** Done, provider-agnostic, on the current mesh: **mute-by-default + push-to-talk** (mic acquired but silent until you hold Space / the "Hold to talk" button — `voice.ts setTalking`, `planet.ts voiceTalk`, `page.tsx` PTT button + Space handler, verified enable→muted→talk→muted with a fake mic) and a per-user **block** mechanism (`voice.ts block/unblock/isBlocked`, `planet.ts voiceBlock` — blocked peers never connect / are torn down). Still to do: block/report **UI** (needs a roster panel), server-side **kick** + rate limits + identity tokens (need the SFU/backend), region-overflow degradation. *Exit (unchanged):* an abusive user can be muted/removed; open-mic-to-strangers risks have controls.

**Phase 5 — Load test, tune, launch (1–2 days).** Bot swarm to 300 then 1000; tune caps/rates/SFU sizing; capacity + cost sign-off; rollback plan. *Exit:* 300 concurrent sustained on named devices within budget; documented headroom to 1000.

Rough total: **~2–3 focused weeks.** Build on a branch; the live site stays on the current single-player-safe build until Phase 5 sign-off.

## Decisions to lock before Phase 3 (I need your call)

1. **SFU: managed vs self-hosted.** *Recommend:* LiveKit **Cloud** to launch (fastest, includes TURN), migrate to self-hosted if cost grows. Trade-off: managed = ~$ per audio-minute; self-host = a server to run + coturn.
2. **Presence backend:** stay on **Supabase (sharded)** — *recommend for now, least change* — or move to PartyKit/Colyseus for bigger headroom.
3. **Budget ceiling** for realtime infra (drives managed-vs-self-host and how hard we cache/shard).
4. **Moderation bar:** minors are on a public `.in` site with open proximity mic to strangers — how strict? (mute-by-default, name filtering, report/kick, age gate?) This shapes Phase 4 scope and is a launch blocker, not an add-on.

## Cost sketch (order-of-magnitude, 300 concurrent, audio)

- **Managed SFU (LiveKit Cloud-style):** audio-only is cheap per minute, but 300 concurrent × session hours adds up — budget on the order of **low-hundreds of $/month** at steady 300, scaling with usage. Self-hosted LiveKit + coturn on a small VM can cut this to a fixed **~$20–80/mo** at the cost of ops.
- **Presence:** Supabase Pro tier (or PartyKit usage) — **tens of $/month** with sharding.
- **Cloudflare Worker + assets:** negligible at this scale.
Firm numbers come after Phase 0 load tests + a chosen SFU.

## Key risks

- **Mobile CPU/bandwidth** is the real ceiling, not the server — hence Pillars A (one uplink) + C (LOD) matter most.
- **Moderation/safety** of open stranger voice at scale — must be designed in Phase 4, not bolted on.
- **Cost runaway** if voice minutes aren't watched — needs the observability gauge + caps.
- **Boundary correctness** in sharded presence (double-sync or gaps at district edges) — covered by Phase 2 exit tests.

## What stays the same

The walk-mode UX, join dialog, avatars, name labels, speaking indicators, `VoiceState` UI contract, and the wire format in `multiplayer-math.ts` are preserved. Users won't see the plumbing change — they'll just see it not fall over at 300.
