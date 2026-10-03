"""Additive corrections from roof/ photos and the 42.37-second balcony video."""
import bpy, json, ast, shutil, math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
source=R/'Yanlaozhai_Video_House_and_Lane.blend'
backup=R.parents[2]/'roof_reference/before_roof_update.blend'
backup.parent.mkdir(exist_ok=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup))
S=bpy.context.scene;ORIGIN=Vector((-37,-109,.12))
ARCH=bpy.data.collections['VIDEO 00 | Filmed house - architecture']
C=bpy.data.collections['VIDEO 05 | Clean interiors and walkable stairs']
PROPS=C
CAM=bpy.data.collections['VIDEO 04 | Reference reconstruction cameras']
tree=ast.parse((R/'rebuild_from_video.py').read_text(encoding='utf-8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'material','box','mesh','line','rod','ball','camera'}],type_ignores=[]),'helpers','exec'))
cube=bpy.data.meshes.new('Roof refinement cube');cache={}
cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
white=material('Roof clean white ceiling',(.89,.88,.84))
gray=material('Roof terrace concrete',(.43,.45,.43))
tile=material('Roof white ceramic',(.82,.84,.82),.35)
joint=material('Roof tile grout',(.49,.52,.50))
red=material('Roof burgundy timber',(.23,.024,.035))
green=material('Roof green metal door',(.045,.18,.13),.5,.18)
steel=material('Roof bronze window frames',(.16,.16,.13),.4,.55)
silver=material('Roof silver dish',(.62,.64,.63),.35,.5)
black=material('Roof stove dark iron',(.028,.032,.03))
terracotta=material('Roof kitchen floor brick',(.38,.27,.17))
glass=bpy.data.materials['V | Interior clear balcony glazing']
def B(name,loc,dim,m=white,solid=True):
    o=box('ROOF '+name,loc,dim,m,C);o['walk_solid']=solid;return o
def remove(prefix):
    for o in list(S.objects):
        if o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)
def replace_mat(o,m):o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(m)
# White ceiling soffits, beams, a real closed end door and restrained aluminum framing.
for o in list(S.objects):
    if o.name.startswith(('INTERIOR upper corridor roof','INTERIOR stair landing roof','Main roof')):replace_mat(o,white)
    if o.name.startswith(('INTERIOR balcony vertical','INTERIOR balcony horizontal')):replace_mat(o,steel)
    if o.name.startswith(('Ochre decorative fascia','Gold fascia edge')) and o.location.z>ORIGIN.z+4.5:remove(o.name)
for x in [3.2,5.8,8.4]:B('corridor white ceiling beam',(x,2.2,6.79),(.14,1.65,.23),white,False)
B('continuous white corridor soffit',(4.5,2.23,6.85),(9.25,1.85,.05),white,False)
B('corridor end red door',(8.975,2.23,4.85),(.045,.95,2.30),red)
for y in [1.72,2.74]:B('end door jamb',(8.94,y,4.86),(.065,.06,2.35),red)
# Roof access is at the southern wall of the stair landing, onto the low wing roof.
remove('INTERIOR stair enclosure front')
for a,b in [(0,.25),(1.30,1.65),(2.65,3.0)]:B('terrace doorway pier',((a+b)/2,1.42,5.3),(b-a,.18,3.36))
B('terrace door header',(.775,1.42,6.60),(1.05,.18,.8))
B('terrace window sill',(2.15,1.42,4.19),(1,.18,1.14))
B('terrace window header',(2.15,1.42,6.40),(1,.18,1.2))
B('terrace window glass',(2.15,1.405,5.3),(.92,.018,1.08),glass,False)
for x in [1.66,2.15,2.64]:B('terrace white window stile',(x,1.38,5.3),(.04,.065,1.18),tile)
for z in [4.73,5.87]:B('terrace white window rail',(2.15,1.38,z),(1.02,.065,.04),tile)
# Open green leaf against the side of the entrance, preserving a usable passage.
B('open green terrace door',(.23,.91,4.83),(.055,.99,2.34),green)
B('terrace door handle',(.19,.77,4.8),(.045,.12,.04),silver,False)
B('terrace cleaned walking deck',(1.5,-2.24,3.60),(2.76,7.05,.04),gray,False)
for x in [.05,2.95]:
    B('terrace low parapet',(x,-2.26,3.96),(.18,7.3,.72),gray)
    B('terrace red coping',(x,-2.26,4.335),(.24,7.4,.05),red,False)
# Keep the existing tall south wall, add observed downpipe and small satellite dish.
rod('ROOF downpipe',(1.62,-6.10,3.65),(1.62,-6.10,5.10),.045,tile,C)
B('dish foot',(.46,-4.95,3.68),(.28,.35,.13),silver,False)
rod('ROOF dish support',(.46,-4.95,3.68),(.46,-4.95,4.1),.025,silver,C)
dish=ball('ROOF satellite dish',(.46,-4.95,4.13),(.29,.12,.29),silver,C);dish.rotation_euler.x=.4
rod('ROOF dish receiver',(.46,-4.96,4.12),(.46,-4.62,4.34),.018,silver,C)
# Visible ceramic joints survive material-batched GLB export.
for z in [3.67,3.85,4.03,4.21,4.39]:B('balcony horizontal tile joint',(6,1.318,z),(6.13,.009,.008),joint,False)
for i in range(18):B('balcony vertical tile joint',(3+i*.35,1.316,4.04),(.008,.009,.72),joint,False)
B('white balcony soffit',(6,2.2,3.34),(6.2,1.65,.055),white,False)
# Kitchen counters: worktop at 0.85 m above its floor, open storage recesses.
for prefix in ['INTERIOR kitchen stove masonry','INTERIOR traditional wok','INTERIOR silver wok','INTERIOR wok lid','INTERIOR stove firebox','INTERIOR kitchen prep return','INTERIOR kitchen worktop','INTERIOR chopping board','INTERIOR kitchen backsplash tile','INTERIOR kitchen side tile']:remove(prefix)
for x in [.29,1.13,2.13]:B('stove masonry support',(x,-1.69,.705),(.13,.68,.79),tile)
B('stove back',(1.2,-2,.71),(1.95,.08,.80),tile)
B('stove open shelf',(1.2,-1.66,.43),(1.95,.66,.08),tile)
B('stove tiled worktop',(1.2,-1.65,1.16),(2.04,.74,.09),tile)
for x in [.72,1.64]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.30,depth=.035,location=ORIGIN+Vector((x,-1.65,1.22)))
    o=bpy.context.object;o.name='ROOF wok iron ring'
    for c in list(o.users_collection):c.objects.unlink(o)
    C.objects.link(o);o.data.materials.append(black);o['walk_solid']=False
    ball('ROOF clean wok lid',(x,-1.65,1.245),(.27,.27,.055),silver,C)
    rod('ROOF wok handle',(x-.05,-1.65,1.30),(x+.05,-1.65,1.30),.018,black,C)
