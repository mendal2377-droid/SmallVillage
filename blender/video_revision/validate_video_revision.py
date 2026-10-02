import bpy,json,math
from pathlib import Path
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'Yanlaozhai_Video_House_and_Lane.blend'))
s=bpy.context.scene
new=[o for c in bpy.data.collections if c.name.startswith('VIDEO ') for o in c.objects]
missing=[bpy.path.abspath(im.filepath) for im in bpy.data.images if im.source=='FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists()]
bad=[o.name for o in s.objects if not all(math.isfinite(v) for v in (*o.location,*o.scale))]
renders=[]
for name in ['01_video_courtyard.png','02_video_alley.png','03_video_entrance.png','04_video_context.png']:
    p=R/name
    assert p.exists(),name
    im=bpy.data.images.load(str(p),check_existing=False)
    renders.append({'file':name,'size':list(im.size),'bytes':p.stat().st_size})
    assert min(im.size)>1000
    bpy.data.images.remove(im)
report={'opens_successfully':True,'total_objects':len(s.objects),'new_editable_objects':len(new),'new_collections':[c.name for c in bpy.data.collections if c.name.startswith('VIDEO ')],'dedicated_cameras':[o.name for o in s.objects if o.type=='CAMERA' and o.name.startswith('VIDEO ')],'active_camera':s.camera.name,'missing_external_images':missing,'invalid_transforms':bad,'packed_fonts':[f.name for f in bpy.data.fonts if f.packed_file],'original_parcels_kept_hidden':[c.name for c in bpy.data.collections if c.name.startswith('BACKUP ') and c.hide_render and c.hide_viewport],'units':s.unit_settings.system,'reference_scope':s.get('video_reconstruction_scope'),'renders':renders}
assert not missing and not bad
assert len(report['dedicated_cameras'])==4
assert len(report['original_parcels_kept_hidden'])==2
assert report['reference_scope'] and len(new)>1000
(R/'validation_video_revision.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
