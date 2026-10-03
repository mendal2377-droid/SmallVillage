# Photo and roof revision — 3 October 2026

## References inspected

17 village photos and the satellite screenshot in `D:/blender/hometown/photos`, the user's road/river/pond/school sketch, and the sketch with a star marking the courtyard house. All 30 images in `D:/blender/hometown/roof` include house photographs and screenshots identifying discrepancies. The 42.37-second `balcony.mp4` was inspected through sequential frames, alongside the two previously reviewed house recordings. Private source media stays local.

## Final scene

The lower-right residential strip contains the detailed house, below the east-west stream and just west of the eastern perimeter road. The sketch controls road connections, central and eastern waterways, two ponds, surrounding fields and the school. North is assumed to be at the top, consistent with the satellite reference. The scene contains 184 estimated surrounding parcels and 237 poplars. Distances, individual plots and most neighboring facades remain estimates.

House corrections include white corridor soffits and beams, darker balcony frames, visible ceramic joints, an end door, a high kitchen window, lowered tiled stove and preparation counters with open shelves, a narrower blue shed opening and the green door onto the cleaned roof terrace. The terrace has low parapets, a downpipe and a small satellite dish. Loose bricks, shoes, bags, stalk piles and temporary clutter are omitted. Upper rooms remain sparsely furnished because their contents are not fully documented.

## Exploring

The complete house is part of the village model. Visitors can walk along its lane, pass through the red gate's pedestrian opening, enter rooms, climb both stair flights and step out onto the terrace. Exported floor ramps and height-dependent wall barriers protect the stairs and roof edges. Water is blocked except at bridges.

Walking fills the viewport and hides page panels, captions and orbit controls. A small menu and exit button remain. The initial movement hint fades; arrow controls appear only for touch devices. Opening the menu pauses movement and releases the mouse.

Spring uses low green field crops. Summer uses green tall corn, autumn dry corn, and winter snow with bare poplars. Weather independently controls clear, overcast, rain, snowfall and sunset lighting. Camera-centred rain and snow particles stop under exported roof footprints. Concrete becomes less rough in rain. These are visual conditions; weather does not change movement physics. There is no ambient audio. The village orbit view highlights the house and offers a focus button; the lane starting point leads through the same continuous scene.

## Reproducing exports

The saved `.blend` contains the final geometry. Run `scripts/export_navigation.py` and `scripts/export_web_models.py` in Blender background mode. `blender/render_photo_village.py` produces the updated gallery; `scripts/finish_photo_assets.py` converts its PNGs to WebP. Rebuild scripts use explicit local backups outside the repository; running an earlier rebuild script can replace later changes. Export from the saved scene when refreshing browser assets.

`npm run test:stairs` covers room entry, both stair flights, roof parapets, descent and the continuous village-to-roof route. `npm run test:village` exercises seasons, weather, roof sheltering, immersive menu/exit, physical keyboard climbing and mobile touch controls in Edge.
