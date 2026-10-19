# Phase 1 — style frames

Four painterly vignettes for choosing the art direction before mass asset production. Built by `build_style_lab.py` (shared builders in `style_lib.py`) into `style_lab.blend`. Renders are in `renders/`.

```sh
blender -b --factory-startup --python blender/rebuild/build_style_lab.py -- --render all --noink           # 1920x1080
blender -b --factory-startup --python blender/rebuild/build_style_lab.py -- --render avenue --preview --only avenue --noink   # quick 960x540
```

The authoritative village file is only read. The courtyard is appended from it, and it is never saved.

| Frame | Season / time | Based on |
| --- | --- | --- |
| `avenue` | Late April, late afternoon | Poplar road photos 04/05/08/09: whitewashed trunk bases, drainage ditch, poles and wires, flat wheat plain |
| `pond` | Summer morning | The algae-green north pond on the satellite map; willows, reeds, ducks, a fishing stool and rod; flat-roof village across the water |
| `edge` | Late May wheat harvest, sunset | Field path (photo 10), white irrigation well hut and stakes, combine harvester, green-canopy electric tricycle, village edge with poplars |
| `courtyard` | Summer afternoon | The real reconstructed house (VIDEO collections), toon-converted, with stools, basins, potted plants, a floral sheet on the line, bean stalks and the tricycle |

## The look

- **Painted toon shading.** Each material is lit as two soft tones: a warm lit tone and a cool blue shadow, blended with a soft edge. Brush-like noise breaks up flat areas, and surfaces darken slightly toward the ground.
  - Everything goes through one shared node group: `SV Painted Toon`.
  - The shared nodes `global lit` and `global shadow` tint the whole scene per time of day (warm noon, orange sunset).
- **No ink outlines on landscapes.** Hand-painted anime backgrounds are lineless. Outlines can stay an option for characters (the child and dog) later. Freestyle outlines were also far too slow on this many trees.
- **Sky:** a painted gradient dome plus sculpted cumulus clouds. The world shader is only a dim ambient fill, because EEVEE lights the scene from the world shader. A bright sky there would wash out every cast shadow.
- **Signature details from the photos:** whitewashed poplar bases, flat roofs with railings, grey cement gable walls, red gates, burgundy plinths, blue sheds, white well huts, poles and wires.

## Placeholder or not yet decided

- Trees, houses, props and vehicles are quick procedural kit pieces. Phase 2 replaces them with properly modelled assets.
- Clouds are still a little "sculpted". Hand-painted cloud cards are an option.
- The walls have no hand-painted texture yet. A painted texture atlas (Phase 2) adds stains, tile joints and hand-written couplets.
- Fine leaf texture, poplar fluff, chimney smoke and the dog and child are not in these frames.

## Questions for review

1. Is the overall look (soft toon shading, no outlines, saturated but gentle colours) the right direction? Should it be more painterly or more realistic?
2. Is anything you'd recognise at first sight missing from these four views?
3. Colour mood: is the warm sunset at harvest right, or would you prefer the hazy winter light that appears in many of your photos?
