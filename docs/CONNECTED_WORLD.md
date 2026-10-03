# Connected world upgrade — 3 October 2026

## User requirements and implementation

The owner requested a page containing only village/house entry, a single continuous map, more realistic play tools/vehicles/vegetation/animals/water, a balcony view matching the real neighboring rooftops, chickens that can be held to fly, and immediate weather/season changes while walking.

Both entry buttons load the same full `village.glb`. `courtyard` starts at Three.js `[-32, 1.85, 109]`; `avenue` uses the existing poplar-road spawn. The detailed house is already part of this world. The gate, interior stair ramps, corridor and terrace navigation remain unchanged. Home returns to the entry overlay and re-entry reuses the model and renderer.

The near roofscape now includes pitched tile roofs, gray/white/pink plaster gables of different heights, an adjoining flat terrace with low brick parapets, and a white two-storey neighbor with roof railings. These are photo-based silhouettes and estimated placements, not measured house-by-house footprints. The refined source preserves the latest kitchen/corridor/curtain corrections.

## Regional references

Research consulted on 3 October 2026; the owner's photographs determine the placement and visible appearance. Official regional evidence supports the crop/tree selection, not the exact species or cultivar in this village:

- [Zhoukou Development and Reform Committee: 2024 execution and 2025 plan](https://fgw.zhoukou.gov.cn/sitesources/fzggwyh/page_pc/zfxxgkpt/fdzdgknr/ghxx/article50ec03f5e79e4a8c94b3252ed25ecbb8.html), 25 February 2025: wheat, maize and soybean production projects in Zhoukou. Model choice: spring wheat, summer maize, ripe autumn maize, winter young wheat and snow.
- [Henan Agriculture Department: autumn crop visit in Zhoukou](https://nynct.henan.gov.cn/2023/07-13/2777796.html), 13 July 2023: maize/soybean intercropping, peanut production and maize yield work in nearby Zhoukou districts. Maize is the primary modeled summer/autumn crop; the model does not assert that every local field contains maize.
- [National Forestry and Grassland Administration: poplars and willows in Henan](https://www.forestry.gov.cn/c/www/sl/562437.jhtml), 14 May 2024: widespread Henan poplars, their tall upright narrow crowns and use in farmland shelterbelts. Model choice: tall poplar avenues with whitewashed bases, leaf clusters and bare winter branches, consistent with the supplied road photographs. Exact poplar cultivar is unidentified.

Birds and livestock use generic sparrow/chicken/dog/cat/snake/cow/sheep anatomy and are gameplay additions. Their counts and placements are not a wildlife census. Chicken-assisted flight is intentionally fictional.

## Runtime contracts

- `src/world.js` hides the old triangular foliage/crop rows, adds original canvas-textured leaf/crop stands, and keeps more detailed curved wheat/maize geometry near the player. Field patches are culled by distance; the far field remains a textured surface. Wind uses shared shader uniforms, not per-leaf CPU animation.
- Metre-scaled UVs are now exported after material batching. Concrete, plaster, brick, bark and roof tiles get original generated surface/bump textures at runtime. No external texture download or runtime secret is required.
- Water replaces the still mint material with an animated shader. It uses irregular moving wave normals, sky-colour/Fresnel variation, rain ripples and a winter ice tint. It is visual flowing water, not a fluid simulation or a planar reflection render.
- `src/game/creatures.js` creates 20 roaming animals (six chickens, two dogs, two cats, three cows, five sheep, two snakes). Leg gait, tail/head motion, snake undulation and wing flaps are animated. Static anatomy is merged by material to reduce draw calls.
- The chicken flight controller owns movement through `walk.driving` while held. Space flaps, Ctrl descends, WASD steers. E requests landing; release occurs on a clear exported floor. Height is capped at 70 m. Bounds and height-aware collision queries remain active; flight can cross waterways above bank height.
- Vehicle body/wheel details are merged while steering/rolling components remain articulated. Tools retain existing target/projectile contracts. The slingshot now draws its elastic while held and fires on release; direct `toys.fire()` still supports deterministic tests.
- G/J cycle weather/season during play; the UI selectors stay synchronized. Changing weather/season refreshes tool availability, including snowballs. Menu pauses player input, while weather/water/sky continue updating visibly.
- The score stays hidden until a target is hit. The house beacon appears when the player is farther than 45 m; it disappears nearby.

## Rebuild safely

```sh
blender --background --python blender/upgrade_connected_world.py
blender --background --python scripts/export_navigation.py
blender --background --python scripts/export_web_models.py
```

The new refinement script opens the current saved source. It replaces only its WORLD objects and estimated residential objects in the immediate photo roofscape region. Its first-run backup is `../world_upgrade_reference/before_world_upgrade.blend` outside Git. It exports `world-details.json` from the existing tree placements/field footprints. Do not blindly replay the older rebuild scripts: they restore historical stage backups.

Refresh `sceneVersion` in `src/viewer.js` when models/navigation/metadata change. The active full village is approximately 4.13 MB (417,724 triangles, 93 material batches), including metre-scaled UVs and the near roofscape. The retained house-only export is approximately 1.21 MB (97,569 triangles, 59 batches); the page does not request it.

## Validation and limits

Current commands are in README. The controller test verifies a complete round trip from yard through the open gate, lane, road and field edge without changing navigation datasets, plus all six animal kinds, chicken pickup/ascent/50 m flight/landing and indoor floor/ceiling barriers. Existing stairs, environment and vehicle/toy tests remain applicable. The browser suite checks the two-button page, house in the full map, instant settings, keyboard chicken flight, no shader/page errors, model reuse, and screenshots of the terrace, fields, water and avenue. `test:touch` verifies real touch events for arrows/dragging and live snow tool availability. `scripts/play-visual.mjs` captures vehicle/animal/drawn-slingshot views for review. Evidence is generated in ignored `artifacts/world/`; former gallery test scripts are historical.

Remaining limits: detailed assets are procedural, not photoreal scans; neighboring positions are estimated; most surrounding buildings have no detailed interiors. Animal movement uses floor/box queries and is not a full navigation-mesh system. Precipitation shelter is camera-based; water has no simulated volume, physical accumulation or true reflected geometry. Dynamic vegetation/animals/tools/vehicles live in browser code and are not all present in the saved Blender scene. Low-end hardware may need a smaller render viewport. The world uses no save game, backend, live-weather API or accounts.
