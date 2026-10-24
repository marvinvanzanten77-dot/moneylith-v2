import {choiceLimitsKey, validateChoiceLimits, choiceProfile} from '../bank/choiceGuidance.js';
import type { FixedCostManualItem, MoneylithAccount, MoneylithTransaction } from '../types';
import type { CloudState } from '../storage/cloudState.js';
import { emptyBankRules, validateBankRules } from '../bank/classificationRules.js';
import { spendingRows, spendingSummary } from '../bank/spending.js';

export type Signal = {
  id: string; scope: 'personal'; kind: 'budget' | 'pace' | 'progress' | 'classification' | 'sync' | 'fuel';
  month: string; label: string; title: string; message: string;
  observedCents: number; referenceCents: number | null;
};
export type Notice = Signal & { createdAt: string; updatedAt: string; readAt: string | null; dismissedAt: string | null; active: boolean };
export type Preferences = { enabled: boolean; mutedLabels: string[] };
export type MonitoringState = { version: 1; fuel?: ReturnType<typeof import('../../server/fuel/prices').fuelOverview>; preferences: Preferences; notices: Notice[]; checkedAt: string | null; sourceRevision: string | null; sourceFetchedAt: string | null; status: string };
export const emptyMonitoring = (): MonitoringState => ({version:1,preferences:{enabled:true,mutedLabels:[]},notices:[],checkedAt:null,sourceRevision:null,sourceFetchedAt:null,status:'Nog niet gecontroleerd.'});
export function amsterdamDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=(name:string)=>parts.find(p=>p.type===name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const euros=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
function read<T>(state:CloudState,key:string,fallback:T):T { return state[key] ? JSON.parse(state[key]) as T : fallback; }
/** Read only the personal snapshot. No descriptions/account identifiers are retained in notifications. */
export function evaluateMonitoring(state:CloudState, preferences:Preferences, now:Date) {
  const asOf=amsterdamDate(now),month=asOf.slice(0,7);
  const rules=read(state,'moneylith.personal.bankRules.v1',emptyBankRules);
  const transactions=read<MoneylithTransaction[]>(state,'moneylith.personal.transactions',[]);
  const fixed=read<FixedCostManualItem[]>(state,'moneylith.personal.fixedCosts',[]);
  const accounts=read<MoneylithAccount[]>(state,'moneylith.personal.accounts',[]);
  if(!validateBankRules(rules)||!Array.isArray(transactions)||!Array.isArray(fixed)||!Array.isArray(accounts))throw Error('Ongeldige gegevens voor monitoring.');
  const selected=accounts.filter(a=>a.active!==false && a.bankProvider==='lunchflow' && rules.accountRoles[a.id]!=='business');
  const timestamps=selected.map(a=>a.bankLastSync).filter((s):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s)));
  const fetchedAt=timestamps.length===selected.length && timestamps.length ? timestamps.sort()[0]:null;
  const signals:Signal[]=[];
  if(!preferences.enabled)return {signals,fetchedAt,status:'Monitoring gepauzeerd.'};
  const scan=read<import('../bank/processSync.js').BankScan|null>(state,'moneylith.personal.bankScan.v1',null);
  if(scan&&typeof scan.id==='string'&&typeof scan.message==='string'&&Number.isFinite(Date.parse(scan.at))&&now.getTime()-Date.parse(scan.at)<2*86400000){
    signals.push({id:`personal:sync:${scan.id}`,scope:'personal',kind:'sync',month,label:'Bankcontrole',title:scan.failed?'Bankcontrole: aandacht nodig':'Bankcontrole uitgevoerd',message:scan.message,observedCents:0,referenceCents:null});
  }
  if(!fetchedAt || Date.parse(fetchedAt)>now.getTime()+300000 || now.getTime()-Date.parse(fetchedAt)>72*3600000)
    return {signals,fetchedAt,status:'Haal eerst recente bankgegevens op. Er worden nu geen nieuwe uitgavensignalen gemaakt.'};
  const ids=new Set(selected.map(a=>a.id));
  const storedLimits=read<unknown>(state,choiceLimitsKey,{});
  const limits=validateChoiceLimits(storedLimits)?storedLimits:{};
  const rows=spendingRows(transactions.filter(t=>ids.has(t.accountId)),rules,fixed);
  const summary=spendingSummary(rows,month,asOf);
  const add=(kind:Signal['kind'],label:string,title:string,message:string,observedCents:number,referenceCents:number|null,phase='')=>{
    if(!label.trim()||label.length>150||!Number.isSafeInteger(observedCents)||preferences.mutedLabels.includes(label))return;
    signals.push({id:`personal:${month}:${kind}:${encodeURIComponent(label)}${phase?":"+phase:""}`,scope:'personal',kind,month,label,title,message,observedCents,referenceCents});
  };
  for(const pot of summary.pots){
    if(Object.hasOwn(limits,pot.label)){
      const limit=limits[pot.label];
      if(pot.cents>limit)add('budget',pot.label,`${pot.label}: boven je keuzegrens`,`${euros(pot.cents)} uitgegeven bij een maandgrens van ${euros(limit)}. Ook een waardevolle aankoop moet financieel passen. ${choiceProfile(pot.label).tip}`,pot.cents,limit,'over');
      else if(limit>0&&pot.cents>=Math.ceil(limit*.8))add('budget',pot.label,`${pot.label}: je keuzegrens komt in zicht`,`${euros(pot.cents)} van ${euros(limit)} gebruikt. Binnen deze grens blijft ${euros(limit-pot.cents)} over; dit is geen bevestiging dat het betaalbaar is.`,pot.cents,limit,'near');
      continue;
    }
    const budgets=fixed.filter(f=>f.budgetCategory===pot.label&&f.paymentRoute!=='withheld'&&f.amountEntered!==false&&Number.isFinite(f.bedrag)&&f.bedrag>=0&&f.budgetSince&&f.budgetSince<=month);
    if(budgets.length>1)continue; // An ambiguous budget is not a reliable comparison.
    if(budgets.length===1){
      const budget=Math.round(budgets[0].bedrag*100);
      if(pot.cents>budget)add('budget',pot.label,`${pot.label}: boven je maandbudget`,`${euros(pot.cents)} aan waargenomen aankopen bij een budget van ${euros(budget)}. Wil je voor de rest van de maand een kleine keuze maken die ruimte geeft?`,pot.cents,budget);
      else if(budget>0&&pot.cents>=Math.ceil(budget*0.8))add('budget',pot.label,`${pot.label}: je budget komt in zicht`,`${euros(pot.cents)} van je maandbudget van ${euros(budget)} is gebruikt. Er blijft ${euros(budget-pot.cents)} binnen dit budget. Kies zelf waar je op wilt letten.`,pot.cents,budget);
      continue;
    }
    const previousCount=rows.filter(r=>r.label===pot.label&&r.date.startsWith(summary.previousMonth)&&Number(r.date.slice(8))<=summary.elapsedDay).length;
    if(pot.count<3||previousCount<3||pot.previousCents===null)continue;
    if(pot.cents-pot.previousCents>=2500 && pot.cents>=pot.previousCents*1.5)
      add('pace',pot.label,`${pot.label}: meer uitgegeven dan vorige maand`,`${euros(pot.cents)} waargenomen, tegenover ${euros(pot.previousCents)} vorige maand tot en met dag ${summary.elapsedDay}. Wil je bekijken welke aankopen je belangrijk vindt?`,pot.cents,pot.previousCents);
    else if(summary.elapsedDay>=21&&pot.previousCents-pot.cents>=2500&&pot.cents<=pot.previousCents*0.8)
      add('progress',pot.label,`${pot.label}: een moment om bij stil te staan`,`${euros(pot.cents)} waargenomen, tegenover ${euros(pot.previousCents)} vorige maand tot en met dag ${summary.elapsedDay}. Als dit past bij jouw keuzes, mag je daar even bij stilstaan. Dit is nog geen vastgestelde besparing.`,pot.cents,pot.previousCents);
  }
  if(summary.unknownCount>=3)add('classification','Nog in te delen','Maak je inzicht een stukje completer',`${summary.unknownCount} aankopen zijn nog niet ingedeeld. Je kunt ze bij Patronen samen indelen; zo worden volgende signalen gerichter.`,summary.unknownCents,null);
  return {signals,fetchedAt,status:'Gecontroleerd op opgeslagen bankgegevens. Historie en indeling kunnen onvolledig zijn; terugbetalingen zijn niet verrekend.'};
}
/** Stable monthly identity means polling, edits and repeat syncs never create a second alert. */
export function reconcileNotices(old:Notice[], signals:Signal[], now:string):Notice[]{
  const current=new Map(signals.map(s=>[s.id,s]));
  const merged=old.map(n=>{const signal=current.get(n.id);current.delete(n.id);return signal ? {...n,...signal,active:true,updatedAt:signal.message===n.message&&signal.title===n.title&&signal.observedCents===n.observedCents&&signal.referenceCents===n.referenceCents?n.updatedAt:now}:{...n,active:false};});
  for(const signal of current.values())merged.push({...signal,createdAt:now,updatedAt:now,readAt:null,dismissedAt:null,active:true});
  return merged.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).slice(0,200);
}
export class InvalidMonitoringAction extends Error {}
export type MonitoringAction = {action:'read'|'dismiss';id:string}|{action:'preferences';enabled:boolean;mutedLabels:string[]};
export function updateMonitoring(state:MonitoringState,value:unknown,now:string):MonitoringState{
  const a=value as MonitoringAction;
  if(!a||typeof a!=='object')throw new InvalidMonitoringAction('Ongeldige meldingsactie.');
  if(a.action==='preferences'){
    if(typeof a.enabled!=='boolean'||!Array.isArray(a.mutedLabels)||a.mutedLabels.length>100||a.mutedLabels.some(s=>typeof s!=='string'||!s.trim()||s.length>150))throw new InvalidMonitoringAction('Ongeldige voorkeuren.');
    return {...state,preferences:{enabled:a.enabled,mutedLabels:[...new Set(a.mutedLabels)]},sourceRevision:null};
  }
  if(!['read','dismiss'].includes(a.action)||typeof a.id!=='string'||!state.notices.some(n=>n.id===a.id))throw new InvalidMonitoringAction('Melding niet gevonden.');
  return {...state,notices:state.notices.map(n=>n.id===a.id?{...n,...(a.action==='read'?{readAt:n.readAt??now}:{dismissedAt:n.dismissedAt??now,readAt:n.readAt??now})}:n)};
}
