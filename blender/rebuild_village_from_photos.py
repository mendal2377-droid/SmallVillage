"""Village topology from the user's sketch and satellite screenshot; details from 17 photos.
The star anchors the previously reconstructed house. Dimensions and individual plots are estimates.
"""
import bpy,math,random,json,shutil
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
OUT=R/'video_revision/Yanlaozhai_Video_House_and_Lane.blend'
BACKUP=R.parent.parent/'village_reference/before_village_update.blend'
BACKUP.parent.mkdir(exist_ok=True)
if not BACKUP.exists():shutil.copy2(OUT,BACKUP)
bpy.ops.wm.open_mainfile(filepath=str(BACKUP))
S=bpy.context.scene;random.seed(20261003)
# Keep the complete filmed house, its lane, interiors, lights and cameras unchanged.
for o in list(S.objects):
    if not any(c.name.startswith('VIDEO ') for c in o.users_collection):bpy.data.objects.remove(o,do_unlink=True)
def col(name):
    c=bpy.data.collections.new('MAP | '+name);S.collection.children.link(c);return c
LAND=col('Fields and seasonal crops');ROAD=col('Roads paths and bridges');WATER=col('River and two ponds')
HOUSES=col('Residential blocks');TREES=col('Poplar avenues');SCHOOL=col('Primary school');CAM=col('Village cameras')
def material(name,color,rough=.8):
    m=bpy.data.materials.new('MAP | '+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
soil=material('earth',(.27,.20,.125));concrete=material('concrete roads',(.49,.49,.43));joint=material('concrete seams',(.27,.28,.24))
grass=material('green field',(.19,.30,.078));rowmat=material('crop rows',(.085,.18,.035));cornmat=material('dry corn leaves',(.42,.34,.15))
cornsoil=material('corn field floor',(.30,.28,.10));snow=material('snow',(.88,.92,.95));bark=material('poplar bark',(.22,.16,.105))
white=material('whitewashed tree bases',(.80,.80,.73));water=material('still canal water',(.12,.27,.23),.20)
reed=material('bank grasses',(.27,.32,.12));brick=material('red brick',(.37,.18,.105));dark=material('window frames',(.05,.057,.055))
red=material('maroon gates',(.27,.04,.035));glass=material('blue grey windows',(.19,.29,.31),.25);blue=material('blue sheet roofs',(.06,.25,.38))
roofmat=material('grey roof tiles',(.25,.27,.26));plasters=[material('house plaster '+str(i),c) for i,c in enumerate([(.74,.74,.68),(.53,.55,.50),(.64,.59,.48)])]
leafmat=material('poplar foliage',(.17,.29,.075));schoolmat=material('school cream facade',(.78,.73,.53))
cube=bpy.data.meshes.new('Map unit cube');cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
cache={}
def obj(name,me,c,season=None,solid=False):
    o=bpy.data.objects.new('MAP '+name,me);c.objects.link(o);o['walk_solid']=solid
    if season:o['season']=season;o.hide_render=season not in ['green','leaves']
    return o
def box(name,loc,dim,m,c=HOUSES,season=None,solid=False):
    if m.name not in cache:me=cube.copy();me.materials.append(m);cache[m.name]=me
    o=obj(name,cache[m.name],c,season,solid);o.location=loc;o.scale=dim;return o
def mesh(name,vs,fs,m,c,season=None):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.materials.append(m);me.update();return obj(name,me,c,season)
def tube(name,a,b,r,m,c=TREES,sides=5):
    a,b=Vector(a),Vector(b);d=b-a;q=d.to_track_quat('Z','Y');vs=[]
    for z in [0,d.length]:
        for i in range(sides):vs.append(tuple(a+q@Vector((r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),z))))
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return mesh(name,vs,fs,m,c)
def P(px,py):return ((px-772)*.65-31,(443-py)*.65-108)
def rect(r):
    x0,y1=P(r[0],r[1]);x1,y0=P(r[2],r[3]);return [x0,y0,x1,y1]
