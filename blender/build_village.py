import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
random.seed(411681)
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene
S.unit_settings.system='METRIC'
S.render.engine='CYCLES'
S.cycles.samples=32
S.cycles.use_denoising=True
S.cycles.max_bounces=5
S.render.resolution_x=1800; S.render.resolution_y=1200
S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG'
S.view_settings.view_transform='AgX'
S.render.film_transparent=False
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    for device_type in ['OPTIX','CUDA','HIP']:
        try:
            prefs.compute_device_type=device_type; prefs.get_devices()
            devices=[d for d in prefs.devices if d.type!='CPU']
            if devices:
                for d in prefs.devices: d.use=d.type!='CPU'
                S.cycles.device='GPU'; print('GPU',device_type,[d.name for d in devices],flush=True); break
        except: pass
except: pass

def collection(name):
    c=bpy.data.collections.new(name); S.collection.children.link(c); return c
LAND=collection('01 | 平原农田 · inferred landscape')
ROAD=collection('02 | 村路巷道 · inferred roads')
HOUSE=collection('03 | 宅院民居 · editable households')
TREES=collection('04 | 杨树与庭院树')
DETAIL=collection('05 | 电杆农具与生活细节')
CAM=collection('06 | 摄影机与光照')

def mat(name,color,rough=.8):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    return m
def noise_mat(name,a,b,scale=4,bump=.12):
    m=mat(name,a); n=m.node_tree.nodes; l=m.node_tree.links; p=n.get('Principled BSDF')
    t=n.new('ShaderNodeTexNoise'); t.inputs['Scale'].default_value=scale; t.inputs['Detail'].default_value=3
    geo=n.new('ShaderNodeNewGeometry'); l.new(geo.outputs['Position'],t.inputs['Vector'])
    r=n.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color=(*a,1); r.color_ramp.elements[1].color=(*b,1)
    l.new(t.outputs['Fac'],r.inputs[0]); l.new(r.outputs[0],p.inputs['Base Color'])
    bu=n.new('ShaderNodeBump'); bu.inputs['Strength'].default_value=bump; bu.inputs['Distance'].default_value=.045
    l.new(t.outputs['Fac'],bu.inputs['Height']); l.new(bu.outputs[0],p.inputs['Normal']); return m

earth=noise_mat('黄褐土壤',(.19,.135,.064),(.38,.29,.16),1.8)
concrete=noise_mat('旧水泥路与晒场',(.32,.32,.29),(.48,.465,.41),8,.2)
asphalt=noise_mat('村主路 沥青',(.095,.105,.105),(.19,.18,.16),17,.18)
plasters=[noise_mat('旧抹灰_'+str(i),a,b,2,.17) for i,(a,b) in enumerate([
    ((.55,.53,.46),(.8,.78,.68)),((.62,.62,.57),(.88,.87,.79)),((.33,.34,.31),(.55,.54,.47)),((.57,.45,.32),(.76,.66,.5))])]
