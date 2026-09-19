# Lazy worldwide areas

The Kerala explorer adds a lightweight district outline map, searchable district/town list, and approximate town-centre starting points for all 14 districts. Choosing a district only changes the preview; clicking Explore starts the existing bounded world loader and directional streaming. This provides statewide starting locations without downloading statewide street geometry. Remote Kerala terrain remains simplified; hills and elevated bridges are not reconstructed. The separate detailed Alappuzha option remains available.

`node scripts/verify-kerala-explorer.mjs` checks all 14 selections, town search, no initial street/model downloads, mobile overflow, and northern/southern starts with mocked map responses. It does not validate live provider coverage across Kerala.

The home route starts with an area picker. No 3D engine, models, elevation, weather, or map requests start before the user selects an area. Users can request a one-time GPS location, enter latitude/longitude, or choose the existing Alappuzha dataset.

Worldwide selections lazy-import `world-area.ts`, request a bounded region about 2.4 km across from https://overpass.private.coffee/api/interpreter, and build a locally projected road graph. Longitude wrapping supports areas crossing the antimeridian. Three recently loaded datasets are cached in memory only. No location is saved to localStorage. Map and weather requests transmit the selected area to their respective providers.

Roads and closed building ways are converted to the renderer's format. Buildings use OSM height/level tags when present and an estimated height otherwise. Building relations, interiors, terrain elevations, and photorealistic facades are not reconstructed. Worldwide terrain is flat. Alappuzha retains its dedicated elevation and scenery.

The scene retains a 5×5 set of 500 m chunks near the player, disposes distant meshes, and builds up to two queued chunks per frame with a soft 5 ms scheduling budget. One dense chunk can exceed that budget. GPU resources are released when changing locations. Downloads abort on cancellation/unmount; late responses cannot mount an old world.

Worldwide areas now stream automatically during travel. `world-stream.ts` estimates travel direction from actual position changes, so walking, driving, reversing and turns all select the area ahead. It predicts 650–1,100 metres ahead (up to 30 seconds of travel), requests overlapping regions centred on a 1 km grid, and avoids downloads while stationary within loaded coverage. Requests run one at a time, at least eight seconds apart after success, with a 60-second backoff after failure. No timers keep fetching while the game is paused or the tab is hidden.

The three closest retained regions are merged using OSM node-pair de-duplication. Distant datasets are evicted and can be fetched again when backtracking. The initial geographic projection stays fixed; `updateMap` refreshes road, water, building, and routing indices without replacing the renderer, camera, vehicle, actor, speed, or active mission. Dirty visible chunks are rebuilt incrementally while their old meshes remain visible. Map bounds expand to match retained coverage. Pending requests abort when the world is closed.

The Location control still returns to the picker for deliberate travel somewhere else. Streaming currently applies to worldwide GPS/coordinate selections; the Alappuzha option uses its existing district dataset. Public-provider delays can still leave an unloaded area ahead; the interface shows loading or automatic-retry status while preserving the loaded world.

Downloads have a 30-second deadline, 12 MB response limit, 25,000-element / 180,000-vertex limits, and a cooldown after rate-limit responses. Empty road coverage and provider failures produce a recoverable error. Public Overpass availability is not guaranteed. See the provider's terms: https://overpass.private.coffee/ . For sustained production traffic, use a managed or self-hosted data service.

Validation:
- `node scripts/verify-world-area.mjs`: projections, coordinate bounds, geometry conversion, empty/invalid data, caching, cancellation, cooldown.
- `node scripts/verify-world-area-ui.mjs`: mocked browser requests prove no startup map/model downloads; GPS and worldwide switching, disposal, errors, cancellation, and mobile layout.
- `node scripts/verify-world-stream.mjs`: ahead loading, turns/reverse, stationary suppression, single-flight requests, fixed origin, de-duplication, eviction/backtracking, failure backoff and disposal.
- `node scripts/verify-world-stream-ui.mjs`: actual driving with delayed mocked map responses; confirms renderer, vehicle and speed continuity and expanded map display.
- `node scripts/verify-world-area-live.mjs`: optional live London-area smoke check. Public providers returned busy responses/timeouts during implementation; mocked tests are not evidence of provider availability.
