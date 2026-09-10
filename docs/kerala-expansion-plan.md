# Little Kerala — 14-district expansion plan

Planning document · 10 September 2026. This is a proposed expansion, not a claim that the content is already implemented.

## Experience and world structure

One continuous Kerala mini-planet with all 14 districts. Preserve the KSRTC bus, drive controls, cameras, time slider, original teal background, audio controls, and route exploration. Use the overview as an atlas; transition to detailed local scenery around the bus. Avoid permanently enlarging every prop to make it visible from orbit.

Place a recognizable compressed Kerala landmass on the planet, with the sea on the west and mountain terrain to the east. Preserve relative district positions and plausible road connections, while compressing travel distances for play. District boundaries are available as a map overlay; landscapes blend naturally across them. These are authored approximations, not a navigation map or survey model.

Offer free driving, a guided district tour, and festival visits. The user can pick a district from the atlas or drive there. Direct district selection is an explicit travel action; normal driving should stream scenery without resetting position, suspension, camera, or sound. Keep nearby background landmarks visible during streaming.

## District content shortlist

These are representative starting points, not an exhaustive description of any district. Shared practices can appear in several districts. Proposed activities must be developed around the actual local setting.

| District | Landscape and built scene to author | Culture and everyday-life content | Initial event candidates |
|---|---|---|---|
| Thiruvananthapuram | Coastal approach, East Fort streets, palace precinct | Market stalls, handloom shop, local bus terminal | Attukal Pongala; Navarathri music setting |
| Kollam | Ashtamudi waterfront, fishing harbour, low bridges | Fishing activity, cashew trade and waterfront workshops | Kottankulangara Chamayavilakku; boat-race setting |
| Pathanamthitta | Pamba riverside, wooded roads, Aranmula village | Aranmula metal-mirror workshop, boat-building details | Aranmula boat race; Padayani venue |
| Alappuzha | Backwaters, Kuttanad paddy, canal bridges | Coir work, ferries, houseboats and waterside homes | Nehru Trophy boat race; Neelamperoor Padayani |
| Kottayam | Kumarakom waterside, town streets and plantations | Bookshop, newspaper kiosk, church precinct and village commerce | Manarcad Perunnal; Vaikathashtami |
| Idukki | Tea slopes, reservoir views, forest-edge settlements, hairpins | Plantation workplaces and hillside markets | Chitra Pournami at Mangaladevi; harvest/farm activities |
| Ernakulam | Fort Kochi waterfront, heritage lanes, working urban streets | Harbour commerce, art spaces, shops and fishing-net scene | Cochin Carnival; Athachamayam |
| Thrissur | Town round, temple precinct, surrounding villages | Percussion rehearsal, cultural learning spaces, shops | Thrissur Pooram; Pulikali |
| Palakkad | Paddy plains, mountain-gap views, Kalpathi streets | Agricultural activity, courtyard homes and craft shops | Kalpathi Ratholsavam |
| Malappuram | River roads, markets, wooded inland routes | Mappila cultural content, literature and craft activities, reviewed locally | Kondotty Nercha; Nilambur Pattu shortlist |
| Kozhikode | Beach approach, market streets, Beypore waterfront | Food shops, boat-building and maritime stories | Revathi Pattathanam; literature-event setting |
| Wayanad | Forested plateau, paddy valleys, coffee country | Community-authored local and Adivasi stories, farms and markets | Valliyoorkavu Aarattu; community seed-festival setting |
| Kannur | Coastal road, fort approach, laterite homes | Weaving workshop, coastal trades and local performance venue | A documented Theyyam/Kaliyattam venue and season |
| Kasaragod | Bekal coastline, laterite landscape, inland villages | Multilingual local signage, Yakshagana and regional craft content | Kanathoor Nalvar Bhoothasthanam festival |

Before production, each row needs a reference sheet with exact venue, district, photographs, costume references, sound references, community context and permitted asset sources. Confirm shortlist items not yet individually documented, especially specific Malappuram venues. Do not imply that an entire district shares one faith, costume, language variety or occupation.

## Content depth for every district

Minimum complete district package:

