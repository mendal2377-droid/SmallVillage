"""Read current architecture to locate illustrated window lights and chimney accents.
Does not alter or save the Blender source. Output uses village/browser coordinates.
"""
import bpy, json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'))
windows=[]
for o in bpy.context.scene.objects:
    if o.type!='MESH' or not any(any(c.name.startswith(p) for p in ['VIDEO 00','VIDEO 05','MAP | Residential','MAP | Photo']) for c in o.users_collection):continue
    names=' '.join(m.name for m in o.data.materials if m).lower()
    if not any(n in names for n in ['window glass','blue grey windows','clear balcony glazing']):continue
    if 'internal' in o.name or 'transparent balcony pane' in o.name:continue
    pts=[o.matrix_world@Vector(p) for p in o.bound_box]
    lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
    dims=[hi[i]-lo[i] for i in range(3)]
    if dims[2]<.3 or min(dims[:2])>.15:continue
    windows.append({'name':o.name,'centre':[(lo[0]+hi[0])/2,(lo[2]+hi[2])/2,-(lo[1]+hi[1])/2],
                    'size':[dims[0],dims[2],dims[1]],'house':any(c.name.startswith('VIDEO') for c in o.users_collection)})
out={'windows':windows,'note':'Actual window bounding boxes. Chimneys and lamps are decorative artistic additions.'}
(R/'public/models/atmosphere.json').write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
print('ATMOSPHERE WINDOWS',len(windows),sum(w['house'] for w in windows),flush=True)
