import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_PROXY?{proxy:{server:process.env.PLAYWRIGHT_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
const errors=[];mkdirSync('artifacts/pond',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:650}});page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.overview==='ready');
 assert.deepEqual(errors,[],'Initial shaders compile');const data=await page.locator('#canvas-host').evaluate(e=>({...e.dataset}));assert.equal(data.forestKoi,'48');assert.ok(Number(data.forestLilies)>40);assert.ok(data.pondGarden.includes('bridge,pavilion'));
 await page.locator('[data-entry=forest]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='forest');
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await frame();assert.deepEqual(errors,[],'Walking shaders compile');await page.screenshot({path:'artifacts/pond/entry.png'});console.log('Forest entry and pond ecology loaded');
 if(await page.evaluate(()=>!!window.__viewer)){
  await page.keyboard.press('x');await page.evaluate(()=>window.__viewer.walk.place(197,2.65,134,-Math.PI/2,-.55));await frame();await page.screenshot({path:'artifacts/pond/koi.png'});
  const audit=await page.evaluate(()=>{const v=window.__viewer,p=v.woodland.ponds;return {moving:p.fish.some(f=>f.tail.rotation.y!==0),clear:p.waters.every(w=>w.material.transparent&&!w.material.depthWrite),beds:p.root.children.filter(o=>o.name.includes('gravel bed')).length};});assert.ok(audit.moving&&audit.clear);assert.equal(audit.beds,2);
  await page.evaluate(()=>window.__viewer.walk.place(190,1.75,168,.40,-.03));await frame();await page.screenshot({path:'artifacts/pond/bridge-pavilion.png'});
 }
 await page.locator('#walk-menu-toggle').click();await page.locator('#walk-season').selectOption('winter');await page.locator('#walk-weather').selectOption('snow');await page.locator('#walk-resume').click();await frame();await page.screenshot({path:'artifacts/pond/winter.png'});
 await page.locator('#walk-menu-toggle').click();await page.locator('#walk-summer-night').click();await frame();await page.screenshot({path:'artifacts/pond/night.png'});
 await page.locator('#walk-exit').click();await page.locator('[data-entry=house]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='courtyard');
 await page.close();console.log('Desktop pond checks passed');const touch=await browser.newContext({viewport:{width:390,height:780},hasTouch:true,isMobile:true});const phone=await touch.newPage();phone.setDefaultTimeout(180000);phone.on('pageerror',e=>errors.push(e.message));phone.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await phone.goto(process.env.BASE_URL||'http://127.0.0.1:4173');await phone.waitForFunction(()=>document.querySelector('#canvas-host').dataset.overview==='ready');console.log('Phone plan',phone.url(),await phone.locator('.map-pin').count());await phone.screenshot({path:'artifacts/pond/phone-plan.png'});await phone.locator('[data-entry=forest]').click();await phone.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='forest');await phone.screenshot({path:'artifacts/pond/phone.png'});await touch.close();
 assert.deepEqual(errors,[]);writeFileSync('artifacts/pond/result.json',JSON.stringify({pass:true,url:process.env.BASE_URL||'http://127.0.0.1:4173',data,errors},null,2));console.log('PASS: koi shaders, clear bed, desktop/touch forest entry, winter/night and courtyard return.');
}finally{await browser.close();}
