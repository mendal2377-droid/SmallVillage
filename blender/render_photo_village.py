"""Render final photo-based village and corrected house; source stays unchanged."""
import bpy,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'))
S=bpy.context.scene
OUT=R.parent/'village_reference/renders';OUT.mkdir(parents=True,exist_ok=True)
S.render.engine='CYCLES';S.cycles.samples=12;S.cycles.use_denoising=True;S.cycles.max_bounces=4
S.render.resolution_x=1200;S.render.resolution_y=900;S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG'
views=[('village','MAP A | Village and fields','green'),('villageplan','MAP B | Village plan','green'),('avenue','MAP C | Poplar avenue','green'),('fieldpath','MAP D | Field path','green'),('winterlane','MAP C | Poplar avenue','winter'),('cornpath','MAP D | Field path','corn'),('courtyard','VIDEO A | Courtyard balcony and blue shed','green'),('context','VIDEO D | House within village','green'),('kitchen','INTERIOR camera Kitchen','green'),('upstairs','ROOF camera corridor','green'),('terrace','ROOF camera terrace','green')]
if '--' in sys.argv:
    only=set(sys.argv[sys.argv.index('--')+1:]);views=[v for v in views if v[0] in only]
for key,name,season in views:
    for o in S.objects:
        tag=o.get('season')
        if tag:o.hide_render=(season=='winter') if tag=='leaves' else tag!=season
    S.world.node_tree.nodes.get('Background').inputs[0].default_value=(.60,.73,.9,1) if season!='winter' else (.72,.76,.81,1)
    bpy.data.lights['MAP daylight'].energy=2.3 if season!='winter' else 1.1
    S.camera=bpy.data.objects[name];S.render.filepath=str(OUT/(key+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDER FINISHED',key,flush=True)