def slab(name,r,z,m,c=LAND,season=None):
    x0,y0,x1,y1=rect(r);return box(name,((x0+x1)/2,(y0+y1)/2,z), (x1-x0,y1-y0,.08),m,c,season)
def strip(name,a,b,width,m,c=ROAD,z=.08):
    a,b=Vector(a),Vector(b);d=b-a;length=d.length
    o=box(name,tuple((a+b)/2)+(z,), (length,width,.08),m,c);o.rotation_euler.z=math.atan2(d.y,d.x);return o
def road(name,a,b,width=4.4):
    a,b=P(*a),P(*b);strip(name+' earth shoulder',a,b,width+1.5,soil,z=.025)
    strip(name,a,b,width,concrete)
    d=Vector(b)-Vector(a);length=d.length;d.normalize();n=Vector((-d.y,d.x))
    for i in range(1,int(length/4.8)):
        p=Vector(a)+d*i*4.8;strip(name+' slab joint',p-n*width/2,p+n*width/2,.018,joint,z=.125)
    return a,b
slab('continuous plain',[-65,-40,1290,820],-.08,soil)
# The sketch controls topology; road widths follow the narrow concrete roads in the photographs.
road('west perimeter road',(164,5),(164,650),5.2)
road('east perimeter road',(820,5),(820,650),5.2)
for y in [243,351,480]:road('cross-village lane '+str(y),(164,y),(820,y),4.4)
road('southern poplar avenue',(35,648),(1262,648),5.8)
road('field path',(582,480),(582,648),2.5)
# River branches and pond margins. Crossings are explicit walkable bridges.
waterzones=[];bridges=[]
def channel(name,a,b,width):
    a,b=P(*a),P(*b);strip(name+' bank',a,b,width+3,reed,WATER,z=.005);strip(name,a,b,width,water,WATER,z=.015)
    cx=(a[0]+b[0])/2;cy=(a[1]+b[1])/2
    waterzones.append({'shape':'rect','rect':[min(a[0],b[0])-width/2,min(-a[1],-b[1])-width/2,max(a[0],b[0])+width/2,max(-a[1],-b[1])+width/2]})
channel('central north south river',(407,42),(407,635),7.4)
channel('north pond channel',(407,42),(641,42),6.8)
channel('east branch beside home',(415,413),(820,413),7.2)
channel('south irrigation channel',(35,632),(1262,632),5.0)
def pond(name,px,py,rx,ry):
    x,y=P(px,py);vs=[(x,y,.045)];bank=[]
    for i in range(49):
        a=i*math.tau/48;k=1+.045*math.sin(a*5)
        vs.append((x+rx*math.cos(a)*k,y+ry*math.sin(a)*k,.045))
        bank.append((x+(rx+1.7)*math.cos(a)*k,y+(ry+1.7)*math.sin(a)*k,.015))
    mesh(name+' margin',bank,[tuple(range(49))],reed,WATER)
    mesh(name,vs,[(0,i,i+1) for i in range(1,49)],water,WATER)
    waterzones.append({'shape':'ellipse','center':[x,-y],'radius':[rx,ry]})
pond('north pond',641,37,35,15)
pond('central junction pond',415,413,25,13)
def bridge(px,py,axis='x',width=4.4,length=13):
    x,y=P(px,py);dims=(length,width) if axis=='x' else (width,length)
    box('bridge deck',(x,y,.10),(*dims,.10),concrete,ROAD)
    bridges.append([x-dims[0]/2,-y-dims[1]/2,x+dims[0]/2,-y+dims[1]/2])
    for side in [-1,1]:
        if axis=='x':loc=(x,y+side*(width/2+.15),.53);dim=(length,.14,.84)
        else:loc=(x+side*(width/2+.15),y,.53);dim=(.14,length,.84)
        box('bridge low parapet',loc,dim,white,ROAD,solid=True)
        for j in [-.4,0,.4]:
            p=(x+j*length,y+side*(width/2+.15),.7) if axis=='x' else (x+side*(width/2+.15),y+j*length,.7)
            box('bridge post',p,(.24,.24,1.18),white,ROAD,solid=True)
