import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const url=process.env.BASE_URL||'http://127.0.0.1:4173',out='artifacts/aim',errors=[];mkdirSync(out,{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:760,height:500}}),page=await context.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.overview==='ready');await page.locator('[data-entry=house]').click();await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.game==='on');
 const dev=await page.evaluate(()=>Boolean(window.__viewer));
 const clearCooldown=async()=>{if(dev)await page.evaluate(()=>{const t=window.__viewer.game.toys;t.cancelHold();t.clear();t.update(.95,0);});else await page.waitForTimeout(1800);};
 const read=()=>page.evaluate(()=>{const h=document.querySelector('#canvas-host'),r=document.querySelector('#walk-crosshair');return {shots:Number(h.dataset.toyShots||0),aim:JSON.parse(h.dataset.shotAim||'[0,0]'),direction:JSON.parse(h.dataset.shotDirection||'[0,0,-1]'),rect:{x:r.getBoundingClientRect().x,y:r.getBoundingClientRect().y,width:r.getBoundingClientRect().width,height:r.getBoundingClientRect().height},weapon:r.classList.contains('weapon-aim')};});
 const checkReticle=async(x,y)=>{const {rect,weapon}=await read();assert.ok(weapon);assert.ok(Math.abs(rect.x+rect.width/2-x)<2&&Math.abs(rect.y+rect.height/2-y)<2,'Crosshair follows mouse position');};
 await page.keyboard.press('1');await clearCooldown();
 await page.mouse.move(190,200);await checkReticle(190,200);let before=await read();await page.mouse.click(190,200);await page.waitForFunction(n=>Number(document.querySelector('#canvas-host').dataset.toyShots)>n,before.shots);let left=await read();assert.ok(Math.abs(left.aim[0]+.5)<1e-6&&Math.abs(left.aim[1]-.2)<1e-6);
 await clearCooldown();await page.mouse.move(570,300);await page.mouse.down({button:'right'});await page.mouse.move(620,220);await checkReticle(620,220);before=await read();await page.mouse.up({button:'right'});await page.waitForFunction(n=>Number(document.querySelector('#canvas-host').dataset.toyShots)>n,before.shots);const right=await read();assert.ok(right.aim[0]>.6&&right.aim[1]>.1);assert.ok(left.direction.some((v,i)=>Math.abs(v-right.direction[i])>.2),'Opposite cursor positions change the actual shot direction');
 await clearCooldown();before=await read();await page.mouse.move(240,220);await page.mouse.down();await page.mouse.move(270,230);await page.mouse.up();assert.equal((await read()).shots,before.shots,'Camera drag never fires');
 await clearCooldown();await page.mouse.move(230,190);before=await read();await page.keyboard.down('p');await page.keyboard.up('p');await page.waitForFunction(n=>Number(document.querySelector('#canvas-host').dataset.toyShots)>n,before.shots);assert.ok((await read()).aim[0]<-.3,'Keyboard trigger keeps cursor aim');
 await page.keyboard.press('2');await clearCooldown();await page.mouse.move(250,230);before=await read();await page.mouse.down({button:'right'});await page.waitForFunction(n=>Number(document.querySelector('#canvas-host').dataset.toyShots)>n,before.shots);await page.mouse.move(520,250);await page.waitForFunction(()=>JSON.parse(document.querySelector('#canvas-host').dataset.shotAim)[0]>.3);await page.mouse.up({button:'right'});
 await page.screenshot({path:`${out}/desktop.png`});console.log('PASS: visible cursor reticle, left click, right-mouse steering, P and no drag misfire');
 await page.setViewportSize({width:390,height:740});await clearCooldown();const cdp=await context.newCDPSession(page),r=await page.locator('#hud-fire').boundingBox();before=await read();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:2}]});await page.waitForFunction(n=>Number(document.querySelector('#canvas-host').dataset.toyShots)>n,before.shots);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual((await read()).aim,[0,0],'Phone trigger uses view centre');await checkReticle(195,370);
 await page.screenshot({path:`${out}/phone.png`});assert.deepEqual(errors,[]);writeFileSync(`${out}/${dev?'result':'production-result'}.json`,JSON.stringify({pass:true,url,errors,mouseAim:true,touchAim:true},null,2));console.log('PASS: phone trigger resets aim to view centre; no JavaScript or shader errors');
}finally{await browser.close();}
