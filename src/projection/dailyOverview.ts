import {salaryPeriod} from "../bank/periodReconciliation";
import {addDays, missingThrough, project, type Input, type Event} from './engine';
/** Read-only view of the projection, never a stored balance or a bank mutation. */
export function dailyOverview(input: Input) {
 const result=project(input);
 const nextReceipt=result.events.find(e=>e.date&&e.date>input.asOf&&e.amount!==null&&e.amount>0&&e.kind!=='reserve');
 const until=nextReceipt?.date?addDays(nextReceipt.date,-1):addDays(input.asOf,30);
 const missing=missingThrough(input,until);
 const initial=input.opening===null||input.reserve===null?null:input.opening-input.reserve;
 const days=result.timeline.filter(d=>d.date<=until);
 const available=initial===null||missing.length||days.some(d=>d.available===null)?null:Math.min(initial,...days.map(d=>d.available!));
 const knownCash=[{date:input.asOf,cash:input.opening},...days].filter((d):d is {date:string;cash:number}=>d.cash!==null);
 const lowest=knownCash.reduce<{date:string;cash:number}|null>((a,b)=>!a||b.cash<a.cash?b:a,null);
 // Group synthetic daily budget allocations into one period entry.
 const grouped=new Map<string,Event>();
 for(const event of result.events.filter(e=>(e.date===null||e.date>input.asOf&&e.date<=addDays(input.asOf,30))&&e.amount!==0)) {
  const budget=event.id.includes(':budget:');
  const key=budget?event.id.split(':budget:')[0]+':'+salaryPeriod(event.date!):event.id;
  const old=grouped.get(key);
  grouped.set(key,old?{...old,date:event.date,amount:old.amount===null||event.amount===null?null:old.amount+event.amount}:{...event});
 }
 const events=[...grouped.values()].sort((a,b)=>(a.date??"9999").localeCompare(b.date??"9999"));
 return {until,available,missing,nextReceipt,lowest,cashComplete:days.every(d=>d.cash!==null),incoming:events.filter(e=>e.amount!==null&&e.amount>0&&e.kind!=='reserve'),outgoing:events.filter(e=>e.amount===null||e.amount<0||e.kind==='reserve')};
}
