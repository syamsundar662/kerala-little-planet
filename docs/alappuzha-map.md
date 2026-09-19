# Alappuzha Open World

The home page opens a street-level Three.js world with elevation terrain based on real Alappuzha road geometry. The old globe engine is no longer loaded. Its previous home component, including pre-existing user changes, is preserved in `app/legacy-planet-page.tsx`.

## Implemented gameplay

- Third-person walking, sprinting, animated player and local pedestrians.
- Enter/exit a KSRTC bus or a simple car. Vehicles have independent parked positions, steering, acceleration, braking and reverse. Exit requires stopping.
- Chase, driver and overhead cameras; drag the scene to look around.
- Building collision, off-road slowdown and road recovery.
- Optional passenger runs, golden road guidance and a destination marker. Stop within 14 m and press E to deliver. Each completion earns ₹120, every five advances the level, and the third completion in an India-calendar day earns an additional ₹250.
- Completed progress persists on this browser (`alappuzha-driving-v1`). No account sync or multiplayer in this new world.
- Live road minimap and a full district map (M / Escape), showing position, mission, road network and town travel. Opening the full map pauses movement; closing restores the previous pause state.
- Touch movement, braking, vehicle entry and map controls.

Controls: WASD/arrows move or drive, Shift runs, Space brakes, F enters/exits, E delivers, C changes camera, R recovers to road, M opens the map. Town selection starts a local mission near the selected town. Missions are optional; free driving is unrestricted by the guide line.

This is a playable open-world foundation, not a full GTA-sized game. It currently has no combat, police, ambient driving traffic, vehicle damage, interiors, multiplayer or account saves. Retention features need real player testing; their presence does not prove retention improvement.

## Geography and accuracy

