import bpy
from pathlib import Path
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'Yanlaozhai_Henan_Village.blend'))
s=bpy.context.scene
for o in s.objects:
    if o.name.startswith('巷旁菜园') and abs(o.location.x-62)<.01:
        o.location.x=58;o.scale.x=6
    elif o.name.startswith('菜地垄沟') and 58.9<o.location.x<65.1:
        o.location.x-=4
s.camera=bpy.data.objects['01 鸟瞰全村']
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Yanlaozhai_Henan_Village.blend'))
for cam,fn,w,h,samples in [('01 鸟瞰全村','01_aerial.png',1800,1200,32),('02 村口人视','02_street.png',1600,1050,32),('03 院落近景','03_courtyard.png',1600,1050,32),('04 总平面','04_plan.png',1500,1500,24)]:
    s.camera=bpy.data.objects[cam];s.render.resolution_x=w;s.render.resolution_y=h;s.cycles.samples=samples
    s.render.filepath=str(R/fn);print('FINAL_RENDER',fn,flush=True);bpy.ops.render.render(write_still=True)
print('FINAL_DONE',flush=True)