brick=mat('烧结红砖 / 240×70mm',(.36,.14,.08))
n=brick.node_tree.nodes;l=brick.node_tree.links;p=n.get('Principled BSDF')
g=n.new('ShaderNodeNewGeometry'); sep=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Position'],sep.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['X'],add.inputs[0]);l.new(sep.outputs['Y'],add.inputs[1])
comb=n.new('ShaderNodeCombineXYZ');l.new(add.outputs[0],comb.inputs['X']);l.new(sep.outputs['Z'],comb.inputs['Y'])
bt=n.new('ShaderNodeTexBrick');l.new(comb.outputs[0],bt.inputs['Vector'])
bt.inputs['Scale'].default_value=1;bt.inputs['Brick Width'].default_value=.26;bt.inputs['Row Height'].default_value=.085
bt.inputs['Mortar Size'].default_value=.009;bt.inputs['Color1'].default_value=(.38,.16,.09,1);bt.inputs['Color2'].default_value=(.22,.08,.04,1);bt.inputs['Mortar'].default_value=(.33,.29,.23,1)
l.new(bt.outputs['Color'],p.inputs['Base Color']);bu=n.new('ShaderNodeBump');bu.inputs['Strength'].default_value=.5;bu.inputs['Distance'].default_value=.018;l.new(bt.outputs['Fac'],bu.inputs['Height']);l.new(bu.outputs[0],p.inputs['Normal'])
tiles=[noise_mat('陶瓦_'+str(i),a,b,9,.24) for i,(a,b) in enumerate([((.09,.1,.1),(.2,.22,.22)),((.17,.11,.08),(.33,.23,.16)),((.29,.095,.05),(.48,.2,.09))])]
blue=mat('褪色蓝彩钢',(.055,.22,.32),.48); red=mat('铁门 暗红',(.26,.025,.018),.56)
metal=mat('镀锌金属',(.36,.4,.41),.35);metal.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.65
dark=mat('窗框与轮胎',(.023,.027,.027)); glass=mat('暗蓝窗玻璃',(.055,.12,.16),.23)
wood=noise_mat('树皮木材',(.105,.073,.035),(.27,.2,.1),6)
green=[mat('树叶'+str(i),v) for i,v in enumerate([(.12,.22,.045),(.18,.29,.065),(.075,.16,.035),(.26,.34,.085),(.2,.26,.05)])]
water=noise_mat('沟塘水面',(.048,.105,.072),(.13,.2,.13),.5,.1);water.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.19
white=mat('路标与瓷砖',(.82,.8,.68)); gold=mat('麦穗',(.5,.36,.1))

cube_mesh=bpy.data.meshes.new('unit box');cube_mesh.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
box_cache={}
def box(name,loc,dim,m,c=DETAIL,rz=0):
    if m.name not in box_cache:
        me=cube_mesh.copy();me.materials.append(m);box_cache[m.name]=me
    o=bpy.data.objects.new(name,box_cache[m.name]);c.objects.link(o);o.location=loc;o.scale=dim;o.rotation_euler[2]=rz;return o
def mesh(name,verts,faces,m,c):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(m);o=bpy.data.objects.new(name,me);c.objects.link(o);return o
def cylinder(name,a,b,r,m,c=DETAIL,vertices=8):
    a,b=Vector(a),Vector(b);d=b-a
    vs=[]
    rot=d.to_track_quat('Z','Y')
    for z in [0,d.length]:
        for i in range(vertices):vs.append(tuple(a+rot@Vector((r*math.cos(i*math.tau/vertices),r*math.sin(i*math.tau/vertices),z))))
    fs=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    return mesh(name,vs,fs,m,c)
def line(name,points,r,m,c=DETAIL):
    cv=bpy.data.curves.new(name,'CURVE');cv.dimensions='3D';cv.resolution_u=1;cv.bevel_depth=r;cv.bevel_resolution=1
    sp=cv.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    cv.materials.append(m);o=bpy.data.objects.new(name,cv);c.objects.link(o);return o
def road(name,points,width,m,z=.03):
    v=[]
    for i,p in enumerate(points):
        d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        d.normalize();normal=Vector((-d.y,d.x))*width/2
        v.extend([(p[0]+normal.x,p[1]+normal.y,z),(p[0]-normal.x,p[1]-normal.y,z)])
    return mesh(name,v,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],m,ROAD)

