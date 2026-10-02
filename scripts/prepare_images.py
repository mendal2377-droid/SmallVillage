from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1]
source=R.parent/'yanlaozhai'
for filename,slug in [('01_video_courtyard.png','courtyard'),('02_video_alley.png','alley'),('03_video_entrance.png','entrance'),('04_video_context.png','context')]:
    im=Image.open(source/'video_revision'/filename).convert('RGB');im.thumbnail((1600,1500));im.save(R/'public/images'/f'{slug}.webp',quality=88,method=6)
im=Image.open(source/'01_aerial.png').convert('RGB');im.thumbnail((1500,1000));im.save(R/'public/images/village.webp',quality=86,method=6)
