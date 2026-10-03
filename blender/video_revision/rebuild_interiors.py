"""Clean, editable interiors from the second video (20261003085305.mp4).
Run in Blender background. Original revision is copied outside the repository.
Room dimensions and hidden partitions remain estimates, not a measured survey.
"""
import bpy, math, json, shutil, ast
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
source=R/'Yanlaozhai_Video_House_and_Lane.blend'
backup=R.parents[2]/'interior_reference'/'before_interiors.blend'
backup.parent.mkdir(exist_ok=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup))
S=bpy.context.scene
ORIGIN=Vector((-37,-109,.12))
ARCH=bpy.data.collections['VIDEO 00 | Filmed house - architecture']
PROPS=bpy.data.collections['VIDEO 02 | Courtyard and domestic details']
CAM=bpy.data.collections['VIDEO 04 | Reference reconstruction cameras']
# Reuse only pure construction helpers, never the previous script's execution.
tree=ast.parse((R/'rebuild_from_video.py').read_text(encoding='utf-8'))
helpers={'material','box','mesh','line','rod','ball','camera'}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'helpers','exec'))
cube=bpy.data.meshes.new('Interior unit cube');cache={}
cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
C=bpy.data.collections.new('VIDEO 05 | Clean interiors and walkable stairs');S.collection.children.link(C)
def mat(name,color,rough=.7,metal=0):return material('Interior '+name,color,rough,metal)
white=mat('warm white plaster',(.81,.80,.75));tile=mat('ivory ceramic',(.84,.85,.80),.28)
wood=mat('dark carved timber',(.14,.065,.025));oak=mat('golden desk timber',(.48,.25,.085))
red=mat('red upholstery',(.43,.026,.05));stepmat=mat('red concrete steps',(.32,.075,.055))
black=mat('dark frames',(.022,.029,.027));steel=mat('polished steel',(.56,.61,.60),.23,.8)
floor=mat('clean concrete',(.48,.49,.45));lavender=mat('pale wardrobe',(.66,.63,.72))
linen=mat('cream bed linen',(.84,.79,.67));green=mat('green stair door',(.07,.27,.20))
glass=mat('clear balcony glazing',(.62,.78,.71),.12)
glass.diffuse_color=(.62,.78,.71,.13);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.13
glass.surface_render_method='DITHERED'
def B(name,loc,dim,m=white,solid=True):
    o=box('INTERIOR '+name,loc,dim,m,C);o['walk_solid']=solid;return o
def L(name,a,b,r=.025,m=steel):return rod('INTERIOR '+name,a,b,r,m,C)
def sphere(name,loc,dim,m):return ball('INTERIOR '+name,loc,dim,m,C)
def remove(prefix):
    for o in list(S.objects):
        if o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)
# Clear temporary clutter, retain the permanent courtyard and alley character.
for o in list(PROPS.objects):bpy.data.objects.remove(o,do_unlink=True)
for p in ['Heap of freshly cut','Cut green branch','Upper floor slab','Balcony','Upper balcony','Upper sliding','Sliding window','Sliding pane','Upper recessed','Upper left plain','Upper right plain','Upper side small','Terrace yellow','Wing inner doorway','Wing teal','Wing red door','Wing transom','Recessed red door','Side door shadow','Side red room','Raised red door','Ground broad black window interior curtain']:
    remove(p)
for o in list(ARCH.objects):
    local=o.location-ORIGIN
    if o.name.startswith('Passage wing wall') and local.x>2 and local.y>0:bpy.data.objects.remove(o,do_unlink=True)
    elif o.name.startswith('Courtyard wall pier') and local.x<2:bpy.data.objects.remove(o,do_unlink=True)
    elif o.name.startswith(('Red ceramic base','Plinth tile joint')) and local.x<3.2:bpy.data.objects.remove(o,do_unlink=True)
    elif o.name.startswith('Wing end wall') and local.y>2:bpy.data.objects.remove(o,do_unlink=True)
    elif o.name.startswith('West wing burgundy plinth') and local.y>1.3:bpy.data.objects.remove(o,do_unlink=True)
    elif o.name.startswith('Wing inner coping'):
        o.location.y=ORIGIN.y-2.45;o.scale.y=7.4
    elif o.name.startswith(('Ochre decorative fascia','Gold fascia edge')) and 1.8<local.y<2.05:
        o.location.y-=.52
    elif o.name.startswith('Repeating gold floral motif'):bpy.data.objects.remove(o,do_unlink=True)
