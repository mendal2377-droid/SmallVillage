# SmallVillage 2.0 — progress checkpoint

Saved 21 October 2026: Phases 1–6 done and Phase 7 started (pond fishing done; other activities next). Resume from here.

- **Plan:** `D:/blender/hometown/REBUILD_PLAN.md` (phases, research, decisions)
- **Repo:** `D:/blender/test0910/SmallVillage`, branch **`rebuild-2027`**. It is local only and not pushed. `main` is untouched, and the live site still runs the old version.

## Decisions (all settled)

- The coast, beach and forest lakes stay only as a separate "dream area", never visible from the real village.
- Ponds follow the satellite map (3 ponds). The 文化大院 in the north-east is the school.
- The old friend is not shown.
- The avatar is a typical village child with a small cute dog.
- Detail: the home quarter is fully detailed, the rest of the village is medium detail, and the horizon uses painted strips.

## Done

| Phase | Result | Where |
| --- | --- | --- |
| 1 Art direction | Approved painterly toon look: two-tone warm/cool shading, no outlines on landscapes, painted sky dome | `blender/rebuild/build_style_lab.py`, `STYLE_FRAMES.md`, `renders/*.jpg` |
| 2 Asset kit | 304 assets, all within triangle budgets. One palette material with seasonal palette swap | `blender/rebuild/kit/` (see `KIT.md`) |

Kit batches:

1. Trees, crops and ground cover
2. Buildings: 8 courtyard plots, house blocks, gates, walls, sheds, the school
3. Roads, ditches, river, bridges and utilities
4. Props and vehicles
5. Animals — **deferred to Phase 6**, together with the avatar and dog
6. Clouds, horizon strips, and 10 sky and light presets (`sky.py`)

Regenerate the kit (`sv_kit.blend` is ignored by git):

```sh
"D:/soft/blender/blender.exe" -b --factory-startup --python blender/rebuild/kit/build_kit.py -- --sheet --preview
```

Use `--groups <name,...>` to render only some review sheets. `presets` renders the sky preset scene.

## Phase 3, village layout — first pass done (20 Oct 2026)

`blender/rebuild/layout/` builds `village_layout.blend` (ignored by git) from the kit and the authoritative house:

```sh
"D:/soft/blender/blender.exe" -b --factory-startup --python blender/rebuild/layout/build_layout.py -- --month 8 --preset "summer afternoon" --render overview,plan --preview
```

Cameras: `overview`, `plan`, `satellite`, `main road`, `north pond`, `avenue`, `home aerial`, `home courtyard`. Underscores also work in names.

- **`layout_data.py`:** the satellite trace in map metres, with scale bar 86 px = 50 m. `to_world()` puts the star (map 565, 400) on the existing house origin (−37, −109), so the old house and walk coordinates still hold. It covers roads and lanes, three ponds, ditches, the south canal, bridges, housing regions, exclusions, tree belts and the field extent.
- **`build_layout.py`:**
  - appends the kit;
  - builds the terrain as an adaptive quadtree with holes for water (21k cells merged to about 400 faces), replacing the earlier boolean approach, which failed;
  - chains road, ditch and canal modules;
  - generates courtyard rows facing south onto lanes (515 plots, 46 gardens) and places the school;
  - brings in the toon-converted home quarter (house plus photographed neighbours), with the plots kept clear of it;
  - adds poplar avenues, pond willows, the west shelterbelt, field parcels by month, well huts and stakes, poles with catenary wires, solar lamps and the transformer;
  - adds the horizon ring and clouds from the sky preset.
- **Review images:** `layout/renders/*.jpg`.

### Phase 3 second pass — done (20 Oct 2026)

- **Fit check:**
  - The `satellite` camera renders an orthographic top view exactly matching the traced crop. `renders/satellite_overlay.jpg` blends it 50/50 with the gridded satellite image.
  - Roads, ponds and house rows line up. The block between the north pond and the school is now fields, as on the satellite.
  - Four `GROVES` traced from the satellite canopy are planted with trees instead of plots.
- **Home quarter:**
  - 18 photo-based props in the courtyard, alley and terrace, at real positions on the courtyard slab. They are seasonal: corn drying in September–October and chillies in September–February.
  - 15 standalone house blocks fill the spots next to the house, ponds and groves where a full courtyard plot does not fit.
- **Near the views** (avenue, home, main road, north pond):
  - Kit crops at the month's growth stage: full detail within 60 m, LOD1 to 110 m, kept clear of road corridors.
  - Verge grass, plus wildflowers in April–September.
- **Current counts:** 432 plots, 51 gardens, 15 infill blocks, 459 grove trees, about 11.9k objects. A build takes about 1.5 minutes plus renders.

