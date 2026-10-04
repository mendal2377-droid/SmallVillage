"""Correct the yard-facing door beside the blue shed from the owner's 4 Oct photo.

Additive and repeatable against the current scene; never restores a historical backup.
The closed door is exported separately for the browser's opening hinge and collision.
"""
import bpy, ast, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
R=ROOT/'blender/video_revision'
source=R/'Yanlaozhai_Video_House_and_Lane.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
S=bpy.context.scene;ORIGIN=Vector((-37,-109,.12))
ARCH=bpy.data.collections['VIDEO 00 | Filmed house - architecture']
C=bpy.data.collections['VIDEO 05 | Clean interiors and walkable stairs']
PROPS=C
tree=ast.parse((R/'rebuild_from_video.py').read_text(encoding='utf-8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'material','box'}],type_ignores=[]),'helpers','exec'))
cube=bpy.data.meshes.new('Photo door cube');cache={}
cube.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
for o in list(S.objects):
    if o.name.startswith(('ROOF storage open red door','Side red room door ajar','Raised red door panel','PHOTO storage door')):bpy.data.objects.remove(o,do_unlink=True)
red=material('Photo storage door red',(.29,.055,.047))
gold=material('Photo storage door brass',(.64,.42,.18),.55,.25)
dark=material('Photo storage door inset',(.20,.035,.027))
def B(name,loc,dim,m):
    o=box('PHOTO storage door '+name,loc,dim,m,C);o['walk_solid']=False;return o
B('leaf',(8.60,2.97,1.41),(.90,.065,2.20),red)
for z in [.77,1.68]:
    B('inset',(8.60,2.925,z),(.70,.025,.69),dark)
    for x in [8.23,8.97]:B('panel stile',(x,2.90,z),(.035,.027,.75),red)
    for h in [z-.37,z+.37]:B('panel rail',(8.60,2.90,h),(.77,.027,.035),red)
diamond=B('festival diamond',(8.60,2.887,1.77),(.27,.018,.27),red);diamond.rotation_euler.y=math.pi/4
B('brass handle',(8.27,2.87,1.43),(.035,.035,.12),gold)
S['storage_door_reference']='4 Oct photo: closed paneled red leaf, yard-facing under barred transom, flush white jamb beside blue shed. Browser opens it on approach.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('PHOTO STORAGE DOOR SAVED',flush=True)