for y in [-1.24,.82]:B('prep support',(.50,y,.705),(.6,.12,.79),tile)
B('prep open shelf',(.50,-.21,.43),(.60,2.10,.08),tile)
B('prep worktop',(.50,-.21,1.16),(.67,2.24,.09),tile)
B('clean chopping board',(.50,.40,1.23),(.35,.42,.04),terracotta,False)
for y in [-.65,.1]:ball('ROOF stored cooking pot',(.51,y,.57),(.18,.18,.12),black,C)
for ix in range(9):
    for iz in range(3):B('rear backsplash tile',(.27+ix*.30,-2.08,1.29+iz*.23),(.294,.018,.224),tile,False)
for iy in range(11):
    for iz in range(3):B('side backsplash tile',(.14,-1.93+iy*.30,1.29+iz*.23),(.018,.294,.224),tile,False)
for ix in range(9):
    for iy in range(11):B('brick kitchen floor',(.22+ix*.30,-1.94+iy*.30,.317),(.29,.29,.018),terracotta,False)
# Cut a high window into the actual south kitchen boundary, keeping the adjacent passage.
for o in list(ARCH.objects):
    local=o.location-ORIGIN
    if o.type=='MESH' and abs(local.y+2.2)<.15 and .1<local.x<2.9 and o.dimensions.x>2 and o.dimensions.z>2:
        bpy.data.objects.remove(o,do_unlink=True)
for a,b in [(0,.90),(2.0,3)]:B('kitchen high window pier',((a+b)/2,-2.2,1.7),(b-a,.20,3.4))
B('kitchen high window lower',(1.45,-2.2,1.20),(1.1,.20,2.4))
B('kitchen high window header',(1.45,-2.2,3.16),(1.1,.20,.48))
B('kitchen high window glass',(1.45,-2.2,2.66),(1,.025,.48),glass,False)
for x in [.93,1.98]:B('high window stile',(x,-2.07,2.66),(.05,.065,.53),tile,False)
for z in [2.40,2.93]:B('high window rail',(1.45,-2.07,z),(1.1,.065,.045),tile,False)
# Reduce the oversized shed opening; retain the actual courtyard entry route.
blue=bpy.data.materials['V | blue corrugated steel']
B('shed north blue panel',(9.05,1.85,1.47),(.08,2.3,2.67),blue)
for i in range(18):B('shed panel fold',(9.00,.75+i*.13,1.47),(.03,.035,2.67),blue,False)
B('storage open red door',(9.04,3.52,1.49),(.06,1.00,2.38),red)
surfaces=json.loads(S['walk_surfaces'])
surfaces.append({'rect':[.16,-5.96,2.84,1.51],'height':3.62})
S['walk_surfaces']=json.dumps(surfaces)
S['roof_reference']='roof/ 30 images (including model error screenshots) and balcony.mp4, 42.37 s. Terrace dimensions estimated; loose clutter omitted.'
S['walk_shelters']=json.dumps([{'rect':[0,1.42,12,8],'roof':7.1},{'rect':[0,-6,3,1.42],'roof':3.60},{'rect':[9,-6,12,3],'roof':3.39}])
camera('ROOF camera terrace',(1.42,.75,5.20),(1.5,-5.1,4.2),23)
camera('ROOF camera corridor',(8.4,2.2,5.25),(.7,2.2,5.1),22)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('ROOF REFINEMENT SAVED',flush=True)