- One distinctive road segment with a town or village stop and a scenic branch.
- One major landmark and two smaller discovery locations.
- Two signature building models, supplemented by at least six local variations assembled from a shared architecture library.
- Regional terrain, vegetation and shoreline/river treatment where relevant.
- Everyday pedestrians with varied faces, ages, clothing and activities; expand beyond the current single character base.
- A bus stop with Malayalam and English destination signage and an arrival announcement.
- One fully authored festival experience and two smaller culture/everyday-life interactions.
- Day, evening, night and wet-weather presentation, with recorded local ambience where obtainable.
- A compact district information card accessible on demand, rather than a persistent status card blocking the scene.

This creates a first complete expansion of 14 substantial regions, 14 main festival experiences and at least 42 discovery locations. Further festivals can be added without rebuilding the world.

## Festivals as changing places

Maintain two separate controls: time of day, and season/date or festival selection. A night slider must not automatically trigger a religious festival. Normal mode shows ordinary working streets; an event adds appropriate decorations, gathering areas, performers, audio, lighting and temporary traffic arrangements.

Festival state sequence: preparation → arrival → main activity → dispersal. Keep a smaller repeatable scene available for short visits. Visitors arrive by bus, park at a suitable approach, and watch from a viewing camera or explore on foot in a later phase. Preserve access boundaries in the setting; do not route the bus through crowds or ritual spaces.

Onam, Vishu, Eid and Christmas can have regional variations across the world rather than belonging to one district. A curated festival-tour mode can visit events from different seasons, clearly described as a showcase. Calendar mode must use verified dates for the selected year. Festival dates can move and require local confirmation; do not hard-code the current calendar forever.

Use locally reviewed choreography, costumes and recordings. Theyyam, Padayani, Oppana, Yakshagana, percussion and boat-race activity require distinct animation and audio packages. The existing walking animation is not a substitute. Credit contributors and keep source/license information with each asset. Community-authored content is particularly important for distinct Adivasi communities; avoid a generic character or invented ceremony.

## Travel and activities

Build a connected route graph, not one repeating circular lane. Suggested coastal progression: Thiruvananthapuram → Kollam → Alappuzha → Ernakulam → Thrissur → Malappuram → Kozhikode → Kannur → Kasaragod. Add inland branches to Pathanamthitta, Kottayam, Idukki, Palakkad and Wayanad. Validate actual road connectivity before choosing detailed routes.

Gameplay proposals: passenger pickup, district arrival stamps, scenic bus stops, short cultural discoveries and festival shuttle trips. Keep free exploration available without missions. Set a provisional ordinary leg length of 3–6 minutes, with shorter direct travel from the atlas. Tune this after playtesting rather than assuming geographic distance equals enjoyable driving time.

Road variety should include coastal bends, bridges, market streets, ghat climbs, narrow village roads and repaired asphalt. Region transitions introduce terrain, buildings, signs and ambience gradually.

## Realism and physics foundations

The present project is a functional prototype. Its procedural scenery, single-base pedestrians, custom collision approximations and spherical-to-flat camera projection need a stronger shared foundation before 14-district content is added.

Use one authoritative terrain/road representation for rendering, tire queries, collisions, water depths and local camera views. Define metre-based vehicle and environment dimensions, converting only at the planet-view boundary. The bus should not become physically tiny because its atlas representation is tiny.

Vehicle requirements: four wheel contacts, spring/damper travel, traction that responds to surfaces, slope-aware acceleration and braking, collision impulses, and speed-dependent impacts. Hills must affect the bus beyond cosmetic pitch. Large rocks and walls block or deflect it; small debris can be ridden over. Water has a basin and depth, not an invisible solid surface. Test bridges separately so the terrain below does not capture the wheels.

Separate dynamic simulation from visual detail. Buildings and terrain use simple collision representations; leaves and decorative clutter do not all become rigid obstacles. Continue refining the custom vehicle model or evaluate a rigid-body engine using a measured prototype before committing to a replacement.

## Visual and audio production

Start with a consistent physical material library: asphalt, soil, laterite, plaster, tile, timber, foliage, rubber, glass and water. Match colour-space handling, texture scale, roughness and lighting exposure. High-quality assets should replace weak models; more polygons alone will not improve composition.

Use accurate sun/moon direction, a bus-focused shadow region, restrained contact occlusion and filtered reflections. Give the closest relevant water surface a reflection update budget. Use cheaper reflection approximations at a distance. Rain changes road roughness, puddles and ambience without turning all surfaces into mirrors.

