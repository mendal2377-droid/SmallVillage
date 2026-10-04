// Shared map landmarks, measured in the same Three.js metres as the exported world.
export const PLACES=[
  {id:'house',place:'courtyard',label:'Your yard',icon:'⌂',x:-32,z:109,color:'#f0c57b'},
  {id:'village',place:'avenue',label:'Poplar avenue',icon:'↟',x:-480.8,z:241.25,color:'#d5e3b0'},
  {id:'pond',place:'pond',label:'Water & bridges',icon:'≈',x:-285.15,z:48.2,color:'#a3dcce'},
  {id:'fields',place:'fields',label:'Fields & gardens',icon:'✿',x:-154.5,z:206.8,color:'#e8d2a1'},
  {id:'school',place:'school',label:'School lane',icon:'⌖',x:.2,z:-150.7,color:'#e7dfbd'},
  {id:'forest',place:'forest',label:'Forest & lakes',icon:'♧',x:194,z:94,color:'#b5d5be'},
];
export const GARDEN_PLOTS=[
  {kind:'melon',rect:[-181,196,-163,208]},
  {kind:'potato',rect:[-185,210,-163,222]},
  {kind:'tomato',rect:[-214,202,-191,209]},
  {kind:'pepper',rect:[-214,190,-191,198]},
  {kind:'cabbage',rect:[-214,214,-191,223]},
  {kind:'cucumber',rect:[-244,194,-228,215]},
];
export const ACTIVITY_SITES=[
  {id:'fish-woodland',kind:'fish',label:'Woodland pond fishing',x:192,z:124,radius:14},
  {id:'fish-pond',kind:'fish',label:'Pond fishing',x:-290,z:87,radius:11},
  {id:'fish-river',kind:'fish',label:'River fishing',x:-276,z:113,radius:8},
  {id:'fish-bridge',kind:'fish',label:'Bridge-side fishing',x:-285.15,z:48.2,radius:10},
  {id:'potato',kind:'potato',label:'Roast a potato',x:-154.5,z:213,radius:8},
  {id:'melon',kind:'melon',label:'Sneak a watermelon',x:-164,z:202,radius:12},
  {id:'rabbit',kind:'rabbit',label:'Chase a rabbit',x:-174,z:218,radius:16},
  {id:'kite',kind:'kite',label:'Fly a kite',x:-480.8,z:241.25,radius:14},
  {id:'firework',kind:'firework',label:'Night fireworks',x:-472,z:242,radius:18},
];
