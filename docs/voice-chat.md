# Nearby voice chat

The active open world now uses WebRTC audio, with signalling carried by the same nearby Supabase Broadcast rooms as live players. Both players must choose **Join voice** and permit microphone access. Joining starts with the microphone muted. Click **Mic muted** to enable the microphone, or hold **V** / the touch **Hold to talk** button to speak temporarily. The Space key remains the vehicle brake.

Voice connects up to six nearby players within 55 metres, both walking and driving. Volume is full within 8 metres and fades with distance. Leaving range, leaving the world, disabling voice, or losing the peer closes its connection. A periodic ready announcement handles late joins and reconnects. “People in voice” lists connected names, speaking indicators, and individual local mute buttons. Leaving voice stops microphone tracks and closes the audio context. No voice is recorded or stored in the visitor database.

Pausing, opening the map or game menu, losing window focus, or moving to a background tab mutes the microphone. It does not automatically reopen on return; unmute explicitly. Pointer cancellation and lost capture release push-to-talk. If a permission request is cancelled, a microphone stream granted later is immediately stopped. Browser permission failures and blocked playback have explicit recovery controls.

## Connectivity

Microphone capture requires HTTPS or localhost. HTTP LAN previews cannot request a microphone. Browser APIs and permission behavior are documented in [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia); media connections use [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection). Signalling uses [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

Default connections use a public STUN server and direct WebRTC. This works on compatible networks, but is not a guarantee of voice connectivity on every mobile, corporate, or restrictive NAT network. Configure a TURN relay for that coverage. No relay account or relay credentials were supplied when this implementation was added.

For a coturn-compatible shared-secret relay, set **server-side** environment values:

- `VOICE_TURN_URLS`: comma-separated `turn:` / `turns:` endpoints.
- `VOICE_TURN_SECRET`: the relay's shared authentication secret.

`GET /api/voice-config` issues per-join credentials expiring in one hour with HMAC-SHA1 (coturn REST authentication). The shared secret never enters the browser bundle. The endpoint also supplies the default STUN configuration. Deploy/restart the app after setting these variables. The relay operator should apply bandwidth and allocation quotas; this guest application exposes credential issuance to site visitors. Rejoin voice for fresh credentials after a long session if a new connection fails.

This is a bounded peer-to-peer guest mesh, not a global conference or authenticated identity service. Names and positions are self-reported. Signals are checked for known nearby membership, destination, payload bounds and call IDs, but guest signalling is not identity-authenticated. Audio travels through WebRTC, not through Supabase or the analytics database.

## Verification

`node scripts/verify-world-voice-browser.mjs` runs two Chrome sessions against the actual Supabase backend with fake microphone input. It checks actual received audio energy, mute-by-default, microphone toggle, push-to-talk, individual mute, distance disconnect/reconnect, permission denial and microphone release. It requires a local server on port 3002 and generates its own PCM test file at `/tmp/world-voice-test.wav`; no real microphone is used. Test visit IDs are saved in `/tmp/world-voice-test-visits.json` for cleanup.