for y in [243,351,480]:bridge(407,y)
for x in [164,407,582,820]:bridge(x,632,'y',5.2 if x!=582 else 2.5,13)
bridge(820,413,'y',5.2,12)
# Seasonal fields: a green low crop, dry tall corn and patchy winter snow.
fields=[(18,28,151,613),(173,485,393,623),(421,485,573,623),(591,485,811,623),(831,139,968,623),(36,665,1261,756),(416,423,478,470),(15,-35,555,15),(712,-35,972,8)]
crop_counts={'green_blades':0,'corn_stalks':0}
for idx,r in enumerate(fields):
    x0,y0,x1,y1=rect(r);slab('field soil '+str(idx),r,.01,soil)
    for season,m in [('green',grass),('corn',cornsoil),('winter',snow)]:slab('season field '+str(idx),r,.07,m,season=season)
    vv=[];ff=[];bv=[];bf=[];cv=[];cf=[]
    # Subtle soil breaks remain visible between long crop rows.
    x=x0+.35
    while x<x1:
        k=len(vv);vv.extend([(x,y0,.135),(x+.19,y0,.135),(x+.19,y1,.135),(x,y1,.135)]);ff.append((k,k+1,k+2,k+3));x+=.72
    mesh('green field furrows '+str(idx),vv,ff,rowmat,LAND,'green')
    for j in range(int((x1-x0)*(y1-y0)/7)):
        x=random.uniform(x0,x1);y=random.uniform(y0,y1)
        # Concentrate detailed plants along margins where a visitor can stand.
        if min(x-x0,x1-x,y-y0,y1-y)>5 and random.random()<.86:continue
        h=random.uniform(.14,.30);k=len(bv)
        bv.extend([(x-.06,y,.14),(x+.06,y,.14),(x+.10,y,.14+h),(x,y-.06,.14),(x,y+.06,.14),(x-.10,y,.14+h)])
        bf.extend([(k,k+1,k+2),(k+3,k+4,k+5)]);crop_counts['green_blades']+=1
        h=random.uniform(1.5,2.05);k=len(cv)
        cv.extend([(x-.025,y,.14),(x+.025,y,.14),(x+.025,y,h),(x-.025,y,h)]);cf.append((k,k+1,k+2,k+3))
        for leaf in range(4):
            a=leaf*2.4;z=.45+leaf*.32;dx=.43*math.cos(a);dy=.43*math.sin(a);k=len(cv)
            cv.extend([(x,y,z),(x+dx*.55-.10,y+dy*.55,z+.15),(x+dx,y+dy,z-.08),(x+dx*.55+.10,y+dy*.55,z+.15)]);cf.append((k,k+1,k+2,k+3))
        crop_counts['corn_stalks']+=1
    mesh('low green crop blades '+str(idx),bv,bf,rowmat,LAND,'green')
    mesh('tall corn plants '+str(idx),cv,cf,cornmat,LAND,'corn')
    # Winter keeps occasional soil exposed, as in the snow photographs.
    for j in range(12):
        x=random.uniform(x0,x1);y=random.uniform(y0,y1)
        box('exposed soil in snow',(x,y,.12),(random.uniform(.8,2.8),random.uniform(.5,1.8),.02),soil,LAND,'winter')
# Small field ditches and paths use the same concrete as the photo with short culvert posts.
road('western field track',(55,480),(55,623),2.3)
for x in [173,591,831]:
    a,b=P(x,493),P(x,617);strip('field irrigation ditch',a,b,1.2,water,WATER,z=.04)
    xx=(a[0]+b[0])/2;waterzones.append({'shape':'rect','rect':[xx-.6,-max(a[1],b[1]),xx+.6,-min(a[1],b[1])]})
