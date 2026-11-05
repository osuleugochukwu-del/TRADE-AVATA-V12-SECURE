/* SECURE custom time-interval input guard. No chart data is generated here.
 * VPS contract: 1-59 seconds or fixed minutes/hours/days up to 30 days.
 * This intentionally does not change existing preset timeframes.
 */
export function parseCustomTimeInterval(input) {
  const raw=String(input??'').trim();
  if(!raw)return {ok:false,error:'Enter an interval such as 12s, 7m, 2h or 2d.'};
  if(/(?:w|mo|mon|month|months|M)$/.test(raw))return {ok:false,error:'Weekly and calendar-month custom intervals are not supported by the current live server.'};
  const match=/^([1-9][0-9]{0,6})([smhd])$/.exec(raw.toLowerCase());
  if(!match)return {ok:false,error:'Use a whole number followed by s, m, h or d (for example 7m).'};
  const amount=Number(match[1]),unit=match[2];
  const seconds=amount*({s:1,m:60,h:3600,d:86400}[unit]);
  if(unit==='s'&&amount>=60)return {ok:false,error:'Seconds intervals must be from 1s to 59s. Use minutes for longer intervals.'};
  if(seconds>30*86400)return {ok:false,error:'Custom intervals cannot exceed 30 days.'};
  return {ok:true,value:amount+unit,seconds};
}
