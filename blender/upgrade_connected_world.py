"""Add the photographed near roofscape without rebuilding the corrected house.
Run once against the current source; repeat runs replace only WORLD objects.
The arrangement is estimated from the balcony photos, not a measured survey.
"""
import bpy,math,json,random,shutil
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
source=R/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'
backup=R.parent/'world_upgrade_reference/before_world_upgrade.blend'
backup.parent.mkdir(exist_ok=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(source));S=bpy.context.scene
for o in list(S.objects):
    if o.name.startswith('WORLD '):bpy.data.objects.remove(o,do_unlink=True)
    elif any(c.name=='MAP | Residential blocks' for c in o.users_collection) and -92<o.location.x<-9 and -134<o.location.y<-94:
        bpy.data.objects.remove(o,do_unlink=True)
col=bpy.data.collections.get('MAP | Photo roofscape')
if not col:col=bpy.data.collections.new('MAP | Photo roofscape');S.collection.children.link(col)
def material(name,color,rough=.85):
    m=bpy.data.materials.get('WORLD '+name) or bpy.data.materials.new('WORLD '+name)
    m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
grey=material('weathered grey plaster',(.49,.51,.50));pink=material('faded pink plaster',(.66,.49,.45));white=material('white tile facade',(.76,.77,.74));brick=material('aged red brick',(.36,.20,.14));tile=material('brown roof tiles',(.30,.19,.13));metal=material('red corrugated roof',(.38,.19,.13),.48);cement=material('flat concrete roof',(.45,.46,.43));frame=material('window frames',(.09,.105,.11));glass=material('window glass',(.17,.25,.26),.25);snow=material('roof snow',(.88,.92,.94))
cube=bpy.data.meshes.new('WORLD unit cube');cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
meshes={}
def box(name,xyz,dim,m,solid=False,season=None):
    if m.name not in meshes:me=cube.copy();me.materials.append(m);meshes[m.name]=me
    o=bpy.data.objects.new('WORLD '+name,meshes[m.name]);col.objects.link(o);o.location=xyz;o.scale=dim;o['walk_solid']=solid
    if season:o['season']=season;o.hide_render=True
    return o
def mesh(name,v,f,m,season=None):
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.materials.append(m);o=bpy.data.objects.new('WORLD '+name,me);col.objects.link(o);o['walk_solid']=False
    if season:o['season']=season;o.hide_render=True
    return o
def pitched(x,y,w,d,h,m,idx,body=True):
    if body:box('neighbor '+str(idx),(x,y,h/2+.1),(w,d,h),m,True)
    z=h+.15;ridge=1.25;v=[(x-w/2-.18,y-d/2-.18,z),(x+w/2+.18,y-d/2-.18,z),(x+w/2+.18,y,z+ridge),(x-w/2-.18,y,z+ridge),(x-w/2-.18,y+d/2+.18,z),(x+w/2+.18,y+d/2+.18,z)]
    mesh('gable roof '+str(idx),v,[(0,1,2,3),(3,2,5,4)],tile)
    mesh('plaster gable '+str(idx),[v[i] for i in [0,3,4,1,2,5]],[(0,1,2),(3,4,5)],m)
    mesh('winter gable '+str(idx),[(a,b,c+.035) for a,b,c in v],[(0,1,2,3),(3,2,5,4)],snow,'winter')
    for j in range(int(w/.19)+1):
        xx=x-w/2+j*.19
        for s in [-1,1]:
            o=box('tile seam',(xx,y+s*d/4,z+ridge/2+.025),(.018,math.hypot(d/2,ridge),.018),tile);o.rotation_euler.x=-s*math.atan2(ridge,d/2)
    box('ridge cap',(x,y,z+ridge+.055),(w+.5,.15,.11),metal)
    if body:
        for xx in [x-w*.27,x+w*.27]:
            box('window surround',(xx,y-d/2-.035,1.7),(1.55,.09,1.5),white)
            box('window',(xx,y-d/2-.092,1.7),(1.40,.03,1.34),glass)
            for dx in [-.7,0,.7]:box('mullion',(xx+dx,y-d/2-.118,1.7),(.035,.035,1.4),frame)
        box('burgundy door',(x,y-d/2-.04,1.28),(1.05,.06,2.35),brick)
# Existing neighbor across the filmed alley: retain its wall and add a pitched roof.
pitched(-43.0,-109,5.1,8.7,3.65,grey,0,False)
# Closely packed roofs, varied heights and plaster colours, matching the sunset/snow silhouettes.
specs=[(-53,-112,10,7,3.5,brick),(-64,-108,9.2,7.5,4.3,grey),(-54,-101.5,9.6,7,5.0,pink),(-66,-99.5,10,7.8,4.6,grey),(-52,-123,10.4,7.5,3.35,grey),(-65,-121,10,7,4.6,pink),(-80,-113,12,8,3.8,grey),(-79,-102,12,8,4.2,white),(-80,-126,11,8,3.5,brick),(-29,-123,10,7,3.8,pink),(-16.5,-117,8.7,7.5,4.4,grey)]
for i,args in enumerate(specs,1):pitched(*args,i)
# Flat terrace foreground with dark low parapets, like the photographed adjoining roof.
box('near flat neighbor',(-45.5,-122.5,1.6),(5,7,3.0),brick,True)
box('near terrace',(-45.5,-122.5,3.15),(5.3,7.2,.18),cement)
for sx in [-1,1]:box('near low parapet',(-45.5+sx*2.6,-122.5,3.45),(.18,7.2,.48),brick)
box('terrace snow',(-45.5,-122.5,3.27),(4.9,6.8,.04),snow,season='winter')
# White tiled two-storey neighbor visible on the right of the supplied photo.
box('tiled two storey',(-16,-103,3.3),(8,8,6.4),white,True)
box('tiled flat roof',(-16,-103,6.62),(8.4,8.4,.16),cement)
for sx in [-1,1]:
    for k in range(15):box('roof railing upright',(-16+sx*4.0,-106.8+k*.53,7.0),(.025,.025,.75),frame)
    box('roof railing top',(-16+sx*4.0,-103,7.39),(.035,8,.035),frame)
for xx in [-18.2,-14.5]:
    for zz in [1.8,4.8]:box('tiled neighbor window',(xx,-107.02,zz),(1.5,.05,1.75),glass)
# Export exact existing tree locations and field rectangles for the browser's instanced vegetation.
trees=[]
for o in S.objects:
    if o.name.startswith('MAP seasonal poplar crown'):trees.append([o.location.x,-o.location.y,15*o.scale.z])
fields=[]
for o in S.objects:
    if o.name.startswith('MAP field soil '):
        x,y,z=o.location;w,d,h=o.dimensions;fields.append([x-w/2,-y-d/2,x+w/2,-y+d/2])
meta={'trees':trees,'fields':fields,'roofscape':'Near roofs follow supplied photos; exact positions estimated.'}
(R/'public/models/world-details.json').write_text(json.dumps(meta,separators=(',',':')),encoding='utf-8')
nav=json.loads(S['village_navigation']);nav['places']['courtyard']={'spawn':[-32,1.85,109],'yaw':0};S['village_navigation']=json.dumps(nav)
S['world_upgrade']='Connected map; photo-based close roofscape. Browser uses world-details.json for dynamic vegetation and water.'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('WORLD SAVED',len(trees),'trees',len(fields),'fields',len(col.objects),'roofscape objects',flush=True)
