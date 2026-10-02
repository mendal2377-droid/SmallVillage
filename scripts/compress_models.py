import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]/'public/models'
stats=json.loads((R/'manifest.json').read_text())
for entry in stats:
    name=entry['name'];p=R/(name+'.glb');temp=R/(name+'.compressed.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(p))
    bpy.ops.export_scene.gltf(filepath=str(temp),export_format='GLB',export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    assert temp.stat().st_size<p.stat().st_size, 'Compression did not reduce size'
    temp.replace(p)
    entry['uncompressed_bytes']=entry['bytes'];entry['bytes']=p.stat().st_size;entry['compression']='Draco'
    print('COMPRESSED',entry,flush=True)
(R/'manifest.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