# Compact, individually editable parcels follow each pink block, with connecting alleys.
parcels=[]
def home(x,y,w,d,idx):
    m=random.choice([brick,*plasters]);h=random.choice([3.3,3.6,6.6]);north=y+d/2-3.7
    box('courtyard %03d'%idx,(x,y,.035),(w,d,.08),concrete)
    box('main house %03d'%idx,(x,north,h/2+.12),(w-1,6.8,h),m,solid=True)
    if random.random()<.58 and h<4:
        z=h+.12;ww=w+.1;dd=7.6
        mesh('pitched tile roof',[(x-ww/2,north-dd/2,z),(x+ww/2,north-dd/2,z),(x+ww/2,north,z+1.4),(x-ww/2,north,z+1.4),(x-ww/2,north+dd/2,z),(x+ww/2,north+dd/2,z)],[(0,1,2,3),(3,2,5,4),(0,3,4),(1,5,2)],roofmat,HOUSES)
    else:
        box('flat house roof',(x,north,h+.20),(w-.5,7.3,.2),concrete)
        for sy in [-1,1]:box('roof parapet',(x,north+sy*3.45,h+.50),(w-.5,.13,.55),m)
        box('snow on flat roof',(x,north,h+.325),(w-.65,7.1,.06),snow,HOUSES,'winter')
    for xx in [x-w*.3,x+w*.3]:
        for z in ([1.8,4.9] if h>4 else [1.8]):
            box('window border',(xx,north-3.45,z),(1.45,.08,1.44),white)
            box('dark glass',(xx,north-3.50,z),(1.30,.025,1.30),glass)
            box('window mullion',(xx,north-3.53,z),(.035,.025,1.3),dark)
    box('front door',(x,north-3.46,1.34),(1.05,.04,2.42),red)
    for sx in [-1,1]:box('boundary wall',(x+sx*w/2,y,1.15),(.18,d,2.2),brick,solid=True)
    # Doors are open gaps; walking into simple background courtyards is possible.
    gy=y-d/2
    for sx in [-1,1]:box('entrance wing wall',(x+sx*(w/4+.5),gy,1.15),(w/2-1,.18,2.2),m,solid=True)
    box('open red gate',(x-1.0,gy+.65,1.1),(.06,1.25,2.05),red,solid=True)
    box('whitewashed wall foot',(x,gy+.01,.38),(w,.025,.5),white) if False else None
    if idx%4==0:box('blue courtyard shed',(x+w*.28,y,2.65),(w*.35,d*.45,.11),blue)
    parcels.append({'id':idx,'center':[round(x,2),round(y,2)],'dimensions':[w,d],'status':'estimated parcel within user block'})
blocks=[(173,36,395,230),(421,73,809,229),(174,258,395,339),(423,258,807,339),(176,364,395,467),(423,362,807,400),(483,428,807,468),(834,58,968,124)]
idx=0
for r in blocks:
    x0,y0,x1,y1=rect(r);nx=max(1,int((x1-x0)/17));ny=max(1,int((y1-y0)/24));sx=(x1-x0)/nx;sy=(y1-y0)/ny
    for iy in range(ny):
        laneY=y0+iy*sy+1.5;strip('local east west alley',(x0,laneY),(x1,laneY),2.4,concrete)
        for ix in range(nx):
            x=x0+(ix+.5)*sx;y=y0+iy*sy+sy/2+1.2
            # Reserve the confirmed starred home and its existing brick lane.
            if -63<x<-14 and -133<y<-92:continue
            idx+=1;home(x,y,sx-2.8,sy-4.4,idx)
    for ix in range(0,nx+1,3):
        x=x0+ix*sx;strip('local north south passage',(x,y0),(x,y1),2.0,concrete)
