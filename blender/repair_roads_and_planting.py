"""Repair the CURRENT saved scene; never rebuild the photographed house.

Remove raised road joints, level paving/bridge tops, relocate complete poplar
assemblies away from roads and crossings, export actual road planting masks.
Idempotent. The pre-edit source backup is ignored under artifacts/road-repair/.
"""
import bpy, json, math, shutil
from pathlib import Path
from mathutils import Vector

R=Path(__file__).resolve().parents[1]
source=R/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'
backup=R/'artifacts/road-repair/before-road-repair.blend'
backup.parent.mkdir(parents=True,exist_ok=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(source));S=bpy.context.scene
removed=0
for o in list(S.objects):
    if o.name.startswith('MAP ') and 'slab joint' in o.name:
        bpy.data.objects.remove(o,do_unlink=True);removed+=1

roads=[]
for o in S.objects:
    if o.type!='MESH' or not any(c.name=='MAP | Roads paths and bridges' for c in o.users_collection):continue
    if not any('concrete roads' in m.name for m in o.data.materials):continue
    if o.dimensions.z>.16 or o.location.z>.3:continue
    # All these are flat ground-level paving cuboids, not rails/poles/house floors.
    o.location.z=.1-o.dimensions.z/2
    roads.append([o.location.x,-o.location.y,o.dimensions.x/2,o.dimensions.y/2,o.rotation_euler.z])
bpy.context.view_layer.update()
nav=json.loads(S['village_navigation']);nav['roads']=roads
oldnav=json.loads((R/'public/models/navigation.json').read_text())['village']
fields=[]
for o in S.objects:
    if o.name.startswith('MAP field soil '):
        x,y,z=o.location;w,d,h=o.dimensions;fields.append([x-w/2,-y-d/2,x+w/2,-y+d/2])

def on_road(x,z,margin=.8):
    for cx,cz,hx,hz,a in roads:
        c,s=math.cos(a),math.sin(a);dx,dz=x-cx,z-cz
        xx,zz=c*dx-s*dz,s*dx+c*dz
        if abs(xx)<hx+margin and abs(zz)<hz+margin:return True
    return any(a-margin<x<c+margin and b-margin<z<d+margin for a,b,c,d in nav['bridges'])
def in_water(x,z):
    for w in nav['waterZones']:
        if w['shape']=='ellipse':
            a,b=w['center'];rx,rz=w['radius']
            if ((x-a)/(rx+.5))**2+((z-b)/(rz+.5))**2<1:return True
        else:
            a,b,c,d=w['rect']
            if a-.5<x<c+.5 and b-.5<z<d+.5:return True
    return False
def in_building(x,z):
    for cx,cz,hx,hz,a,low,high in oldnav['boxes']:
        if high<.55:continue
        c,s=math.cos(a),math.sin(a);dx,dz=x-cx,z-cz
        if abs(c*dx-s*dz)<hx+.7 and abs(s*dx+c*dz)<hz+.7:return True
    return False

crowns=sorted((o for o in S.objects if o.name.startswith('MAP seasonal poplar crown')),key=lambda o:o.name)
points=[(o.location.x,-o.location.y) for o in crowns];groups=[[o] for o in crowns]
for o in S.objects:
    if o in crowns or o.type!='MESH' or not any(c.name=='MAP | Poplar avenues' for c in o.users_collection):continue
    ps=[o.matrix_world@Vector(v) for v in o.bound_box]
    x=(min(p.x for p in ps)+max(p.x for p in ps))/2
    z=-(min(p.y for p in ps)+max(p.y for p in ps))/2
    i=min(range(len(points)),key=lambda j:(points[j][0]-x)**2+(points[j][1]-z)**2)
    groups[i].append(o)
moved=[]
for i,(x,z) in enumerate(list(points)):
    if not on_road(x,z):continue
    destination=None
    for distance in [2,4,6,8,10,12,16,20]:
        for k in range(24):
            a=k*math.tau/24;px,pz=x+math.cos(a)*distance,z+math.sin(a)*distance
            if on_road(px,pz,1) or in_water(px,pz) or in_building(px,pz):continue
            if any(j!=i and math.hypot(px-p[0],pz-p[1])<3 for j,p in enumerate(points)):continue
            if not (nav['bounds'][0]<px<nav['bounds'][2] and nav['bounds'][1]<pz<nav['bounds'][3]):continue
            destination=(px,pz);break
        if destination:break
    if not destination:raise RuntimeError(f'No safe relocation for {crowns[i].name}')
    px,pz=destination
    for o in groups[i]:o.location+=Vector((px-x,-(pz-z),0))
    points[i]=destination;moved.append({'tree':crowns[i].name,'from':[x,z],'to':[px,pz],'parts':len(groups[i])})
assert not any(on_road(x,z) for x,z in points),'Tree trunk still intersects paving'
meta=json.loads((R/'public/models/world-details.json').read_text())
meta.update(trees=[[o.location.x,-o.location.y,15*o.scale.z] for o in crowns],fields=fields,roads=roads)
(R/'public/models/world-details.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
S['village_navigation']=json.dumps(nav);S['road_repair']='Continuous level paving, no raised slab joints; poplar assemblies clear of roads/bridges.'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
report_path=R/'docs/road-repair.json'
previous=json.loads(report_path.read_text()) if report_path.exists() else {}
report={'removedRaisedJoints':removed+previous.get('removedRaisedJoints',0),'levelPavingFootprints':len(roads),'pavingTop':.1,'relocatedPoplars':previous.get('relocatedPoplars',[])+moved,'remainingTreeRoadConflicts':0}
(R/'docs/road-repair.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
