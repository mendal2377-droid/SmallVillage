import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const pos=()=>page.locator('#canvas-host').getAttribute('data-camera-position').then(s=>s.split(',').map(Number));
await mkdir('test-results',{recursive:true});
try{
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173',{waitUntil:'domcontentloaded',timeout:90000});
  assert.equal(await page.locator('.filmstrip img').count(),10);
  await page.locator('.filmstrip img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
  await page.locator('#three-mode').click();
  await page.locator('#loading').waitFor({state:'hidden',timeout:120000});
  await page.locator('[data-view="walk"]').click();
  async function axis(i,target){
    const p=await pos(),sign=Math.sign(target-p[i]);
    if(Math.abs(target-p[i])<.12)return;
    const key=i===0?(sign>0?'KeyD':'KeyA'):(sign>0?'KeyS':'KeyW');
    await page.keyboard.down(key);
    try{await page.waitForFunction(({i,target,sign})=>sign*(Number(document.querySelector('#canvas-host').dataset.cameraPosition.split(',')[i])-target)>=-.08,{i,target,sign},{timeout:90000});}
    finally{await page.keyboard.up(key);}
  }
  await axis(0,-1.3);await axis(2,-2.2);await axis(0,-2.87);
  await page.screenshot({path:'test-results/stairs-entry.png'});
  await axis(2,-6.7);assert.ok(Math.abs((await pos())[1]-3.73)<.1);
  await axis(0,-4.26);await axis(2,-2.3);
  assert.ok(Math.abs((await pos())[1]-5.39)<.1);
  await axis(0,1.5);
  const canvas=page.locator('#canvas-host canvas');await canvas.click();
  await page.waitForFunction(()=>Boolean(document.pointerLockElement));
  // Turn toward the windows and look down from the actual second-floor position.
  await page.mouse.move(640,500);await page.mouse.move(10,630,{steps:8});
  await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/second-floor-browser.png'});
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  const result={passed:true,position:await pos(),checks:['Ten gallery images decode','Keyboard entry','First flight','Turning landing','Second flight','Upper corridor','Mouse look from upstairs','No page errors']};
  await writeFile('test-results/stairs-browser.json',JSON.stringify(result,null,2));
  console.log(result);
}finally{await browser.close();}
