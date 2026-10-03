# Level roads and living banks — 4 October 2026

The latest corrections respond to the owner's screenshots of raised road divisions, a poplar blocking a bridge approach, sparse grain and waterside planting.

## Source geometry

`blender/repair_roads_and_planting.py` opens the **current authoritative scene** and makes an ignored backup under `artifacts/road-repair/`. It removes the decorative raised crossbars, retaining the continuous paving beneath them, and aligns ground-level paving and bridge decks with the navigation ground at **0.10 m**. House floors, stairs and parapets are excluded.

The repair removed **637 crossbars** and aligned **67 paving footprints**. It relocated **three complete poplar assemblies**, including each trunk, crown, white base and branches. All **237 mapped poplar trunk centres** now pass the paving/bridge clearance check. Crowns may overhang a road naturally. See [road-repair.json](road-repair.json) for the recorded positions and totals.

The saved `.blend`, both GLBs, navigation and vegetation metadata were exported together. Browser asset version: `roads-and-wetlands-20261004-2`.

```sh
blender --background --threads 4 --python blender/repair_roads_and_planting.py
blender --background --threads 4 --python scripts/export_navigation.py
blender --background --threads 4 --python scripts/export_web_models.py
npm run test:planting
npm run test:walk
npm run test:stairs
npm run build
```

The repair is repeatable against the current scene and preserves its audit totals. It is not a replacement for the historical full-village rebuild. After later architecture edits, run the repair before paired exports so road footprints stay current.

## Placement contract

`navigation.json.village.roads` and `world-details.json.roads` hold matching oriented paving rectangles: `[centreX, centreZ, halfX, halfZ, rotationRadians]`, using browser coordinates. `src/planting.js` shares road, bridge, water and structural exclusion rules. New spreading/fruit trees search nearby safe ground if a requested position is obstructed. Grain, vegetables, reeds and bank details also avoid the paving. Clearance applies to plant centres with a margin; leaves can extend beyond it.

## Density and ecology

- **37 additional spreading/fruit trees**, including **20 orchard trees**: mixed peach, pear, apple and jujube groups, plus larger willow, paulownia, scholar-tree and elm forms near ponds and field edges. These supplement the mapped poplar avenues.
- Closer, uneven grain and vegetable spacing, fuller wheat clumps and more melon foliage. Distant grain retains the existing cheaper stand representation.
- **17 pond frogs** with back ridges, spots, eyes, folded hind legs and toes. Nearby players trigger a hop toward shallow water and a landing ripple; frogs later return to the bank.
- Curved submerged water grass, brown cattails, small floating duckweed patches and **10 dragonflies**, supplementing the existing fish, lotus and flowers. The light-green flowing water shader remains the visual base.
- Frogs and tender wetland planting hide in winter/snow. Dragonflies appear during warmer daylight; summer-night fireflies remain. These are simplified seasonal game rules.

The added ecology is browser-generated in `src/wetland.js` and `src/gardens.js`; it is not present in the Blender file. The road geometry and relocated original poplars are saved in Blender. All new assets are original procedural models, with estimated sizes and placement, rather than scanned or surveyed wildlife.

## Research

Sources guide plausible forms, not identification of species in this particular village:

- [National Forestry and Grassland Administration: national afforestation plan](https://www.forestry.gov.cn/uploadfile/main/2016-7/file/2016-7-27-5b0861f937084243be5d17399f5f5f71.pdf): the Huang–Huai–Hai plain species lists include poplar, willow and elm, plus fruit trees such as apple, pear, peach and jujube.
- [Zhoukou municipal government: 2019 gazette](https://www.zhoukou.gov.cn/upload/file/20190805/6370059317147737509326943.pdf): local planting priorities include paulownia, willow and scholar tree. The scene groups are decorative interpretations.
- [Beijing Forestry and Parks: black-spotted pond frog](https://yllhj.beijing.gov.cn/ztxx/ysdw/zygk/lqpxlzy/201510/t20151013_120725.shtml): green/brown spotted bodies, paired back ridges, water-grass habitats, escape hops into water and winter dormancy inform the frog model and behaviour. Its visual game scale and seasonal timing are simplified.

## Validation

`test:planting` checks exported footprint consistency, all mapped poplars, reproduced old obstruction locations, repaired placements, rotated-road masking and eight bridge routes. `test:walk` and `test:stairs` verify the connected house/yard/village and upper-floor access after the paired export.

With the local dev server on port 4173, `test:ecology` checks the new tree/frog counts, absence of raised-seam batches, clear bridge view, orchard density, actual frog hop, winter hiding and summer return, plus JavaScript/shader errors. Captures are ignored under `artifacts/road-repair/`. The headless browser uses software WebGL; this validation does not establish performance on a normal GPU or low-end mobile hardware.