# Agricultural setting. Dimensions are creative assumptions, not surveyed extents.
box('黄淮平原地基',(0,0,-.28),(1500,1500,.5),earth,LAND)
roughgrass=noise_mat('村边杂草地',(.12,.15,.055),(.32,.30,.13),.32,.25)
box('村内土草混合地',(0,0,-.04),(285,270,.12),roughgrass,LAND)
fieldm=[]
for i,col in enumerate([(.36,.37,.095),(.43,.36,.11),(.31,.37,.12),(.48,.4,.16),(.19,.27,.07),(.36,.29,.105)]):
    m=noise_mat('耕地_'+str(i),tuple(k*.72 for k in col),col,.2,.2)
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    w=n.new('ShaderNodeTexWave');w.wave_type='BANDS';w.bands_direction='X';w.inputs['Scale'].default_value=2.8;w.inputs['Distortion'].default_value=1.2
    ge=n.new('ShaderNodeNewGeometry');l.new(ge.outputs['Position'],w.inputs['Vector'])
    b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.28;b.inputs['Distance'].default_value=.22;l.new(w.outputs['Color'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal']);fieldm.append(m)
for ix in range(-6,6):
    for iy in range(-6,6):
        x=ix*86+43;y=iy*78+39
        if abs(x)<140 and abs(y)<140:continue
        box('田块 %d %d'%(ix,iy),(x,y,-.015),(83,75,.12),random.choice(fieldm),LAND)
        for stripe in [-1,1]:box('农机田埂',(x+stripe*39,y,.052),(.35,75,.08),earth,LAND)
# Main village road and narrow horizontal lanes.
main=[(-8,-600),(-5,-200),(0,-128),(1,-80),(-2,-28),(3,32),(4,100),(0,180),(12,600)]
road('主路土肩',main,10,earth,.07);road('主路 6米',main,6.3,asphalt,.09)
for y in [-124,-96,-68,-40,-12,16,44,72,100,128]:
    road('东西水泥巷 %.0f'%y,[(-132,y-1),(-65,y),(0,y),(62,y+.7),(137,y+2)],3.8,concrete,.08)
for x in [-126,-62,65,130]:road('南北支巷',[(x,-125),(x+1,0),(x-1,130)],3.2,concrete,.075)
road('村南通田道路',[(-450,-143),(-180,-144),(-60,-143),(0,-140),(170,-148),(480,-144)],5.5,concrete,.073)

def roof(name,x,y,z,w,d,h,m,c):
    v=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x-w/2,y,z+h),(x+w/2,y,z+h),(x-w/2,y+d/2,z),(x+w/2,y+d/2,z)]
    mesh(name,v,[(0,1,3,2),(2,3,5,4),(0,2,4),(1,5,3)],m,c)
    # Raised horizontal tile courses, modelled as one mesh per roof.
    vv=[];ff=[]
    for side in [-1,1]:
        count=max(4,int(d/.6))
        for j in range(1,count):
            t=j/count; yy=y+side*d/2*t;zz=z+h*(1-t)+.025
            k=len(vv);vv += [(x-w/2,yy-.025,zz),(x+w/2,yy-.025,zz),(x+w/2,yy+.045,zz+.022),(x-w/2,yy+.045,zz+.022)];ff.append((k,k+1,k+2,k+3))
    mesh(name+' 瓦垄',vv,ff,m,c)
    cylinder('屋脊',(x-w/2,y,z+h+.05),(x+w/2,y,z+h+.05),.11,m,c)

def window(x,y,z,w=1.45,h=1.5,c=HOUSE):
    box('窗框',(x,y,z),(w+.16,.15,h+.16),white,c)
    box('玻璃',(x,y-.085,z),(w,.03,h),glass,c)
    box('中挺',(x,y-.115,z),(.055,.045,h),dark,c)
    box('横挺',(x,y-.115,z),(w,.045,.05),dark,c)
    box('窗台',(x,y-.13,z-h/2-.09),(w+.25,.3,.1),concrete,c)

