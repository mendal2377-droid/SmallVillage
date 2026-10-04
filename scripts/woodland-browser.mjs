import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:600}});page.setDefaultTimeout(180000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
mkdirSync('artifacts/woodland',{recursive:true});
const paintedFrame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.overview==='ready');
 const data=await page.locator('#canvas-host').evaluate(e=>({...e.dataset}));assert.equal(await page.locator('.map-pin:visible').count(),6);assert.equal(data.generatedArt,'foliage,meadow,ground');assert.equal(data.woodlandPonds,'2');assert.ok(Number(data.woodlandTrees)>200);assert.ok(Number(data.flowerClumps)>3000);
 for(const name of ['foliage','meadow','ground'])assert.ok((await page.request.get(new URL(`/textures/painted/${name}.png`,page.url()).href)).ok());
 await page.screenshot({path:'artifacts/woodland/overview.png'});console.log('Six entry pins, generated textures, forest and two large ponds',data.woodlandTrees,data.flowerClumps);
 await page.locator('[data-entry=forest]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='forest'&&document.querySelector('#canvas-host').dataset.game==='on');
 await paintedFrame();await page.screenshot({path:'artifacts/woodland/forest.png'});
 if(await page.evaluate(()=>Boolean(window.__viewer))){
  const audit=await page.evaluate(()=>{const v=window.__viewer,nav=v.walk.nav;return{water:nav.woodland.ponds.every(w=>v.walk.inWater(...w.center)),flowersSafe:v.woodland.points.every(p=>!nav.roads.some(([x,z,hx,hz,a])=>Math.abs(Math.cos(a)*(p.x-x)-Math.sin(a)*(p.z-z))<hx&&Math.abs(Math.sin(a)*(p.x-x)+Math.cos(a)*(p.z-z))<hz)),loaded:nav.woodlandTrees.length};});assert.ok(audit.water&&audit.flowersSafe);
  await page.evaluate(()=>{const v=window.__viewer;v.walk.place(179,1.75,132,-Math.PI/2,-.15);v.environment.setWeather('sunset');});await paintedFrame();await page.screenshot({path:'artifacts/woodland/pond-sunset.png'});
  await page.evaluate(()=>{const v=window.__viewer;v.walk.place(-480,1.75,241.25,-Math.PI/2,-.05);});await paintedFrame();await page.screenshot({path:'artifacts/woodland/flower-avenue.png'});
 }
 await page.locator('#walk-menu-toggle').click();await page.locator('#walk-season').selectOption('winter');await page.locator('#walk-weather').selectOption('snow');await page.locator('#walk-resume').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.livingSeason==='winter');
 if(await page.evaluate(()=>Boolean(window.__viewer))){const leafAudit=await page.evaluate(()=>window.__viewer.woodland.canopies.every(c=>c.group.children.filter(m=>m.material===c.mat).every(m=>m.visible===(c.kind===3))));assert.ok(leafAudit,'Winter bare branches and evergreen woodland');}
 await page.locator('#walk-menu-toggle').click();await page.locator('#walk-summer-night').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.summerNight==='true');
 if(await page.evaluate(()=>Boolean(window.__viewer)))await page.evaluate(()=>window.__viewer.walk.place(194,1.75,94,Math.atan2(-46,-40),.15));await paintedFrame();await page.screenshot({path:'artifacts/woodland/summer-night.png'});
 await page.locator('#walk-exit').click();await page.locator('[data-entry=house]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='courtyard');
 assert.deepEqual(errors,[]);writeFileSync('artifacts/woodland/result.json',JSON.stringify({pass:true,url:page.url(),data,errors},null,2));console.log('PASS: forest entry, water/flower exclusions, live winter, summer night, yard return and no shader/asset errors');
}finally{await browser.close();}
