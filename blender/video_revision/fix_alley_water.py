import bpy,math,sys
from mathutils import Vector
from pathlib import Path
R=Path(__file__).resolve().parent
P=R/'Yanlaozhai_Video_House_and_Lane.blend'
bpy.ops.wm.open_mainfile(filepath=str(P))
S=bpy.context.scene
origin=Vector((-37,-109,.12))
poster=bpy.data.objects['Traditional colorful door poster.001']
poster.location=origin+Vector((.44-.045*math.cos(1),-4.17+.045*math.sin(1),1.8));poster.rotation_euler[2]=-1
blessing=bpy.data.objects['Door blessing.001']
blessing.location=origin+Vector((.44-.059*math.cos(1),-4.17+.059*math.sin(1),1.8));blessing.rotation_euler[2]=-math.pi/2-1
for prefix in ['Shallow rain puddle','Irregular muddy rut']:
    for i,o in enumerate(sorted([o for o in S.objects if o.name.startswith(prefix)],key=lambda o:o.name)):
        for v in o.data.vertices:v.co.z=(.094 if prefix.startswith('Shallow') else .089)+i*.001
S.camera=bpy.data.objects['VIDEO A | Courtyard balcony and blue shed'];S.render.resolution_x=1400;S.render.resolution_y=1138
bpy.ops.wm.save_as_mainfile(filepath=str(P))
if '--entrance-only' not in sys.argv:
    S.camera=bpy.data.objects['VIDEO B | Damp brick alley and ivy']
    S.render.resolution_x=1100;S.render.resolution_y=1400;S.render.filepath=str(R/'02_video_alley.png')
    bpy.ops.render.render(write_still=True)
S.camera=bpy.data.objects['VIDEO C | Entrance and courtyard passage']
S.render.resolution_x=1300;S.render.resolution_y=1114;S.render.filepath=str(R/'03_video_entrance.png')
bpy.ops.render.render(write_still=True)
S.camera=bpy.data.objects['VIDEO A | Courtyard balcony and blue shed'];S.render.resolution_x=1400;S.render.resolution_y=1138
bpy.ops.wm.save_as_mainfile(filepath=str(P))
print('PUDDLE OVERLAP FIXED',flush=True)