Retain the planet overview, chase, overhead and FPV views. Add authored landmark viewpoints and a cinematic tour that slows at compositions. Avoid depth-of-field blur during driving when it obscures the road. District labels should not cover the bus or driving controls.

Use source-recorded diesel loops with idle/load transitions, gear behaviour and inside/outside filtering. Add spatial local ambience, licensed field recordings and event audio. Crossfade district and day/night sound beds. Keep horn, reverse beep, collisions and water interaction separate from engine volume. Supply master and category volume controls.

## Streaming, performance and project structure

Refactor the large scene setup into world, district-content, vehicle, terrain, festival, audio and UI modules. Store districts as data manifests with stable IDs, neighbours, asset bundles, spawns, routes, landmarks and events. Separate environment construction from per-frame simulation and disposal.

Keep simplified representations of every district in atlas view. Load detailed assets for the current district and the next likely route segment. Retain collision geometry ahead of the bus even when detailed visuals are still loading. Never let unloading remove the road underneath the vehicle.

Pool crowds, ripples, particles and lights. Instance repeated plants and props; use lower-detail models and compressed textures. Limit distant skeleton animation and audio voices. Festival crowd density is a quality setting, not an unlimited multiplier.

Provisional targets, to be measured on named test devices: 60 FPS desktop and a stable 30 FPS mobile quality mode; a small initial atlas download, roughly 8–12 MB compressed; district detail loaded separately; no shader recompilation or scene rebuild when changing time; no frame stall at district boundaries. These are targets, not guarantees or current measurements. Establish actual RAM/GPU budgets after the pilot and test repeatedly after district loading/unloading.

## Delivery sequence and acceptance

1. Foundation and reference audit: preserve current playable version, profile it, define world scale and shared terrain, split modules, document sources and district map. Exit: existing controls and physics still work and performance is measured.
2. Quality pilot: build one polished Alappuzha district with roads, houses, canal, people and a boat-race scene. Exit: reviewed visuals, cultural references, working collisions/water, acceptable frame times.
3. Contrasting connected districts: add Ernakulam and Idukki to prove urban density and steep terrain, plus seamless travel. Exit: drive across boundaries without camera reset, falling through terrain, stale collisions or audio cuts.
4. Full state geography: all 14 district regions, route graph, correct labels, base terrain and simplified landmarks. This is a navigable skeleton, not the final cultural content release.
5. District production batches: complete the remaining district packages using the pilot standard. Prioritize shared asset families without making every settlement look identical.
6. Festival and community review: finish the 14 main events, regional everyday-life details, costumes, recorded audio, reviewed wording and calendar data.
7. Release polish: mobile controls, accessibility/reduced motion, volume settings, performance tiers, save/load, travel recovery, missing-asset handling and long-session memory testing.

Do not give a reliable completion date until the pilot establishes asset production speed and review effort. A single developer using libraries and a team producing custom photorealistic characters/performances have very different schedules and costs.

Final acceptance includes all 14 districts reachable; distinctive local scenes; at least one reviewed event per district; stable wheel contact and collision behaviour on every terrain type; no pond/bridge camera inconsistency; no district loading gaps; preserved controls; audio that changes correctly by location/time; and measured performance on the agreed desktop and mobile devices.

## Source references

- Kerala Tourism district profiles: https://www.keralatourism.org/districts/
- Kerala Tourism festival calendar: https://www.keralatourism.org/festivalcalendar
- Geocoded Festival Information System: https://www.keralatourism.org/1000festivals/index.php
- Festival directory, including district associations: https://www.keralatourism.org/1000festivals/index.php/Festival_directory
- Kerala Tourism Malabar overview: https://www.keralatourism.org/malabar/
- DTPC Idukki, Chitra Pournami: https://www.dtpcidukki.com/festival-event/chitra-pournami-festival-mangaladevi-temple
- Kerala Tourism, Kanathoor festival: https://www.keralatourism.org/video-gallery/kanathoor-nalvar-bhoothasthanam/973//

The shortlist combines documented district/event associations with proposed scene and interaction design. Individual cultural asset sheets and detailed road routes remain research tasks before implementation.
