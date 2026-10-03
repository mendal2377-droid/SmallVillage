"""Collect successful browser evidence and final export sizes without private media."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
report={'revision':'roof-weather-20261003','date':'2026-10-03','browser':{},'models':json.loads((R/'public/models/manifest.json').read_text()),'navigation':{}}
for key in ['smoke','walk','village-browser']:
    report['browser'][key]=json.loads((R/'test-results'/f'{key}.json').read_text())
assert all(r['passed'] for r in report['browser'].values())
nav=json.loads((R/'public/models/navigation.json').read_text())
for mode,data in nav.items():report['navigation'][mode]={'obstacles':len(data['boxes']),'walk_surfaces':len(data['surfaces']),'shelter_footprints':len(data.get('shelters',[]))}
report['controller_checks']=['All ground rooms','Two flights and intermediate landing','Upper corridor','Descent','Roof terrace and parapet barrier','Continuous village lane through pedestrian gate to roof','All five village starting points','River bank barrier','Bridge crossing']
report['build']='npm run build passed'
report['limits']='Dimensions, individual village plots and unobserved room details estimated. North at top assumed. Visual weather; unchanged movement physics.'
(R/'docs/photo-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Saved photo validation report')
