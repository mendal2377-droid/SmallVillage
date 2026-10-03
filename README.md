# SmallVillage

A browser-based presentation of a Blender village reconstruction in Henan, China, with a detailed courtyard house and adjoining alley based on two videos, including a detailed 116-second interior tour.

## Explore

- Ten rendered views: courtyard, alley, entrance, elevated context, kitchen, meeting room, bedroom, storage room, stairs, and upstairs.
- Two interactive 3D scenes: the filmed house and the interpretive village.
- Orbit, zoom, pan, camera presets, and fullscreen.
- First-person walking in both scenes, with floor-aware movement, furniture/wall collisions, and climbable stairs.
- Responsive layout and a render-gallery fallback if WebGL is unavailable.
- Downloadable, editable Blender source files.

The house model is approximately 0.8 MB and the full village approximately 6.4 MB, using Draco compression. Model decoders are served locally with the site.

### Walk through the scene

Select a scene, choose **Explore in 3D**, then **Walk inside**. Use **WASD** or **arrow keys** to move, click the scene for mouse look, and hold **Shift** to move faster. **Esc** releases the mouse. Dragging to look also works without mouse capture. On touchscreens, hold the on-screen arrow buttons to walk and drag the scene to look around. **Reset** returns to the starting position; **Orbit view** leaves walking mode.

Enter the corner doorway to the left of the meeting room. Walk up the red stairs, turn left on the intermediate landing, then climb the return flight. You can walk along the enclosed upper corridor, look down into the courtyard, enter the upper rooms, and descend. The ground floor includes a kitchen, meeting room, bedroom, and tidy storage/dining room. Upstairs room furnishings are sparse because the footage mainly shows the corridor.

Walk surfaces and height-aware wall/furniture bounds come from the Blender source. The camera follows stair ramps at 1.65 m above the floor and rejects unsupported drops. Rebuild `public/models/navigation.json` with `blender --background --python scripts/export_navigation.py` after changing the architecture.

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

With the dev server running, `npm test` runs browser smoke checks in headless Microsoft Edge, including both 3D models, scene controls, responsive layout and the WebGL fallback. `npm run test:walk` checks walking, mouse capture, wall collisions, the courtyard-to-alley passage, and touch movement/look. `npm run test:stairs` deterministically verifies the full room/stair route, descent, balcony barrier and village-scene stairs. `node scripts/stairs-browser.mjs` verifies keyboard climbing and mouse look in the rendered browser. Microsoft Edge must be installed for browser tests.

Vercel uses the checked-in `vercel.json` to build with Vite and publish `dist/`. The browser loads the Three.js viewer and the selected GLB only when **Explore in 3D** is selected.

## Project structure

| Path | Contents |
| --- | --- |
| `src/` | Website styles, gallery interactions and Three.js viewer |
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

**Estimated:** dimensions, hidden rooms, roof layout, cardinal orientation and location within the surrounding village. The village-wide layout is interpretive and is **not a measured or map-verified survey**.

原始视频用于还原可见建筑特征与生活细节。尺寸、不可见空间、方位和村内位置均为推测，不可作为测绘资料。

The original village file is preserved. The revised Blender file retains the replaced parcels in hidden `BACKUP` collections, with the new work organized in `VIDEO 00–05` collections. `VIDEO 05` contains the clean interiors and stairs. See `blender/video_revision/INTERIOR_NOTES.md` for the observed timestamps and estimated elements.

`rebuild_interiors.py` uses a local `../interior_reference/before_interiors.blend` backup of the pre-interior revision. On a fresh checkout, restore the Blender file from commit `a23b855` before the first run; the script then creates that local backup. Do not run multiple Blender save/export processes against the same file at once. Raw videos and reference frames stay outside this repository.

## Third-party components

Three.js uses the MIT license. The locally distributed Draco decoders use Apache License 2.0; see `public/draco/LICENSE`. Dependency versions are pinned by `package-lock.json`.
