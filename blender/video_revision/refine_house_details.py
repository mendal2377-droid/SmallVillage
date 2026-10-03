"""Additive house corrections from the 3 Oct 2026 courtyard, kitchen and corridor photos.

Runs on the current saved scene (not a historical stage backup). The first run copies the
scene to ../house_detail_reference/before_house_details.blend; later runs start from that copy,
so the script can be re-run safely without duplicating geometry.
"""
import bpy, ast, shutil, math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
source=R/'Yanlaozhai_Video_House_and_Lane.blend'
backup=R.parents[2]/'house_detail_reference/before_house_details.blend'
backup.parent.mkdir(exist_ok=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup))
S=bpy.context.scene;ORIGIN=Vector((-37,-109,.12))
ARCH=bpy.data.collections['VIDEO 00 | Filmed house - architecture']
C=bpy.data.collections['VIDEO 05 | Clean interiors and walkable stairs']
PROPS=C
tree=ast.parse((R/'rebuild_from_video.py').read_text(encoding='utf-8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'material','box'}],type_ignores=[]),'helpers','exec'))
cube=bpy.data.meshes.new('Detail refinement cube');cache={}
cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
M=bpy.data.materials
def existing(name):return M['V | '+name]
def recolor(name,color,rough=None,metal=None):
    m=existing(name);m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF')
    if p:
        if not p.inputs['Base Color'].is_linked:p.inputs['Base Color'].default_value=(*color,1)
        if rough is not None:p.inputs['Roughness'].default_value=rough
        if metal is not None:p.inputs['Metallic'].default_value=metal
    return m
def remove(prefix):
    for o in list(S.objects):
        if o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)
def D(name,x0,x1,z0,z1,y0,y1,m,solid=False):
    """Box from browser-space bounds (x right, z toward the gate, y up), as the web viewer sees them."""
    loc=((x0+x1)/2+5,-(z0+z1)/2,(y0+y1)/2-.12)
    o=box('DETAIL '+name,loc,(x1-x0,z1-z0,y1-y0),m,C);o['walk_solid']=solid;return o
remove('DETAIL ')

teal=existing('Interior gathered teal door screens')
burgundy=existing('Roof burgundy timber')
iron=existing('Roof stove dark iron')
ceramic=existing('Roof white ceramic')
steel=existing('Interior polished steel')
dark_glass=existing('dark window frames')
ochre=existing('ochre trim backing')
gold=existing('golden decorative trim')
grey=existing('mottled grey exterior render')
frame=existing('dark window frames')
jade=existing('muted jade window glass')
plinth=existing('glossy oxblood tiled plinth')

# Kitchen floor: worn dark red-brown brick, not pale terracotta.
recolor('Roof kitchen floor brick',(.17,.075,.05),.85)
# Corridor glazing is champagne aluminium in every photo, not dark bronze.
recolor('Roof bronze window frames',(.42,.40,.33),.38,.55)

# Hanging split door curtains (photos 5-2, 5-3, 6): soft, so never collision.
remove('INTERIOR gathered living door curtain');remove('INTERIOR gathered kitchen curtain')
for a,b in [(-1.72,-1.20),(-1.14,-.63)]:D('living door hanging curtain',a,b,-2.845,-2.825,.42,2.57,teal)
for a,b in [(-1.30,-.76),(-.70,-.15)]:D('kitchen door hanging curtain',-1.85,-1.83,a,b,.42,2.57,teal)
# Kitchen door gets the same burgundy frame and barred transom as the other curtain doors.
for a,b in [(-1.33,-1.27),(-.18,-.12)]:D('kitchen door jamb',-1.88,-1.81,a,b,.36,2.96,burgundy)
D('kitchen transom rail',-1.88,-1.81,-1.33,-.12,2.57,2.63,burgundy)
D('kitchen transom glass',-1.86,-1.85,-1.27,-.18,2.63,2.96,dark_glass)
for z in [-1.0,-.72,-.44]:D('kitchen transom bar',-1.88,-1.82,z-.02,z+.02,2.63,2.96,burgundy)

# Kitchen stove: closed white-tiled masonry front with arched fire mouths and ash pits (photo 3).
remove('ROOF stove open shelf')
D('stove tiled front',-4.77,-2.83,1.31,1.35,.43,1.24,ceramic,True)
for cx in [-4.28,-3.36]:
    D('stove fire mouth',cx-.15,cx+.15,1.29,1.31,.70,.92,iron)
    D('stove fire mouth arch',cx-.10,cx+.10,1.29,1.31,.92,.98,iron)
    D('stove ash pit',cx-.13,cx+.13,1.29,1.31,.45,.62,plinth)
    D('stove scalloped ledge',cx-.24,cx+.24,1.25,1.31,.64,.68,ceramic)
# Sink cabinet beside the stove with a steel basin and swan-neck tap.
D('sink cabinet',-2.80,-2.15,1.45,2.05,.43,1.00,ceramic,True)
D('sink cabinet door',-2.74,-2.21,1.43,1.45,.50,.86,steel)
D('sink worktop',-2.82,-2.13,1.42,2.07,1.00,1.05,ceramic)
D('sink basin',-2.70,-2.25,1.55,1.95,.98,1.06,steel)
D('tap upright',-2.49,-2.46,1.97,2.00,1.05,1.32,steel)
D('tap spout',-2.49,-2.46,1.82,2.00,1.29,1.32,steel)
# Full-width white tile band above every worktop.
D('kitchen back tile band',-4.88,-2.10,2.06,2.09,1.30,2.05,ceramic)
D('kitchen side tile band',-4.88,-4.85,-.95,2.06,1.30,2.05,ceramic)

# Courtyard facade of the main house (photos 5-1, 5-2, 5-3).
# Orange patterned bands under and over the corridor glazing.
for y in [4.50,6.68]:
    D('corridor ochre band',-2.12,4.12,-1.33,-1.29,y,y+.12,ochre)
    D('corridor gold band edge',-2.12,4.12,-1.30,-1.28,y+.04,y+.08,gold)
for i in range(31):
    x=-1.95+i*.2
    for y in [4.535,6.715]:D('corridor band diamond',x-.035,x+.035,-1.285,-1.275,y,y+.05,gold)
# Down-stand beam end under the balcony with its red 福 tile.
D('balcony beam end',-.45,-.15,-2.90,-1.40,2.88,3.44,existing('Roof clean white ceiling'))
D('fu tile',-.42,-.18,-1.40,-1.38,3.02,3.30,plinth)
D('fu tile border',-.40,-.20,-1.38,-1.37,3.05,3.27,gold)
# Upper east bay is unpainted grey render with a dark 2x2 window.
D('upper east grey render',4.17,7.0,-2.91,-2.87,3.74,7.22,grey)
D('upper east window glass',5.0,6.4,-2.87,-2.86,4.75,6.20,jade)
for a,b in [(4.96,5.04),(5.66,5.74),(6.36,6.44)]:D('upper east window stile',a,b,-2.87,-2.83,4.71,6.24,frame)
for a,b in [(4.71,4.79),(5.44,5.52),(6.16,6.24)]:D('upper east window rail',4.96,6.44,-2.87,-2.83,a,b,frame)

bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('HOUSE DETAILS SAVED',len([o for o in S.objects if o.name.startswith('DETAIL ')]))