house_records=[]
def household(x,y,idx):
    c=collection('宅院 %03d'%idx)
    # Each south-facing parcel has its own collection for editing.
    w=random.uniform(15.5,18.2);d=random.uniform(20,23)
    box('宅基',(x,y,.055),(w,d,.16),concrete,c)
    mw=w-random.uniform(.7,2);md=random.uniform(6.4,8.4);my=y+d/2-md/2-.3
    two=random.random()<.34;flat=two or random.random()<.17;h=random.uniform(6.3,7) if two else random.uniform(3,3.5)
    wm=random.choice(plasters) if random.random()<.56 else brick
    box('主屋墙体',(x,my,h/2+.2),(mw,md,h),wm,c)
    box('基座',(x,my,.32),(mw+.1,md+.1,.38),plasters[2],c)
    if flat:
        box('平屋面',(x,my,h+.27),(mw+.36,md+.36,.2),concrete,c)
        for sy in [-1,1]:box('女儿墙',(x,my+sy*md/2,h+.62),(mw,.18,.65),wm,c)
        for sx in [-1,1]:box('女儿墙',(x+sx*mw/2,my,h+.62),(.18,md,.65),wm,c)
        if random.random()<.45:roof('屋顶彩钢雨棚',x,my+1,h+1,mw*.8,md*.65,.6,blue,c)
    else:roof('双坡瓦屋面',x,my,h+.2,mw+.75,md+.7,random.uniform(1.5,2.1),random.choice(tiles),c)
    front=my-md/2-.025
    for level in range(2 if two else 1):
        for off in [-mw*.34,-mw*.15,mw*.16,mw*.35]:window(x+off,front,1.9+level*3.15,c=c)
    box('主屋入户门',(x,front-.055,1.45),(1.35,.12,2.5),red,c)
    box('门头雨檐',(x,front-.55,2.9),(2.4,1.2,.13),concrete,c)
    if two:box('楼层腰线',(x,front-.06,3.4),(mw+.08,.15,.18),white,c)
    # Annex and enclosure with a genuine entrance gap.
    aw=random.uniform(3,4);ad=random.uniform(7,10);ax=x-w/2+aw/2+.25;ay=y-d/2+ad/2+.5
    if random.random()<.76:
        box('偏房',(ax,ay,1.55),(aw,ad,3),wm,c);roof('偏房屋顶',ax,ay,3.08,aw+.4,ad+.3,.65,random.choice([blue,*tiles]),c)
    for sx in [-1,1]:box('院墙',(x+sx*w/2,y,1.1),(.24,d,2.1),brick if random.random()<.6 else wm,c)
    gatex=x+w*.2;gy=y-d/2
    left=gatex-1.65-(x-w/2);right=x+w/2-(gatex+1.65)
    box('南院墙左',(x-w/2+left/2,gy,1.1),(left,.25,2.1),wm,c)
    box('南院墙右',(gatex+1.65+right/2,gy,1.1),(right,.25,2.1),wm,c)
    for sx in [-1,1]:box('门柱',(gatex+sx*1.68,gy,1.45),(.42,.48,2.8),brick,c)
    box('红铁院门',(gatex,gy+.03,1.27),(3.15,.09,2.45),red,c)
    box('门分缝',(gatex,gy-.035,1.25),(.035,.02,2.4),dark,c)
    roof('院门瓦檐',gatex,gy,2.92,4.1,1.2,.4,tiles[0],c)
    for sx in [-1,1]:box('门联',(gatex+sx*1.58,gy-.27,1.65),(.15,.01,1.55),red,c)
    # Roof utilities, AC units, woodpiles and small vegetable beds.
    if flat and random.random()<.64:
        cylinder('太阳能热水器水箱',(x-1,my,h+1.1),(x+1,my,h+1.1),.32,metal,c)
        o=box('太阳能集热板',(x,my-.8,h+.75),(2,1.35,.12),glass,c);o.rotation_euler[0]=.45
        for j in range(10):cylinder('集热管',(x-.9+j*.2,my-1.3,h+.47),(x-.9+j*.2,my-.22,h+.99),.035,metal,c)
    if random.random()<.55:
        box('空调外机',(x+mw/2-.8,front-.35,2.55),(.8,.42,.58),white,c)
    box('院内菜畦',(x+w*.27,y+.4,.19),(3,3.7,.15),random.choice(fieldm),c)
    for j in range(random.randint(2,5)):
        cylinder('码放柴木',(x-w*.23,y+j*.22,.35),(x-w*.23+2,y+j*.22,.35),.095,wood,c)
    if random.random()<.2:
        for j in range(3):box('粮食晾晒',(x-2+j*1.15,y-2,.16),(.9,2.2,.04),gold,c)
    house_records.append({'id':idx,'x':round(x,2),'y':round(y,2),'stories':2 if two else 1,'layout_status':'inferred'})

