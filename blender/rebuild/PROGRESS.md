# SmallVillage 2.0 — progress checkpoint

Saved 20 October 2026, at the end of Phase 2. Resume from here.

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

## Next: Phase 3, village layout in Blender

1. A new `blender/rebuild/layout/` script that links or instances kit assets from `kit/sv_kit.blend`.
2. Ground terrain with channels cut for the ditches and river; kit water sits below z = 0.
3. Roads and lanes:
   - Follow the satellite map (`D:/blender/hometown/village photos/map.png`) and the plan sketch (`village plan.pptx`).
   - One main east–west road, north–south roads on the east and west edges.
   - Three ponds: a large algae-green north pond, a west pond, and an elongated pond south of the centre.
   - The school in the north-east.
4. Courtyard plots along the lanes, rotated to face them using `sv_footprint`.
5. The detailed home quarter: reuse the authoritative house (VIDEO collections in `blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend`) at the confirmed star position.
6. Fields with crops by month (`sv_months`), poplar avenues and shelterbelts, poles with wires (`catenary()`), well huts and stakes.
7. Horizon ring of distant villages and poplar clumps; the dream area placed beyond it.
8. Review renders, then Phase 4: web export (tiles, instancing, LOD, KTX2, splitting `water` faces and `wheels` groups).

Phases 5–9 are unchanged from the plan: main page map modes and paraglider, avatar and dog with animals, activity polish, climate and seasons, then deploy.

## Notes for whoever resumes

- Blender 5.1 EEVEE lights the scene from the world shader. Keep the world as a dim ambient colour and show the sky on a separate dome, or toon shadows disappear.
- The toon ramp thresholds (0.22–0.38) assume sun strength around 4.5 and ambient around 0.45. The `lit` / `shadow` tints act as exposure.
- Write long multi-line patches with the Write tool, not shell heredocs; quoting has broken twice.
