"""Height-aware walls and walk surfaces derived from the saved Blender geometry."""
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
        if mode=='house' and not any(c.name.startswith(('VIDEO 00','VIDEO 01','VIDEO 05')) for c in o.users_collection):continue
        if o.get('walk_solid') is False:continue
        # Structural cuboids provide predictable collision without scanning foliage triangles.
        if len(o.data.vertices)!=8 or len(o.data.polygons)!=6:continue
        pts=[o.matrix_world@v.co-offset for v in o.data.vertices]
        low=min(p.z for p in pts);high=max(p.z for p in pts)
        if high<.55:continue
        x0=min(p.x for p in pts);x1=max(p.x for p in pts)
        z0=-max(p.y for p in pts);z1=-min(p.y for p in pts)
        if max(x1-x0,z1-z0)<.6 and not o.get('walk_solid'):continue
        if high-low<.35 and min(x1-x0,z1-z0)>.8:continue
        # Keep each box's orientation so an open gate leaf doesn't block its whole bounding rectangle.
        local_low=Vector(tuple(min(v.co[i] for v in o.data.vertices) for i in range(3)))
        local_high=Vector(tuple(max(v.co[i] for v in o.data.vertices) for i in range(3)))
        center=o.matrix_world@((local_low+local_high)/2)-offset
        hx=(local_high.x-local_low.x)*o.matrix_world.col[0].to_3d().length/2
        hz=(local_high.y-local_low.y)*o.matrix_world.col[1].to_3d().length/2
        boxes.append([round(v,4) for v in [center.x,-center.y,hx,hz,o.matrix_world.to_euler().z,low,high]])
    surfaces=[]
    for s in json.loads(bpy.context.scene['walk_surfaces']):
        x0,y0,x1,y1=s['rect'];dx=-37-offset.x;dz=109+offset.y
        # Blender +Y becomes browser -Z, so invert the ramp's interpolation.
        rise=s.get('rise',0)
        surfaces.append({'rect':[x0+dx,-y1+dz,x1+dx,-y0+dz],'height':s['height']+.12+rise,'rise':-rise,'axis':'z'})
    shelters=[]
    if mode=='village':
        for o in bpy.context.scene.objects:
            if o.type!='MESH' or o.hide_render or not o.name.startswith('MAP '):continue
            if not any(key in o.name for key in ['flat house roof','pitched tile roof','school flat roof','blue courtyard shed']):continue
            pts=[o.matrix_world@Vector(v) for v in o.bound_box]
            shelters.append({'rect':[min(p.x for p in pts),-max(p.y for p in pts),max(p.x for p in pts),-min(p.y for p in pts)],'roof':max(p.z for p in pts)})
    for s in json.loads(bpy.context.scene.get('walk_shelters','[]')):
        x0,y0,x1,y1=s['rect'];dx=-37-offset.x;dz=109+offset.y
        shelters.append({'rect':[x0+dx,-y1+dz,x1+dx,-y0+dz],'roof':s['roof']+.12})
    result[mode]={'boxes':boxes,'surfaces':surfaces,'shelters':shelters,'ground':.2 if mode=='house' else .1,'bounds':[-14,-13,8,15] if mode=='house' else [-138,-134,138,152], 'spawn':[0,1.85,3.25] if mode=='house' else [0,1.75,137]}
    if mode=='village' and 'village_navigation' in bpy.context.scene:
        result[mode].update(json.loads(bpy.context.scene['village_navigation']))
(R/'public/models/navigation.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print({name:len(data['boxes']) for name,data in result.items()})
