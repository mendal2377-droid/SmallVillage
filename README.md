# SmallVillage

A browser-based presentation of a Blender village reconstruction in Henan, China. The house follows the courtyard, interior and roof videos plus new photographs. Village topology follows the supplied sketch, satellite reference and seventeen field and lane photographs.

**New developers:** start with [the project handoff](HANDOFF.md) for setup, the authoritative Blender source, coordinate/navigation contracts, export steps, validation, deployment access and current reference-media paths.

## Explore

- Seventeen rendered views, including the roof terrace, village plan, poplar avenue, field path, autumn corn and winter road.
- Two interactive 3D scenes, with the same detailed house included in the full village.
- Orbit, zoom, pan, camera presets, and fullscreen.
- Immersive first-person walking, wall collisions, two climbable stair flights and an accessible roof terrace.
- Four seasonal crop/snow views; clear, overcast, rain, thunderstorm, snowfall, fog and sunset weather; a full day/night cycle with stars, moonlight and a flashlight.
- A playful game layer: drive the family e-trike or a farm tractor, and use a slingshot, water pistol, firecrackers or snowballs on tins, bottles, straw targets and sparrows.
- A highlighted house, camera focus button and village starting points along roads and field paths.
- Responsive layout and a render-gallery fallback if WebGL is unavailable.
- Downloadable, editable Blender source files.

The house model is approximately 0.8 MB and the full village approximately 2.9 MB, using Draco compression. Model decoders are served locally with the site.

### Walk through the scene

Select a scene, choose **Explore in 3D**, then **Walk inside**. Use **WASD** or **arrow keys** to move, click the scene for mouse look, and hold **Shift** to move faster. **Esc** releases the mouse. Dragging to look also works without mouse capture. Touchscreens show arrow buttons and support dragging to look. **Menu** pauses walking and opens weather, season, time of day, day speed, sound and village starting-point controls; **Exit walk** restores the page. Rain and snow stop under the exported roof footprints. Sound is synthesized in the browser and starts with your first key press or tap.

Enter the corner doorway to the left of the meeting room. Walk up the red stairs, turn left on the intermediate landing, then climb the return flight. You can walk along the enclosed upper corridor, look down into the courtyard, enter the upper rooms, and descend. The ground floor includes a kitchen, meeting room, bedroom, and tidy storage/dining room. Upstairs room furnishings are sparse because the footage mainly shows the corridor.

Walk surfaces and height-aware wall/furniture bounds come from the Blender source. The camera follows stair ramps at 1.65 m above the floor and rejects unsupported drops. Rebuild `public/models/navigation.json` with `blender --background --python scripts/export_navigation.py` after changing the architecture.

### Play

Nothing here is violent: toys knock over tins and startle birds, which fly off and come back.

| Key | Action |
| --- | --- |
| **1** / **2** / **3** / **4** (or mouse wheel) | Slingshot, water pistol, firecrackers, snowballs (snow only); **0** puts them away |
| Click / hold | Shoot a pebble, spray water, throw a firecracker or snowball |
| **F** (or **E**) | Ride the e-trike or the tractor when the prompt appears; again to get off |
| **W S A D**, **Space** | Drive, steer and brake; **V** switches chase/seat view, **H** sounds the horn |
| **L** | Flashlight |
| **T** / **G** / **R** | One hour later / next weather / restack the tins |

Water puts out a lit firecracker. Tins restack themselves a few seconds after the last one falls. The e-trike is parked in the courtyard and on the village road near your lane; the tractor waits on the field path. Vehicles share the walker's collision boxes, floors, water and bridges, so they stay on land and cross streams only at bridges. On touchscreens, the arrow pad drives, **●** uses the selected toy, and **Ride / get off** appears next to a vehicle.

## Run locally

Requires Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

With the dev server running, `npm test` runs browser smoke checks in headless Microsoft Edge, including both 3D models, scene controls, responsive layout and the WebGL fallback. `npm run test:walk` checks walking, mouse capture, wall collisions, the courtyard-to-alley passage, and touch movement/look. `npm run test:stairs` deterministically verifies the full room/stair route, descent, balcony barrier and village-scene stairs. `npm run test:game` checks vehicle driving, steering, water and dismounting plus toy hits, firecrackers and the snow rule without a browser. `node scripts/stairs-browser.mjs` verifies keyboard climbing and mouse look in the rendered browser. Microsoft Edge must be installed for browser tests.

Vercel uses the checked-in `vercel.json` to build with Vite and publish `dist/`. The browser loads the Three.js viewer and the selected GLB only when **Explore in 3D** is selected.

## Project structure

| Path | Contents |
| --- | --- |
| `src/` | Website styles, gallery interactions and Three.js viewer |
| `src/game/` | Vehicles, toys and targets, synthesized audio and the play HUD |
| `public/images/` | Optimized renders |
| `public/models/` | Centered GLB exports, batched by material for fewer draw calls |
| `blender/Yanlaozhai_Henan_Village.blend` | Original interpretive village |
| `blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend` | Final video-based house and lane revision |
| `blender/video_revision/` | Reconstruction, finishing and validation scripts |
| `scripts/export_web_models.py` | Re-export browser models from the final Blender file |
| `docs/` | Saved Blender validation report |

To export models with Blender 5.1:

```sh
blender --background --python scripts/export_web_models.py
```

The website uses simplified material colors in 3D; the rendered gallery retains the more detailed procedural Blender materials. The raw reference video and extracted video frames are not included.

## Reconstruction accuracy

**Observed in the video:** two-storey white house, enclosed glazed balcony, burgundy tiled plinth, decorative tile bands, red entrance gate with pedestrian opening, blue corrugated shed, kitchen stove, red-cushioned wooden sofas, bedroom desk and wardrobe, storage/dining room, dogleg red stairs, aluminum balcony glazing, narrow wet brick alley, ivy, wires and scooter.

**Additional observations:** roof terrace, green access door and adjacent window, white corridor ceiling/beams, bronze frames, open kitchen counter shelves, high kitchen window, field paths, irrigation crossings, whitewashed poplar trunks, seasonal crops and snowy road margins.

**Confirmed placement:** the house occupies the starred position in the user's sketch. Road, water, pond and school connections follow that sketch. **Estimated:** distances, dimensions, individual neighboring plots, hidden rooms and generic school details. North is assumed at the top, consistent with the satellite reference. This is **not a measured survey**. See [photo revision notes](docs/PHOTO_RECONSTRUCTION.md).

原始视频用于还原可见建筑特征与生活细节。尺寸、不可见空间、方位和村内位置均为推测，不可作为测绘资料。

The original village file is preserved. The revised Blender file organizes the detailed house in `VIDEO 00–05` collections and the new village in `MAP` collections. `VIDEO 05` contains clean interiors, stairs and the roof corrections. See `blender/video_revision/INTERIOR_NOTES.md` for the earlier observed timestamps and estimated elements.

`rebuild_interiors.py` uses a local `../interior_reference/before_interiors.blend` backup of the pre-interior revision. On a fresh checkout, restore the Blender file from commit `a23b855` before the first run; the script then creates that local backup. Do not run multiple Blender save/export processes against the same file at once. Raw videos and reference frames stay outside this repository.

## Third-party components

Three.js uses the MIT license. The locally distributed Draco decoders use Apache License 2.0; see `public/draco/LICENSE`. Dependency versions are pinned by `package-lock.json`.
