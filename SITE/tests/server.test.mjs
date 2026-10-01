import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalServer} from '../scripts/serve.mjs';

test('local server serves a matching interface and assets without stale caches',async()=>{
 const server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const root=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(root),html=await page.text();assert.equal(page.headers.get('cache-control'),'no-store');
  assert(html.includes('id="cardScroll"'));assert(html.includes('id="characterEventPrevious"'));
  const asset=html.match(/src="(app\.js\?[^"]+)"/)[1],script=await fetch(`${root}/${asset}`);assert.equal(script.status,200);assert.equal(script.headers.get('cache-control'),'no-store');assert((await script.text()).includes('function ensureInterface()'));
  assert.equal((await fetch(`${root}/%2e%2e%2fpackage.json`)).status,403);
  assert.equal((await fetch(`${root}/missing.json`)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