idx=0
for row in range(8):
    y=-110+row*28
    for col,x0 in enumerate([-114,-91,-78,-49,-27,23,45,79,101,119]):
        # Use regular plots within irregular village edge, with several vacant lots.
        if col in [2,9]:continue
        if (row in [0,7] and col in [0,8]) or (row==3 and col in [5,6]) or random.random()<.06:continue
        x=x0+random.uniform(-.7,.7); yy=y+random.uniform(-.6,.6)
        idx+=1;household(x,yy,idx)
print('HOUSEHOLDS',idx,flush=True)
for y in [-109,-81,-53,-25,3,31,59,87]:
    for x in [-73,58,119]:
        box('巷旁菜园',(x,y,.095),(6 if x==58 else 8,19,.14),random.choice(fieldm),LAND)
        for dx in [-3,-1.5,0,1.5,3]:box('菜地垄沟',(x+dx,y,.18),(.22,18,.1),earth,LAND)

# Pond and small clearing are representative landscape features, not confirmed site features.
pv=[(163+24*math.cos(t)*(1+.06*math.sin(t*5)),35+37*math.sin(t),.13) for t in [i*math.tau/48 for i in range(48)]]
mesh('推定村东坑塘水面',pv,[tuple(range(48))],water,LAND)
line('土岸',[(v[0]*1.008,v[1],.11) for v in pv+[pv[0]]],1.5,earth,LAND)
box('巷口空地',(27,-22,.13),(33,24,.16),concrete,ROAD)

# Tree prototypes: thousands of individual, irregular leaf facets, shared between instances.
def tree_proto(seed,poplar):
    rng=random.Random(seed); vv=[];ff=[];mi=[]
    height=10 if poplar else 7
    for k in range(190 if poplar else 220):
        z=rng.uniform(height*.4,height)
        r=(1-abs(z/height-.7)*1.65)*(1.9 if poplar else 3.7)
        angle=rng.random()*math.tau; rr=math.sqrt(rng.random())*r
        cx=rr*math.cos(angle);cy=rr*math.sin(angle)
        for j in range(10):
            center=Vector((cx+rng.uniform(-.5,.5),cy+rng.uniform(-.5,.5),z+rng.uniform(-.5,.5)))
            sz=rng.uniform(.18,.38);a=rng.random()*math.tau
            u=Vector((math.cos(a)*sz,math.sin(a)*sz,rng.uniform(-.1,.1)))
            v=Vector((-math.sin(a)*sz*.65,math.cos(a)*sz*.65,sz*.5))
            q=len(vv);vv.extend([tuple(center-u),tuple(center+v),tuple(center+u),tuple(center-v)]);ff.append((q,q+1,q+2,q+3));mi.append(rng.randrange(len(green)))
    me=bpy.data.meshes.new('杨树叶簇' if poplar else '阔叶树冠');me.from_pydata(vv,[],ff)
    for m in green:me.materials.append(m)
    for p,i in zip(me.polygons,mi):p.material_index=i
    return me
protos=[tree_proto(50+i,i<3) for i in range(6)]
def tree(x,y,scale=1,poplar=False):
    i=random.randrange(3) if poplar else random.randrange(3,6)
    o=bpy.data.objects.new('杨树' if poplar else '槐榆庭院树',protos[i]);TREES.objects.link(o);o.location=(x,y,.15);o.scale=(scale,)*3;o.rotation_euler[2]=random.random()*math.tau
    h=(10 if poplar else 7)*scale
    cylinder('树干',(x,y,0),(x+.15,y,h*.78),.17*scale,wood,TREES)
    for a in [0,2.1,4.2]:cylinder('枝干',(x,y,h*.34),(x+math.cos(a)*h*.2,y+math.sin(a)*h*.2,h*.7),.075*scale,wood,TREES)
for rec in house_records:
    if random.random()<.66:tree(rec['x']+random.choice([-5,5]),rec['y']-4,random.uniform(.55,.85))
