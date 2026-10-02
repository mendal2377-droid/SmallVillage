"""Lightweight ground-level wall colliders, derived from the saved Blender geometry."""
import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'))
result={}
for mode in ['house','village']:
    offset=Vector((-32,-109,0)) if mode=='house' else Vector((0,0,0))
    boxes=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.hide_render:continue
        if any(c.hide_render or c.name.startswith('BACKUP ') for c in o.users_collection):continue
        if mode=='house' and not any(c.name.startswith(('VIDEO 00','VIDEO 01')) for c in o.users_collection):continue
        # Structural cuboids provide predictable collision without scanning foliage triangles.
        if len(o.data.vertices)!=8 or len(o.data.polygons)!=6:continue
        pts=[o.matrix_world@v.co-offset for v in o.data.vertices]
        low=min(p.z for p in pts);high=max(p.z for p in pts)
        if high<.55 or low>1.65:continue
        x0=min(p.x for p in pts);x1=max(p.x for p in pts)
        z0=-max(p.y for p in pts);z1=-min(p.y for p in pts)
        if max(x1-x0,z1-z0)<.6:continue
        if mode=='village' and (x1<-140 or x0>140 or z1<-140 or z0>155):continue
        # Keep each box's orientation so an open gate leaf doesn't block its whole bounding rectangle.
        local_low=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3)))
        local_high=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
        center=o.matrix_world@((local_low+local_high)/2)-offset
        hx=(local_high.x-local_low.x)*o.matrix_world.col[0].to_3d().length/2
        hz=(local_high.y-local_low.y)*o.matrix_world.col[1].to_3d().length/2
        boxes.append([round(v,4) for v in [center.x,-center.y,hx,hz,o.matrix_world.to_euler().z]])
    result[mode]={'boxes':boxes,'bounds':[-14,-13,8,15] if mode=='house' else [-138,-134,138,152], 'spawn':[0,1.85,3.25] if mode=='house' else [0,1.75,137]}
(R/'public/models/navigation.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print({name:len(data['boxes']) for name,data in result.items()})
