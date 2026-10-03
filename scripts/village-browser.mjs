import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
// Software WebGL in CI is slower than a desktop GPU; keep pixel cost bounded.
const page=await browser.newPage({viewport:{width:1024,height:700}});page.setDefaultTimeout(120000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const pos=()=>page.locator('#canvas-host').getAttribute('data-camera-position').then(s=>s.split(',').map(Number));
async function axis(i,target){
  const p=await pos(),sign=Math.sign(target-p[i]);if(Math.abs(target-p[i])<.1)return;
  const key=i===0?(sign>0?'KeyD':'KeyA'):(sign>0?'KeyS':'KeyW');await page.keyboard.down(key);
  try{await page.waitForFunction(({i,target,sign})=>sign*(Number(document.querySelector('#canvas-host').dataset.cameraPosition.split(',')[i])-target)>=-.04,{i,target,sign},{timeout:120000});}finally{await page.keyboard.up(key);}
}
await mkdir('test-results',{recursive:true});
try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.filmstrip').waitFor();
  assert.equal(await page.locator('.filmstrip img').count(),17);
  await page.locator('.filmstrip img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
  await page.locator('[data-model="village"]').click();await page.locator('#three-mode').click();
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.loadedModel==='village');
  await page.locator('#loading').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.houseHighlighted==='true');
  for(const season of ['summer','corn','winter','green']){
    await page.locator('#village-season').selectOption(season);
    await page.waitForFunction(value=>document.querySelector('#canvas-host').dataset.season===value,season);
    assert.ok(Number(await page.locator('#canvas-host').getAttribute('data-season-meshes'))>0);
  }
  await page.locator('#find-house').click();await page.screenshot({path:'test-results/house-highlight.png'});
  await page.locator('#scene-weather').selectOption('rain');
  await page.locator('#walk-location-go').click();
  assert.equal(await page.locator('.stage-top').isVisible(),false);
  assert.equal(await page.locator('#viewer-controls').isVisible(),false);
  assert.equal(await page.locator('#walk-pad').isVisible(),false,'Desktop has no touch pad');
  const rect=await page.locator('#stage').boundingBox();assert.deepEqual([rect.x,rect.y,rect.width,rect.height],[0,0,1024,700]);
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.precipitation==='rain');
  // Use physical key events for the complete village-to-house route.
  await axis(2,112.65);await axis(0,-33.3);await axis(2,106.8);await axis(0,-34.87);
  await axis(2,102.3);await axis(0,-36.26);await axis(2,106.7);
  assert.ok(Math.abs((await pos())[1]-5.39)<.1);
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.precipitation==='none');
  await page.screenshot({path:'test-results/immersive-upstairs.png'});
  await axis(2,112.8);
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.precipitation==='rain');
  await page.locator('#walk-menu-toggle').click();
  const paused=await pos();await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');assert.deepEqual(await pos(),paused);
  await page.locator('#walk-weather').selectOption('snow');await page.locator('#walk-season').selectOption('winter');await page.locator('#walk-resume').click();
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.precipitation==='snow');
  await page.screenshot({path:'test-results/roof-snow.png'});
  await page.locator('#walk-menu-toggle').click();await page.locator('#walk-weather').selectOption('sunset');await page.locator('#walk-resume').click();
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.weather==='sunset');
  await page.screenshot({path:'test-results/roof-sunset.png'});
  await page.locator('#walk-exit').click();assert.equal(await page.locator('.stage-top').isVisible(),true);
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('immersive-walk')),false);
  await page.locator('#render-mode').click();
  assert.equal(await page.locator('#scene-image').isVisible(),true);
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.setDefaultTimeout(90000);mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url,{waitUntil:'domcontentloaded'});await mobile.locator('#three-mode').tap();await mobile.locator('#loading').waitFor({state:'hidden'});await mobile.locator('[data-view="walk"]').tap();
  assert.equal(await mobile.locator('#walk-pad').isVisible(),true);
  const start=Number((await mobile.locator('#canvas-host').getAttribute('data-camera-position')).split(',')[2]);
  const cdp=await mobile.context().newCDPSession(mobile),b=await mobile.locator('[data-walk="forward"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await mobile.waitForFunction(z=>Number(document.querySelector('#canvas-host').dataset.cameraPosition.split(',')[2])<z-.35,start);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const beforeLook=await mobile.locator('#canvas-host').getAttribute('data-camera-look');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y:370}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:215,y:380}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.waitForFunction(v=>document.querySelector('#canvas-host').dataset.cameraLook!==v,beforeLook);
  await mobile.locator('#walk-menu-toggle').tap();await mobile.locator('#walk-resume').tap();await mobile.screenshot({path:'test-results/immersive-mobile.png'});await mobile.locator('#walk-exit').tap();
  assert.deepEqual(errors,[]);
  const result={url,passed:true,checks:['17 gallery images','Season geometry','House highlighted','Immersive viewport','Desktop minimal controls','Village lane to house','Real two-flight stairs','Roof terrace','Indoor precipitation shelter','Rain and snow particles','Sunset lighting','Menu pauses walking','Exit restores page','Mobile movement and touch look','No page errors']};
  await writeFile('test-results/village-browser.json',JSON.stringify(result,null,2));console.log(result);
}catch(e){console.log('FAIL position:',await pos().catch(()=>null));await page.screenshot({path:'test-results/village-failure.png'});throw e;}finally{await browser.close();}