for y in range(-185,200,14):
    for x in [-141,143]:
        if x>0 and 0<y<85:continue
        tree(x+random.uniform(-2,2),y,random.uniform(.9,1.25),True)
for x in range(-330,350,15):
    if abs(x)<12:continue
    tree(x,-152,random.uniform(.8,1.2),True)
for j in range(60):
    x=random.choice([-1,1])*random.uniform(152,210);y=random.uniform(-120,150)
    if x>0 and abs(y-35)<42:continue
    tree(x,y,random.uniform(.65,1.1),random.random()<.6)

# Rural overhead services, with sagging cables.
for side in [-1,1]:
    xs=side*5.2
    for y in range(-165,165,30):
        cylinder('水泥电杆',(xs,y,0),(xs,y,8.2),.13,concrete)
        box('横担',(xs,y,7.5),(1.6,.09,.09),metal)
        for dx in [-.6,0,.6]:
            cylinder('瓷绝缘子',(xs+dx,y,7.5),(xs+dx,y,7.78),.07,white)
            if y<135:line('架空线',[(xs+dx,y+30*t/12,7.78-.85*math.sin(math.pi*t/12)) for t in range(13)],.014,dark)
    for y in [-105,-45,15,75]:
        cylinder('路灯臂',(xs,y,6.3),(xs-side*1.2,y,6.8),.055,metal)
        box('LED路灯',(xs-side*1.15,y,6.79),(.7,.28,.12),white)

def tractor(x,y):
    c=DETAIL
    box('拖拉机发动机',(x,y,.95),(1.05,1.8,.85),red,c)
    box('拖拉机底盘',(x,y+.45,.5),(1.2,2.8,.25),dark,c)
    box('驾驶座',(x,y+1,1.1),(.75,.6,.28),dark,c)
    for sx in [-1,1]:
        for yy,rr in [(y-.65,.42),(y+1.1,.65)]:
            cylinder('车胎',(x+sx*.6,yy,rr),(x+sx*.9,yy,rr),rr,dark,c,16)
            cylinder('轮毂',(x+sx*.91,yy,rr),(x+sx*.93,yy,rr),rr*.48,metal,c,12)
    cylinder('排气筒',(x-.4,y,1.1),(x-.4,y,2.25),.06,dark)
    for sx in [-1,1]:cylinder('遮阳棚柱',(x+sx*.58,y+1,.9),(x+sx*.58,y+1,2.7),.035,metal)
    box('拖拉机遮阳棚',(x,y+.75,2.73),(1.55,1.5,.12),blue)
    box('农用挂斗',(x,y+4,.9),(1.75,2.6,.15),blue)
    for sx in [-1,1]:box('挂斗栏板',(x+sx*.85,y+4,1.2),(.08,2.6,.6),blue)
tractor(16,-144);tractor(-55,134)

# A modest corner shop, no invented real business identity.
box('便民店',(24,-23,1.85),(10,7,3.5),plasters[1],DETAIL)
roof('小店蓝棚',24,-23,3.6,10.8,7.5,.65,blue,DETAIL)
box('卷帘门',(22,-26.55,1.5),(3,.08,2.8),metal)
window(26,-26.6,1.8,2.5,1.7,DETAIL)
box('商店招牌',(24,-26.72,3.2),(8,.12,.55),red)
font_path=Path('C:/Windows/Fonts/msyh.ttc')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
def text_obj(name,body,loc,size,m,rotation=(math.pi/2,0,0)):
    cv=bpy.data.curves.new(name,'FONT');cv.body=body;cv.size=size;cv.align_x='CENTER';cv.extrude=.003
    if font:cv.font=font
    cv.materials.append(m);o=bpy.data.objects.new(name,cv);DETAIL.objects.link(o);o.location=loc;o.rotation_euler=rotation;return o
