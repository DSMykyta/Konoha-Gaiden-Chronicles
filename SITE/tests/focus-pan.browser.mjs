import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createLocalServer} from '../scripts/serve.mjs';
const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try {
 for (const viewport of [{width:1440,height:900},{width:375,height:812}]) {
  const page=await browser.newPage({viewport}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.waitForSelector('#timeline .node');
  const before=await page.evaluate(()=>{
   zoom=zoomModes.month;center=dayToAxis(95);render();
   const node=graphNodes.find(p=>p.cast.length&&p.y>90&&p.y<$('canvas').clientHeight-90);
   if(!node)throw new Error('No visible character mark in fixture');
   setFocus(node.cast[0]);
   const mark=[...document.querySelectorAll('#timeline .node')].find(el=>el.dataset.event===node.id),r=mark.getBoundingClientRect();
   return {character:focusedCharacter,x:r.left+r.width/2,y:r.top+r.height/2};
  });
  assert(before.x>0&&before.x<viewport.width);
  await page.mouse.move(before.x,before.y);await page.mouse.down();
  await page.mouse.move(Math.min(viewport.width-15,before.x+95),before.y+11,{steps:9});
  await page.mouse.up();await page.waitForTimeout(200);
  const after=await page.evaluate(()=>({
   character:focusedCharacter,
   foreignVisible:[...document.querySelectorAll('#timeline .node')].filter(el=>{
    const node=panFrame?.nodes.find(n=>n.id===el.dataset.event);
    return node&&!node.cast.includes(focusedCharacter)&&!el.classList.contains('is-line-focus-hidden');
   }).length
  }));
  assert.equal(after.character,before.character,'dragging a mark cannot deselect character');
  assert.equal(after.foreignVisible,0,'drag cannot reveal nodes outside focused story');
  await page.evaluate(()=>{
   const span=range()[1]-range()[0];
   center=clampAxisCenter(panFrame.coverHi+span*.2);schedule();
  });
  await page.waitForTimeout(260);
  const far=await page.evaluate(()=>({
   character:focusedCharacter,covered:!!panFrame&&range()[0]>=panFrame.coverLo-1e-7&&range()[1]<=panFrame.coverHi+1e-7,
   foreignVisible:[...document.querySelectorAll('#timeline .node')].filter(el=>{
    const node=panFrame?.nodes.find(n=>n.id===el.dataset.event);
    return node&&!node.cast.includes(focusedCharacter)&&!el.classList.contains('is-line-focus-hidden');
   }).length
  }));
  assert.equal(far.character,before.character);
  assert(far.covered);assert.equal(far.foreignVisible,0,'buffer rebuild cannot reveal foreign nodes');
  await page.evaluate(()=>{
   setFocus(focusedCharacter);zoom=zoomModes.month;center=dayToAxis(95);render();
   StoryTitleScale.update();
   const button=document.querySelector('#storyTitleTrack .story-title-label');
   if(!button)throw new Error('No story label');
   button.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse',bubbles:false}));
   if(!window.__storyScaleFocus.active)throw new Error('Story hover not active');
   window.__focusedStoryKey=window.__storyScaleFocus.key;
   const span=range()[1]-range()[0];center=clampAxisCenter(panFrame.coverHi+span*.2);schedule();
  });
  await page.waitForTimeout(260);
  const story=await page.evaluate(()=>({
   active:window.__storyScaleFocus.active,key:window.__storyScaleFocus.key,
   expected:window.__focusedStoryKey,
   dimmed:document.querySelectorAll('#timeline .is-story-scale-hover-muted').length
  }));
  assert(story.active);assert.equal(story.key,story.expected);
  assert(story.dimmed>0,'story filter must be restored to new SVG children');
  assert.deepEqual(errors,[]);
  await page.close();
 }
}finally{await browser.close();server.close();}