Source: [OpenStreetMap relation 3743889](https://www.openstreetmap.org/relation/3743889), Alappuzha district. Data is © OpenStreetMap contributors under [ODbL 1.0](https://www.openstreetmap.org/copyright). The distributed extract is available in `public/maps/alappuzha.json` under ODbL, with its source timestamp and license metadata. The map displays that timestamp.

The extract includes **28,082 road ways, 316,985 road geometry points, 9,041 water ways and 120 named places**. Original coordinates and node IDs are retained. A locally scaled equirectangular projection converts coordinates to meters for the flat world. There is no globe or invented replacement road network.

Road widths are approximated by road class. Buildings, palms and roadside scenery are generated placeholders, not surveyed replicas or real building footprints. Ground follows a bundled elevation model (see below); detailed coastal land cover and water physics are not reconstructed. Mapped water ways render in the scene, but water multipolygon relations are not imported, so water coverage is incomplete. Rendering the whole district as grass is a gameplay simplification outside imported waterways.

The map is as accurate as the bundled OSM snapshot; it is not guaranteed to contain every current road. Ways crossing the district boundary can extend beyond the boundary. A* uses shared OSM node IDs, one-way directions, roundabouts, and excludes private/no-access ways. It does not model turn-restriction relations, conditional access, closures or ferries. All 56 directional routes between the eight town destinations are verified connected. Town locations are gameplay spawn anchors, not official bus stops or verified KSRTC services.

## Architecture

`app/alappuzha-world.ts` builds a 500 m spatial index and streams nearby chunks. Static geometry is batched by material. Scene meshes are disposed when leaving a chunk; keyboard and animation resources are cleaned up on unmount. `app/alappuzha-drive.tsx` owns the HUD, progress and lifecycle; `app/alappuzha-world-map.tsx` renders the full map. `app/alappuzha-map.ts` contains projection, graph construction and A*.

The extract is approximately 16 MB uncompressed. It is fetched once at startup, with no runtime Overpass or tile service dependency. Three.js and the world are dynamically imported. Further compression/tiled downloads would reduce first-load cost on slow mobile connections. The existing GLB assets are reused; existing credit files remain in `public/`.

## Refreshing map data

Download this query from an available public Overpass server:

```overpass
[out:json][timeout:150];
area(3603743889)->.a;
(
  rel(3743889);
  way(area.a)[highway][highway!~"footway|path|steps|cycleway|construction|proposed|pedestrian"];
  way(area.a)[waterway];
  way(area.a)[natural=water];
  node(area.a)[place~"town|village|city"];
);
out geom;
```

Save it as `/tmp/alappuzha-osm.json`, then:

```sh
node scripts/build-alappuzha-map.mjs
node scripts/verify-alappuzha.mjs
npx tsc --noEmit
npx oxlint app/alappuzha-world.ts app/alappuzha-drive.tsx app/alappuzha-world-map.tsx app/page.tsx
node scripts/verify-alappuzha-world.mjs
node scripts/verify-alappuzha-recovery.mjs
node scripts/verify-alappuzha-roads.mjs
node scripts/verify-alappuzha-road-render.mjs
npm run build
```

The browser check uses installed Chrome and the existing preview at localhost:3002. It checks on-foot spawning, entering and driving both the bus and car, left/right walking displacement, left/right steering direction, braking, vehicle exit, pause/resume, town travel, full-map opening/closing/zoom controls, responsive layout and browser errors. It does not currently automate an entire passenger run or validate all scenery collisions.

Recovery regression: `verify-alappuzha-recovery.mjs` checks that on-foot recovery leaves the character outside parked vehicles and able to walk, and that pressing R while the full map is open cannot move the player. Vehicle exits also search for an unoccupied position. Steering is cleared when spawning, recovering, or switching vehicles.

Road surface regression: `verify-alappuzha-roads.mjs` reproduces uncovered outside corners from separate road rectangles, verifies filled round joins for both turn directions and across streamed chunks, checks upward surface normals, and verifies dash continuity across short OSM segments. The flat ground layers render in a fixed order (water, shoulder, asphalt, markings) before scene objects, with depth testing/writing disabled for those flat layers. Batching preserves this ordering across chunks. The ground uses a local subdivided mesh rather than a 140 km two-triangle plane. This avoids terrain/asphalt depth competition; buildings and vehicles still render over the surface. `verify-alappuzha-road-render.mjs` checks 560 asphalt samples over 80 moving-camera frames and verifies foreground-object occlusion with WebGL pixel reads.

Scenery: streamed houses now include road-facing verandas, columns, steps, framed windows, tiled roofs, balconies, shop awnings and rooftop water tanks. Coconut palms have curved fronds and coconuts; broadleaf trees use layered canopies. The sky includes 28 instanced cloud clusters and 14 animated birds. Scenery shares materials and is merged within each chunk; extra close-range detail is limited to nearby buildings. The palette now uses muted grass, charcoal asphalt, subdued plaster/roof materials, and weather-responsive lighting. These buildings remain generated scenery, not surveyed building footprints.

## Live environment

The HUD shows India time (Asia/Kolkata), using the device clock. NOAA's fractional-year solar approximation positions sunlight for the player's latitude/longitude, with dawn, dusk, night, and matching directional shadows. Lighting continues following real time while gameplay is paused.

Open-Meteo current model estimates for Alappuzha (9.4981, 76.3388) are requested on load, every ten minutes, and when returning to the tab. The HUD shows the provider reading time, temperature, and conditions. This is one area-wide weather estimate, not a street-level observation or a guarantee of instantaneous rainfall. Precipitation and WMO rain codes control animated rain, wet asphalt, fog distance, and water roughness; cloud cover controls the clouds and sunlight. Failed updates retain a labeled last reading; readings older than 90 minutes are no longer applied. With no valid reading, weather is shown unavailable and the environment uses neutral lighting without rain. No account or location permission is required.

Water has animated world-space ripple normals, wind-responsive roughness, sun highlights, and an approximate sky reflection. It does not simulate tides, flooding, fluid physics, or mirror reflections of buildings. Existing OSM water geometry limitations still apply. Muted procedural ground/asphalt/plaster/roof materials, hipped roofs, and local shadow maps replace the earlier bright flat palette.

References: https://open-meteo.com/en/docs and https://gml.noaa.gov/grad/solcalc/solareqns.PDF

Validation: `node scripts/verify-alappuzha-weather.mjs` exercises rain/dry transitions, malformed provider responses, and morning/noon/night solar direction; the existing world and moving-camera road regressions remain applicable.


## Elevation terrain

A bundled Mapzen Terrarium / AWS elevation dataset now replaces the flat ground. `scripts/build-alappuzha-terrain.py` downloads 66 zoom-12 tiles covering all imported road coordinates plus a 2.5 km margin. It samples a 50 m grid (1,028 × 1,857; 1,908,996 elevations), stored as a 3.8 MB signed decimeter binary raster plus metadata. The actual source resolution and accuracy vary; 50 m is the output spacing, not survey accuracy. There is no vertical exaggeration. Global SRTM/GMTED2010 credit: USGS; ETOPO1 credit: NOAA. Full attribution is in `public/maps/terrain/credits.txt` and linked in the game.

The 4 km local ground mesh follows the same fixed grid triangles used for actor height sampling. Road surfaces are split at terrain cell edges and diagonals before elevation is applied. Surface layers now depth-test against terrain while retaining deterministic layer order and no depth writes between roads; the previous flat-only rendering description above is historical. Buildings/trees are anchored to local elevations, vehicles pitch with the road, walking/NPCs follow the surface, and the camera and shadow light target include the local elevation. Water polygons use a constant median shoreline elevation; narrow waterway strips follow the elevation surface. These are gameplay approximations, not hydrologically corrected water levels.

This does **not** add surveyed bridge decks, culverts, terrain retaining walls, accurate ocean coverage, paddy/forest/beach land-use polygons, or exact building footprints. Scenery is still generated. DEMs can include canopy/building artifacts and do not resolve small embankments. The full map remains the existing 2D road/water overview. Missing or corrupt elevation assets produce a load error rather than silently pretending a flat fallback is real terrain.

Refresh with `python3 scripts/build-alappuzha-terrain.py` (Python Pillow required). Test with `node scripts/verify-alappuzha-terrain.mjs`, `node scripts/verify-alappuzha-terrain-render.mjs`, and the existing world/recovery regressions.

## Mobile gameplay

Mobile HUD uses a compact town/map/menu row, single-line weather, small mission distance, minimap, speed, contextual vehicle action, and thumb controls. Large mission prose, branding, levels, daily-trip decoration, keyboard hints and persistent secondary action stacks are removed from mobile gameplay. Camera, recovery, sound, location, horn and pause remain in Menu; attribution is also available there. Dynamic viewport height and safe-area offsets support phone browser bars and landscape. Control targets are at least 44 CSS pixels.

The engine chooses a phone budget at creation for coarse pointers or widths at most 760px: 1x framebuffer resolution, no multisample antialiasing or shadow maps, nine streamed chunks, one chunk build per frame, up to 35 scenery sites per chunk without extra facade detail, three NPCs, five birds, twelve cloud clusters, and 500 rain streaks. Fog conceals the shorter draw distance. It caps rendering near 30 fps, publishes HUD updates four times per second, and skips rendering while the tab is hidden. Desktop quality remains unchanged. This reduces work but does not guarantee a frame rate on all phones. `scripts/verify-alappuzha-mobile.mjs` checks portrait/small-phone/landscape control bounds and overlaps, menu, map, pointer driving, framebuffer size, and the active mobile render profile.

Mobile movement now uses one analog thumb joystick instead of arrow/brake buttons. Its circular range includes a 12% dead zone; movement strength and steering are proportional to drag distance. Forward accelerates, diagonal drag steers while moving, backward brakes then reverses, and release applies the vehicle brake. Pointer capture supports dragging outside the pad; pointer cancellation, lost capture, blur, overlays, and tab hiding clear input. The thumb moves through CSS properties without triggering React renders for every pointer event. Desktop keyboard controls remain available. The mobile regression checks forward/diagonal/reverse/release and interruption behavior.

## Nearby-location building appearance

The nearby-area loader preserves OSM building IDs, type, explicit height (meters or feet), floor count, building color/material, roof color/shape/height, and height provenance. Explicit height wins over floor-derived height; when both are absent, building-type-based estimates are used. Geographic footprints remain unchanged. The renderer batches colored plaster walls with shader-generated window frames, panes and sills, and separately colored roofs. Rectangular footprints support mapped gabled, hipped and pyramidal roof shapes; other footprints retain their exact outline with flat roofs. Untagged small residential buildings receive an estimated pitched roof, while industrial buildings avoid residential window patterns. No extra facade meshes or image downloads are required, and material variants are bounded for mobile rendering.

This is a data-driven approximation, not photographic street imagery. Facade openings, untagged colors/heights, and unsupported roof forms are estimated. Building relations/courtyards and building:part geometry are not added by this pass. See https://wiki.openstreetmap.org/wiki/S3DB for the mapped tag model. Nearby-world footer explicitly labels facade details as estimated.

Checks: `node scripts/verify-world-area.mjs` verifies unit conversion and preserved building metadata; `node scripts/verify-world-area-ui.mjs` covers GPS-triggered loading, tagged roof/facade rendering without shader errors, area switching and streaming entry points.

## Map download recovery

Nearby-area requests now go to the same-origin `/api/world-map` endpoint instead of directly from Safari to one Overpass provider. The server validates coordinates, builds a bounded area query, uses an explicitly encoded form request, and tries an alternate provider on network errors, invalid/incomplete responses, or HTTP errors. Each attempt has a 25-second timeout; provider rate limits trigger a cooldown. Responses are size-limited and successful responses can be cached privately for five minutes. The UI preserves the chosen coordinates with **Retry this location**, translates browser network errors into a connection/retry message, and still permits cancelling or choosing a different location. Both providers can still be unavailable; no unrelated place is silently substituted.

Regression checks: `verify-world-map-provider.mjs` tests failover and cancellation; `verify-world-area-ui.mjs` checks same-location retry and error recovery; `verify-world-area-live.mjs` exercises the running server endpoint with a real regional request.

Live validation found a valid London area response of 13.6 MB exceeded the old 12 MB download limit. The server now accepts up to 24 MB (still bounded by the query's area/resource limits), compacts JSON before returning it, and reports oversize responses as density errors rather than masking them with network failover. Verified the live endpoint loaded 2,912 road ways and 5,487 mapped buildings. A regression fixture covers a valid response above the previous limit.

The desktop HUD now uses the same compact Map/Menu controls as mobile. Mission title/prose, repeated location subtitle, level/daily-trip decoration, weather-source prose, and keyboard-help bar are hidden during normal play. Distance/fare, small minimap, compact weather/time, balance, and contextual vehicle interaction remain visible. Speed appears only in a vehicle. Menu reveals secondary actions, keyboard help (desktop), and attribution; Escape/outside click dismiss it. Streaming notices appear only when loading/retrying. `verify-minimal-hud.mjs` verifies these visibility rules and map/menu interaction.

## Building / road clearance

All mapped building footprints now pass a polygon-versus-road-corridor check before rendering. Conflicting footprints are omitted from the playable scene; source coordinates are not shifted or rewritten. The clearance corridor includes the rendered road half-width plus 1.25 m for shoulders and a small gap. Generated buildings use a rotated envelope including roof overhangs and veranda/steps, rather than checking only a center point. A separate 128 m spatial index covers the complete road segment bounds (including neighboring chunk edges and long segments) and rebuilds whenever streamed map data changes. Buildings clear of the corridor remain in their mapped locations. Because road widths are approximated and bridge/tunnel separation is not modeled, omission is a conservative gameplay choice, not a correction to OSM.

`node scripts/verify-road-clearance.mjs` covers crossing/contained roads, shoulder overlap, clear buildings, rotated verandas, cross-cell long roads, and index rebuilding.

## Vehicle fleet

Car, motorcycle, lorry and KSRTC bus are playable. The compact Menu contains a vehicle chooser that takes the player to the selected parked vehicle; switching is blocked while driving above walking speed or paused. Every town spawn places the extra vehicles near roads, with spacing between models. Walking entry/exit, recovery and nearby-vehicle detection use all four vehicles and their own dimensions. The car and lorry have distinct wheelbases and speeds; the motorcycle has a seated rider, lean while steering, and a closer camera. New vehicles are lightweight procedural meshes with rolling wheels; the bus retains its GLB model. They use the same desktop controls/mobile joystick. `scripts/verify-vehicle-fleet.mjs` checks selection, driving, braking and exit for each type.
