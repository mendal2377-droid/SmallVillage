from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1]
for p in (R.parent/'village_reference/renders').glob('*.png'):
    Image.open(p).convert('RGB').save(R/'public/images'/f'{p.stem}.webp',quality=88,method=6)
print('Converted final render assets')
