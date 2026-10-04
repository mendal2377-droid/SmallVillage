# Painted village and forest lakes

Updated 4 October 2026. The visual direction uses original imagegen foliage and meadow assets, guided by a generated village concept board. See [design/IMAGEGEN.md](design/IMAGEGEN.md) for the artwork, exact prompts, provenance and implementation decisions.

## Current behavior

- Six projected entry pins on the real 3D world, including **Forest & lakes**. The forest shares the village navigation and can also be reached on foot from the east road at z=132.
- Two large jade ponds east of the farms, surrounded by mixed trees, reeds, lotus, fish, frogs and meadow glades. A woodland fishing encounter is available on the western shore of the southern lake.
- Dense flower ribbons beside actual roads, with a joined ochre trail around the new lakes. Flowers and trunks use the road, bridge, building and water exclusions.
- Painted foliage replaces the earlier opaque ball/stacked crown geometry throughout the avenue, orchards, shade trees and distant forest. Branch frames remain; deciduous crowns disappear in winter, while evergreen forest crowns stay.
- Stronger warm key light and softer ambient fill give trees and buildings a clearer painted light/shadow shape. The shared illustration pass remains on houses, toys, vehicles, wildlife, crops and water.
- Summer nights retain stars, fireflies, amber house/yard lights and moving smoke. New meadows hide during winter and become muted in autumn; all environment controls remain available in walk mode.

## Files and source contract

| File | Role |
| --- | --- |
| `src/painted.js` | Loads three local PNGs before world installation; shared foliage material, world-scaled ground painting and volumetric crown templates |
| `src/woodland-layout.js` | Pure deterministic layout and additive navigation: ponds, trail footprints, 330 trunks, safe forest spawn |
| `src/woodland.js` | Walkable woodland, hole-cut ground, flush joined trail, meadow chunks and atmospheric motes |
| `src/world.js` | Painted avenue crowns and new ponds using the same live water shader as village canals |
| `src/map.js`, `src/places.js` | Sixth entry pin, forest/pond/path minimap shapes and woodland fishing site |
| `docs/design/village-concept.png` | Imagegen design board; development reference, not a homepage gallery |
| `public/textures/painted/` | Actual generated foliage, meadow and ground PNGs served with the application |

The `.blend` and paired GLBs still own the measured courtyard and original village. **The new woodland is a browser-created landscape layer**, not baked into the Blender export. `extendWoodlandNavigation` clones the base village navigation before every install and adds its colliders and water boundaries. Never copy that augmented object back into `navigation.json`, or the layer will duplicate on load. When moving lake/path layouts, edit `WOODLAND` and run the navigation and browser checks together. The main game, planting masks, minimap and environment all receive that same augmented object.

## Validation

`npm run test:woodland` checks deterministic layout, trunk exclusions, every half-metre along each trail, blocked pond water, safe forest entry and continuous yard–forest–yard walking. `npm run test:painted` checks rendered assets, six pins, forest entry, flower exclusions, live winter/evergreen behavior, summer night and yard re-entry. Screenshots/results are written under ignored `artifacts/woodland/`.

`npm run test:touch`, `npm run test:walk`, `npm run test:stairs`, `npm run test:environment` and `npm run test:illustration` retain the existing platform/navigation/environment coverage. This is an illustrated interpretation, with original artwork applied to a navigable 3D scene; it does not reproduce every brushstroke of the concept board.
