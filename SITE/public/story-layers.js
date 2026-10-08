'use strict';
/* Editorial provenance layers. A layer selects a historical ASSERTION,
   not the characters who happen to participate in a canonical event. */
const StoryLayers=(()=>{
 const names=Object.freeze(['naruto','official','project']);
 const ALL=Object.freeze({naruto:true,official:true,project:true});
 function compose(value,enabled=ALL){
  const text=String(value??'');
  const matcher=/\[\[([a-z]+)\|([\s\S]*?)\]\]/g;
  let matched='',last=0,output='',match;
  while((match=matcher.exec(text))){
   const [raw,name,body]=match;
   if(!names.includes(name))throw new Error('Unknown narrative layer '+name);
   if(body.includes('[[')||body.includes(']]'))throw new Error('Nested narrative conditions are unsupported');
   matched+=raw;
   output+=text.slice(last,match.index);
   if(enabled[name]===true)output+=body;
   last=match.index+raw.length;
  }
  output+=text.slice(last);
  if(output.includes('[[')||output.includes(']]'))
   throw new Error('Invalid or unclosed conditional narrative block');
  return output.replace(/\n[\t ]*\n(?:[\t ]*\n)+/g,'\n\n').trim();
 }
 function classify(moment){
  const explicit=moment?.layer;
  if(explicit==='team9'||explicit==='project')return 'project';
  if(explicit==='naruto'||explicit==='official')return explicit;
  if(explicit!==undefined&&explicit!==null)throw new Error('Unknown moment layer '+explicit);
  if(moment?.origin==='P')return 'project';
  if(moment?.origin==='M')return 'naruto';
  if(['F','V','N'].includes(moment?.origin))return 'official';
  // A (anime) is ambiguous: adaptations of manga AND extra scenes.
  // R, G and O also require editorial classification. Never guess.
  return null;
 }
 return {ALL,compose,classify};
})();
if(typeof module!=='undefined')module.exports=StoryLayers;