# West kitchen wall has real door and window openings.
for a,b in [(-2.2,-1.57),(-.69,.15),(1.3,1.42)]:B('kitchen facade pier',(3,(a+b)/2,1.72),(.22,b-a,3.4))
B('kitchen window sill wall',(3,-1.13,.5),(.22,.88,1))
B('kitchen window header',(3,-1.13,3.05),(.22,.88,.74))
B('kitchen door header',(3,.725,3.12),(.22,1.15,.56))
B('kitchen north partition',(1.5,1.42,1.72),(3,.18,3.4))
# Corner entry to staircase, between the kitchen and the sitting-room door.
B('stair entry header',(3,2.23,3.13),(.22,1.44,.6))
B('stair enclosure front',(1.5,1.42,5.25),(3,.18,3.3))
B('stair landing west wall',(0,2.24,5.25),(.22,1.65,3.3))
B('stair right enclosure',(3,5.54,3.5),(.20,5.08,6.9))
B('upper main floor',(7.55,5.5,3.5),(8.9,5.0,.24),floor,False)
B('upper landing floor',(1.55,2.23,3.5),(3.1,1.42,.24),floor,False)
B('upper corridor floor',(6,2.23,3.5),(6,1.42,.24),floor,False)
B('upper corridor parapet',(6,1.42,4.04),(6.2,.18,.84),tile)
B('upper corridor lintel',(6,1.42,6.80),(6.2,.18,.36),tile)
B('upper corridor roof',(6,2.22,7.0),(6.4,1.85,.2),floor,False)
B('stair landing roof',(1.5,2.22,7.0),(3.2,1.85,.2),floor,False)
B('upper corridor end',(9.08,2.22,5.3),(.18,1.7,3.4),tile)
for i in range(9):
    x=3+i*.75
    B('balcony vertical aluminum frame',(x,1.39,5.54),(.045,.075,2.18),steel)
    if i<8:B('transparent balcony pane',(x+.375,1.42,5.54),(.705,.018,2.08),glass,False)
for z in [4.45,5.68,6.61]:B('balcony horizontal frame',(6,1.39,z),(6.07,.075,.045),steel)
# Upstairs courtyard-facing wall: two red doors and an internal black window.
for a,b in [(3,3.35),(4.35,6.9),(7.9,12)]:
    if a==4.35:
        B('upper window lower wall',(5.625,3,4.13),(2.55,.18,1.02))
        B('upper window header',(5.625,3,6.5),(2.55,.18,1))
        B('upper internal glass',(5.625,3,5.25),(2.45,.02,1.15),glass,False)
        for x in [4.38,5.63,6.87]:B('upper internal window stile',(x,2.94,5.25),(.045,.07,1.2),black)
        for z in [4.65,5.85]:B('upper internal window rail',(5.625,2.94,z),(2.55,.07,.05),black)
    else:B('upper facade',(a/2+b/2,3,5.31),(b-a,.18,3.38))
for x in [3.85,7.4]:
    B('upper doorway lintel',(x,3,6.52),(1,.2,.96))
    B('upper red open door',(x-.43,3.49,4.77),(.07,.9,2.3),red)
    for xx in [x-.51,x+.51]:B('upper red door jamb',(xx,2.97,4.8),(.05,.08,2.36),red)
B('upper room partition',(6.95,5.5,5.31),(.16,4.9,3.38))
# Dogleg stairs: 20 red treads, a turning landing, and tubular stainless rails.
z0=.30;rise=(3.62-z0)/20
for i in range(10):
    h=z0+(i+1)*rise
    B('first flight tread %02d'%i,(2.13,3.15+(i+.5)*.30,(h+z0)/2),(1.42,.30,h-z0),stepmat,False)
    h=z0+(11+i)*rise
    B('return flight tread %02d'%i,(.74,6.15-(i+.5)*.30,(h+1.96)/2),(1.24,.30,h-1.96),stepmat,False)
