import type {IncomeItem, FixedCostManualItem, FixedCostItem, SchuldItem, MoneylithTransaction} from '../types.js';
import {costForMonth,costPlannedInMonth} from '../logic/monthlyCosts.js';
import {patternKey} from './patterns.js';
import type {DebtLedger} from './debtPayments.js';
import type {BankRuleSettings} from './classificationRules.js';
export const periodPlansKey='moneylith.personal.periodPlans.v1';
export const periodPaidKey='moneylith.personal.periodPaid.v1';
export type PeriodRow={id:string;label:string;kind:'income'|'fixed'|'debt';expected:number|null;costGroup?:'work-tools';budgetLabels?:string[];estimated?:boolean;settlesOnPayment?:boolean;route?:string;paymentFrom?:string;budget?:string;evidence?:{key:string;transactionIds:string[]};party?:string};
export type PeriodPlan={capturedAt:string;rows:PeriodRow[]};
export type PeriodPlans=Record<string,PeriodPlan>;
export type PeriodPaid=Record<string,Record<string,number>>;
const cents=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.round(v*100):null;
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function salaryPeriod(date:string){
 const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)throw Error('Ongeldige datum');
 if(d.getUTCDate()<23)d.setUTCMonth(d.getUTCMonth()-1,23);
 return d.toISOString().slice(0,7);
}
export function periodBounds(period:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Ongeldige salarisperiode');
 const d=new Date(period+'-23T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,22);
 return {start:period+'-23',end:d.toISOString().slice(0,10)};
}
export function makePeriodPlan(income:IncomeItem[],fixed:FixedCostManualItem[],detected:FixedCostItem[],debts:SchuldItem[],asOf:string):PeriodPlan{
 const period=salaryPeriod(asOf), active=detected.filter(i=>i.isFixed&&!i.isIgnored);
 const rows:PeriodRow[]=income.map(i=>({id:'income:'+i.id,label:i.naam,kind:'income',expected:i.amountEntered===false||(i.bedrag===0&&i.amountEntered!==true)?null:cents(i.bedrag),evidence:i.bankEvidence}));
 for(const raw of fixed.filter(i=>!active.length||i.paymentRoute||i.budgetCategory)){
  const month=raw.dagVanMaand>0&&raw.dagVanMaand<23?periodBounds(period).end.slice(0,7):period;
  if(!costPlannedInMonth(raw,month))continue;
  const i=costForMonth(raw,month);
  rows.push({id:'fixed:'+i.id,label:i.naam,kind:'fixed',expected:i.bankObservedOnly?null:i.amountEntered===false||(i.bedrag===0&&i.amountEntered!==true)?null:cents(i.bedrag),budgetLabels:i.bankBudgetLabels,estimated:i.bankEstimate?.months.includes(month),settlesOnPayment:i.bankEstimate?.months.includes(month)&&i.bankEstimate.settlesOnPayment,costGroup:i.costGroup,route:i.paymentRoute,paymentFrom:i.bankPaymentFrom,budget:i.budgetCategory,evidence:i.bankEvidence});
 }
 for(const i of active)rows.push({id:'detected:'+i.id,label:i.customLabel||i.descriptionPattern,kind:'fixed',expected:cents(i.customMonthlyAmount??i.estimatedMonthlyAmount),party:i.descriptionPattern});
 for(const d of debts)rows.push({id:'debt:'+d.id,label:d.naam,kind:'debt',expected:(d.saldo??d.openBedrag)===0?0:cents(d.minimaleMaandlast??d.minBetaling)??0});
 return {capturedAt:asOf,rows};
}
export function capturePeriodPlan(plans:PeriodPlans,plan:PeriodPlan,asOf:string):PeriodPlans{
 const period=salaryPeriod(asOf);return plans[period]?plans:{...plans,[period]:plan};
}
export type ReconciledRow=PeriodRow & {actual:number|null;forecast:number|null;difference:number|null;status:string;transactionIds:string[];reversed:boolean};
/** Derived from booked transactions and saved expectations. Never mutates a balance or transaction. */
export function reconcilePeriod(period:string,asOf:string,plan:PeriodPlan,hasSavedPlan:boolean,transactions:MoneylithTransaction[],ledger:DebtLedger,rules:BankRuleSettings,manual:Record<string,number>={}){
 const {start,end}=periodBounds(period),through=end<asOf?end:asOf,closed=end<asOf;
 const seen=new Set<string>();
 const all=transactions.filter(t=>{
  if(seen.has(t.id)||(t.provider !== 'lunchflow' && t.provider !== 'bunq')||t.currency!=='EUR'||!Number.isFinite(t.amount)||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!Number.isFinite(Date.parse(t.date))||new Date(t.date).toISOString().slice(0,10)!==t.date||t.date>asOf||rules.accountRoles[t.accountId]==='business')return false;
  seen.add(t.id);return true;
 });
 const booked=all.filter(t=>t.date>=start&&t.date<=through);
 const assigned=new Set<string>(),ambiguous=new Set<string>();
 const amounts=new Map<string,number>();
 const matches=new Map<string,string[]>();
 const reversed=new Set<string>();
 const reversals=new Set<string>();
 // Only explicit reversal/refund text plus same account, counterparty and amount establishes an offset.
 const {reversedDebits,credits,uncertainDebits}=findBankReversals(all);
 for(const id of credits)reversals.add(id);
 const ledgerTx=new Map(ledger.entries.map(e=>[e.transactionId,e]));
 for(const t of all.filter(t=>booked.includes(t)||[...(ledgerTx.get(t.id)?.allocations??[]),...(ledgerTx.get(t.id)?.fixedAllocations??[])].some(a=>a.period===period))){
  if(reversals.has(t.id))continue;
  const payment=ledgerTx.get(t.id);
  if(payment){
   assigned.add(t.id);
   for(const a of payment.allocations){if((a.period??salaryPeriod(payment.date))!==period)continue;const id='debt:'+a.debtId;matches.set(id,[...(matches.get(id)??[]),t.id]);if(reversedDebits.has(t.id))reversed.add(id);else amounts.set(id,(amounts.get(id)??0)+a.cents);}
   for(const a of payment.fixedAllocations??[]){if((a.period??salaryPeriod(payment.date))!==period)continue;const id='fixed:'+a.fixedId;matches.set(id,[...(matches.get(id)??[]),t.id]);if(reversedDebits.has(t.id))reversed.add(id);else amounts.set(id,(amounts.get(id)??0)+a.cents);}
   continue;
  }
  if(['transfer','financing','ignore'].includes(t.bankPatternKind??''))continue;
  const candidates=plan.rows.filter(r=>{
   if(r.kind==='debt'||r.route==='withheld'||r.route==='cash'||(r.kind==='income')!==(t.amount>0))return false;
   if(r.paymentFrom&&/^\d{4}-\d{2}-\d{2}$/.test(r.paymentFrom)&&Number.isFinite(Date.parse(r.paymentFrom))&&new Date(r.paymentFrom).toISOString().slice(0,10)===r.paymentFrom&&period>=salaryPeriod(r.paymentFrom)&&t.date<r.paymentFrom)return false;
   if(r.budgetLabels)return t.bankPatternKind==='fixed'&&r.budgetLabels.some(label=>norm(label)===norm(t.bankRuleLabel??t.category??''));
   if(r.budget)return norm(r.budget)===norm(t.bankRuleLabel??t.category??'');
   const explicitlyLinked=t.bankPatternKind==='fixed'&&norm(r.label)===norm(t.bankRuleLabel??t.category??'');
   if(explicitlyLinked)return true;
   // Card is the usual route, not proof of an invisible card payment. Only an
   // explicitly named bank group can identify an alternative direct bank payment.
   if(r.route==='card')return false;
   if(r.evidence){
    if(r.evidence.transactionIds.includes(t.id)||r.evidence.key===patternKey(t))return true;
    const anchors=all.filter(a=>r.evidence!.transactionIds.includes(a.id));
    const identities=new Set(anchors.map(a=>a.accountId+'|'+norm(a.providerData?.counterparty??a.counterparty??'')+'|'+(a.bankRuleId??'')));
    return identities.size===1&&norm(t.counterparty??'')!==''&&!/^(mollie|paypal|adyen|stripe|sumup|tikkie)\b/i.test(t.counterparty??'')&&identities.has(t.accountId+'|'+norm(t.providerData?.counterparty??t.counterparty??'')+'|'+(t.bankRuleId??''));
   }
   return (!!r.party&&norm(r.party)===norm(t.counterparty??'')) || (t.bankPatternKind==='fixed'&&norm(r.label)===norm(t.bankRuleLabel??t.category??''));
  });
  if(candidates.length>1){ambiguous.add(t.id);continue;}
  if(!candidates.length)continue;
  const r=candidates[0];assigned.add(t.id);matches.set(r.id,[...(matches.get(r.id)??[]),t.id]);
  if(reversedDebits.has(t.id)){reversed.add(r.id);continue;}
  amounts.set(r.id,(amounts.get(r.id)??0)+Math.abs(Math.round(t.amount*100)));
 }
 const rows:ReconciledRow[]=plan.rows.map(r=>{
  const ids=matches.get(r.id)??[],isReversed=reversed.has(r.id);
  const uncertain=ids.some(id=>uncertainDebits.has(id));
  const confirmed=Number.isSafeInteger(manual[r.id])&&manual[r.id]>=0?manual[r.id]:null;
  const actual=uncertain?null:ids.length?(amounts.get(r.id)??0):confirmed??(r.kind==='debt'&&hasSavedPlan&&r.expected===0?0:null);
  const expected=hasSavedPlan?r.expected:null;
  const forecast=r.route==='withheld'?0:closed?actual:r.settlesOnPayment&&actual!==null&&!isReversed?actual:(r.budget||r.kind==='fixed')?(expected===null?null:Math.max(expected,actual??0)):actual!==null&&!isReversed?actual:expected;
  const status=uncertain?'Mogelijke terugboeking — controleren':r.route==='withheld'?'Al ingehouden; geen tweede afschrijving':isReversed?'Teruggeboekt — controleren':ids.length?'Via bank herkend':confirmed!==null?'Zelf bevestigd':r.kind==='debt'&&expected===0?'Geen aflossing ingepland':r.route==='card'?'Bunq/card: betaling nog bevestigen':r.route==='cash'?'Contant: betaling nog bevestigen':closed?'Geen betaling herkend':r.estimated?'Voorlopige schatting uit eerdere perioden':'Nog verwacht / niet herkend';
  return {...r,expected,actual,forecast,difference:actual!==null&&expected!==null?actual-expected:null,status,transactionIds:ids,reversed:isReversed};
 });
 const sum=(kind:'income'|'fixed'|'debt',field:'actual'|'expected'|'forecast')=>{
  const rs=rows.filter(r=>r.kind===kind&&r.route!=='withheld');
  return !rs.length?(kind==='debt'&&hasSavedPlan?0:null):rs.some(r=>r[field]===null)?null:rs.reduce((s,r)=>s+r[field]!,0);
 };
 const total=(field:'actual'|'expected'|'forecast')=>({income:sum('income',field),fixed:sum('fixed',field),debt:sum('debt',field)});
 const cashMoves=booked.filter(t=>t.amount<0&&(/\bbunq\b/i.test((t.counterparty??'')+' '+t.description)||/geldopname|geldautomaat|cash withdrawal|\batm\b/i.test(t.description)));
 const residual=booked.flatMap(t=>{const p=ledgerTx.get(t.id);const left=p?p.paidCents-p.allocations.reduce((n,a)=>n+a.cents,0)-(p.fixedAllocations??[]).reduce((n,a)=>n+a.cents,0):0;return left>0?[{...t,amount:-left/100}]:[];});
 const other=[...residual,...booked.filter(t=>!assigned.has(t.id)&&!reversals.has(t.id)&&!cashMoves.some(c=>c.id===t.id)&&!['transfer','ignore'].includes(t.bankPatternKind??''))];
 return {period,start,end,through,closed,rows,expected:total('expected'),actual:total('actual'),forecast:total('forecast'),hasSavedPlan,capturedAt:hasSavedPlan?plan.capturedAt:null,
  checkWindow:Number(asOf.slice(8))>=23||Number(asOf.slice(8))<=7,
  observedIn:booked.filter(t=>t.amount>0).reduce((s,t)=>s+Math.round(t.amount*100),0),observedOut:booked.filter(t=>t.amount<0).reduce((s,t)=>s-Math.round(t.amount*100),0),
  cashMoves:cashMoves.map(t=>({id:t.id,date:t.date,cents:Math.round(-t.amount*100),label:/bunq/i.test((t.counterparty??'')+' '+t.description)?'Naar bunq':'Contant opgenomen'})),
  unmatched:other.map(t=>({id:t.id,date:t.date,cents:Math.round(t.amount*100),label:t.counterparty||'Onbekende tegenpartij',ambiguous:ambiguous.has(t.id),partlyAllocated:ledgerTx.has(t.id)})),
  earliest:all.map(t=>t.date).sort()[0]??null};
}

export function findBankReversals(all:MoneylithTransaction[]){
 const reversals=new Set<string>();
 const uncertainDebits=new Set<string>();
 all=all.map(t=>({...t,amount:t.providerData?.amount??t.amount,date:t.providerData?.date??t.date,counterparty:t.providerData?.counterparty??t.counterparty,description:t.providerData?.description??t.description}));
 const reversedDebits=new Set<string>();
 for(const credit of all.filter(t=>t.amount>0&&(t.providerData?.paymentSubType==='REVERSAL'||(t.provider==='bunq'&&t.providerData?.paymentSubType==='SDD')||/terugboek|storno|restitutie|refund/i.test(t.providerData?.description??t.description))).sort((a,b)=>a.date.localeCompare(b.date))){
  const candidates=all.filter(t=>t.amount<0&&t.accountId===credit.accountId&&t.date<=credit.date&&Math.round(-t.amount*100)===Math.round(credit.amount*100)&&norm(t.counterparty??'')!==''&&norm(t.counterparty??'')===norm(credit.counterparty??'')&&!reversedDebits.has(t.id)).sort((a,b)=>b.date.localeCompare(a.date));
  const explicit=credit.providerData?.paymentSubType==='REVERSAL'||/terugboek|storno|restitutie|refund/i.test(credit.description);
  if(candidates.length===1&&explicit){reversedDebits.add(candidates[0].id);reversals.add(credit.id);}else if(candidates.length>0){for(const c of candidates)uncertainDebits.add(c.id);}
 }
 return {reversedDebits,credits:reversals,uncertainDebits};
}

/** Refresh editable work costs only in the open period; historical snapshots stay intact. */
export function refreshWorkCostPlan(saved:PeriodPlan,latest:PeriodPlan):PeriodPlan {
 const work=latest.rows.filter(r=>r.costGroup==='work-tools'||r.id.startsWith('fixed:bunq-observed:'));
 const ids=new Set(work.map(r=>r.id));
 const rows=[...saved.rows.filter(r=>r.costGroup!=='work-tools'&&!r.id.startsWith('fixed:bunq-observed:')&&!ids.has(r.id)),...work];
 return JSON.stringify(rows)===JSON.stringify(saved.rows)?saved:{...saved,rows};
}
