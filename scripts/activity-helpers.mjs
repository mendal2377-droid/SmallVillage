export async function advanceActivity(page,seconds){await page.evaluate(seconds=>{const v=window.__viewer;for(let i=0;i<seconds*20;i++)v.game.adventure.update(.05,i*.05);v.game.update(0,seconds,.25);},seconds);}
export async function playFishing(page){
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.encounter==='fish');await page.keyboard.press('q');
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.activityPhase==='rig');await page.keyboard.press('q');
  await page.evaluate(()=>{const v=window.__viewer;for(let i=0;i<600&&v.game.adventure.task?.phase!=='bite';i++)v.game.adventure.update(.05,i*.05);v.game.update(0,0,.25);});
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.activityPhase==='bite');await page.keyboard.press('q');
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.activityPhase==='fight');
  await page.evaluate(()=>{const v=window.__viewer,a=v.game.adventure;for(let i=0;i<1800&&a.task?.phase==='fight';i++){const s=a.task.fishing.state;if(s.cycle){a.release();a.aim(-s.side);}else a.press();a.update(.05,i*.05);}v.game.update(0,0,.25);});
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.activityPhase==='caught');await page.keyboard.press('q');
  await page.waitForFunction(()=>document.querySelector('#canvas-host').dataset.activityOutcome==='fish'&&document.querySelector('#canvas-host').dataset.activity==='');
}
