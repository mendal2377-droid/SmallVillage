import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parent
P=R/'Yanlaozhai_Video_House_and_Lane.blend'
bpy.ops.wm.open_mainfile(filepath=str(P))
S=bpy.context.scene
# Match the brighter overcast plaster seen in the recording.
for name,a,b in [
    ('V | aged white courtyard plaster',(.56,.57,.54),(.89,.89,.84)),
    ('V | mottled grey exterior render',(.28,.32,.30),(.67,.69,.66)),
]:
    m=bpy.data.materials[name]
    for n in m.node_tree.nodes:
        if n.type=='VALTORGB':n.color_ramp.elements[0].color=(*a,1);n.color_ramp.elements[1].color=(*b,1)
S.view_settings.exposure=.70
S.cycles.samples=20;S.cycles.use_denoising=True
S.render.threads_mode='FIXED';S.render.threads=6
S.cycles.use_light_tree=True
views=[('VIDEO A | Courtyard balcony and blue shed','01_video_courtyard.png',1400,1138),('VIDEO B | Damp brick alley and ivy','02_video_alley.png',1100,1400),('VIDEO C | Entrance and courtyard passage','03_video_entrance.png',1300,1114),('VIDEO D | House within village','04_video_context.png',1400,1138)]
S.camera=bpy.data.objects[views[0][0]];S.render.resolution_x=1400;S.render.resolution_y=1138
bpy.ops.wm.save_as_mainfile(filepath=str(P))
manifest={'blend':str(P),'source_video':S['video_reference'],'scope':S['video_reconstruction_scope'],'new_objects':sum(len(c.objects) for c in bpy.data.collections if c.name.startswith('VIDEO ')),'views':[]}
for camera,name,w,h in views:
    S.camera=bpy.data.objects[camera];S.render.resolution_x=w;S.render.resolution_y=h;S.render.filepath=str(R/name)
    print('RENDER',name,flush=True);bpy.ops.render.render(write_still=True)
    manifest['views'].append({'camera':camera,'file':name,'size':[w,h]})
S.camera=bpy.data.objects[views[0][0]];S.render.resolution_x=1400;S.render.resolution_y=1138
bpy.ops.wm.save_as_mainfile(filepath=str(P))
(R/'video_revision_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('FINAL RENDERS COMPLETE',flush=True)
