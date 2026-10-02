# 闫老寨：视频住宅与小巷重建

## Deliverable

Open **Yanlaozhai_Video_House_and_Lane.blend** in Blender. It contains the previous village scene with a detailed house and side alley based on the supplied 54.5-second video. The original village file is unchanged.

The opening camera is **VIDEO A | Courtyard balcony and blue shed**. Switch to cameras **VIDEO B–D** for the alley, entrance and village context. The five **VIDEO 00–04** collections contain the editable architecture, alley, household objects, vegetation and cameras. Previous parcels 002 and 003 are retained in disabled **BACKUP** collections.

## Reference matches

| Video time | Modeled details |
| --- | --- |
| 00–15 s | Narrow brick alley, shallow puddles and muddy ruts, dense ivy, gray plaster walls, barred windows, overhead wires, mint scooter and loose tarps |
| 17–21 s | Burgundy metal entrance, pedestrian inset door, gold Chinese plaque, concrete step and passage |
| 21–29 s | Blue corrugated shed with open bay, hanging white sheet and red towel, bundled stalks, heap of cut vines |
| 29–41 s | White two-storey house, glossy dark red plinth, enclosed glazed balcony, rectangular ceramic tiles and decorative gold bands, low courtyard wing |
| 43–53 s | Teal insect curtains, drying rack, white washing machine, stools and basins, red-covered table and laptop |

## Accuracy and assumptions

The visible finishes and architectural features follow the video. This is a visual reconstruction, not a measured scan. The approximate 12 × 14 m house parcel, building heights, hidden rooms, roof layout and courtyard connections are estimated. Cardinal orientation and placement within the earlier village model remain provisional; the video does not establish village-wide geography. Fine graphics and furniture are simplified.

根据视频重建了可见立面、院落和小巷；尺寸、不可见房间、屋顶细节与村内位置均为推测，不能作为测绘成果。

## Files

- `01_video_courtyard.png`: house, enclosed balcony and shed
- `02_video_alley.png`: wet brick lane and ivy-covered wall
- `03_video_entrance.png`: entrance and passage
- `04_video_context.png`: revised area within the village
- `reference_contact_sheet.jpg`, `timeline_1.jpg`–`timeline_3.jpg`: local analysis stills
- `rebuild_from_video.py`: reproducible Blender build/render script
- `finish_video_revision.py`: final daylight/material adjustments and delivery renders; run after the build script
- `validation_video_revision.json`: saved-file and asset checks

Source: `D:/blender/hometown/a7052683d1582cdbe0d08dca263a9642_raw.mp4`. The source video was processed locally and left unchanged.