### Phase 3 closed (20 Oct 2026)

- **Season check:** `renders/seasons_*.jpg` compare May (golden sunset, ripe wheat), August, October (golden poplars, sown wheat) and January (bare poplars over green winter wheat in haze) for the avenue, overview, home aerial and courtyard.
- **Fixes from that check:**
  - September now uses the summer palette; poplars turn only in October–November.
  - The winter-haze exposure is lowered so white walls don't clip.
- **Dream area:** the `DREAM AREA anchor` empty sits 6 km east of the village centre, far beyond the horizon ring. It marks where the web build loads the coast, beach and forest lakes after a deliberate transition.

## Phase 4, web export — first version done (20 Oct 2026)

```sh
"D:/soft/blender/blender.exe" -b --factory-startup --python blender/rebuild/layout/build_layout.py -- --export --month 8
"D:/soft/blender/blender.exe" -b blender/rebuild/layout/village_layout.blend --python blender/rebuild/export/export_web.py
npm run dev   # then open http://127.0.0.1:4173/village-2027.html  (?view=avenue&month=1&sky=winter%20haze%20morning)
```

- **Export** (`blender/rebuild/export/export_web.py`) → `public/models/v2/`, 2.6 MB in total, Draco-compressed:
  - `assets.glb` (1.3 MB): every kit mesh once, with no materials.
  - `static.glb` (0.85 MB): terrain, ponds, fields and the merged home quarter (104k triangles, materials named).
  - `village.json` (0.45 MB): 7,994 instances under 63 asset keys with leafy/bare states and LODs, seasonal props with their months, the palette, the crop calendar, sky presets, wires, viewpoints, and the home and dream anchors.
- **Web preview** (`village-2027.html`, `src/v2/`). The original app is unchanged; `vite.config.js` builds both pages.
  - `toon.js` ports the painted toon shader onto `MeshLambertMaterial`, giving matching light, ramp and tints.
    - Lighting matches Blender: three.js light intensity equals the Blender sun strength, ambient is π × world strength, and there's no tone mapping.
    - The palette's water cell, the ponds and the fields have their own shader branches: animated water with algae, and crop stripes coloured from the crop calendar.
  - `village.js` builds `InstancedMesh` tiles of 300 m. Full detail is per instance within 70 m of the camera (re-split every 10 m), with LOD1 to 450 m and LOD2 beyond. Distant tiles cast no shadows.
  - Seasons swap the palette texture, leafy/bare geometry, crop colours and seasonal props.
  - Sky dome, sun, ambient light and fog come from `sky.py`; clouds come per preset.
  - `main.js` has orbit and simple eye-height walking (no collisions yet), plus month, sky and viewpoint selectors.
  - `window.__sv2` is a test hook that renders one frame on demand and returns draw calls and triangles.
- **Measured** (hidden pane, shadow pass included): 1.4–3.0 M triangles and 200–400 draw calls per view, 8–14 ms per frame. The build passes.

### Phase 4 completed (20 Oct 2026)

- **Walking with collisions:** the preview reuses the app's `src/walk.js` (sliding, stairs, drag-to-look, touch input).
  - `export_web.py` writes `village.json.nav` with 5,743 oriented boxes:
    - one per courtyard plot and house block, plus the school;
    - trunks, poles and huts;
    - water as boxes along the ditches, canal and pond interiors, with gaps wherever a road or bridge crosses.
  - It also includes the original house boxes and stair/floor surfaces inside the home quarter (same coordinates), so the house walk and stairs work as before.
  - **Tested:**
    - from the main road, walking north stops at the first row of courtyard plots;
    - on the pond bank, the player stops at the water;
    - in the courtyard, the player stops at the house front and at the laundry line.
- **Run-time crops** (`src/v2/crops.js`):
  - Kit crops at the month's stage around the player, from the exported field parcels, kept off road corridors.
  - Placement is stable (world grid with hash jitter) and refreshes every 6 m.
  - Ranges: full detail within 25 m and LOD1 to 60 m on high; 12 m and 30 m on phones.
  - Crops are hidden when the camera is above 40 m.
- **Quality tiers:** `high` / `low` ("Phone"), with `auto` picking low for touch devices, small screens or weak CPUs. A selector and `?quality=` set it by hand.
  - The phone tier lowers pixel ratio, shadow map size and extent, near-detail and LOD distances, and crop radius.
  - It sets a 900 m view distance with stronger fog, casts shadows only from full-detail tiles, and shows fewer clouds.
  - Small field details (stakes, well huts, wellheads) are distance-culled on both tiers.
  - Phone layout: the touch D-pad appears while walking, and the control panel folds to its title.