# Connect the filmed brick alley to the southern village lane without crossing its walls.
strip('home lane connection',(-38.7,-123),(-38.7,P(772,480)[1]),2.1,concrete)
strip('home lane to east road',(-38.7,P(772,480)[1]),P(820,480),4.4,concrete)
# Reusable poplars have visible branches and whitewashed trunks in all seasons.
def prototype():
    vs=[];fs=[]
    for j in range(200):
        z=random.uniform(5,15);a=random.uniform(0,math.tau);r=random.uniform(.1,1.9)*(1-abs(z-10)/11)
        x=math.cos(a)*r;y=math.sin(a)*r;w=random.uniform(.35,.65);k=len(vs)
        vs.extend([(x-w,y,z),(x,y-w*.7,z+.25),(x+w,y,z),(x,y+w*.7,z-.15)]);fs.append((k,k+1,k+2,k+3))
    me=bpy.data.meshes.new('shared poplar leaf crown');me.from_pydata(vs,[],fs);me.materials.append(leafmat);return me
leafmesh=prototype();treecount=0
def tree(x,y):
    global treecount
    treecount+=1;h=random.uniform(13,17)
    tube('poplar trunk',(x,y,.10),(x+.12,y,h),.22,bark)
    tube('whitewashed base',(x,y,.10),(x+.009,y,1.1),.227,white)
    for j in range(12):
        z=4+j*.8;a=j*2.39;reach=1.1+(j%3)*.25
        end=(x+math.cos(a)*reach,y+math.sin(a)*reach,z+2.2)
        tube('bare poplar branch',(x,y,z),end,.055,bark,sides=4)
        tube('fine branch',end,(end[0]+.45*math.cos(a+.7),end[1]+.45*math.sin(a+.7),end[2]+1.0),.018,bark,sides=3)
    o=obj('seasonal poplar crown',leafmesh,TREES,'leaves');o.location=(x,y,0);o.scale=(1,1,h/15);o.rotation_euler.z=random.random()*math.tau
south=P(35,648)[1]
for x in range(round(P(35,648)[0])+4,round(P(1262,648)[0]),9):
    for dy in [-4.3,4.3]:tree(x,south+dy)
for px in [155,829]:
    x=P(px,648)[0]
    for py in range(148,615,18):tree(x,P(px,py)[1])
for py in range(497,620,20):
    x,y=P(573,py);tree(x,y)
# Snow margins beside roads keep the concrete surface readable, as in the photos.
for dy in [-4,4]:strip('snow along avenue',(P(35,648)[0],south+dy),(P(1262,648)[0],south+dy),1.8,snow,LAND,z=.14)['season']='winter'
for o in LAND.objects:
    if o.get('season')=='winter':o.hide_render=True
# Rural overhead poles and sagging wires.
for px in [170,588,812]:
    previous=None
    for py in range(500 if px==588 else 80,631,55):
        x,y=P(px,py);tube('concrete utility pole',(x,y,.1),(x,y,7.8),.14,concrete,ROAD)
        box('utility crossarm',(x,y,7.4),(1.15,.09,.09),dark,ROAD)
        if previous:
            for dx in [-.35,.35]:
                prev=Vector((previous[0]+dx,previous[1],7.6));end=Vector((x+dx,y,7.6))
                for j in range(8):
                    a=prev.lerp(end,j/8);b=prev.lerp(end,(j+1)/8);a.z-=.55*math.sin(j/8*math.pi);b.z-=.55*math.sin((j+1)/8*math.pi)
                    tube('overhead wire',a,b,.013,dark,ROAD,sides=3)
        previous=(x,y)
