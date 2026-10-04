# SmallVillage

Wander through an illustrated village, from the fields into the courtyard house, upstairs and onto its roof terrace in one connected Three.js world. Painted colours, fine outlines, mixed woodland, grassy banks, drifting smoke and warm night lights set the visual mood. The current house shape and map follow the owner's sketch and photographs; dimensions and surrounding parcels are estimates.

**Live:** https://small-village-eta.vercel.app/

**Developers:** read [HANDOFF.md](HANDOFF.md), [illustration direction](docs/ILLUSTRATION.md), [level roads and living banks](docs/ROAD_REPAIR.md), [wandering systems](docs/WANDERING.md), and [the connected-world notes](docs/CONNECTED_WORLD.md).

## Enter and play

The homepage is the actual 3D village plan. Turn and zoom the map, then choose a pin at the yard, avenue, water, fields or school lane to start wandering. Every pin enters the same `village.glb`. **Summer night** sets a clear summer sky at 22:00 before you choose a starting point. **Overview** returns to this map.

| Control | Action |
| --- | --- |
| WASD / arrows · Shift | Walk · run |
| Click / drag · Esc | Look · release the mouse |
| 0–4 / mouse wheel | Hands, slingshot, water pistol, firecrackers, snowballs |
| Hold and release | Draw and shoot the slingshot |
| Hold | Spray water; click throws other toys |
| F · V · H | Ride / get off · vehicle view · horn |
| E | Hold a nearby chicken; land and release when already holding it |
| Space · Ctrl | Flap upward · descend while holding a chicken |
| L | Flashlight |
| G · J · T | Change weather · season · time immediately while walking |
| R | Restack targets |
| Q · X | Start / act in a nearby activity · leave / decline |

Click the weather chip or **Weather & tools** to choose weather, season, time and sound, or use **Summer night** there for the starry sky at your current location. The scene changes immediately behind the menu. Closing it resumes movement. Mobile devices show movement, interaction, flap and descend buttons.

The small navigation map shows the player, home, waterways and destinations. Click a landmark to change the direction guide; this does not teleport the player. Energy declines during wandering, warns at 25%, and restores when resting in the actual yard/house. Outdoor activities pause the drain and award energy on completion: timed fishing, potato roasting, watermelon picking, rabbit chasing, kite flying and night fireworks. Prompts appear only near their locations, with random selection, wait times and cooldowns. The settings menu pauses activity timers and energy drain.

The two vehicles have detailed tyres, controls, mirrors/vents and working driving, steering and lights. Tools interact with targets; birds scatter and return. Chickens, dogs, cats, snakes, cows, sheep and rabbits roam with varied size, pace and movement. Holding a chicken gives the player a deliberately fantastical flight ability, with collision checks and a controlled landing.

The close roofscape follows the supplied balcony photographs. Roads and bridges have continuous level paving, with planting kept clear of their approaches. Fields use dense, uneven seasonal wheat/maize stands, mixed vegetables and fruit-tree groves. Curved leaves, stems, vines, trellises and solid produce give the nearby plants depth; far grain fields use cheaper textured stands. Thirty-seven spreading/fruit trees supplement the poplar avenues. Light green water has swimming fish, hopping pond frogs and landing ripples, water grass, cattails, duckweed, dragonflies and summer lotus flowers. Summer nights have individually twinkling stars and waterside fireflies. These are procedural game assets, not photogrammetry or a surveyed reconstruction.

## Develop

Node 22.12+ or 24+, npm and Git are required. Blender 5.1.2 is needed only when editing/exporting architecture.

```sh
npm ci
npm run dev -- --port 4173 --strictPort
npm run build
```

With the dev server running:

```sh
npm test                  # Edge: entry, world, settings, chicken flight, re-entry, shader errors
npm run test:walk         # Continuous courtyard/lane/road/field route and chicken flight
npm run test:stairs       # Rooms, stairs, upper corridor, terrace and descent
npm run test:environment  # Shelters, precipitation, day/night, storms and wet materials
npm run test:game         # Vehicles, collisions, targets, toys and snow rules
npm run test:adventure    # Energy, all activities, cooldowns, seasonal rules and pause/recovery
npm run test:touch        # Mobile arrows, real touch drag, live settings and snow tools
npm run test:activities   # Dev server: garden/orchard views, fishing, kite and night fireworks
npm run test:planting     # Exported road masks, every mapped poplar and all bridge routes
npm run test:ecology      # Dev server: level roads, clear bridge, orchard and seasonal frogs
npm run test:illustration # Painted overview/house, mixed forest, banks, smoke and night lighting
```

Browser tests use installed Microsoft Edge and write ignored evidence to `artifacts/world/`. `BASE_URL` can point the same browser suite at production. Browser rendering on software WebGL is slower than normal GPU rendering.

## Source and deployment

- `index.html`, `src/entry.js`, `src/world.css`, `src/adventure.css`: map entry and game controls.
- `src/map.js`, `src/places.js`: projected entry pins, minimap and shared activity/garden coordinates.
- `src/viewer.js`, `src/walk.js`, `src/environment.js`: world loading, navigation and weather/time.
- `src/world.js`: surface textures, instanced vegetation, wind, water and distance-based crop detail.
- `src/gardens.js`, `src/organic.js`: vegetable/fruit models, mature trees, banks, flowers, fish and fireflies.
- `src/planting.js`, `src/wetland.js`: placement exclusions, frogs, ripples and wetland life.
- `src/illustration.js`, `src/atmosphere.js`: shared painted rendering, forest, banks, smoke and house/yard lights.
- `src/game/adventure.js`: energy, location encounters, minigames and rewards.
- `src/game/`: vehicles, toys, animated creatures, chicken flight, sound and HUD.
- `blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend`: authoritative editable architecture and map.
- `blender/upgrade_connected_world.py`: repeatable close-roofscape refinement and vegetation metadata export.
- `blender/repair_roads_and_planting.py`: saved-source level paving, poplar relocation and road-footprint export.
- `scripts/export_web_models.py`, `scripts/export_navigation.py`: paired mesh/navigation exports.
- `scripts/export_atmosphere.py`, `public/models/atmosphere.json`: actual window positions for artistic night lighting.
- `public/models/world-details.json`: tree positions and field rectangles from the Blender source.

Vercel builds `dist/` from GitHub `main`. Raw reference photos/videos and credentials stay outside Git. Existing rendered assets remain in the repository for historical reference, but the page never loads them. The legacy browser scripts for the former gallery are historical; use the commands above for current validation.

## Painted woodland update

Original imagegen foliage and meadow artwork, flower-lined roads, and a connected Forest & lakes destination are implemented in the 3D world. See [PAINTED_WOODLAND.md](docs/PAINTED_WOODLAND.md) and the [design board and prompts](docs/design/IMAGEGEN.md).
