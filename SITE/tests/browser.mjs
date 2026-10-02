import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createLocalServer} from '../scripts/serve.mjs';

const require = createRequire(import.meta.url);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const {chromium} = require(playwright);
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
const server = createLocalServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
const output = process.env.BROWSER_SCREENSHOTS;
if (output) await fs.mkdir(output, {recursive: true});

try {
  browser = await chromium.launch({executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--window-size=2400,1400']});
  const viewports=process.env.BROWSER_VIEWPORT ? [JSON.parse(process.env.BROWSER_VIEWPORT)] : [[1440,900], [375,812], [320,700], [812,375], [768,1024], [2000,1100]];
  for (const [width, height] of viewports) {
    const page = await browser.newPage({viewport: {width, height}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url, {waitUntil: 'networkidle'});
    await page.waitForSelector('.node');
    assert.equal(await page.locator('#error').isVisible(), false);

    // Overview remains compact; focus preserves the original story geometry.
    await page.evaluate(()=>{zoom=zoomModes.year;render();});
    assert(await page.evaluate(()=>Math.max(...graphNodes.map(p=>p.y))-Math.min(...graphNodes.map(p=>p.y))<90),'Year overview grew into tall peaks');
    assert.equal(await page.locator('#storyTitleLevel').inputValue(),'arc');
    const overviewCoordinates=await page.locator('.node .mark').evaluateAll(elements=>Object.fromEntries(elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cy')])));
    await page.evaluate(()=>setFocus('c-naruto'));
    assert(await page.locator('.thread').count()>0);
    const focusedCoordinates=await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cy')]));
    for(const [id,y] of focusedCoordinates)assert.equal(y,overviewCoordinates[id],'Focus flattened the story geometry');
    await page.evaluate(()=>{setFocus('c-naruto');navigateEvent("ev-y0-0122-team7-announced");closeCard();});
    assert.equal(await page.locator('#storyTitleLevel').inputValue(),'moment');
    const reader=page.locator('.story-title-label[data-story-key="moment:ev-y0-0122-team7-announced"]');
    assert.equal(await reader.count(),1);
    assert.equal(await page.locator('.story-item-read').count(),0);
    if(width<=760&&height>=520){
      if(await page.locator('.story-reader-toggle').getAttribute('aria-expanded')==='false')await page.locator('.story-reader-toggle').click();
      const row=reader.locator('..');
      const number=await row.locator('.story-item-number').textContent();
      assert.equal(number,await page.locator('[data-event="ev-y0-0122-team7-announced"] .moment-number').textContent());
      assert(await row.locator('.story-item-context').textContent());
      assert(await row.locator('.story-title-label').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
      assert(await reader.evaluate(el=>el.getBoundingClientRect().height>=44));
      await page.locator('.story-reader-toggle').click();
      assert.equal(await page.locator('.story-reader-toggle').getAttribute('aria-expanded'),'false');
      await page.locator('.story-reader-toggle').click();
    }
    await reader.click();
    assert.equal(await page.evaluate(()=>pinnedNodeId),'ev-y0-0122-team7-announced');
    assert.equal(await page.locator('#eventCard .card-kind').textContent(),'МОМЕНТ');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{zoom=zoomModes.month;center=dayToAxis(21.5);render();});
    // No clearance mask hides an actual shared physical anchor.
    assert(await page.evaluate(()=>[...document.querySelectorAll('.thread[mask]')].every(path=>{
      const id=path.dataset.character,maskId=path.getAttribute('mask').slice(5,-1);
      return [...document.getElementById(maskId).querySelectorAll('[data-node-id]')].every(cutout=>!graphNodes.find(p=>p.id===cutout.dataset.nodeId)?.cast.includes(id));
    })));

    // A tooltip still recognizes the trigger after its native title is removed.
    const tooltipButton = page.locator('[data-mode="week"]');
    await tooltipButton.hover();
    await page.locator('#glassTooltip').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('#glassTooltip').isVisible(), true);
    await page.mouse.move(1, height / 2);
    assert.equal(await page.locator('#glassTooltip').isVisible(), false);
    await tooltipButton.hover();
    await page.waitForTimeout(320);
    await page.keyboard.press('Escape');
    await page.mouse.move(1, height / 2);
    assert.equal(await page.locator('#glassTooltip').isVisible(), false);

    await page.evaluate(() => { closeCard(); zoom=zoomModes.week; center=dayToAxis(21.5); render(); });
    const node = page.locator('[data-event="sc-y0-0122-academy-announcements"] .mark');
    const box = await node.boundingBox();
    if (width > 760 && height >= 520) {

      // Move through the 44px hit area onto its visible mark before the delay.
      // Neither the map elements nor unrelated strand visibility may change.
      const mapGeometry=await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')]));
      await page.evaluate(()=>{window.mapMutations=0;window.mapObserver=new MutationObserver(records=>{window.mapMutations+=records.filter(record=>record.target.id==='timeline').length;});window.mapObserver.observe($('timeline'),{childList:true});});
      for(let repeat=0;repeat<3;repeat++){
        await page.mouse.move(1,height/2);
        await page.locator('#eventCard').waitFor({state:'hidden',timeout:10000});
        await page.mouse.move(box.x+box.width/2+18,box.y+box.height/2);
        await page.waitForTimeout(80);
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.locator('#eventCard').waitFor({state:'visible',timeout:10000});
        assert.equal(await page.locator('.thread.is-scene-muted').count(),0,'Hover made the map disappear');
        assert.deepEqual(await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')])),mapGeometry,'Hover moved the map');
      }
      assert.equal(await page.evaluate(()=>window.mapMutations),0,'Hover rebuilt the SVG');
      await page.evaluate(()=>window.mapObserver.disconnect());
      await page.mouse.move(1,height/2);
      await page.locator('#eventCard').waitFor({state:'hidden',timeout:10000});

      // Passing through a node, Escape and zoom cancel delayed opening.
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
      await page.mouse.move(1, height/2);
      await page.locator('#eventCard').waitFor({state:'hidden',timeout:10000});
      await page.waitForTimeout(320);
      assert.equal(await page.locator('#eventCard').isVisible(), false);
      await node.hover();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(320);
      assert.equal(await page.locator('#eventCard').isVisible(), false);
      await page.mouse.move(1, height/2);
      await node.hover();
      await page.evaluate(() => setZoom(zoom * 1.01));
      await page.waitForTimeout(320);
      assert.equal(await page.locator('#eventCard').isVisible(), false, 'Zoom left a stale open callback');
      await page.evaluate(() => { zoom=zoomModes.week; render(); });
      await page.mouse.move(1, height/2);
      await node.hover();
      await page.locator('#eventCard').waitFor({state:'visible',timeout:10000});
      assert.equal(await page.locator('#eventCard').isVisible(), true);
      const before = await page.locator('#eventCard').boundingBox();
      const scrollBefore = await page.locator('#canvas').evaluate(canvas => canvas.scrollTop);
      await node.click();
      assert.deepEqual(await page.locator('#eventCard').boundingBox(), before, 'Pinning changed card geometry');
      assert.equal(await page.locator('#canvas').evaluate(canvas => canvas.scrollTop), scrollBefore, 'Pinning scrolled the graph');
      assert.equal(await page.evaluate(() => pinnedNodeId), 'sc-y0-0122-academy-announcements');
    } else {
      await node.click();
      assert.equal(await page.locator('#eventCard').isVisible(), true);
    }
    assert.equal(await page.evaluate(() => {
      const original = StoryClouds.contours; let rebuilt=0;
      StoryClouds.contours=(...args)=>{rebuilt++;return original(...args);};
      try { cloudRenderer.refresh(); cloudRenderer.refresh(); cloudRenderer.scroll($('canvas').scrollTop); return rebuilt; }
      finally { StoryClouds.contours=original; }
    }), 0, 'A palette/scroll update rebuilt unchanged contours');

    // All levels share one cascade, headers stay fixed, and no idle reflow runs.
    await page.evaluate(() => navigateStory('arc', 'arc-y0-genin-formation'));
    if (width >= 816) {
      const row = page.locator('#eventCard [data-story-episode="ep-y0-team-formation"]');
      const rowBox=await row.boundingBox();
      await page.mouse.move(rowBox.x+rowBox.width/2,rowBox.y+rowBox.height/2);
      await page.mouse.move(1, height / 2);
      await page.locator('.hierarchy-preview').waitFor({state:'hidden',timeout:10000});
      await page.waitForTimeout(320);
      assert.equal(await page.locator('.hierarchy-preview').count(), 0, 'Leaving a row did not cancel its delay');
      await row.hover();
      await page.locator('.hierarchy-preview').waitFor({state:'visible',timeout:10000});
      assert.equal(await page.locator('.hierarchy-preview').count(), 1);
      if(width>=1240&&height>=520){
        const parentLeft=await page.locator('#eventCard').evaluate(element=>element.style.left);
        const sceneRow=page.locator('[data-hierarchy-depth="0"] [data-story-scene="sc-y0-0122-academy-announcements"]');
        await sceneRow.hover();
        await page.locator('[data-hierarchy-depth="1"]').waitFor({state:'visible',timeout:10000});
        const leafRow=page.locator('[data-hierarchy-depth="1"] [data-scene-preview="ev-y0-0122-team7-announced"]');
        const leafBounds=await leafRow.boundingBox();
        const priorPositions=await page.locator('.story-panel').evaluateAll(elements=>elements.map(element=>element.style.left));
        await leafRow.hover();
        await page.waitForTimeout(400);
        assert.deepEqual(await leafRow.boundingBox(),leafBounds,'Opening the last preview moved its own hover trigger');
        assert.equal(await page.locator('#eventCard').evaluate(element=>element.style.left),parentLeft,'The cascade shifted the map reader');
        assert.deepEqual((await page.locator('.story-panel').evaluateAll(elements=>elements.map(element=>element.style.left))).slice(0,priorPositions.length),priorPositions,'A hover moved its preceding panels');
        assert(await page.locator('[data-hierarchy-depth="1"]').isVisible(),'The last hover closed the cascade');
      }
      await page.mouse.move(1, height - 130);
      await page.locator('.hierarchy-preview').waitFor({state:'hidden',timeout:10000});
      await page.waitForTimeout(320);
      assert.equal(await page.locator('.hierarchy-preview').count(), 0, 'An unpinned child stuck open');
      assert.equal(await page.locator('#eventCard').isVisible(), true, 'Leaving a child closed its pinned parent');
    }
    await page.locator('#eventCard [data-story-episode="ep-y0-team-formation"]').click();
    await page.locator('[data-hierarchy-depth="0"] [data-story-scene="sc-y0-0122-academy-announcements"]').click();
    const episodeScroll=await page.locator('[data-hierarchy-depth="0"] .preview-scroll').evaluate(element=>element.scrollTop);
    await page.locator('[data-hierarchy-depth="1"] [data-scene-preview="ev-y0-0122-team7-announced"]').click();
    assert.equal(await page.locator('.hierarchy-preview').count(), 3);
    const activeParentRows = await page.locator('.is-preview-active').count();
    assert.equal(activeParentRows, 3);
    const panels = page.locator('.story-panel:visible');
    const bounds = await panels.evaluateAll(elements => elements.filter(element => getComputedStyle(element).visibility !== 'hidden').map(element => {
      const rect = element.getBoundingClientRect(); return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom};
    }));
    if(width<=760)assert.equal(bounds.length,1,'Phone shows overlapping reading levels');
    if(width>=1240)assert(bounds.length>=3,'Desktop lost neighboring episode, scene and moment panels');
    for (const rect of bounds) {
      assert(rect.left >= 11 && rect.right <= width - 11, 'Cascade is outside the viewport');
      assert(rect.top >= 0 && rect.bottom <= height, 'Cascade controls are clipped vertically');
    }
    const detail = page.locator('[data-hierarchy-depth="2"]');
    for(const depth of [0,1,2]){
      assert.equal(await page.locator(`[data-hierarchy-depth="${depth}"] .story-parent-button`).count(),0,'Cascade has a redundant upward bar');
      assert.equal(await page.locator(`[data-hierarchy-depth="${depth}"] .story-panel-header [data-back-hierarchy]`).count(),0);
    }
    const headerBefore = await detail.locator('.story-panel-header').boundingBox();
    await detail.locator('.preview-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.deepEqual(await detail.locator('.story-panel-header').boundingBox(), headerBefore, 'Preview header scrolled');
    const positions = await panels.evaluateAll(elements => elements.map(element => element.style.left));
    await page.waitForTimeout(600);
    assert.deepEqual(await panels.evaluateAll(elements => elements.map(element => element.style.left)), positions, 'Idle cascade drifted');
    if (width === 1440) {
      // A pinned aggregate survives zoom even when its graph node disappears.
      await page.evaluate(() => { zoom=zoomModes.day; render(); });
      await page.setViewportSize({width:375, height:375});
      await page.waitForTimeout(80);
      const small = await page.locator('[data-hierarchy-depth="2"]').boundingBox();
      assert(small.x >= 11 && small.x + small.width <= 364 && small.y >= 0 && small.y + small.height <= 375, 'A resized pinned cascade is clipped');
      await page.setViewportSize({width,height});
      await page.waitForTimeout(80);
    }
    if(await detail.locator('[data-back-hierarchy]').isVisible())await detail.locator('[data-back-hierarchy]').click();else await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hierarchy-preview').count(), 2);
    assert.equal(await page.locator('[data-hierarchy-depth="1"]').evaluate(element=>element.inert),false);
    if(await page.locator('[data-hierarchy-depth="1"] [data-back-hierarchy]').isVisible())await page.locator('[data-hierarchy-depth="1"] [data-back-hierarchy]').click();else await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hierarchy-preview').count(), 1);
    assert.equal(await page.locator('[data-hierarchy-depth="0"] .preview-scroll').evaluate(element=>element.scrollTop),episodeScroll);
    if(await page.locator('[data-hierarchy-depth="0"] [data-back-hierarchy]').isVisible())await page.locator('[data-hierarchy-depth="0"] [data-back-hierarchy]').click();else await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hierarchy-preview').count(), 0);
    assert.equal(await page.locator('#eventCard').isVisible(), true);
    await page.locator('#eventCard [data-story-episode="ep-y0-team-formation"]').click();
    await page.locator('[data-hierarchy-depth="0"] [data-close-hierarchy]').click();
    assert.equal(await page.locator('.hierarchy-preview').count(),0);
    assert.equal(await page.locator('#eventCard').isVisible(),false,'Close left a parent reader open');
    await page.evaluate(()=>navigateStory('arc','arc-y0-genin-formation'));
    await page.locator('#eventCard [data-story-episode="ep-y0-team-formation"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.hierarchy-preview').count(),0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#eventCard').isVisible(), false);

    // Clicks bypass hover delays and upward navigation handles singleton scenes.
    await page.evaluate(() => navigateEvent('ev-y0-0122-three-jonin-wait-outside'));
    await page.locator('#eventCard [data-parent-kind="scene"]').click();
    assert.equal(await page.locator('#eventCard .card-kind').textContent(), 'СЦЕНА');
    await page.locator('#eventCard [data-parent-kind="episode"]').click();
    assert.equal(await page.locator('#eventCard .card-kind').textContent(), 'ЕПІЗОД');
    await page.locator('#eventCard [data-parent-kind="arc"]').click();
    assert.equal(await page.locator('#eventCard .card-kind').textContent(), 'АРКА');
    await page.evaluate(() => closeCard());

    // A title is read in place, and the reported episode-to-arc path retains the map.
    await page.evaluate(()=>{closeCard();zoom=zoomModes.week;center=dayToAxis(21.5);render();});
    const mapBefore=await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')]));
    await page.locator('.cloud-label').first().click();
    assert.equal(await page.locator('#eventCard').isVisible(),true);
    assert.deepEqual(await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')])),mapBefore,'Reading a map title moved the map');
    await page.evaluate(()=>closeCard());
    await page.evaluate(()=>navigateStory('episode',[...episodeMap.values()].find(episode=>episode.arc_id==='arc-y0-scroll-of-seals').id));
    await page.locator('#eventCard [data-parent-kind="arc"]').click();
    assert.equal(await page.locator('#eventCard .card-kind').textContent(),'АРКА');
    assert.equal(await page.locator('[data-event="arc:arc-y0-scroll-of-seals"]').count(),1);
    assert(await page.locator('.thread').count()>0,'Returning to an arc erased the character lines');
    assert.equal(await page.locator('#timelineEmpty').isVisible(),false);
    await page.evaluate(()=>closeCard());

    await page.locator('[data-mode="week"]').click();
    await page.locator('.timeline-key [data-level="scene"][aria-current="true"]').waitFor({state:'visible'});
    assert(await page.evaluate(()=>axisToDay(center)<31),'Returning from the January arc jumped to another month');

    // Search, reading from a bottom title, single-character focus and profiles.
    await page.keyboard.press('/');
    await page.locator('#eventSearch').fill('Команда 7');
    await page.locator('#searchResults [data-search-kind="moment"]').first().click();
    assert.equal(await page.locator('#eventCard').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { zoom=zoomModes.week; center=dayToAxis(21.5); render(); });
    await page.locator('#storyTitleLevel').selectOption('scene');
    const bottomMap=await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')]));
    const bottomView=await page.evaluate(()=>[zoom,center]);
    await page.locator('.story-title-label[data-story-key="scene:sc-y0-0122-academy-announcements"]').click();
    assert.equal(await page.evaluate(()=>cardSelection.id),'sc-y0-0122-academy-announcements');
    assert.equal(await page.evaluate(() => window.__storyScaleFocus.active),false);
    assert.equal(await page.locator('.is-story-scale-fixed-hidden').count(),0);
    assert.deepEqual(await page.evaluate(()=>[zoom,center]),bottomView,'Bottom reading changed the time scale');
    assert.deepEqual(await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cx'),element.getAttribute('cy')])),bottomMap,'Bottom reading moved the map');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
    assert.equal(await page.evaluate(() => window.__storyScaleFocus.active), false);
    const sceneCoordinates=await page.locator('.node .mark').evaluateAll(elements=>Object.fromEntries(elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cy')])));
    const focusCurves=await page.locator('.thread').evaluateAll(elements=>elements.map(element=>element.getAttribute('d')));
    await page.evaluate(() => setFocus('c-naruto'));
    for(const [id,y] of await page.locator('.node .mark').evaluateAll(elements=>elements.map(element=>[element.parentElement.dataset.event,element.getAttribute('cy')])))assert.equal(y,sceneCoordinates[id],'Focus flattened the chronological groups');
    assert(await page.locator('.thread').count()>0);
    assert.deepEqual(await page.locator('.thread').evaluateAll(elements=>elements.map(element=>element.getAttribute('d'))),focusCurves,'Focus changed strands or gaps');
    assert(await page.locator('.thread.is-line-focus-main').count()>0);
    assert.equal(await page.locator('.focus-guest-entry').count(),0);
    await page.locator('#clearFocus').click();
    await page.evaluate(() => openProfile('c-naruto', $('linesButton')));
    assert.equal(await page.locator('#profileDialog').isVisible(), true);
    assert(await page.locator('.technique-card').count() > 0);
    await page.evaluate(() => openCharacterEvents('c-naruto', $('profileDialog')));
    assert.equal(await page.locator('#characterEventsDialog').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.evaluate(() => navigateScene('sc-y0-0122-academy-announcements'));
    await page.evaluate(() => readScene('sc-y0-0122-academy-announcements', $('cardContent')));
    assert.equal(await page.locator('#sceneDialog').isVisible(), true);
    await page.keyboard.press('Escape');
    if (output) await page.screenshot({path: path.join(output, `site-${width}-${height}.png`), animations: 'disabled'});
    assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
    console.log(`PASS browser ${width}×${height}: hover, tooltips, stable pin, cascade, parent navigation, focus, search, readers and profiles`);
    await page.close();
  }
  const touch=await browser.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true});
  const touchErrors=[];touch.on('pageerror',error=>touchErrors.push(error.message));
  await touch.goto(url,{waitUntil:'networkidle'});
  await touch.locator('[data-mode="day"]').tap();
  await touch.locator('[data-event="ev-y0-0122-team7-announced"] .moment-number').waitFor();
  if(await touch.locator('.story-reader-toggle').getAttribute('aria-expanded')==='false')await touch.locator('.story-reader-toggle').tap();
  await touch.locator('.story-title-label[data-story-key="moment:ev-y0-0122-team7-announced"]').tap();
  assert.equal(await touch.evaluate(()=>pinnedNodeId),'ev-y0-0122-team7-announced');
  await touch.waitForTimeout(320);
  assert.equal(await touch.evaluate(()=>pinnedNodeId),'ev-y0-0122-team7-announced','A delayed touch hover replaced the chosen moment');
  await touch.locator('#eventCard [data-close-card]').tap();
  assert.equal(await touch.locator('#eventCard').isVisible(),false);
  await touch.locator('[data-event="ev-y0-0122-team7-announced"] .mark').tap();
  assert.equal(await touch.evaluate(()=>pinnedNodeId),'ev-y0-0122-team7-announced');
  await touch.locator('#eventCard [data-parent-kind="scene"]').tap();
  assert.equal(await touch.locator('#eventCard .card-kind').textContent(),'СЦЕНА');
  await touch.locator('#eventCard [data-parent-kind="episode"]').tap();
  assert.equal(await touch.locator('#eventCard .card-kind').textContent(),'ЕПІЗОД');
  await touch.locator('#eventCard [data-parent-kind="arc"]').tap();
  await touch.locator('#eventCard [data-story-episode="ep-y0-team-formation"]').tap();
  await touch.locator('[data-hierarchy-depth="0"] [data-story-scene="sc-y0-0122-academy-announcements"]').tap();
  await touch.locator('[data-hierarchy-depth="1"] [data-scene-preview="ev-y0-0122-team7-announced"]').tap();
  await touch.locator('[data-hierarchy-depth="2"] [data-back-hierarchy]').tap();
  assert.equal(await touch.locator('[data-hierarchy-depth="1"]').evaluate(element=>element.inert),false);
  await touch.setViewportSize({width:812,height:375});
  await touch.locator('[data-hierarchy-depth="1"] [data-back-hierarchy]').tap();
  await touch.setViewportSize({width:375,height:812});
  await touch.locator('[data-hierarchy-depth="0"] [data-back-hierarchy]').tap();
  assert.equal(await touch.locator('.hierarchy-preview').count(),0);
  assert.equal(await touch.locator('#eventCard').evaluate(element=>element.inert),false);
  await touch.locator('#eventCard [data-story-episode="ep-y0-team-formation"]').tap();
  await touch.locator('[data-hierarchy-depth="0"] [data-close-hierarchy]').tap();
  assert.equal(await touch.locator('#eventCard').isVisible(),false);
  assert.deepEqual(touchErrors,[]);
  await touch.close();
  console.log('PASS real touch: direct reading, upward navigation, cascade return, phone rotation and close');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
