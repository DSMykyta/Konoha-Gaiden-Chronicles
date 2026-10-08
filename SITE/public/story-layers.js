'use strict';
/* Provenance describes the source of a claim, never the characters in it. */
const StoryLayers=(()=>{
 const keys=Object.freeze(['canon','filler','sources','project']);
 const ALL=Object.freeze({canon:true,filler:true,sources:true,project:true});
 const aliases={naruto:'canon',official:'sources',team9:'project'};
 const normalize=value=>aliases[value]||value;
 const mask=state=>keys.map(key=>state[key]?'1':'0').join('');
 function compose(input,enabled=ALL){
  const src=String(input??''),re=/\[\[([a-z]+)\|([\s\S]*?)\]\]/g;
  let out='',start=0,match;
  while((match=re.exec(src))){
   const layer=normalize(match[1]);
   if(!keys.includes(layer))throw Error('Unknown story layer '+match[1]);
   if(match[2].includes('[[')||match[2].includes(']]'))throw Error('Nested story-layer blocks');
   const active=enabled[layer]??enabled[Object.keys(aliases).find(k=>aliases[k]===layer)]??false;
   out+=src.slice(start,match.index)+(active?match[2]:'');
   start=match.index+match[0].length;
  }
  out+=src.slice(start);
  if(out.includes('[[')||out.includes(']]'))throw Error('Unclosed story-layer block');
  return out.replace(/\n[\t ]*\n(?:[\t ]*\n)+/g,'\n\n').trim();
 }
 function classify(event,arcKind=null){
  if(event?.layer!==undefined&&event.layer!==null){
   const layer=normalize(event.layer);
   if(!keys.includes(layer))throw Error('Unknown event layer '+event.layer);
   return layer;
  }
  if(arcKind==='project'||event?.origin==='P')return 'project';
  if(event?.origin==='M')return 'canon';
  if(event?.origin==='F')return 'filler';
  if(event?.origin==='R')return arcKind==='adaptation'?'filler':'sources';
  if(['V','N','G','O'].includes(event?.origin))return 'sources';
  if(event?.origin==='A'){
   if((event.evidence_ids||[]).some(id=>id.includes('manga-')))return 'canon';
   return arcKind==='adaptation'?'filler':arcKind==='canonical'?'canon':null;
  }
  return null;
 }
 function select(events,state,arcKind=()=>null){
  return events.filter(event=>{const layer=classify(event,arcKind(event));return layer===null||state[layer]===true;});
 }
 return {keys,ALL,mask,normalize,compose,classify,select};
})();
if(typeof module!=='undefined')module.exports=StoryLayers;
