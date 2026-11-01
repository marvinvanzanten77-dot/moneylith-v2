import type {reconcilePeriod} from '../bank/periodReconciliation';
import {reviewedPeriodForecast} from '../logic/periodRoom';

/** Display known subtotals without altering reconciliation or inventing missing amounts. */
export function planningSummary(report:ReturnType<typeof reconcilePeriod>,readiness?:{income:boolean;fixed:boolean},previousReviews?:{income?:string|null;fixed?:string|null}) {
 const totals=reviewedPeriodForecast(report,readiness);
 const rows=report.rows.filter(r=>r.route!=='withheld');
 const subtotal=(kind:'income'|'fixed'|'debt')=>{
  if(totals[kind]!==null)return totals[kind];
  const known=rows.filter(r=>r.kind===kind&&r.forecast!==null);
  return known.length?known.reduce((sum,r)=>sum+r.forecast!,0):null;
 };
 const income=subtotal('income'),fixed=subtotal('fixed'),debt=subtotal('debt');
 const costs=[fixed,debt].filter((n):n is number=>n!==null);
 // A known zero debt payment alone does not establish an unknown fixed-cost section.
 const out=fixed===null&&totals.fixed===null&&debt===0?null:costs.length?costs.reduce((sum,n)=>sum+n,0):null;
 const issues=rows.filter(r=>r.forecast===null).map(r=>({id:r.id,label:r.label,reason:report.closed?'Geen volledig betaald bedrag bekend voor deze periode':'Geen bedrag of schatting beschikbaar voor deze periode'}));
 for(const kind of ['income','fixed','debt'] as const)if(totals[kind]===null&&!rows.some(r=>r.kind===kind))issues.push({id:kind,label:{income:'Inkomsten',fixed:'Vaste lasten',debt:'Aflossingen'}[kind],reason:'Geen volledig overzicht beschikbaar voor deze periode'});
 if(readiness&&!readiness.income)issues.push({id:'review-income',label:'Inkomsten',reason:previousReviews?.income?'Eerder bevestigd; de huidige gegevens of maand wijken af. Controleer opnieuw.':'Volledigheid nog niet bevestigd'});
 if(readiness&&!readiness.fixed)issues.push({id:'review-fixed',label:'Vaste lasten',reason:previousReviews?.fixed?'Eerder bevestigd; de huidige gegevens of maand wijken af. Controleer opnieuw.':'Volledigheid nog niet bevestigd'});
 return {income,out,remaining:income===null||out===null?null:income-out,partial:issues.length>0,issues};
}
