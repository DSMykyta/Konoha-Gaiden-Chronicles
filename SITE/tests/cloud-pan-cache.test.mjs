import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../public/story-clouds.js',import.meta.url),'utf8');

test('Canvas pan reuses original paths and precomputed group geometry',()=>{
 const translations=[],clears=[],frameQueue=[];let paths=0;
 const context={
  setTransform(){},clearRect:(...args)=>clears.push(args),
  translate:(x,y)=>translations.push([x,y]),
  createLinearGradient:()=>({addColorStop(){}}),
  save(){},restore(){},stroke(){},fill(){}
 };
 const canvas={width:0,height:0,getContext:()=>context};
 const globals={
  window:{devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}})},
  document:{visibilityState:'visible',addEventListener(){}},
  requestAnimationFrame:callback=>{frameQueue.push(callback);return frameQueue.length;},
  cancelAnimationFrame(){},
  StoryTitleScale:{palette:colors=>colors},
  SelectionFocus:{palette:colors=>colors},
  Path2D:class {constructor(){paths++;}moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}}
 };
 const clouds=vm.runInNewContext(source+';StoryClouds',globals);
 const renderer=clouds.create(canvas);
 const points=[{id:'one',x:120,y:150},{id:'two',x:180,y:165}];
 const group={key:'episode:one',kind:'episode',parts:[points]};
 renderer.update({groups:[group],width:800,height:500,scrollTop:0});
 assert.equal(paths,1,'the episode contour should be constructed once');
 const firstDrawing=clears.length;
 renderer.pan(-45);
 assert.equal(paths,1,'camera movement must not synchronously recreate a path');
 assert(frameQueue.length>0);
 frameQueue.shift()();
 assert.equal(paths,1,'camera movement must reuse the exact same Path2D');
 assert.equal(clears.length,firstDrawing+1,'camera movement should redraw the bitmap only');
 assert(translations.some(([x,y])=>x===-45&&y===0),'the camera translation must reach Canvas');
 renderer.refresh();frameQueue.shift()();
 assert.equal(paths,1,'a palette refresh must also preserve the path');
});
