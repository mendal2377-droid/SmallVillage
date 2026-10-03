import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:650}});page.setDefaultTimeout(180000);
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
mkdirSync('artifacts/world',{recursive:true});
await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');console.log('Checking',page.url());await page.locator('[data-entry=house]').waitFor();assert.equal(await page.locator('[data-entry]').count(),2);assert.equal(await page.locator('img').count(),0);assert.equal(await page.locator('a').count(),0);
await page.screenshot({path:'artifacts/world/entry.png'});console.log('Entry: only village and house');
await page.locator('[data-entry=house]').click();
await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.game==='on');
assert.equal(await page.locator('#canvas-host').getAttribute('data-loaded-model'),'village');
assert.equal(await page.locator('#canvas-host').getAttribute('data-animals'),'20');
await page.screenshot({path:'artifacts/world/courtyard.png'});console.log('Connected courtyard loaded',await page.locator('#canvas-host').evaluate(o=>({...o.dataset})));
await page.locator('#walk-menu-toggle').click();await page.locator('#walk-weather').selectOption('rain');await page.locator('#walk-season').selectOption('summer');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.weather==='rain'&&document.querySelector('#canvas-host').dataset.livingSeason==='summer');
await page.locator('#walk-weather').selectOption('sunset');await page.locator('#walk-season').selectOption('green');await page.locator('#walk-resume').click();
await page.keyboard.press('g');await page.keyboard.press('j');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.season==='summer'&&document.querySelector('#canvas-host').dataset.weather!=='sunset');
await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.chicken==='held');const before=Number((await page.locator('#canvas-host').getAttribute('data-camera-position')).split(',')[1]);
await page.keyboard.down('Space');await page.waitForFunction(y=>Number(document.querySelector('#canvas-host').dataset.cameraPosition.split(',')[1])>y+1.2,before);await page.keyboard.up('Space');await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.chicken==='');console.log('Keyboard: live season/weather, chicken pickup, lift and landing');
await page.locator('#walk-menu-toggle').click();await page.locator('#walk-weather').selectOption('sunset');await page.locator('#walk-season').selectOption('green');await page.locator('#walk-resume').click();
if(await page.evaluate(()=>Boolean(window.__viewer))){
  await page.evaluate(()=>{window.__viewer.walk.place(-35.5,5.39,111.5,Math.PI/2,-.06);});await page.screenshot({path:'artifacts/world/terrace.png'});
  await page.evaluate(()=>{const v=window.__viewer;v.environment.setWeather('clear');v.environment.setHour(14);v.walk.place(-154.5,1.75,205,0);});await page.screenshot({path:'artifacts/world/fields.png'});
  await page.evaluate(()=>{window.__viewer.walk.place(-276,1.75,99,-Math.PI/2,-.08);});await page.screenshot({path:'artifacts/world/water.png'});
  await page.evaluate(()=>{const v=window.__viewer;v.walk.place(-31,1.85,110,0,.20);});await page.screenshot({path:'artifacts/world/chicken.png'});
}
await page.locator('#walk-exit').click();await page.locator('[data-entry=village]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.walkLocation==='avenue');assert.equal(await page.locator('canvas').count(),1,'Re-entry reuses the world and renderer');await page.screenshot({path:'artifacts/world/avenue.png'});
assert.deepEqual(errors,[],'No JavaScript or shader errors');writeFileSync('artifacts/world/browser-result.json',JSON.stringify({pass:true,errors},null,2));console.log('PASS: entry, connected house, immediate weather/season, chicken flight, re-entry, visible world and no browser errors');await browser.close();