- **Measured** (shadow pass included):
  - high: 310–390 draw calls, 1.4–4.1 M triangles;
  - phone: 230–290 calls (207 at phone size on the avenue), 0.7–2.0 M triangles.
- **Remaining performance work (Phase 9):** merge per-tile variants with `BatchedMesh`, and atlas the 89 home-quarter materials. Rideable vehicles (splitting `wheels`) wait for the activities phase.

## Phase 5, main page — done (21 Oct 2026)

`village-2027.html` opens on the **painted map**, with **Map / 3D** modes. Choosing a place starts a **paraglider landing**, which hands over to walking.

- **Map sheets:**
  - Blender's `mapsheet` camera renders orthographic views of `MAP_SHEET` (an 1100 m square, 4096 px) for April, August, October and January.
  - `blender/rebuild/layout/paint_map.py` (Pillow + numpy) paints them: mode-filter brush patches, warmer colour, light ink edges, paper grain and wash, and an irregular paper-fade border.
  - Output: `public/images/v2/map_{spring,summer,autumn,winter}.webp`, 2048 px, 165–220 KB each.
- **Places:** `layout_data.PLACES` has ten spots with Chinese and English names, a landing point and a "look toward" point. The exporter writes `places` and `mapSheet` into `village.json`. Home is the house lane start, looking north toward the gate.
- **`src/v2/landing.js`:**
  - 2D map with pan, wheel zoom and pinch.
  - Pins stay readable when zoomed.
  - Tapping anywhere lands "here".
  - The dream coast is a faded inset marked as coming later.
  - The 3D mode projects the same pins over the orbit overview.
  - Map images follow the selected season.
- **`src/v2/glide.js`:**
  - A cubic Bezier from about 300 m up, with the final approach along the place's view direction.
  - Banking from the path's turn and a gentle sway.
  - A flare, after which the canopy folds away.
  - The glide lasts 11 s the first time and 6.5 s on repeat visits (localStorage `sv2-glides`). Any key or tap skips it.
  - A flat-celled red, yellow and white wing with lines frames the top of the view.
  - Landing calls `startWalking`. "↩ 地图 Map" returns to the chosen map mode.
- **UI:** The title is bilingual (闫老寨 · 小村). The developer panel (month, sky, view, quality) starts folded and hides while gliding. `?view=` still jumps straight to a view for tests. The test hook `window.__sv2` adds `land`, `glider`, `landing` and `backToMap`.
- **Regenerate:** render the map sheets (`build_layout.py -- --export --month N --render mapsheet`), then run `python blender/rebuild/layout/paint_map.py`. For data, run the export layout (`--export --month 8`) and then `export_web.py`.

## Phase 6, child, dog and animals — done (21 Oct 2026)

- **Kit batch 5** (`blender/rebuild/kit/build_creatures.py` → `public/models/v2/creatures.glb`, 86 KB):
  - Ten part rigs: a generic village child, a yellow village dog, a cat, a goat, brown and white hens, a duck, a goose, a magpie and a sparrow.
  - Each rig is an empty `RIG <name>` with rigid parts parented at their joints (`<name>:<part>`), 530–890 triangles per creature, using the shared palette.
  - The child's shirt and trousers are seasonal palette slots: a striped shirt in summer, a red top in winter.
  - Review sheets: `kit/renders/creatures_people.png` and `creatures_birds.png`.
- **`src/v2/creatures.js`:**
  - Procedural gaits (biped, quadruped with sit, wag and sniff; birds with walk, peck, flap and swim).
  - `createLife` handles the avatar, the dog and the animals; `createFollowCamera` handles the third-person view.
  - **Avatar:** the walk controller now drives an invisible `player` camera, so collisions and stairs are unchanged.
    - The visible camera follows the child (52° FOV) with a boom that shortens against walls.
    - In tight spots it switches to the child's eyes. V or the button switches first/third person.
  - **Dog:** follows at heel with steering around obstacles, and catches up when more than 28 m away. When placed, it starts somewhere with a clear line to the child (never behind a courtyard wall) and runs to meet you. It wags while you walk, sits when you stop, and sniffs about.
  - **Animals near the player** (refreshed every 25 m, removed beyond 140 m):
    - hens at plot gates (some in the family courtyard);
    - ducks and geese on the ponds (half as many in winter);
    - goats tethered beside the field roads;
    - cats near gates;
    - magpies and sparrow flocks, which fly off when the child comes near.
  - Each species draws each body part as one `InstancedMesh`, so draw calls don't grow with the number of animals.
- **Tested:**
  - the dog keeps heel at 1.6 m on the avenue and in the house lane;
  - 34 animals spawned around the home, 17 on the avenue;
  - about 390 draw calls with everything in view;
  - no console errors, and the build passes.
