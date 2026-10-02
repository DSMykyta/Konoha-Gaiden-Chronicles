import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const interactions = vm.runInNewContext(fs.readFileSync(new URL('../public/interaction-core.js', import.meta.url), 'utf8') + ';TimelineInteractions');

test('cancelled and superseded hover callbacks cannot reopen stale surfaces', () => {
  const callbacks = [];
  // Execute even cleared callbacks to exercise cancellation after a callback
  // has already been queued by the host, rather than trusting clearTimeout.
  const timers = interactions.scheduler({setTimeout(callback) { callbacks.push(callback); return callbacks.length; }, clearTimeout() {}});
  const shown = [];
  timers.defer('node-open', 260, () => shown.push('old'));
  timers.defer('node-open', 260, () => shown.push('current'));
  callbacks[0]();
  assert.deepEqual(shown, []);
  callbacks[1]();
  assert.deepEqual(shown, ['current']);
  timers.defer('node-open', 260, () => shown.push('dismissed'));
  timers.cancel('node-open');
  callbacks[2]();
  assert.deepEqual(shown, ['current']);
});

test('closing a hierarchy cancels its pending open and close jobs together', () => {
  const callbacks = [], shown = [];
  const timers = interactions.scheduler({setTimeout(callback) { callbacks.push(callback); return callbacks.length; }, clearTimeout() {}});
  for (const key of ['hierarchy-open:0', 'hierarchy-close:0', 'hierarchy-open:1', 'tooltip']) timers.defer(key, 260, () => shown.push(key));
  timers.cancelAll('hierarchy-');
  callbacks.forEach(callback => callback());
  assert.deepEqual(shown, ['tooltip']);
});

test('cascades fit narrow and wide screens without drift or off-screen controls', () => {
  for (const width of [320, 375, 768, 812, 1024, 1440, 2000]) {
    for (const count of [1, 2, 3, 4]) {
      const slots = interactions.panelLayout(count, width, width * .65, 120, 500);
      const visible = slots.filter(slot => !slot.obscured).sort((a,b)=>a.left-b.left);
      assert.equal(slots.at(-1).obscured, false);
      for (const slot of visible) {
        assert(slot.left >= 12);
        assert(slot.left + slot.width <= width - 12 + .001);
      }
      for (let i = 1; i < visible.length; i++) assert(visible[i].left >= visible[i-1].left + visible[i-1].width + 12);
      assert.deepEqual(slots, interactions.panelLayout(count, width, width * .65, 120, 500));
    }
  }
});

test('a tablet preview leaves its node clickable and preserves the same placement when pinned', () => {
  for (const width of [768, 812, 1024, 1440]) {
    for (const x of [width * .2, width * .5, width * .8]) {
      const y = 632, slot = interactions.cardLayout(width, x, y, 162, 908);
      assert(slot.left >= 12 && slot.left + slot.width <= width - 12);
      assert(slot.top >= 162 && slot.top + slot.height <= 908);
      assert(x < slot.left || x > slot.left + slot.width || y < slot.top || y > slot.top + slot.height, 'Preview covers its trigger');
      assert.deepEqual(slot, interactions.cardLayout(width, x, y, 162, 908));
    }
  }
});

test('short cards reserve a shelf for their external navigation control', () => {
  const slot = interactions.cardLayout(812, 398, 136, 108, 259);
  assert(slot.top>=108+52);
  assert(slot.top+slot.height<=259);
  assert(slot.top-52>=108);
  assert(slot.left >= 12 && slot.left + slot.width <= 800);
});

test('adding a cascade level never changes an existing surface position', () => {
  for (const width of [320,375,812,1024,1440,2000]) {
    for (const anchor of [12,width*.35,width*.65]) {
      let previous=[];
      for(let count=1;count<=5;count++){
        const slots=interactions.panelLayout(count,width,anchor,160,520);
        for(let i=0;i<previous.length;i++){
          assert.equal(slots[i].left,previous[i].left,'A child moved the parent row under the pointer');
          assert.equal(slots[i].top,previous[i].top);
          assert.equal(slots[i].width,previous[i].width);
        }
        previous=slots;
      }
    }
  }
});

test('a reading surface sits above its node and leaves room for the parent button', () => {
  for(const width of [375,812,1440,2000]){
    const point={x:width*.6,y:550};
    const slot=interactions.cardLayout(width,point.x,point.y,108,784);
    assert(slot.top>=160);
    assert(slot.top+slot.height<=point.y-18);
    assert(slot.top-52>=108);
  }
});
