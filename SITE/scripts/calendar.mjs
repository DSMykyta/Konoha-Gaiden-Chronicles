/** Historical year numbers stay positive; the canvas uses days from its first year. */
export function validateCalendar(calendar, periods, anchors) {
 if(calendar?.status!=='project_reconstruction'||calendar.epoch_year!==1||!Number.isInteger(calendar.current_year)||calendar.current_year<1)throw Error('Invalid founding calendar');
 const validYear=year=>Number.isInteger(year)&&year>0;
 for(const period of periods){
  if(!period.label||!['before_founding','after_founding'].includes(period.calendar_era))throw Error('Invalid era metadata: '+period.id);
  for(const key of ['from_year','to_year'])if(period[key]!==undefined&&!validYear(period[key]))throw Error('Invalid era year: '+period.id);
  if(period.boundary_date){
   const date=period.boundary_date,lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
   if(!validYear(date.year)||date.year!==period.from_year||!Number.isInteger(date.month)||date.month<1||date.month>12||!Number.isInteger(date.day)||date.day<1||date.day>lengths[date.month-1])throw Error('Invalid era boundary date: '+period.id);
  }
  if(period.from_year!==undefined&&period.to_year!==undefined){
   const direction=period.calendar_era==='before_founding'?-1:1;
   if(direction*period.from_year>direction*period.to_year)throw Error('Reversed era range: '+period.id);
  }
 }
 for(const anchor of anchors){
  const date=anchor.date;
  if(!date)continue;
  if(!validYear(date.year)||!['before_founding','after_founding'].includes(date.era||'after_founding'))throw Error('Invalid anchor year: '+anchor.id);
 }
}

export function dayInYear(date, offset, calendar, lengths) {
 const firstYear=calendar.view_start_year??calendar.current_year,lastYear=calendar.view_end_year??calendar.current_year;
 if((date.era||'after_founding')!=='after_founding'||!Number.isInteger(date.year)||date.year<firstYear||date.year>lastYear)throw Error('Date outside active calendar years '+firstYear+'–'+lastYear);
 if(!Number.isInteger(date.month)||date.month<1||date.month>lengths.length||!Number.isInteger(date.day)||date.day<1||date.day>lengths[date.month-1])throw Error('Invalid calendar date');
 if(!Number.isInteger(offset))throw Error('Invalid calendar day offset');
 const day=(date.year-firstYear)*calendar.days_per_year+lengths.slice(0,date.month-1).reduce((sum,n)=>sum+n,0)+date.day-1+offset;
 if(day<0||day>=(lastYear-firstYear+1)*calendar.days_per_year)throw Error('Calendar placement out of bounds');
 return day;
}
