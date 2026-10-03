"""Export visible Blender geometry as material-batched, centered GLB models."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'blender/video_revision/Yanlaozhai_Video_House_and_Lane.blend'
OUT=ROOT/'public/models';OUT.mkdir(parents=True,exist_ok=True)
stats=[]
for mode in ['house','village']:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    S=bpy.context.scene
    originals=list(S.objects)
    center=Vector((-32,-109,0)) if mode=='house' else Vector((0,0,0))
    batches={};dg=bpy.context.evaluated_depsgraph_get()
    for o in originals:
        if o.type not in {'MESH','CURVE','FONT'} or o.hide_render:continue
        if any(c.hide_render or c.name.startswith('BACKUP ') for c in o.users_collection):continue
        if mode=='house' and not any(c.name.startswith('VIDEO ') for c in o.users_collection):continue
        # Keep the village and a little surrounding farmland, not the 1.5 km base.
        if mode=='village' and (o.name.startswith('黄淮平原地基') or o.name.startswith('田块') or o.name.startswith('农机田埂')):continue
        try:
            ob=o.evaluated_get(dg);me=ob.to_mesh();me.calc_loop_triangles()
            if not len(me.vertices):ob.to_mesh_clear();continue
            transformed=[tuple(o.matrix_world@v.co-center) for v in me.vertices]
            for tri in me.loop_triangles:
                mi=min(tri.material_index,len(me.materials)-1)
                mat=me.materials[mi] if mi>=0 else None
                key=mat.name if mat else 'unassigned'
                if key not in batches:batches[key]={'v':[],'f':[],'m':mat,'lookup':{}}
                b=batches[key];idx=[]
                for vi in tri.vertices:
                    lookup=(o.name,vi)
                    if lookup not in b['lookup']:b['lookup'][lookup]=len(b['v']);b['v'].append(transformed[vi])
                    idx.append(b['lookup'][lookup])
                b['f'].append(tuple(idx))
            ob.to_mesh_clear()
        except Exception as e:raise RuntimeError(f'Cannot export {o.name}: {e}')
    for o in originals:bpy.data.objects.remove(o,do_unlink=True)
    for name,b in batches.items():
        me=bpy.data.meshes.new(name);me.from_pydata(b['v'],[],b['f']);me.update()
        if b['m']:
            old=b['m'];mat=bpy.data.materials.new('Web '+name);mat.diffuse_color=old.diffuse_color;mat.use_nodes=True
            p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=old.diffuse_color
            if old.use_nodes:
                op=old.node_tree.nodes.get('Principled BSDF')
                if op:
                    for prop in ['Roughness','Metallic','IOR']:
                        p.inputs[prop].default_value=op.inputs[prop].default_value
            if 'aged white courtyard plaster' in name:p.inputs['Base Color'].default_value=(.78,.79,.76,1)
            if 'mottled grey exterior' in name:p.inputs['Base Color'].default_value=(.53,.57,.55,1)
            if 'clear balcony glazing' in name:
                p.inputs['Alpha'].default_value=.13
                mat.surface_render_method='DITHERED'
            mat.use_backface_culling=False;me.materials.append(mat)
        ob=bpy.data.objects.new(name,me);S.collection.objects.link(ob)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(mode+'.glb')),export_format='GLB',export_cameras=False,export_lights=False,export_extras=False,export_animations=False,export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    stats.append({'name':mode,'meshes':len(batches),'triangles':sum(len(b['f']) for b in batches.values()),'bytes':(OUT/(mode+'.glb')).stat().st_size})
    print('EXPORTED',stats[-1],flush=True)
(OUT/'manifest.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