B('turning landing',(1.5,6.72,1.85),(2.8,1.14,.22),stepmat,False)
B('stair divider',(1.4,4.65,1.25),(.10,3,1.9))
for x,start,end,base,top in [(1.43,3.15,6.15,.3,1.96),(1.34,6.15,3.15,1.96,3.62)]:
    L('stair handrail',(x,start,base+.92),(x,end,top+.92),.033)
    for i in range(11):
        t=i/10;y=start+(end-start)*t;z=base+(top-base)*t
        L('stair baluster',(x,y,z),(x,y,z+.92),.019)
    sphere('rail finial',(x,start,base+.93),(.06,.06,.06),steel)
# Guard the open edge of the upper landing; the return flight remains open.
B('landing guard rail',(2.18,3.11,4.57),(1.65,.055,.055),steel)
for i in range(8):L('landing guard baluster',(1.43+i*.20,3.11,3.62),(1.43+i*.20,3.11,4.57),.019)
L('landing upper rail',(1.39,3.11,4.57),(2.95,3.11,4.57),.027)
# Floors and room connections. Living -> bedroom, bedroom -> storage doors remain open.
B('kitchen floor',(1.5,-.35,.24),(2.8,3.4,.12),floor,False)
screen=mat('gathered teal door screens',(.035,.19,.19))
for x in [3.30,4.35]:B('gathered living door curtain',(x,2.85,1.38),(.10,.045,2.15),screen,False)
for y in [.2,1.25]:B('gathered kitchen curtain',(3.16,y,1.38),(.045,.10,2.15),screen,False)
for x in [5.65,8.05]:
    for a,b in [(3,4.4),(5.45,8)]:B('room partition',(x,(a+b)/2,1.85),(.14,b-a,3.1))
    B('connecting doorway header',(x,4.925,3.05),(.14,1.05,.70))
    if x==5.65:B('open oak interior door',(x+.46,4.43,1.45),(.92,.065,2.3),oak)
# Tile floors retain the distinct finishes visible in the film.
tan=[mat('parquet '+str(i),c) for i,c in enumerate([(.49,.35,.20),(.62,.48,.31),(.55,.41,.24)])]
for ix in range(5):
    for iy in range(10):B('meeting parquet tile',(3.28+ix*.47,3.25+iy*.47,.308),(.46,.46,.02),tan[(ix+iy)%3],False)
for ix in range(5):
    for iy in range(10):B('bedroom geometric tile',(5.91+ix*.43,3.25+iy*.47,.31),(.42,.46,.022),linen if (ix+iy)%2 else stepmat,False)
# Meeting room: two facing carved timber sofas, crimson upholstery, central tea table.
def sofa(x,y):
    B('sofa base',(x,y,.55),(.54,1.8,.45),wood)
    B('sofa red seat',(x,y,.80),(.52,1.64,.12),red)
    back=x+(-.23 if x<4.4 else .23)
    B('sofa carved back',(back,y,1.10),(.09,1.85,.73),wood)
    for yy in [y-.54,y,y+.54]:B('sofa red back cushion',(back+(.065 if x<4.4 else -.065),yy,1.08),(.08,.48,.40),red,False)
    for yy in [y-.86,y+.86]:B('sofa arm',(x,yy,.96),(.56,.08,.13),wood)
sofa(3.43,6.30);sofa(5.25,6.30)
B('meeting coffee table',(4.32,6.28,.78),(.67,1.3,.12),wood)
for x in [4.06,4.58]:
    for y in [5.75,6.80]:B('tea table leg',(x,y,.51),(.06,.06,.47),wood)
B('back console',(4.35,7.64,.85),(2.35,.45,1.1),wood)
for x in [3.6,4.35,5.1]:B('console door inset',(x,7.405,.87),(.65,.025,.83),oak,False)
def picture(name,x,y,z,w,h):
    B(name+' frame',(x,y,z),(w,.06,h),wood,False)
    B(name+' paper',(x,y-.035,z),(w-.08,.012,h-.08),linen,False)
    # Abstract landscape silhouettes, not reproductions of private wall artwork.
    for i in range(5):
        xx=x-w*.32+i*w*.16;zz=z-h*.28;hh=.18+(i%3)*.12
        mesh('INTERIOR '+name+' mountain',[(xx-w*.17,y-.046,zz),(xx,y-.046,zz+hh),(xx+w*.17,y-.046,zz)],[(0,1,2)],green,C)
