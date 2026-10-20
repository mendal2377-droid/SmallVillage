# SmallVillage 2.0 — progress checkpoint

Saved 20 October 2026: Phases 1–2 done, Phase 3 first and second passes done. Resume from here.

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

### Still open for Phase 3

- Dream-area placeholder beyond the horizon.
- Review renders for other months: May (harvest), October and January.

### Next: Phase 4, web export

Tiles, instancing, LOD, KTX2, and splitting `water` faces and `wheels` groups.

Phases 5–9 are unchanged from the plan: main page map modes and paraglider, avatar and dog with animals, activity polish, climate and seasons, then deploy.

## Notes for whoever resumes

- Blender 5.1 EEVEE lights the scene from the world shader. Keep the world as a dim ambient colour and show the sky on a separate dome, or toon shadows disappear.
- The toon ramp thresholds (0.22–0.38) assume sun strength around 4.5 and ambient around 0.45. The `lit` / `shadow` tints act as exposure.
- Write long multi-line patches with the Write tool, not shell heredocs; quoting has broken twice.
