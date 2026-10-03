# SmallVillage

Walk from the fields into the courtyard house, upstairs and onto its roof terrace in one connected Three.js world. Village roads, ponds, waterways and the starred house location follow the owner's sketch and photographs; dimensions and surrounding parcels are estimates.

**Live:** https://small-village-eta.vercel.app/

**Developers:** read [HANDOFF.md](HANDOFF.md) and [the connected-world notes](docs/CONNECTED_WORLD.md).

## Enter and play

The homepage contains two buttons: **Explore village** and **Enter house**. Both load `village.glb`; only the starting position changes. There is no gallery, story section or separate house world on the page.

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

Click the weather chip or **Weather & tools** to choose weather, season, time and sound. The scene changes immediately behind the menu. Closing it resumes movement. Mobile devices show movement, interaction, flap and descend buttons.

The two vehicles have detailed tyres, controls, mirrors/vents and working driving, steering and lights. Tools interact with targets; birds scatter and return. Chickens, dogs, cats, snakes, cows and sheep roam on clear ground. Holding a chicken gives the player a deliberately fantastical flight ability, with collision checks and a controlled landing.

The close roofscape follows the supplied balcony photographs. Fields use seasonal wheat/maize shapes, textured crop stands and wind motion. Poplars have shaped leaf clusters and bare winter branches. Water has animated currents, reflected sky colour, rain ripples, winter ice tint and bank reeds. These are detailed procedural game assets, not photogrammetry or a surveyed reconstruction.

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
npm run test:touch        # Mobile arrows, real touch drag, live settings and snow tools
```

Browser tests use installed Microsoft Edge and write ignored evidence to `artifacts/world/`. `BASE_URL` can point the same browser suite at production. Browser rendering on software WebGL is slower than normal GPU rendering.

## Source and deployment

- `index.html`, `src/entry.js`, `src/world.css`: minimal entry and game controls.
- `src/viewer.js`, `src/walk.js`, `src/environment.js`: world loading, navigation and weather/time.
- `src/world.js`: surface textures, instanced vegetation, wind, water and distance-based crop detail.
- `src/game/`: vehicles, toys, animated creatures, chicken flight, sound and HUD.
- `blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend`: authoritative editable architecture and map.
- `blender/upgrade_connected_world.py`: repeatable close-roofscape refinement and vegetation metadata export.
- `scripts/export_web_models.py`, `scripts/export_navigation.py`: paired mesh/navigation exports.
- `public/models/world-details.json`: tree positions and field rectangles from the Blender source.

Vercel builds `dist/` from GitHub `main`. Raw reference photos/videos and credentials stay outside Git. Existing rendered assets remain in the repository for historical reference, but the page never loads them. The legacy browser scripts for the former gallery are historical; use the commands above for current validation.
