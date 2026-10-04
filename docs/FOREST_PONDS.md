# Forest koi garden

The owner's pond screenshots guide this additive, imagined garden: clear jade water, animated light patterns on gravel, white/red/black/gold koi, notched lily pads, lotus flowers, spotted frogs, mossy rocks, a wooden bridge, an open pavilion and a small cascade with a turtle. The supplied video URL was unavailable to the web reader; the attached frames are the visual evidence. All geometry and shaders are original, generated locally, with no external assets needed during play.

## Implementation

- Both existing woodland pond boundaries remain in `woodland-layout.js`. `forest-pond.js` adds their beds, water and garden. The former opaque forest water and generic forest fish/lotus have been replaced; village ponds keep their existing native fish and ecology.
- `pond-layout.js` supplies shared rail/rock/trunk colliders and the two gentle bridge ramps. The 24 m bridge crosses the western cove of Dragonfly pond, with clear entrances. Existing forest routes remain intact; an extra path connects the bridge. The forest pin enters beside its northern approach.
- `pond-life.js` supplies reusable koi bodies/fins, veined notched pads, lotus, spotted frogs and turtle. There are 48 bounded koi with six coat patterns and 66 floating lily groups. Swimming and tail motion are time based, with a school close to each viewing shore.
- `pond-materials.js` supplies gravel and moving caustics, translucent Fresnel water and original koi coats. The main ground and fallback floor discard pixels inside forest ponds, so underwater geometry remains visible. Transparency does not write depth. No second reflection render or network texture is required.
- Winter hides lilies, blossom crowns, the cascade and turtle, lightens moss/roof and adds a milky water surface. Night and wet weather adapt the pond lighting. These changes preserve fishing, chicken flight, weapons and coast navigation.

## Validation

`npm run test:pond` checks a complete bridge crossing and return, camera elevation, off-bridge water barriers, koi bounds/depth and seasons. `npm run test:pond-ui` checks real WebGL shader compilation, desktop/touch entry, pond rendering, winter/night and return to the courtyard. Browser screenshots and results go to ignored `artifacts/pond/`.

Also run woodland, planting, coast, comfort, fishing, aim and game regressions plus the production build. Check the ground-level koi and bridge views before publishing: passing a JS build alone does not prove the GLSL shaders compile.