text_obj('便民商店字样','便 民 商 店',(24,-26.81,3.0),.4,white)
box('村名石牌',(-10,-139,1.1),(5,.55,2.2),plasters[2])
text_obj('场景主题村名','闫 老 寨',(-10,-139.3,1.25),.76,white)
text_obj('推定标识说明','豫东村落风貌参考重建',(-10,-139.3,.65),.2,white)
for x,y in [(31,-28),(-13,-132),(56,49)]:
    box('垃圾桶',(x,y,.52),(.62,.68,1),green[2]);box('垃圾桶盖',(x,y,1.04),(.7,.74,.1),dark)

# Clumped grasses at field edges, using one combined mesh.
vv=[];ff=[]
for k in range(15000):
    x=random.uniform(-240,240);y=random.uniform(-225,-157)
    if -7<x<7:continue
    z=.1;h=random.uniform(.22,.6);w=.045;a=random.random()*math.tau
    q=len(vv);vv.extend([(x-w,y,z),(x+w,y,z),(x+.12*math.cos(a),y+.12*math.sin(a),z+h)]);ff.append((q,q+1,q+2))
mesh('前景麦田茬与草叶',vv,ff,gold,LAND)

# Lighting and presentation cameras.
world=bpy.data.worlds.new('初夏晴空');S.world=world;world.use_nodes=True
n=world.node_tree.nodes;l=world.node_tree.links;n.clear();out=n.new('ShaderNodeOutputWorld');bg=n.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=.65
bg.inputs['Color'].default_value=(.52,.66,.86,1)
l.new(bg.outputs[0],out.inputs[0])
ld=bpy.data.lights.new('下午阳光','SUN');ld.energy=3;ld.angle=math.radians(5)
lo=bpy.data.objects.new('下午阳光',ld);CAM.objects.link(lo);lo.rotation_euler=(math.radians(30),math.radians(-25),math.radians(-35))
def camera(name,loc,target,lens=45,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);CAM.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_end=3000
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    return o
hero=camera('01 鸟瞰全村',(330,-405,315),(0,0,0),48)
street=camera('02 村口人视',(1.4,-151,2.7),(0,-72,3.2),38)
detail=camera('03 院落近景',(-45,-147,22),(-45,-100,2.2),48)
top=camera('04 总平面',(0,0,500),(0,0,0),45,370)
S.camera=hero
S['RECONSTRUCTION_STATUS']='Interpretive Henan rural scene; exact Yanlaozhai road and building footprints were NOT verified.'
S['LOCATION']='河南省周口市项城市贾岭镇闫老寨村（阎老寨）'
S['UNITS']='meters; dimensions are modelling assumptions'
S['SEASON']='初夏麦收季节的艺术设定，非拍摄日期'
readme=bpy.data.texts.new('READ ME | 重建范围与参考来源')
readme.write('闫老寨村风貌参考重建\n\n已核实：村名与贾岭镇行政归属。\n未核实：精确坐标、村界、道路走向、逐栋建筑、坑塘位置。所有几何布局均为推定，不能用于测绘、导航或土地边界判断。\n允许按河南同类村庄参考进行建模。模型为约260米见方的村落核心与外围田地；住宅数量和尺寸是场景设计参数。\n全部材质与几何为程序创建，无外部贴图依赖。各宅院可在同名集合中编辑。\n参考及访问限制详见同目录 REFERENCES.md。\n')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.clip_end=3000;area.spaces.active.region_3d.view_distance=390
            area.spaces.active.region_3d.view_location=(0,0,0)
            area.spaces.active.region_3d.view_rotation=hero.rotation_euler.to_quaternion()
            area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Yanlaozhai_Henan_Village.blend'))
(ROOT/'scene_inventory.json').write_text(json.dumps({'households':len(house_records),'objects':len(S.objects),'materials':len(bpy.data.materials),'cameras':[o.name for o in CAM.objects if o.type=='CAMERA'],'layout':'inferred, not surveyed','parcels':house_records},ensure_ascii=False,indent=2),encoding='utf-8')
print('SAVED',flush=True)
S.render.filepath=str(ROOT/'01_aerial.png');bpy.ops.render.render(write_still=True)
print('RENDER_AERIAL_DONE',flush=True)