- **Regenerate:**
  - `blender -b --factory-startup --python blender/rebuild/kit/build_creatures.py -- --sheet`;
  - after palette changes, refresh `village.json` (re-run `export_web.py`, or rewrite its `palette` from `palette.py`).

## Phase 7, activities — fishing done (21 Oct 2026)

- **`src/v2/fishing.js`**: pond fishing the way village children do it, with a bamboo hand pole (手竿) and a float, and no reel.
  - **Spots:** `export_web.py` now writes `pondShapes` (water outlines and the water height) into `village.json`. Within 4.5 m of a pond edge, a "🎣 钓鱼 Fish · F" button appears. The child steps to the nearest standing room on the bank (the bank collider keeps walkers about 3 m from the water) and faces the water.
  - **Cast:** hold to swing the rod back, release to cast 3.5–8 m. The float arcs out with a plop, rings and spray. Bait is a worm (蚯蚓) or dough (面团); each changes the species odds.
  - **Watch:** the float bobs on the water. Nibbles are small dips with rings, and sometimes a small fish teases first. The real bite depends on the species: a crucian lifts the float until it lies flat (顶漂); a carp sinks it (黑漂); a grass carp drags it away; a loach or gudgeon makes it jitter. Each species has its own strike window (0.55–1.5 s).
  - **Miss:** striking too early sends the float flying back over the child's head, and the child scratches their head. Striking too late means "the fish stole the bait". Either way, one tap casts again.
  - **The fight:** hold to pull while the fish rests. When it runs left or right, let go and lean the other way (A/D or the ◀ ▶ buttons). Pulling against a run, or leaning the wrong way, raises tension. The tension bar goes green, then yellow, then red, then the line snaps. A big fish that isn't yet tired bolts when it sees the bank. The rod bends towards the pull and the line sags less as tension rises. Far out, the fish shows as a dark shadow with wake rings; near the bank it thrashes at the surface. The species stays a surprise until it is landed.
  - **The jump:** carp and especially grass carp may leap during a run. It plays in slow motion (the scene's time scale drops to 0.3 near the top), with spray and splash. Pulling during the leap throws the hook.
  - **Landing:** the fish swings out of the water into the child's hands. The camera turns to a front "photo" shot, the child hops, and the dog comes over.
  - **Catch card:** species (zh/en), length, weight (a·L³), number of jumps, pond, month, sky and bait, with "new species" and "biggest yet" flags. You choose Keep (into the red bucket beside the child) or Release (the fish splashes back).
  - **Journal (鱼谱, J or the 📖 button):** five species cards (unknown ones are silhouettes) with count and biggest length, plus the last 8 catches. Stored in localStorage under `sv2-fish-journal`.
  - **Conditions:**
    - The sky preset sets the bite rate: dusk, golden sunset, overcast and stormy skies are good; a summer afternoon is slow.
    - Ponds have their own species mix; grass carp and loach feed mainly in the warm months.
    - December to February the pond is frozen.
  - **Feel:**
    - Synthesised sounds: whoosh, plop, nibble tick, splash, rod creak, snap, chime.
    - Phone vibration on bites, runs, jumps and snaps (only after the first touch).
    - Slow motion for the rest of the scene too (`fishing.timeScale` scales the life update and the toon time).
  - **Controls:**
    - Space, F or the mouse on the view to act; A/D or the arrow keys to lean; B for bait; Esc to stop.
    - On phones, a panel replaces the walking arrows.
    - The camera stands over the shoulder, closer while watching the float, and further back on portrait screens.
  - **Pacing tested** with a scripted "good player":
    - an 18 cm crucian lands in about 6 s, a 45 cm carp in 19 s, and a 68 cm grass carp in 38 s (two jumps);
    - pulling the whole time snaps the line within a few seconds.
- **Hooks:**
  - `creatures.js` `life.setPosture(fn)` applies an activity pose after the walking pose.
  - `__sv2.fishing()` gives `start`, `press`, `release`, `setLean`, `forceBite`, `forceJump`, `state` and `clearJournal`.

### Next

- Phase 7, continued: the other activities in the new village (the old app's toys and adventures: kites, the swing, catching dragonflies, the tricycle ride, harvest work), with seasonal activities (sliding on the frozen pond in winter, wheat harvest in May). Ice fishing could also be added.
- Phase 8: climate and seasons (monthly calendar, weather, wetness, snow cover as a shader, wind, ambient sound).
- Phase 9: performance (BatchedMesh, home-quarter material atlas) and deploy. Switch `index.html` to the new page only when the owner agrees.
