# SmallVillage

A browser-based presentation of a Blender village reconstruction in Henan, China, with a detailed courtyard house and adjoining alley based on a 54-second video.

## Explore

- Four rendered views: courtyard, side alley, entrance, and elevated context.
- Two interactive 3D scenes: the filmed house and the interpretive village.
- Orbit, zoom, pan, camera presets, and fullscreen.
- First-person walking in both scenes, with eye-level movement and wall collisions.
- Responsive layout and a render-gallery fallback if WebGL is unavailable.
- Downloadable, editable Blender source files.

The house model is approximately 1.3 MB and the full village approximately 6.9 MB, using Draco compression. Model decoders are served locally with the site.

### Walk through the scene

Select a scene, choose **Explore in 3D**, then **Walk inside**. Use **WASD** or **arrow keys** to move, click the scene for mouse look, and hold **Shift** to move faster. **Esc** releases the mouse. Dragging to look also works without mouse capture. On touchscreens, hold the on-screen arrow buttons to walk and drag the scene to look around. **Reset** returns to the starting position; **Orbit view** leaves walking mode.

The walk stays at ground level. Wall collisions are derived from the source Blender geometry; stairs and access to unmodeled interiors are not simulated. Rebuild `public/models/navigation.json` with `blender --background --python scripts/export_navigation.py` after changing the architecture.

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

With the dev server running, `npm test` runs browser smoke checks in headless Microsoft Edge, including both 3D models, scene controls, responsive layout and the WebGL fallback. `npm run test:walk` checks walking, mouse capture, wall collisions, the courtyard-to-alley passage, and touch movement/look. Microsoft Edge must be installed to use the default test setup.

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

**Observed in the video:** two-storey white house, enclosed glazed balcony, burgundy tiled plinth, decorative tile bands, red entrance gate with pedestrian opening, blue corrugated shed, laundry, cut branches, furniture, narrow wet brick alley, ivy, wires and scooter.

**Estimated:** dimensions, hidden rooms, roof layout, cardinal orientation and location within the surrounding village. The village-wide layout is interpretive and is **not a measured or map-verified survey**.

原始视频用于还原可见建筑特征与生活细节。尺寸、不可见空间、方位和村内位置均为推测，不可作为测绘资料。

The original village file is preserved. The revised Blender file retains the replaced parcels in hidden `BACKUP` collections, with the new work organized in `VIDEO 00–04` collections.

## Third-party components

Three.js uses the MIT license. The locally distributed Draco decoders use Apache License 2.0; see `public/draco/LICENSE`. Dependency versions are pinned by `package-lock.json`.
