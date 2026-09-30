// A before B: A sees B under "After this event"; B sees A under "Before this event".
function describeRelation(relation,currentId){
 const outgoing=relation.a===currentId;
 if(!outgoing&&relation.b!==currentId)return null;
 const otherId=outgoing?relation.b:relation.a;
 const labels={before:outgoing?'Після цієї події':'До цієї події',meets:outgoing?'Одразу після':'Безпосередньо до',intersects:'Перекривається в часі',same_span:'Той самий проміжок',observes:outgoing?'Спостерігає':'Спостережена з'};
 return {label:labels[relation.kind]||relation.kind,otherId,outgoing};
}
