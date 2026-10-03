import bpy,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'Yanlaozhai_Video_House_and_Lane.blend'))
S=bpy.context.scene
S.render.engine='CYCLES';S.cycles.samples=20;S.cycles.use_denoising=True
S.render.resolution_x=1280;S.render.resolution_y=960;S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG'
out=R.parents[2]/'interior_reference'/'renders';out.mkdir(exist_ok=True)
views={'kitchen':'INTERIOR camera Kitchen','meeting':'INTERIOR camera Meeting','bedroom':'INTERIOR camera Bedroom','storage':'INTERIOR camera Storage','upstairs':'INTERIOR camera Upstairs','stairs':'INTERIOR camera Stairs','courtyard':'VIDEO A | Courtyard balcony and blue shed','context':'VIDEO D | House within village'}
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else views.keys()
for key in requested:
    # Reload per view so corrections made during a long rendering batch are reflected.
    bpy.ops.wm.open_mainfile(filepath=str(R/'Yanlaozhai_Video_House_and_Lane.blend'))
    S=bpy.context.scene;S.cycles.samples=12;S.cycles.use_denoising=True
    S.render.resolution_x=1280;S.render.resolution_y=960;S.render.resolution_percentage=100
    if key=='storage' and not bpy.data.objects.get(views[key]):
        d=bpy.data.cameras.new(views[key]);cam=bpy.data.objects.new(views[key],d);S.collection.objects.link(cam)
        pos=Vector((8.75,3.5,1.95));target=Vector((10.5,6.3,1.2))
        cam.location=Vector((-37,-109,.12))+pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler();d.lens=20
    S.camera=bpy.data.objects[views[key]];S.render.filepath=str(out/(key+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDERED',key,flush=True)
