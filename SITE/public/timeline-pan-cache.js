'use strict';

// A pan is a camera operation. Keep geometry and all DOM paths from the most
// recent layout while the camera stays within its pre-rendered overscan.
const TimelinePanCache = {
  visibleBreaks(breaks,lo,hi) {
    return breaks.filter(gap=>gap.axis>=lo&&gap.axis<=hi)
      .map(gap=>gap.axis+':'+gap.size).join('|');
  },
  frame({lo,hi,maxAxis,width,height,zoom,dayPx,breaks},overscan=.7) {
    const span=hi-lo,coverLo=Math.max(0,lo-span*overscan),coverHi=Math.min(maxAxis,hi+span*overscan);
    return {
      lo,hi,coverLo,coverHi,width,height,zoom,dayPx,
      breakKey:this.visibleBreaks(breaks,lo,hi),
      leftPx:(lo-coverLo)*dayPx,rightPx:(coverHi-hi)*dayPx
    };
  },
  reuse(frame,{lo,hi,width,height,zoom,breaks}) {
    if(!frame||frame.width!==width||frame.height!==height||frame.zoom!==zoom||
       lo<frame.coverLo-1e-8||hi>frame.coverHi+1e-8||
       this.visibleBreaks(breaks,lo,hi)!==frame.breakKey)return null;
    return {shift:(frame.lo-lo)*frame.dayPx,lo,hi};
  }
};
if(typeof module!=='undefined')module.exports=TimelinePanCache;