picture('meeting landscape',4.35,7.72,2.16,2.0,.84)
# Bedroom: neatly made red bed, golden desk/hutch and pale sliding wardrobe.
B('bed timber frame',(6.7,6.3,.54),(1.45,2.03,.45),oak)
B('bed mattress',(6.7,6.30,.83),(1.44,1.99,.20),linen)
B('red bed cover',(6.7,6.04,.945),(1.46,1.50,.055),red,False)
B('bed headboard',(6.7,7.33,1.00),(1.5,.08,1.0),oak)
for x in [6.34,7.05]:
    pillow=B('bed pillow',(x,6.98,1.015),(.55,.37,.14),linen,False)
    # Apply scale before bevel so the linen has rounded corners in metres.
    pillow.data=pillow.data.copy()
    for v in pillow.data.vertices:v.co.x*=.55;v.co.y*=.37;v.co.z*=.14
    pillow.scale=(1,1,1)
    bevel=pillow.modifiers.new('soft pillow corners','BEVEL');bevel.width=.065;bevel.segments=4
B('bedroom desk',(6.29,3.6,1.03),(.93,.51,.08),oak)
for x in [5.88,6.70]:B('desk support',(x,3.6,.64),(.08,.48,.78),oak)
for z in [1.2,1.7,2.15]:B('hutch shelf',(6.29,3.34,z),(.93,.22,.055),oak)
for x in [5.86,6.72]:B('hutch upright',(x,3.34,1.66),(.05,.22,1.0),oak)
B('sliding wardrobe',(7.57,3.65,1.4),(.72,.66,2.18),lavender)
for x in [7.42,7.74]:B('wardrobe handle',(x,4.00,1.4),(.022,.032,.33),steel,False)
# Storage / dining: red round table and orderly shelves, no loose sacks.
def cylinder(name,loc,r,depth,m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth,location=ORIGIN+Vector(loc))
    o=bpy.context.object;o.name='INTERIOR '+name
    for c in list(o.users_collection):c.objects.unlink(o)
    C.objects.link(o);o.data.materials.append(m);o['walk_solid']=False;return o
cylinder('round red dining table',(10.1,5.5,1.07),.75,.065,red)
B('round table underframe',(10.1,5.5,1.02),(1.05,1.05,.06),wood)
for x in [9.68,10.52]:
    for y in [5.08,5.92]:B('round table leg',(x,y,.67),(.075,.075,.74),wood)
for y in [4.40,6.60]:
    B('dining chair seat',(10.1,y,.78),(.43,.42,.08),oak)
    B('dining chair back',(10.1,y+(.18 if y>5 else -.18),1.07),(.43,.065,.65),oak)
    for dx in [-.16,.16]:B('chair leg',(10.1+dx,y,.53),(.05,.32,.46),oak)