# The school footprint is a landmark from the sketch; facade details are intentionally generic.
sx,sy=P(898,32)
box('school paved court',(sx,sy,.03),(88,22,.10),concrete,SCHOOL)
box('primary school classroom block',(sx,sy+5,3.15),(82,8,6.2),schoolmat,SCHOOL,solid=True)
box('school flat roof',(sx,sy+5,6.35),(83,8.6,.2),concrete,SCHOOL)
for x in range(-36,38,5):
    for z in [1.85,4.85]:box('school windows',(sx+x,sy+.95,z),(2.2,.06,1.6),glass,SCHOOL)
box('school central door',(sx,sy+.90,1.35),(2,.08,2.6),red,SCHOOL)
for sign in [-1,1]:box('school boundary',(sx+sign*44,sy,1.1),(.22,22,2.1),brick,SCHOOL,solid=True)
cv=bpy.data.curves.new('Primary school label','FONT');cv.body='PRIMARY SCHOOL';cv.align_x='CENTER';cv.size=.85;cv.materials.append(red)
o=obj('Primary school label',cv,SCHOOL);o.location=(sx,sy+.87,5.9);o.rotation_euler=(math.pi/2,0,0)
# Save coordinates and walk barriers in the same source used for the model exports.
def place(px,py,yaw=0):
    x,y=P(px,py);return {'spawn':[x,1.75,-y],'yaw':yaw}
village_nav={'bounds':[-535,-205,315,335],'spawn':[-38.7,1.75,130.5],'ground':.1,'waterZones':waterzones,'bridges':bridges,
 'places':{'home':{'spawn':[-38.7,1.75,122.5],'yaw':0},'fields':place(582,595),'avenue':place(80,648,-math.pi/2),'pond':place(381,351,-math.pi/2),'school':place(820,45,-math.pi/2)}}
S['village_navigation']=json.dumps(village_nav)
S['village_layout_status']='User sketch topology, satellite reference, house location confirmed by star. North assumed at top. Exact dimensions and individual parcels estimated.'
S['village_photos']='17 supplied JPG photographs plus map.png; local originals unchanged.'
S['village_season']='green'
def camera(name,pos,target,lens=42,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);CAM.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_end=4000
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    return o
camera('MAP A | Village and fields',(370,-695,660),(-160,-45,0),43)
camera('MAP B | Village plan',(-150,-65,1000),(-150,-65,0),40,850)
camera('MAP C | Poplar avenue',(*P(100,648),1.85),(*P(650,648),3),27)
camera('MAP D | Field path',(*P(582,600),1.85),(*P(582,480),2.6),30)
camera('MAP E | Home at the field edge',(8,-163,2.1),(-33,-125,2.4),27)
for o in S.objects:
    if o.type=='LIGHT' and 'Interior soft light' not in o.name:o.hide_render=True
light=bpy.data.lights.new('MAP daylight','SUN');light.energy=2.3;light.angle=.07
o=bpy.data.objects.new('MAP daylight',light);CAM.objects.link(o);o.rotation_euler=(.45,-.4,-.65)
S.world.use_nodes=True;bg=S.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.60,.73,.90,1);bg.inputs[1].default_value=.65
S.camera=bpy.data.objects['MAP A | Village and fields'];S.render.engine='CYCLES';S.cycles.samples=16;S.cycles.use_denoising=True
S['RECONSTRUCTION_STATUS']=S['village_layout_status'];S['SEASON']='Photo-based green crops, dry corn, and winter snow variants'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
report={'house_location':'star in lower-right housing strip, below east-west river and west of east road','orientation':'north at top assumed, consistent with supplied satellite screenshot','scale':'approximate 0.65 m per sketch pixel; not a survey','parcels':parcels,'trees':treecount,'crops':crop_counts,'landmarks':['north pond','central pond','central river','east river branch','southern irrigation channel','primary school'],'seasons':['green','corn','winter'],'navigation':village_nav}
(R/'photo_village_inventory.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('PHOTO VILLAGE SAVED',len(parcels),'parcels',treecount,'poplars',crop_counts,flush=True)
