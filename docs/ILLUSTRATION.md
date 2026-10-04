# Illustrated village — 4 October 2026

The owner changed the visual direction from a reconstruction of real surfaces to an illustrated village, retaining the current house shape and connected map. Reference: the supplied frames of [this video](https://x.com/LexnLin/status/2106493673425047896/video/1), showing painted greens, fine building/tree outlines, grass-covered banks, varied woodland and pale drifting chimney smoke. The X page could not be fetched directly; the attached frames guided the treatment. No video frames or third-party artwork are shipped as assets.

## What changed

- A shared colour/depth rendering pass gives buildings, plants, animals, water and held tools fine coloured outlines, gently simplified shading, warmer highlights, cooler shadows and subtle paper grain. The DOM controls remain crisp.
- Architecture keeps its current geometry, floor heights and navigation. Semantic material colours become painted plaster, muted brick/roof shades and softer blue steel. Brushed procedural texture replaces coarse surface bump maps. Transparent corridor glazing stays transparent.
- Poplars and spreading trees gain small solid crown masses inside the individual leaves. The masses make foliage silhouettes fuller and disappear in winter with the deciduous leaves.
- **667 trees** form a mixed distant woodland beyond the walkable boundary: rounded broadleaf, slender poplar, pale-trunk and layered evergreen silhouettes, with varied scale, spacing, colour and gaps. These are an artistic setting, not surveyed forest. Existing local trees and crop fields remain in place.
- **34 grassy bank segments** slope gently outward from the existing canal/pond boundaries. Tufts and bank surfaces avoid bridge approaches, paving and nearby buildings. Crossings and navigation remain unchanged.
- **21 decorative chimneys** on selected neighbouring roofs emit intermittent rising/drifting smoke. Smoke cycles independently and pauses in rain/storms. These chimney locations are artistic additions.
- Window glow panels follow **507 actual window bounding boxes** exported from the Blender scene, including five opaque panes on the detailed house. A selection of neighbouring homes lights up after dusk; some extinguish late at night. The detailed house remains lit at night. Frames stay visible; transparent balcony panes are excluded.
- Courtyard/upper-floor fixtures, warm light pools and two nearby practical lights illuminate the owner's home at night. Selected neighbouring yards also have lamps. Practical lights are disabled during daytime and outside the home area to limit rendering work.
- The sky has softer painted cloud masses. Weather, seasons, twinkling stars, outdoor activities and continuous walking remain available.

## Modules and assets

| File | Purpose |
| --- | --- |
| `src/illustration.js` | Shared colour/depth pass, ink contours, palette and procedural painted architecture surface |
| `src/atmosphere.js` | Forest silhouettes, bank meshes/grass, window and yard lights, chimney/smoke cycles |
| `scripts/export_atmosphere.py` | Reads the saved Blender scene and exports actual window positions/sizes without modifying it |
| `public/models/atmosphere.json` | Window centre `[x,y,z]`, size `[x,y,z]`, source name and detailed-house flag |
| `src/gardens.js`, `src/world.js` | Fuller illustrated tree crown masses alongside existing leaves and seasons |

`src/viewer.js` installs the atmosphere after loading the full village and renders through the illustration pass. The browser asset version is `illustrated-village-20261004-1`. Existing `.blend`, GLBs and navigation geometry are retained: the art treatment and decorative additions live in browser code.

When architecture/window positions change, regenerate atmosphere metadata alongside the usual navigation/GLB exports:

```sh
blender --background --threads 4 --python scripts/export_atmosphere.py
npm run build
npm run test:illustration
```

The rendering pass allocates one colour/depth target at the drawing-buffer size and reuses it on every frame. It samples depth edges rather than rendering the world a second time for outlines. Transparent smoke/water use their existing blending; this is a stylized real-time treatment, not a recreation of the reference video's exact shader or a hand-painted asset pack.

## Validation

`test:illustration` runs on the development server at port 4173, or against `BASE_URL`. It checks map/house entry, forest/bank/chimney counts, day/night window visibility, winter changes, renderer reuse and JavaScript/shader errors. Development additionally checks actual smoke movement and nearby house light activation, and captures balcony/bank views. Evidence is ignored in `artifacts/illustration/`.

Existing `test:walk`, `test:stairs`, `test:planting` and `test:environment` validate the unchanged routes, upstairs access, safe planting and weather/shelter rules. The screenshots are a visual review; headless software WebGL does not establish GPU frame rate or low-end mobile performance.