for z in [.4,1,1.6,2.2]:B('storage shelving',(11.5,6.8,z),(.60,1.85,.06),oak)
for y in [5.91,7.69]:B('shelf upright',(11.5,y,1.3),(.60,.06,1.9),oak)
for i in range(6):B('neat storage box',(11.47,6.22+(i%2)*.9,.64+(i//2)*.60),(.44,.58,.38),linen)
B('storage closed cupboard',(9,7.61,1.14),(1.45,.53,1.68),oak)
# Kitchen L-shaped masonry counter, round wok lids, fireboxes and prep return.
B('kitchen stove masonry',(1.23,-1.67,.84),(1.98,.70,1.08),tile)
for x in [.72,1.65]:
    cylinder('traditional wok dark rim',(x,-1.67,1.40),.34,.045,black)
    sphere('silver wok lid',(x,-1.67,1.44),(.30,.30,.07),steel)
    L('wok lid handle',(x-.055,-1.67,1.52),(x+.055,-1.67,1.52),.02,black)
    B('stove firebox',(x,-1.307,.73),(.37,.012,.35),black,False)
B('kitchen prep return',(.53,-.23,.87),(.58,2.25,1.12),tile)
B('kitchen worktop',(.53,-.23,1.45),(.67,2.35,.055),linen)
B('chopping board',(.51,.4,1.51),(.34,.46,.035),oak,False)
for ix in range(9):
    for iz in range(4):B('kitchen backsplash tile',(.27+ix*.30,-2.08,1.40+iz*.23),(.294,.018,.224),tile,False)
for iy in range(11):
    for iz in range(4):B('kitchen side tile',(.14,-1.93+iy*.30,1.4+iz*.23),(.018,.294,.224),tile,False)
# Restrained upper rooms: footage documents the corridor, not their furnishings.
B('upstairs simple cabinet',(11.3,7.5,4.24),(1.2,.6,1.24),oak)
B('upstairs bench',(5.8,7.35,4.0),(1.7,.5,.18),oak)
for x in [5.1,6.5]:B('bench legs',(x,7.35,3.81),(.08,.45,.38),wood)
# Explicit walk surfaces in Blender-local x/y. Ramps follow the visible stair flights.
surfaces=[
 {'rect':[0,-6,12,3],'height':.08},
 {'rect':[0,3,12,8],'height':.30}, {'rect':[0,-2.2,3,3.15],'height':.30},
 {'rect':[1.42,3.15,2.86,6.15],'height':.30,'rise':1.66,'axis':'y'},
 {'rect':[.12,6.15,2.86,7.29],'height':1.96},
 {'rect':[.12,3.15,1.36,6.15],'height':3.62,'rise':-1.66,'axis':'y'},
 {'rect':[.12,1.51,3.1,3.15],'height':3.62},
 {'rect':[3.1,1.51,9,3.15],'height':3.62},
 {'rect':[3.1,3.15,11.88,7.88],'height':3.62},
]
S['walk_surfaces']=json.dumps(surfaces)
S['video_reference']='20261003085305.mp4; 116.537 seconds; plus original courtyard video'
S['video_reconstruction_scope']='Observed room finishes and furnishings cleaned and reconstructed. Dimensions, concealed partitions, stair measurements and upstairs room interiors estimated.'
notes='''SECOND VIDEO / 2026-10-03\n00-17 courtyard; 19-25 kitchen with masonry stove; 31-37 storage/dining room; 43-50 meeting room; 52-61 bedroom; 64-80 red dogleg stair and steel railing; 82-116 enclosed upper corridor overlooking courtyard.\nClean interpretation removes temporary clutter and arranges observed furniture. Room sizes, concealed walls, stair dimensions and upstairs room interiors are inferred. Upstairs rooms are deliberately sparsely furnished because their contents are not filmed. Raw videos and reference stills remain local.\nWalk surfaces and vertical obstacle bounds are exported from this Blender scene. Stairs have two physical flights and a turning landing.\n'''
(R/'INTERIOR_NOTES.md').write_text(notes,encoding='utf-8')
t=bpy.data.texts.new('SECOND VIDEO | observed and estimated');t.write(notes)
views=[('Kitchen',(2.78,1.0,1.95),(1.12,-1.5,1.05),19),('Meeting',(3.85,3.35,1.85),(4.35,6.75,1.2),20),('Bedroom',(7.7,4.5,1.9),(6.6,6.6,1.0),19),('Upstairs',(3.3,2.24,5.23),(8.2,-1.0,2.7),21),('Stairs',(2.65,2.3,1.95),(1.7,5.2,2.1),18)]
for name,pos,target,lens in views:camera('INTERIOR camera '+name,pos,target,lens)
for name,pos in [('Kitchen',(1.6,-.2,3.1)),('Meeting',(4.3,5.5,3.1)),('Bedroom',(6.8,5.5,3.1)),('Storage',(10,5.5,3.1)),('Stairs',(1.5,5,6.5))]:
    d=bpy.data.lights.new('Interior soft light '+name,'AREA');o=bpy.data.objects.new(d.name,d);CAM.objects.link(o);o.location=ORIGIN+Vector(pos);d.energy=65;d.shape='DISK';d.size=2
S.render.engine='CYCLES';S.cycles.samples=24;S.cycles.use_denoising=True
bpy.context.preferences.filepaths.save_version=0  # The original is preserved in before_interiors.blend.
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('INTERIORS SAVED',len(C.objects),flush=True)
