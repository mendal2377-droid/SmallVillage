"""Editable reconstruction from the user's 54.5 second video; dimensions estimated."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
random.seed(20261002)
bpy.ops.wm.open_mainfile(filepath=str(R.parent/'Yanlaozhai_Henan_Village.blend'))
S=bpy.context.scene
ORIGIN=Vector((-37,-109,0.12))
def col(name):
    c=bpy.data.collections.new(name);S.collection.children.link(c);return c
ARCH=col('VIDEO 00 | Filmed house - architecture')
LANE=col('VIDEO 01 | Brick alley and neighboring walls')
PROPS=col('VIDEO 02 | Courtyard and domestic details')
PLANTS=col('VIDEO 03 | Ivy weeds and cut branches')
CAM=col('VIDEO 04 | Reference reconstruction cameras')
# Keep the old parcels in the revision as disabled backups.
for name in ['宅院 002','宅院 003']:
    c=bpy.data.collections.get(name)
    if c: c.hide_render=True;c.hide_viewport=True;c.name='BACKUP hidden | '+name
for cname in ['04 | 杨树与庭院树','05 | 电杆农具与生活细节']:
    c=bpy.data.collections.get(cname)
    if c:
        for o in list(c.all_objects):
            if o.type not in {'MESH','CURVE'}:continue
            pts=[o.matrix_world@Vector(v) for v in o.bound_box]
            p=sum(pts,Vector())/8
            if -57<p.x<-16 and -123<p.y<-97:o.hide_render=True;o.hide_viewport=True

def material(name,color,rough=.75,metal=0):
    m=bpy.data.materials.new('V | '+name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
def weather(name,a,b,scale=3,bump=.1):
    m=material(name,a);n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    t=n.new('ShaderNodeTexNoise');t.inputs['Scale'].default_value=scale;t.inputs['Detail'].default_value=4;t.inputs['Roughness'].default_value=.75
    g=n.new('ShaderNodeNewGeometry');l.new(g.outputs['Position'],t.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.25;ramp.color_ramp.elements[0].color=(*a,1);ramp.color_ramp.elements[1].position=.78;ramp.color_ramp.elements[1].color=(*b,1)
    l.new(t.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bu=n.new('ShaderNodeBump');bu.inputs['Strength'].default_value=bump;bu.inputs['Distance'].default_value=.055;l.new(t.outputs['Fac'],bu.inputs['Height']);l.new(bu.outputs[0],p.inputs['Normal']);return m
plaster=weather('aged white courtyard plaster',(.37,.38,.355),(.82,.82,.77),2.6,.16)
outside=weather('mottled grey exterior render',(.19,.235,.22),(.61,.64,.61),3.2,.23)
concrete=weather('damp worn courtyard concrete',(.15,.18,.145),(.39,.40,.35),4,.25)
roofmat=weather('flat concrete roof',(.25,.255,.23),(.47,.48,.44),7,.2)
red=material('burgundy enamel doors',(.26,.026,.038),.35,.12)
tile=material('glossy oxblood tiled plinth',(.24,.018,.027),.2)
coping=weather('red coping',(.19,.035,.025),(.34,.12,.085),9)
blue=material('blue corrugated steel',(.018,.25,.54),.32,.48)
blueedge=material('steel raised folds',(.02,.34,.69),.3,.45)
black=material('dark window frames',(.018,.024,.027),.36,.4)
steel=material('aluminum frames and drying rack',(.42,.48,.47),.27,.65)
white=material('off white plastic',(.73,.76,.71),.36)
gold=material('golden decorative trim',(.65,.40,.12),.38,.28)
ochre=material('ochre trim backing',(.44,.19,.055),.48)
wood=weather('dry twigs and timber',(.075,.04,.015),(.3,.20,.10),11,.25)
mud=weather('wet mud at alley center',(.075,.082,.048),(.19,.16,.105),6,.15)
water=material('shallow brown puddles',(.095,.11,.085),.055)
water.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.8
teal=weather('teal door mesh curtains',(.016,.08,.092),(.065,.23,.25),35,.12)
mint=material('mint green plastic',(.27,.57,.44),.45)
pink=material('red plastic stool and basins',(.65,.015,.075),.3)
clothwhite=weather('white floral laundry cotton',(.55,.56,.50),(.87,.86,.79),65,.22)
clothred=weather('red hanging towel',(.38,.008,.034),(.77,.026,.092),90,.28)
purple=material('purple mesh cover',(.35,.18,.47),.7)
curtain=weather('faded pink interior curtains',(.16,.10,.11),(.37,.28,.27),26,.13)
glass=material('muted jade window glass',(.22,.36,.32),.21,.18)
p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.18;p.inputs['IOR'].default_value=1.45
leaves=[material('leaf '+str(i),c,.65) for i,c in enumerate([(.045,.13,.022),(.095,.23,.032),(.16,.28,.044),(.075,.17,.022),(.23,.29,.08)])]
brickm=[weather('paving brick '+str(i),tuple(k*.6 for k in c),c,22,.22) for i,c in enumerate([(.26,.23,.17),(.34,.26,.20),(.29,.28,.24),(.38,.30,.245),(.24,.23,.20)])]
# Ceramic tiles: physical metre coordinates across the vertical facade.
ceramic=material('white rectangular balcony tiles',(.74,.77,.74),.3)
n=ceramic.node_tree.nodes;l=ceramic.node_tree.links;p=n.get('Principled BSDF')
geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['X'],add.inputs[0]);l.new(sep.outputs['Y'],add.inputs[1])
co=n.new('ShaderNodeCombineXYZ');l.new(add.outputs[0],co.inputs['X']);l.new(sep.outputs['Z'],co.inputs['Y'])
bt=n.new('ShaderNodeTexBrick');l.new(co.outputs[0],bt.inputs['Vector']);bt.inputs['Scale'].default_value=1;bt.inputs['Brick Width'].default_value=.37;bt.inputs['Row Height'].default_value=.18;bt.inputs['Mortar Size'].default_value=.007
bt.inputs['Color1'].default_value=(.78,.8,.77,1);bt.inputs['Color2'].default_value=(.68,.72,.70,1);bt.inputs['Mortar'].default_value=(.30,.34,.32,1);l.new(bt.outputs['Color'],p.inputs['Base Color'])
bu=n.new('ShaderNodeBump');bu.inputs['Distance'].default_value=.006;bu.inputs['Strength'].default_value=.3;l.new(bt.outputs['Fac'],bu.inputs['Height']);l.new(bu.outputs[0],p.inputs['Normal'])

cube=bpy.data.meshes.new('V unit cube');cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
cache={}
def box(name,loc,dim,m,c=ARCH,rz=0):
    if m.name not in cache:
        me=cube.copy();me.materials.append(m);cache[m.name]=me
    o=bpy.data.objects.new(name,cache[m.name]);c.objects.link(o);o.location=ORIGIN+Vector(loc);o.scale=dim;o.rotation_euler[2]=rz;return o
def mesh(name,vs,fs,m,c=ARCH):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.materials.append(m);me.update();o=bpy.data.objects.new(name,me);c.objects.link(o);o.location=ORIGIN;return o
def line(name,pts,r,m,c=PROPS):
    cv=bpy.data.curves.new(name,'CURVE');cv.dimensions='3D';cv.resolution_u=1;cv.bevel_depth=r;cv.bevel_resolution=1
    sp=cv.splines.new('POLY');sp.points.add(len(pts)-1)
    for p,v in zip(sp.points,pts):p.co=(*v,1)
    cv.materials.append(m);o=bpy.data.objects.new(name,cv);c.objects.link(o);o.location=ORIGIN;return o
def rod(name,a,b,r,m,c=PROPS):return line(name,[a,b],r,m,c)
def ball(name,loc,scale,m,c=PROPS):
    key='sphere '+m.name
    if key not in cache:
        vs=[(0,0,1)];fs=[]
        for j in range(1,8):
            t=math.pi*j/8
            for i in range(12):vs.append((math.sin(t)*math.cos(i*math.tau/12),math.sin(t)*math.sin(i*math.tau/12),math.cos(t)))
        vs.append((0,0,-1))
        for i in range(12):fs.append((0,1+i,1+(i+1)%12))
        for j in range(6):
            for i in range(12):fs.append((1+j*12+i,1+j*12+(i+1)%12,1+(j+1)*12+(i+1)%12,1+(j+1)*12+i))
        for i in range(12):fs.append((73+i,85,73+(i+1)%12))
        me=bpy.data.meshes.new(key);me.from_pydata(vs,[],fs);me.materials.append(m)
        for poly in me.polygons:poly.use_smooth=True
        cache[key]=me
    o=bpy.data.objects.new(name,cache[key]);c.objects.link(o);o.location=ORIGIN+Vector(loc);o.scale=scale;return o
def text3(name,body,loc,size,m,rot,c=ARCH):
    cv=bpy.data.curves.new(name,'FONT');cv.body=body;cv.size=size;cv.align_x='CENTER';cv.align_y='CENTER';cv.extrude=.0005
    try:cv.font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc',check_existing=True)
    except:pass
    cv.materials.append(m);o=bpy.data.objects.new(name,cv);c.objects.link(o);o.location=ORIGIN+Vector(loc);o.rotation_euler=rot;return o
def trim_x(x1,x2,y,z):
    box('Ochre decorative fascia',((x1+x2)/2,y,z),(x2-x1,.045,.13),ochre)
    for zz in [z-.065,z+.065]:box('Gold fascia edge',((x1+x2)/2,y-.025,zz),(x2-x1,.026,.02),gold)
    for k in range(int((x2-x1)/.17)):
        x=x1+.1+k*.17
        mesh('Repeating gold floral motif',[(x-.055,y-.032,z),(x,y-.032,z+.045),(x+.055,y-.032,z),(x,y-.032,z-.045)],[(0,1,2,3)],gold)
def trim_y(y1,y2,x,z):
    box('Wing decorative fascia',(x,(y1+y2)/2,z),(.045,y2-y1,.13),ochre)
    for zz in [z-.065,z+.065]:box('Wing gold edge',(x+.025,(y1+y2)/2,zz),(.026,y2-y1,.02),gold)
    for k in range(int((y2-y1)/.17)):
        y=y1+.1+k*.17;mesh('Wing repeating motif',[(x+.03,y-.052,z),(x+.03,y,z+.045),(x+.03,y+.052,z),(x+.03,y,z-.045)],[(0,1,2,3)],gold)

# House ground, north main rooms, and solid roof slabs; facades have real openings.
box('Courtyard concrete slab',(6,-.6,.025),(12.4,15.5,.10),concrete)
box('Main house interior floor',(6,5.5,.18),(12,5,.23),roofmat)
box('North rear wall',(6,8,3.6),(12,.24,7.1),outside)
for x in [0,12]:box('Main side wall',(x,5.5,3.6),(.24,5.2,7.1),outside)
box('Upper floor slab',(6,5.1,3.5),(12.2,5.95,.22),plaster)
box('Main roof',(6,5.25,7.0),(12.25,5.85,.20),roofmat)
for x in [0,12]:box('Stepped roof parapet',(x,5.3,7.35),(.20,5.8,.60),outside);box('Red roof coping',(x,5.3,7.68),(.28,5.95,.07),coping)
box('Rear parapet',(6,8,7.35),(12,.20,.60),outside)
box('Rear coping',(6,8,7.68),(12.25,.28,.07),coping)
box('Ground floor porch strip',(6,2.5,.15),(6.15,1.1,.18),roofmat)

def front_wall_openings(y,x1,x2,h,openings):
    # opening tuples: x left/right, bottom, top
    cursor=x1
    for a,b,bottom,top in sorted(openings):
        if a>cursor:box('Courtyard wall pier',((a+cursor)/2,y,h/2),(a-cursor,.22,h),plaster)
        if bottom>0:box('Wall below window',((a+b)/2,y,bottom/2),(b-a,.22,bottom),plaster)
        box('Wall above opening',((a+b)/2,y,(h+top)/2),(b-a,.22,h-top),plaster);cursor=b
    if cursor<x2:box('End wall pier',((cursor+x2)/2,y,h/2),(x2-cursor,.22,h),plaster)
def plinth_x(a,b,y):
    box('Red ceramic base',((a+b)/2,y,.47),(b-a,.027,.74),tile)
    for x in [a+i*.6 for i in range(1,int((b-a)/.6))]:box('Plinth tile joint',(x,y-.016,.47),(.009,.006,.74),coping)
front_wall_openings(3,0,12,3.42,[(3.25,4.4,.18,2.98),(5,7.3,.88,2.84),(8.15,9.05,.18,2.98)])
for a,b in [(0,3.25),(4.4,8.15),(9.05,12)]:plinth_x(a,b,2.874)

def window_x(name,x,y,z,w,h,frame=black,panes=2,curtains=True):
    box(name+' tinted glass',(x,y+.055,z),(w,.025,h),glass)
    if curtains:
        # Ribbed curtain folds stay behind the glazing.
        for i in range(int(w/.10)):
            xx=x-w/2+.05+i*.1;box(name+' interior curtain',(xx,y+.11,z),(.105,.02,h-.07),curtain)
    for xx in [x-w/2,x+w/2]:box(name+' jamb',(xx,y,z),(.055,.085,h+.09),frame)
    for zz in [z-h/2,z+h/2,z+h*.18]:box(name+' horizontal frame',(x,y,zz),(w+.09,.085,.048),frame)
    for i in range(1,panes):box(name+' vertical frame',(x-w/2+w*i/panes,y,z),(.045,.08,h),frame)
    box(name+' sill',(x,y-.03,z-h/2-.08),(w+.20,.30,.10),plaster)
window_x('Ground broad black window',6.15,2.84,1.86,2.30,1.94)

def hanging(name,x,y,z,w,h,m,axis='X',sag=.12):
    vs=[];fs=[];nx=30;ny=18
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx;ac=(u-.5)*w;depth=.03*math.sin(u*math.pi*14)+.035*math.sin(v*4+u*9);zz=z-v*h-sag*math.sin(u*math.pi)*(.2+.8*v)
            vs.append((x+ac,y+depth,zz) if axis=='X' else (x+depth,y+ac,zz))
    for j in range(ny):
        for i in range(nx):k=j*(nx+1)+i;fs.append((k,k+1,k+nx+2,k+nx+1))
    o=mesh(name,vs,fs,m,PROPS)
    for f in o.data.polygons:f.use_smooth=True
    return o
def curtained_door(x,y):
    box('Recessed red door behind mesh',(x,y+.25,1.55),(1.1,.06,2.72),red)
    for xx in [x-.57,x+.57]:box('Burgundy door frame',(xx,y,1.57),(.06,.10,2.84),red)
    box('Dark transom glass',(x,y+.035,2.70),(1.10,.035,.48),black)
    for i in range(6):rod('Transom security bar',(x-.47+i*.19,y-.015,2.48),(x-.47+i*.19,y-.015,2.93),.013,red,ARCH)
    for side in [-1,1]:
        hanging('Teal insect screen panel',x+side*.277,y-.04,2.44,.54,2.21,teal,sag=.01)
        rod('Mint curtain binding',(x+side*.006,y-.07,.2),(x+side*.006,y-.07,2.44),.014,mint)
    box('Floral red door valance',(x,y-.065,2.46),(1.15,.018,.067),red)
    for i in range(12):ball('Valance gold floral accent',(x-.52+i*.094,y-.08,2.465),(.025,.008,.025),gold)
curtained_door(3.825,2.83)
# Side door with inset red panels, ajar against shed side.
box('Side door shadow',(8.60,3.08,1.55),(.9,.05,2.7),black)
o=box('Side red room door ajar',(8.96,3.27,1.45),(.82,.07,2.5),red,rz=-.60)
for zz in [1.0,1.9]:box('Raised red door panel',(8.96,3.22,zz),(.58,.035,.52),coping,rz=-.60)
window_x('Red side transom',8.6,2.82,2.74,.88,.40,red,4,False)

# Enclosed projecting upstairs balcony, white ceramic skirt and aluminum panes.
box('Balcony projecting floor',(6,2.58,3.5),(6.25,1.20,.23),plaster)
box('Balcony tiled skirt',(6,2.08,4.03),(6.25,.22,.84),ceramic)
box('Balcony tiled upper lintel',(6,2.08,6.82),(6.25,.22,.38),ceramic)
for x in [2.9,9.1]:box('Balcony side return',(x,2.57,5.25),(.20,1.05,3.35),ceramic)
window_x('Upper balcony',6,1.94,5.56,6.04,2.13,steel,6,False)
# One visibly open sliding panel replaces a pane with a dark aperture.
box('Upper sliding open aperture',(6.0,1.91,5.21),(.86,.026,1.20),black)
box('Sliding window displaced',(6.55,1.885,5.21),(.80,.025,1.20),glass)
for xx in [6.15,6.95]:box('Sliding pane edge',(xx,1.86,5.21),(.035,.07,1.24),steel)
box('Upper recessed red doorway',(6.0,3.2,5.25),(1,.05,2.25),red)
trim_x(2.85,9.15,1.95,3.64);trim_x(2.85,9.15,1.95,6.62)
for x in [4.15,7.95]:box('Balcony concrete corbel',(x,2.60,3.25),(.19,.9,.34),plaster)
box('Upper left plain room',(1.45,3.04,5.3),(2.9,.22,3.4),outside)
box('Upper right plain room',(10.55,3.04,5.3),(2.9,.22,3.4),outside)
window_x('Upper side small window',10.6,2.88,5.35,1.25,1.55,steel,2,True)
box('Terrace yellow access door',(1.5,2.885,4.65),(.95,.05,2.15),gold)

# Single-storey west wing with a through passage to the alley.
box('West wing roof',(1.5,-1.5,3.50),(3.15,9.3,.20),plaster)
for y in [-6,3]:box('Wing end wall',(1.5,y,1.73),(3,.20,3.4),plaster)
for x in [0,3]:
    for a,b in [(-6,-4.4),(-2.2,3)]:box('Passage wing wall',(x,(a+b)/2,1.72),(.22,b-a,3.4),outside if x==0 else plaster)
    box('Entrance passage lintel',(x,-3.3,3.06),(.24,2.2,.74),plaster)
box('Entry passage floor',(1.5,-3.3,.15),(3,2.2,.16),roofmat)
for y in [-4.4,-2.2]:box('Passage side',(1.5,y,1.64),(3,.18,3.2),plaster);box('Passage red plinth',(1.5,y+(.10 if y<-3 else -.10),.49),(3,.025,.74),tile)
box('Wing terrace parapet',(1.5,-6,3.78),(3,.18,.46),plaster)
box('West perimeter coping',(0,-1.5,3.65),(.29,9.3,.08),coping)
box('Wing inner coping',(3,-1.5,3.65),(.29,9.3,.08),coping)
trim_y(-6,3,3.13,3.44)
# West wing window/door applied to inner facade; interior of wing is not documented.
for a,b in [(-6,-4.4),(-2.2,.15),(1.3,3)]:box('West wing burgundy plinth',(3.125,(a+b)/2,.47),(.027,b-a,.74),tile)
box('Wing inner doorway recess',(3.14,.72,1.52),(.028,1.12,2.65),black)
for side in [-1,1]:hanging('Wing teal mesh curtain',3.17,.72+side*.28,2.43,.54,2.20,teal,'Y',.01)
box('Wing red door transom',(3.16,.72,2.72),(.04,1.1,.48),red)
for i in range(6):rod('Wing transom bar',(3.19,.22+i*.2,2.50),(3.19,.22+i*.2,2.94),.012,black)
box('Wing narrow pink curtain window',(3.135,-1.13,1.84),(.035,.84,1.66),curtain)
for yy in [-1.57,-.69]:box('Wing reddish window stile',(3.16,yy,1.84),(.07,.055,1.76),red)
for zz in [1,1.75,2.68]:box('Wing reddish window rail',(3.16,-1.13,zz),(.07,.9,.055),red)

# Entry gate with a real pedestrian opening and inward-swinging inset leaf.
for yy in [-4.47,-2.13]:box('Maroon tiled gate jamb',(-.16,yy,1.53),(.22,.20,3.03),tile)
box('Entrance canopy',(-.28,-3.3,3.17),(.9,2.85,.18),coping)
box('Gate gold plaque',(-.24,-3.3,2.87),(.065,2.22,.34),ochre)
text3('Family harmony plaque','家和万事兴',(-.284,-3.3,2.87),.26,gold,(math.pi/2,0,-math.pi/2))
box('Fixed large gate leaf',(.01,-2.73,1.43),(.075,1.09,2.60),red)
# Left leaf contains the pedestrian opening: frame plus top panel.
box('Left leaf upper panel',(.01,-3.84,2.36),(.075,1.09,.74),red)
for yy in [-4.365,-3.335]:box('Inset door side stiles',(.01,yy,1.14),(.075,.09,1.93),red)
box('Inset door lower rail',(.01,-3.84,.21),(.075,1.09,.12),red)
o=box('Open inward pedestrian leaf',(.44,-4.17,1.14),(.07,.94,1.84),red,rz=-1.0)
for zz in [.55,1.30,2.13,2.52]:box('Gate raised panel rail',(-.04,-2.74,zz),(.018,1.0,.035),coping)
for yy in [-2.24,-3.22]:box('Gate raised panel stile',(-.04,yy,1.47),(.018,.035,2.12),coping)
ball('Door brass handle',(-.09,-3.08,1.26),(.03,.035,.055),gold)
box('Entrance concrete step',(-.41,-3.3,.12),(.86,2.60,.20),roofmat)
for yy in [-2.75,-4.18]:
    if yy>-3:
        box('Traditional colorful door poster',(-.055,yy,1.8),(.015,.34,.49),pink)
        text3('Door blessing','福',(-.068,yy,1.80),.22,gold,(math.pi/2,0,-math.pi/2))
    else:
        box('Traditional colorful door poster',(.44-.045*math.cos(1),-4.17+.045*math.sin(1),1.8),(.015,.34,.49),pink,rz=-1)
        text3('Door blessing','福',(.44-.059*math.cos(1),-4.17+.059*math.sin(1),1.8),.22,gold,(math.pi/2,0,-math.pi/2-1))

# Tall south neighbor wall and blue steel shed along east edge.
box('Tall south enclosure',(6,-6.2,2.55),(12.3,.24,5.1),outside)
box('South wall coping',(6,-6.2,5.13),(12.4,.30,.08),roofmat)
box('Shed back masonry wall',(12,-1.5,1.60),(.20,9.3,3.2),outside)
box('Shed ground pad',(10.55,-1.5,.12),(3.0,9.1,.15),roofmat)
box('Blue corrugated shed fascia',(9.05,-1.5,2.85),(.08,9.1,.68),blue)
box('Shed solid blue end panel',(9.05,-4.83,1.35),(.08,2.42,2.7),blue)
for i in range(84):
    yy=-6.05+i*.108
    box('Blue fascia raised corrugation',(8.992,yy,2.85),(.038,.030,.68),blueedge)
    if yy<-3.6:box('Blue cladding corrugation',(8.992,yy,1.35),(.038,.030,2.7),blueedge)
mesh('Shed pitched steel roof',[(8.85,-6.28,3.20),(12.25,-6.28,3.39),(12.25,3.15,3.39),(8.85,3.15,3.20)],[(0,1,2,3)],blue)
for i in range(85):
    y=-6.2+i*.11;rod('Roof corrugation',(8.85,y,3.21),(12.25,y,3.40),.016,blueedge,ARCH)
for yy in [-6.1,-3.6,.15,3]:rod('Shed square support',(9.07,yy,.14),(9.07,yy,3.15),.045,black,ARCH)
rod('Shed cross beam',(9.07,-6.1,2.5),(9.07,3,2.5),.055,black,ARCH)
rod('South white downpipe',(8.65,-6.04,.18),(8.65,-6.04,5.2),.049,white,ARCH)
for z in [.6,1.6,2.6,3.6,4.6]:rod('Downpipe fixing',(8.59,-6.01,z),(8.71,-6.01,z),.017,black)
rod('Outer white drainpipe',(-.18,1.8,.1),(-.18,1.8,7.6),.044,white,ARCH)

# Clothes, stalk bundles and everyday courtyard objects seen in the film.
line('Shed clothesline',[(8.89,-3.6,2.24),(8.85,-.4,2.10),(8.89,2.8,2.24)],.007,wood)
hanging('Sagging white floral sheet',8.84,.32,2.16,2.05,1.0,clothwhite,'Y',.38)
hanging('Bright red towel',8.80,-1.22,2.14,.75,1.45,clothred,'Y',.06)
for i in range(120):
    # Small colored motifs placed over the draped white cloth, respecting its sag.
    yy=random.uniform(-.65,1.28);v=random.uniform(.10,.9);u=(yy+.705)/2.05
    zz=2.16-v- .38*math.sin(u*math.pi)*(.2+.8*v)
    ball('Floral cloth pattern',(8.798,yy,zz),(.009,.013,.022),random.choice([pink,gold,mint]))
for b in range(7):
    by=-2.7+b*.73
    for i in range(38):
        yy=by+random.uniform(-.26,.26);xx=11.35+random.uniform(-.2,.25);h=random.uniform(1.45,2.2)
        rod('Bound cut stalk',(xx,yy,.18),(xx+.25+random.random()*.2,yy+random.uniform(-.18,.18),h),random.uniform(.012,.023),wood)
    rod('Red binding twine',(11.12,by-.28,.68),(11.16,by+.28,.68),.018,red)
def stool(x,y,z=.38,m=pink):
    box('Plastic stool top',(x,y,z),(.40,.34,.075),m,PROPS)
    for dx in [-.145,.145]:
        for dy in [-.105,.105]:rod('Stool tapered leg',(x+dx*1.15,y+dy*1.2,.12),(x+dx,y+dy,z),.031,m)
    box('Stool cross brace',(x,y,.19),(.30,.035,.045),m,PROPS)
stool(7.80,-5.30);stool(4.3,1.26,.36,mint);stool(8,1.1,.36,pink)
def basin(x,y,r,h,m=pink):
    vs=[];fs=[];N=36
    for radius,z in [(r*.75,.10),(r,.10+h),(r-.025,.10+h),(r*.73,.125)]:
        for i in range(N):vs.append((x+radius*math.cos(i*math.tau/N),y+radius*math.sin(i*math.tau/N),z))
    for ring in range(3):
        for i in range(N):a=ring*N+i;b=ring*N+(i+1)%N;fs.append((a,b,b+N,a+N))
    fs.append(tuple(range(3*N,4*N)));return mesh('Red washing basin',vs,fs,m,PROPS)
basin(7.25,-5.55,.34,.14);basin(8,-4.63,.24,.13);basin(7.12,-4.8,.33,.30)
# Red cloth table with open laptop (video 43 seconds).
box('Low folding table top',(5.20,-.20,.78),(1.30,.72,.055),wood,PROPS)
box('Red table cover',(5.2,-.20,.815),(1.35,.76,.012),clothred,PROPS)
for sx in [-1,1]:
    rod('Table folding legs',(5.2+sx*.50,-.49,.1),(5.2-sx*.48,-.49,.76),.026,wood)
    rod('Table folding legs',(5.2+sx*.50,.07,.1),(5.2-sx*.48,.07,.76),.026,wood)
box('Laptop silver base',(5.42,-.20,.84),(.34,.25,.018),steel,PROPS)
o=box('Laptop open screen',(5.42,-.077,.955),(.34,.018,.22),steel,PROPS);o.rotation_euler[0]=-.18
o=box('Laptop dark display',(5.42,-.090,.955),(.30,.009,.18),black,PROPS);o.rotation_euler[0]=-.18
ball('Mouse',(5.11,-.20,.86),(.04,.057,.023),black)
rod('Water bottle',(4.87,-.05,.82),(4.87,-.05,1.04),.032,glass)
line('Yellow extension cord',[(5.42,-.22,.82),(5.66,-.4,.75),(5.9,-.5,.11),(6.4,-.8,.10),(6.8,-.5,.10),(6.1,-.1,.10),(6.5,.1,.10),(6.9,-.3,.1),(7.0,1.8,.1)],.007,gold)
# Drying rack against main broad ground window.
for x in [5.55,7.28]:
    rod('Drying rack X',(x,1.25,.14),(x,2.08,1.40),.018,steel)
    rod('Drying rack X',(x,2.08,.14),(x,1.25,1.40),.018,steel)
rod('Drying rack top rail',(5.45,1.25,1.40),(7.4,1.25,1.40),.022,steel)
for i,m in enumerate([clothwhite,teal,clothwhite,black]):hanging('Laundry on drying rack',5.65+i*.42,1.235,1.42,.30,.5+random.random()*.25,m,sag=.025)
box('White top loading washing machine',(7.72,2.28,.60),(.61,.61,.91),white,PROPS)
box('Washer upper rim',(7.72,2.28,1.08),(.64,.63,.11),white,PROPS)
box('Washer dark top lid',(7.72,2.28,1.14),(.48,.44,.025),steel,PROPS)
for i in range(15):box('Washer vertical rib',(7.45+i*.038,1.966,.59),(.011,.009,.72),white,PROPS)
ball('Purple mesh domed cover',(7.68,2.24,1.17),(.25,.24,.22),purple)
for yy in [1.66,2.12]:
    for xx in [6.89,7.16]:rod('Folding chair leg',(xx,yy,.12),(xx,1.9,.46),.013,steel)
box('Teal small chair seat',(7.02,1.9,.46),(.34,.36,.05),mint,PROPS)
for x,y in [(3.5,2.51),(3.8,2.51),(8.05,2.6),(8.3,2.5)]:ball('Slippers',(x,y,.18),(.075,.15,.036),coping)
rod('Mop handle',(8.78,-4.0,.13),(8.92,-3.86,1.55),.013,pink);box('Mop head',(8.78,-4,.13),(.23,.09,.05),purple,PROPS)

# Mesh leaves, assembled into a handful of efficient editable foliage objects.
def leaf_mesh(name,items,c=PLANTS):
    vs=[];fs=[];indices=[]
    for loc,size,direction,mi in items:
        p=Vector(loc);q=Vector(direction).to_track_quat('Z','Y');k=len(vs)
        for v in [(-.55*size,0,0),(0,-size,0),(.55*size,0,0),(0,size,0),(0,0,.16*size)]:vs.append(tuple(p+q@Vector(v)))
        fs.extend([(k,k+1,k+4),(k+1,k+2,k+4),(k+2,k+3,k+4),(k+3,k,k+4)]);indices.extend([mi]*4)
    o=mesh(name,vs,fs,leaves[0],c)
    for m in leaves[1:]:o.data.materials.append(m)
    for poly,idx in zip(o.data.polygons,indices):poly.material_index=idx
    return o
items=[]
for i in range(4800):
    a=random.random()*math.tau;r=math.sqrt(random.random());x=7.5+1.25*r*math.cos(a);y=-2.2+1.5*r*math.sin(a);z=.18+.78*(1-r*r)*random.random()+random.uniform(0,.12)
    items.append(((x,y,z),random.uniform(.04,.10),(random.uniform(-1,1),random.uniform(-1,1),random.uniform(-.1,1)),random.randrange(5)))
leaf_mesh('Heap of freshly cut green vines',items)
for i in range(150):
    x=random.uniform(6.3,8.6);y=random.uniform(-3.3,-1)
    rod('Cut green branch',(x,y,.17),(x+random.uniform(-.5,.5),y+random.uniform(-.5,.5),random.uniform(.35,.95)),.007,wood)

# North-south side alley, bounded by filmed house east and ivy-covered neighbor west.
box('Alley dark mortar bed',(-1.52,-1,.018),(3.05,27,.055),mud,LANE)
vs=[];fs=[];mis=[]
def append_cube(loc,dim,mi):
    k=len(vs)
    for v in cube.vertices:vs.append(tuple(Vector(loc)+Vector((v.co.x*dim[0],v.co.y*dim[1],v.co.z*dim[2]))))
    for p in cube.polygons:fs.append(tuple(k+i for i in p.vertices));mis.append(mi)
for row in range(166):
    y=-14.1+row*.16
    for j in range(10):
        x=-2.96+j*.302+(.151 if row%2 else 0)
        if x>-.08:continue
        append_cube((x,y,.052+random.uniform(-.008,.008)),(.292,.150,.053),random.randrange(5))
o=mesh('Individual worn brick pavers',vs,fs,brickm[0],LANE)
for m in brickm[1:]:o.data.materials.append(m)
for p,i in zip(o.data.polygons,mis):p.material_index=i
def patch(name,x,y,rx,ry,z,m):
    vs=[(x,y,z)];N=48
    for i in range(N):
        t=i*math.tau/N;f=1+.12*math.sin(t*5)+.05*math.sin(t*13);vs.append((x+rx*math.cos(t)*f,y+ry*math.sin(t)*f,z))
    return mesh(name,vs,[(0,i+1,(i+1)%N+1) for i in range(N)],m,LANE)
for i,(x,y,rx,ry) in enumerate([(-1.42,-7.7,.61,2.1),(-1.75,-4.5,.38,.73),(-1.20,3.5,.54,1.6),(-1.68,-10.7,.50,1.0)]):
    patch('Irregular muddy rut',x,y,rx*1.20,ry*1.13,.089+i*.001,mud);patch('Shallow rain puddle',x,y,rx,ry,.094+i*.001,water)
# Long western neighbor facade; small inset gate and different roof heights.
for y,h,length in [(-8.3,3.4,10),(.0,3.3,6.6),(7.35,5.4,8.1)]:
    box('Neighbor west street wall',(-3.20,y,h/2),(.23,length,h),outside,LANE)
    box('Neighbor modest flat roof',(-6.0,y,h), (5.9,length+.2,.14),roofmat,LANE)
    box('Neighbor coping',(-3.2,y,h+.12),(.3,length+.12,.13),coping,LANE)
    box('Neighbor back volume',(-8.8,y,h/2),(.23,length,h),outside,LANE)
box('Neighbor recessed red gate',(-3.06,-7.2,1.20),(.05,1.50,2.35),red,LANE)
for yy in [-7.98,-6.42]:box('Neighbor gate maroon surround',(-3.02,yy,1.3),(.10,.13,2.6),tile,LANE)
box('Neighbor gate lintel',(-3.02,-7.2,2.58),(.12,1.68,.15),tile,LANE)
# House exterior high, small barred openings and abandoned bricks.
for y,z,w,h in [(.4,2.15,.85,.65),(5.3,2.1,.75,.55),(-5.2,2.5,.7,.48)]:
    box('Exterior small dark window',(-.133,y,z),(.025,w,h),black,LANE)
    for j in range(5):rod('Exterior window bars',(-.159,y-w/2+.08+j*(w-.16)/4,z-h/2),(-.159,y-w/2+.08+j*(w-.16)/4,z+h/2),.011,red,LANE)
    box('Exterior red sill',(-.22,y,z-h/2-.05),(.31,w+.16,.08),coping,LANE)
# Ivy leaves lie irregularly on the wall, with vines descending below the coping.
items=[]
for i in range(11500):
    yy=random.uniform(-13.2,3.35);zz=random.uniform(.20,3.60)
    if -8.05<yy<-6.35 and zz<2.55:continue
    xx=-3.0+random.uniform(0,.24)+.09*math.sin(yy*3+zz*5)
    items.append(((xx,yy,zz),random.uniform(.065,.14),(1,random.uniform(-.8,.8),random.uniform(-.4,.8)),random.randrange(5)))
leaf_mesh('Dense ivy on neighboring alley wall',items)
for i in range(30):
    yy=-13+i*.55;line('Trailing ivy stems',[(-2.95,yy,.2),(-2.87,yy+.1,1.4),(-2.94,yy-.14,2.3),(-2.98,yy,3.55)],.008,wood,PLANTS)
items=[]
for i in range(2500):
    y=random.uniform(-14,12);x=random.choice([random.uniform(-3.04,-2.59),random.uniform(-.48,-.15)])
    if -4.6<y<-2.0 and x>-.6:continue
    z=random.uniform(.09,.28);items.append(((x,y,z),random.uniform(.04,.13),(random.uniform(-1,1),random.uniform(-1,1),1),random.randrange(5)))
leaf_mesh('Alley wall-base weeds',items)
for i in range(70):
    box('Loose brick and rubble',(-.5+random.uniform(-.2,.2),random.uniform(2.1,5),.13),(.24,.11,.065),random.choice(brickm),LANE,random.uniform(-1,1))
# Crumpled blue-white tarpaulins outside.
for idx,(cx,cy,m) in enumerate([(-.65,3.9,blue),(-.82,4.6,clothwhite),(-.60,5.2,blue)]):
    vv=[];ff=[]
    for j in range(10):
        for i in range(8):vv.append((cx+(i/7-.5)*.78,cy+(j/9-.5)*1.12,.14+random.random()*.14))
    for j in range(9):
        for i in range(7):k=j*8+i;ff.append((k,k+1,k+9,k+8))
    mesh('Rumpled roadside tarp '+str(idx),vv,ff,m,LANE)

# Stylized mint electric scooter, modeled rather than a photograph billboard.
def scooter(x,y,c=LANE):
    for yy in [y-.53,y+.53]:
        # Tire torus approximated by a circular bevel curve in a vertical plane.
        pts=[(x,yy+.225*math.cos(i*math.tau/32),.33+.225*math.sin(i*math.tau/32)) for i in range(33)]
        line('Scooter tire',pts,.055,black,c);rod('Scooter axle',(x-.09,yy,.33),(x+.09,yy,.33),.052,steel,c)
    box('Scooter mint footboard',(x,y,.32),(.32,.75,.12),mint,c)
    box('Scooter rear body',(x,y-.38,.58),(.39,.35,.37),mint,c)
    ball('Scooter black seat',(x,y-.25,.84),(.23,.36,.085),black,c)
    rod('Scooter steering column',(x,y+.47,.35),(x,y+.44,1.13),.045,black,c)
    ball('Scooter mint front shield',(x,y+.48,.70),(.24,.09,.28),mint,c)
    rod('Scooter handlebars',(x-.30,y+.42,1.13),(x+.30,y+.42,1.13),.022,black,c)
    ball('Scooter headlight',(x,y+.48,1.12),(.125,.07,.085),white,c)
    for dx in [-.25,.25]:rod('Mirror stalk',(x+dx,y+.43,1.15),(x+dx,y+.47,1.38),.011,steel,c);ball('Rearview mirror',(x+dx,y+.48,1.40),(.065,.02,.045),black,c)
scooter(-.70,2.0)
for y,z in [(-6.0,3.8),(3.0,4.0),(9.0,4.25)]:rod('Alley overhead cross pipe',(-3.25,y,z),(.1,y,z+.04),.023,black,LANE)
for x in [-.30,-2.9]:line('Sagging overhead alley cable',[(x,-14,4.7),(x,-7,4.20),(x,0,4.0),(x,6,4.5),(x,12,4.65)],.007,black,LANE)
for i in range(4):
    line('Cable coil on exterior wall',[(-.22,6.3+.19*math.cos(j*math.tau/40),4.1+.19*math.sin(j*math.tau/40)+i*.012) for j in range(41)],.009,black,LANE)
# Fine cracks in courtyard concrete.
for pts in [[(3.2,-3.9,.087),(4.4,-3.5,.087),(5.2,-3.55,.087),(6.4,-3.2,.087)],[(5.2,-3.55,.087),(5.5,-4.5,.087),(5.3,-5.9,.087)],[(4.0,1.1,.087),(4.9,.8,.087),(5.0,.25,.087)]]:line('Hairline concrete crack',pts,.0035,mud)

# Overcast lighting consistent with the recording; retain village cameras.
for o in S.objects:
    if o.type=='LIGHT':o.hide_render=True
S.world.use_nodes=True;bg=S.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.70,.76,.83,1);bg.inputs[1].default_value=.55
ld=bpy.data.lights.new('Cloud filtered daylight','AREA');lo=bpy.data.objects.new('Cloud filtered daylight',ld);CAM.objects.link(lo);lo.location=ORIGIN+Vector((2,-3,19));ld.energy=2400;ld.shape='DISK';ld.size=16
sun=bpy.data.lights.new('Soft ambient sun','SUN');so=bpy.data.objects.new('Soft ambient sun',sun);CAM.objects.link(so);so.rotation_euler=(.28,-.35,-.4);sun.energy=.55;sun.angle=.45
def camera(name,pos,target,lens=27):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);CAM.objects.link(o);o.location=ORIGIN+Vector(pos);o.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_start=.06;d.clip_end=2000;return o
views=[
    (camera('VIDEO A | Courtyard balcony and blue shed',(3.65,-5.55,2.30),(6.3,1.50,3.0),18),'01_video_courtyard.png',1600,1300),
    (camera('VIDEO B | Damp brick alley and ivy',(-1.65,-12.3,1.70),(-1.35,1,1.95),25),'02_video_alley.png',1200,1500),
    (camera('VIDEO C | Entrance and courtyard passage',(-2.55,-4.80,1.75),(.1,-3.23,1.65),23),'03_video_entrance.png',1400,1200),
    (camera('VIDEO D | House within village',(-20,-25,25),(4,0,1.5),46),'04_video_context.png',1600,1300),
]
S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=40;S.cycles.use_denoising=True;S.cycles.max_bounces=6
S.render.image_settings.file_format='PNG';S.render.resolution_percentage=100;S.view_settings.view_transform='AgX'
S.camera=views[0][0];S.render.resolution_x=1600;S.render.resolution_y=1300
S['video_reference']='a7052683d1582cdbe0d08dca263a9642_raw.mp4; 54.546 seconds'
S['video_reconstruction_scope']='Visible courtyard facades, entrance and alley recreated from video. Dimensions, cardinal orientation, hidden rooms and placement in village are estimates.'
ARCH['footprint_estimate_m']='12 x 14, main block 2 storeys; approximate local coordinates'
notes='''VIDEO RECONSTRUCTION / 2026-10-02\nUser source: D:/blender/hometown/a7052683d1582cdbe0d08dca263a9642_raw.mp4\nVideo stays local and unchanged. Reference stills extracted at 2 second intervals.\nOBSERVED: 00-15 s brick alley, damp rut/puddles, vine-covered neighbor wall, small barred windows, scooter and tarps. 17-21 s burgundy metal gate with pedestrian leaf and passage. 21-29 s blue corrugated shed, laundry, bundled stalks and cut green branches. 29-41 s two-storey white house, red tiled plinth, enclosed glazed balcony and decorative tile bands; low wing around courtyard. 43-53 s teal door screens, table/laptop, washer and drying rack.\nESTIMATED: dimensions, concealed rooms and rear walls, exact room connections, roof plan and north direction. The recording is not a measured survey. Its position in the previously interpretive village is provisional.\nThe original parcels 002/003 remain in disabled BACKUP collections. Original blend untouched.\nEditable groups VIDEO 00-04; four dedicated cameras A-D. All geometry/materials are local and editable.\n'''
tx=bpy.data.texts.new('VIDEO REFERENCE | observed versus estimated');tx.write(notes)
(R/'RECONSTRUCTION_NOTES.txt').write_text(notes,encoding='utf-8')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.file.pack_all()
out=R/'Yanlaozhai_Video_House_and_Lane.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(out))
manifest={'blend':str(out),'source_video':S['video_reference'],'origin':list(ORIGIN),'observed_scope':S['video_reconstruction_scope'],'new_objects':sum(len(c.objects) for c in [ARCH,LANE,PROPS,PLANTS,CAM]),'views':[]}
for cam,filename,w,h in views:
    S.camera=cam;S.render.resolution_x=w;S.render.resolution_y=h;S.render.filepath=str(R/filename)
    print('RENDER',filename,flush=True);bpy.ops.render.render(write_still=True)
    manifest['views'].append({'camera':cam.name,'file':filename,'resolution':[w,h]})
S.camera=views[0][0];S.render.resolution_x=1600;S.render.resolution_y=1300
bpy.ops.wm.save_as_mainfile(filepath=str(out))
(R/'video_revision_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('VIDEO REVISION COMPLETE',str(out),flush=True)
