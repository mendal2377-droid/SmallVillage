import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:760,height:500}});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});mkdirSync('artifacts/road-repair',{recursive:true});
try{
  await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.overview==='ready');await page.locator('[data-entry=village]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.game==='on');
  const metrics=await page.locator('#canvas-host').evaluate(o=>({roads:Number(o.dataset.roadFootprints),treeConflicts:Number(o.dataset.treeRoadConflicts),trees:Number(o.dataset.bigTrees),frogs:Number(o.dataset.frogs)}));assert.equal(metrics.roads,67);assert.equal(metrics.treeConflicts,0);assert.ok(metrics.trees>=32);assert.ok(metrics.frogs>=10);console.log(metrics);
  assert.equal(await page.evaluate(()=>{let found=false;window.__viewer.model.traverse(o=>{if(o.material?.name?.includes('concrete seams'))found=true;});return found;}),false,'No raised seam batch in exported model');await page.screenshot({path:'artifacts/road-repair/flat-avenue.png'});
  await page.evaluate(()=>window.__viewer.walk.place(-426.2,1.75,243,0,-.1));await page.screenshot({path:'artifacts/road-repair/clear-bridge.png'});
  await page.evaluate(()=>window.__viewer.walk.place(-238,1.75,180,0,.15));await page.screenshot({path:'artifacts/road-repair/orchard.png'});
  await page.evaluate(()=>{const v=window.__viewer,f=v.details.gardens.wetland.frogs.find(f=>f.home.x<-250&&f.home.z>96);f.next=performance.now()/1000+90;v.walk.place(f.home.x,1.75,f.home.z+1.2,0,-.65);});await page.screenshot({path:'artifacts/road-repair/frog-and-grass.png'});
  // Approach a resting frog: its actual body moves toward water and triggers a landing ripple.
  await page.evaluate(()=>{const v=window.__viewer,f=v.details.gardens.wetland.frogs.find(f=>f.home.x<-250&&f.home.z>96);f.next=0;});await page.waitForFunction(()=>window.__viewer.details.gardens.wetland.frogs.some(f=>f.water));
  await page.locator('#walk-menu-toggle').click();await page.locator('#walk-season').selectOption('winter');await page.locator('#walk-resume').click();await page.waitForFunction(()=>window.__viewer.details.gardens.wetland.frogs.every(f=>!f.g.visible));
  await page.locator('#walk-menu-toggle').click();await page.locator('#walk-summer-night').click();await page.waitForFunction(()=>window.__viewer.details.gardens.wetland.frogs.some(f=>f.g.visible));await page.screenshot({path:'artifacts/road-repair/night-pond.png'});
  assert.deepEqual(errors,[]);console.log('PASS: flat road export, clear bridge, dense safe orchard, living wetland, frog hop, winter dormancy/summer return, no shader errors');
}finally{await browser.close();}
