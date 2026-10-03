'use strict';
const TimelineEraHeading = {
  segments(periods, calendar) {
    const lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
    const base=calendar.view_start_year??calendar.current_year,days=calendar.days_per_year;
    const rows=periods.filter(p=>p.calendar_era==='after_founding'&&Number.isInteger(p.from_year)).map(p=>{
      // A precise transition can be supplied inside a year. Otherwise the
      // registry has year precision, so the heading changes at that year's start.
      const boundary=p.boundary_date||{year:p.from_year,month:1,day:1};
      const start=(boundary.year-base)*days+lengths.slice(0,boundary.month-1).reduce((sum,n)=>sum+n,0)+boundary.day-1;
      return {id:p.id,label:p.label,start,order:p.order};
    }).sort((a,b)=>a.start-b.start||a.order-b.order);
    const distinct=[];
    for(const row of rows){
      if(distinct.at(-1)?.start===row.start)distinct[distinct.length-1]=row;
      else distinct.push(row);
    }
    return distinct;
  },
  layout(segments, leftDay, boundaryX, currentWidth, stageWidth, reducedMotion=false) {
    let index=segments.findLastIndex(p=>p.start<=leftDay);
    if(index<0)return [];
    const current=segments[index],next=segments[index+1];
    if(reducedMotion||!next)return [{...current,x:0,current:true}];
    const incomingX=boundaryX(next.start);
    const rows=[{...current,x:Math.min(0,incomingX-currentWidth-16),current:true}];
    if(incomingX<stageWidth)rows.push({...next,x:incomingX,current:false});
    return rows;
  }
};
