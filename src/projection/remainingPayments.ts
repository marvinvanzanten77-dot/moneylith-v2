import {returnedPayments} from '../bank/returnedPayments.js';
import type {MoneylithSnapshotDomain} from '../core/moneylithSnapshot.js';
import type {IncomeItem,FixedCostManualItem,FixedCostItem,SchuldItem,MoneylithTransaction,MoneylithAccount} from '../types.js';
import {makePeriodPlan,reconcilePeriod,salaryPeriod,periodBounds} from '../bank/periodReconciliation.js';
import {emptyBankRules,validateBankRules} from '../bank/classificationRules.js';
import {emptyDebtLedger,validateDebtLedger} from '../bank/debtPayments.js';
import {costForMonth} from '../logic/monthlyCosts.js';
import {addDays,monthlyDates,type Input,type Options} from './engine.js';
const list=<T>(v:unknown):T[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];
const euro=(c:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(c/100);
/** Reconcile commitments against booked evidence; never change source data or bank balances. */
export function remainingPayments(input:Input,data:MoneylithSnapshotDomain,options:Options){
 const fixed=list<FixedCostManualItem>(data.fixedCosts),detected=list<FixedCostItem>(data.detectedFixedCosts);
 const rules=validateBankRules(data.bankRules)?data.bankRules:emptyBankRules;
 const ledger=validateDebtLedger(data.debtPayments)?data.debtPayments:emptyDebtLedger();
 const period=salaryPeriod(input.asOf),bounds=periodBounds(period);
 const plan=makePeriodPlan(list<IncomeItem>(data.income),fixed,detected,list<SchuldItem>(data.debts),input.asOf);
 const paid=data.periodPaid&&typeof data.periodPaid==='object'?(data.periodPaid as Record<string,Record<string,number>>)[period]:undefined;
 const report=reconcilePeriod(period,input.asOf,plan,true,list<MoneylithTransaction>(data.transactions),ledger,rules,paid&&typeof paid==='object'?paid:{});
 const funding:Record<string,number>={card:0,cash:0};
 for(const move of report.cashMoves)funding[move.label==='Naar bunq'?'card':'cash']+=move.cents;
 for(const row of report.rows)if((row.route==='card'||row.route==='cash')&&!row.transactionIds.length)funding[row.route]=Math.max(0,funding[row.route]-(row.actual??0));
 const returned=returnedPayments(list<MoneylithTransaction>(data.transactions),rules,input.asOf,data.paymentResolutions);
 const pendingReturns=returned.filter(r=>r.status==='pending');
 const coveredReturns=new Set<string>();
 input.commitments=[];
 for(const row of report.rows.filter(r=>r.kind==='fixed'||r.kind==='debt')){
  const debt=row.kind==='debt'?list<SchuldItem>(data.debts).find(d=>'debt:'+d.id===row.id):undefined;
  if(row.kind==='debt'&&(!debt||debt.firstPaymentDate!==undefined||debt.remainingPayments!==undefined||!row.expected))continue;
  const raw=fixed.find(f=>'fixed:'+f.id===row.id);
  if(raw?.bankObservedOnly){
   input.assumptions.push(row.label+': alleen betaalde kosten bekend; toekomstige bedragen zijn nog niet ingepland.');
   // A dated unknown affects only horizons reaching that date. Credits are one-off purchases.
   if(raw.costKind!=='credits') {
    let nextDate:string|null=null;
    if(Number.isInteger(raw.dagVanMaand)&&raw.dagVanMaand>=1&&raw.dagVanMaand<=31){
      const dueMonth=raw.dagVanMaand>=23?bounds.start.slice(0,7):bounds.end.slice(0,7);
      const lastDay=new Date(Date.UTC(Number(dueMonth.slice(0,4)),Number(dueMonth.slice(5,7)),0)).getUTCDate();
      const due=dueMonth+'-'+String(Math.min(raw.dagVanMaand,lastDay)).padStart(2,'0');
      // An elapsed date is not proof of payment. An unpaid/uncertain overdue cost has no reliable date.
      nextDate=due>input.asOf?due:row.actual!==null&&!row.reversed?monthlyDates(input.asOf,raw.dagVanMaand)[0]??null:null;
    }
    input.events.push({id:row.id+':unknown-future',label:row.label+' — toekomstige kosten',date:nextDate??null,amount:null,source:'fixed',basis:'assumption'});
    input.commitments.push({label:row.label,expected:null,paid:row.actual,remaining:null,date:nextDate??null,note:'Toekomstig bedrag onbekend; alleen een opgegeven betaaldag wordt gebruikt. Een eerdere betaling bewijst geen volgende betaling.'});
   }
   continue;
  }
  const id=row.id.startsWith('detected:')?'fixed:'+row.id.slice(9):row.id;
  if(row.route==='withheld')continue;
  const matches=(event:Input['events'][number])=>event.id===id||event.id.startsWith(id+':');
  if(row.budget&&raw){
   input.events=input.events.filter(e=>!matches(e));
   let start=addDays(input.asOf,1);
   const horizon=addDays(input.asOf,365);
   while(start<=horizon){
    const p=salaryPeriod(start),end=periodBounds(p).end;
    const resolved=costForMonth(raw,p);
    const budget=resolved.amountEntered===false||(resolved.bedrag===0&&resolved.amountEntered!==true)||!Number.isFinite(resolved.bedrag)?null:Math.round(resolved.bedrag*100);
    const remaining=budget===null?null:Math.max(0,budget-(p===period?(row.actual??0):0));
    const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
    for(let n=0;n<days&&addDays(start,n)<=horizon;n++)input.events.push({id:id+':budget:'+addDays(start,n),label:row.label+' — resterend budget',date:addDays(start,n),amount:remaining===null?null:-(Math.floor(remaining/days)+(n<remaining%days?1:0)),source:'fixed',basis:'assumption'});
    start=addDays(end,1);
   }
   const left=row.expected===null?null:Math.max(0,row.expected-(row.actual??0));
   const elapsed=Math.round((Date.parse(input.asOf)-Date.parse(bounds.start))/86400000)+1;
   const duration=Math.round((Date.parse(bounds.end)-Date.parse(bounds.start))/86400000)+1;
   const txs=list<MoneylithTransaction>(data.transactions).filter(t=>(t.provider === 'lunchflow' || t.provider === 'bunq')&&t.date<=input.asOf&&rules.accountRoles[t.accountId]!=='business');
   const accountIds=list<MoneylithAccount>(data.accounts).filter(a=>a.active&&(a.bankProvider === 'lunchflow' || a.bankProvider === 'bunq')&&rules.accountRoles[a.id]!=='business').map(a=>a.id);
   const covered=accountIds.length>0&&accountIds.every(id=>txs.some(t=>t.accountId===id&&t.date<=bounds.start));
   const samples=row.transactionIds.length;
   const pace=covered&&samples>=3&&row.actual!==null&&elapsed>=7?Math.round(row.actual/elapsed*duration):null;
   input.commitments.push({label:row.label,expected:row.expected,paid:row.actual,remaining:left,date:bounds.end,note:pace!==null&&row.expected!==null&&pace>row.expected?`Indicatie op ${samples} betalingen over ${elapsed} dagen vanaf ${bounds.start}; bankhistorie kan onvolledig zijn. Bij hetzelfde uitgaventempo ongeveer ${euro(pace-row.expected)} boven budget; dit is een aanname en nog niet extra afgetrokken.`:`Resterend budget gelijkmatig verdeeld tot de 22ste; aankoopdagen zijn aannames. ${pace===null?'Nog onvoldoende periodehistorie voor een tempo-inschatting.':`Tempo-indicatie op ${samples} betalingen over ${elapsed} dagen; geen garantie voor de rest van de periode.`}`});
   continue;
  }
  // Only this salary period is reconciled. Later periods keep their configured amounts.
  input.events=input.events.filter(e=>!(matches(e)&&(e.date===null||e.date<=bounds.end)));
  const observed=detected.find(d=>'detected:'+d.id===row.id)?.lastDate;
  const day=debt?.afschrijfDag||raw?.dagVanMaand||(observed&&/^\d{4}-\d{2}-\d{2}$/.test(observed)?Number(observed.slice(8)):null)||options.monthlyDay;
  let date:string|null=null;
  if(day&&Number.isInteger(day)&&day>=1&&day<=31){
   const month=day>=23?bounds.start.slice(0,7):bounds.end.slice(0,7);
   const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
   date=month+'-'+String(Math.min(day,end)).padStart(2,'0');
  }
  let remaining=row.settlesOnPayment&&row.actual!==null&&!row.reversed?0:row.expected===null?null:Math.max(0,row.expected-(row.actual??0));
  const resolvedReturns=returned.filter(r=>r.debitId&&row.transactionIds.includes(r.debitId)&&(r.status==='repaid'||r.dueMonth));
  // A resolved/deferred reversal must not also remain as this period's unpaid bill.
  if(resolvedReturns.length&&remaining!==null)remaining=Math.max(0,remaining-resolvedReturns.reduce((sum,r)=>sum+r.cents,0));
  const rowReturns=pendingReturns.filter(r=>!r.dueMonth&&r.debitId&&row.transactionIds.includes(r.debitId));
  if(rowReturns.length){
   const reopened=rowReturns.reduce((sum,r)=>sum+r.cents,0);
   remaining=remaining===null?reopened:Math.max(remaining,reopened);
   rowReturns.forEach(r=>coveredReturns.add(r.id));
  }
  let funded=0;
  if(!rowReturns.length&&(row.route==='cash'||(row.route==='card'&&!list<MoneylithAccount>(data.accounts).some(a=>a.active&&a.bankProvider==='bunq'&&rules.accountRoles[a.id]!=='business')))&&remaining!==null){funded=Math.min(remaining,funding[row.route]);funding[row.route]-=funded;remaining-=funded;}
  const pending=remaining===null||remaining>0;
  const assumed=pending&&(!date||date<=input.asOf);
  if(assumed)date=addDays(input.asOf,1);
  const note=rowReturns.length?'Teruggedraaide incasso: opnieuw te betalen. De geplande datum is een aanname totdat een nieuwe betaaldatum bekend is.':funded>0?`${euro(funded)} al naar bunq/contant verplaatst; geen tweede bankuitgave. De betaling van deze post is daarmee niet bewezen. `+(assumed?'Resterende financiering voorlopig morgen gepland.':''):assumed?'Nog niet volledig via betaling herkend; voorlopig morgen ingepland, geen bevestigde incassodatum.':row.reversed?'Teruggeboekt: opnieuw als nog te betalen opgenomen.':'Alleen het nog niet herkende deel wordt verwacht; betaald geldt pas na sync of bevestiging.';
  if(pending)input.events.push({id:id+':remaining:'+period,label:row.label+(rowReturns.length?' — opnieuw te betalen':' — nog verwacht'),date,amount:remaining===null?null:-remaining,source:debt?'debt':'fixed',...(debt?{kind:'repayment' as const,debtId:debt.id}:{}),basis:!assumed&&raw?.monthlyAmounts!==undefined?'input':'assumption'});
  input.commitments.push({label:row.label,expected:row.expected,paid:row.actual,remaining,date,note});
 }
 for(const r of pendingReturns.filter(r=>!coveredReturns.has(r.id))){
  let date=r.dueMonth?r.dueMonth+'-'+String(new Date(Date.UTC(Number(r.dueMonth.slice(0,4)),Number(r.dueMonth.slice(5,7)),0)).getUTCDate()):addDays(input.asOf,1);
  if(date<=input.asOf)date=addDays(input.asOf,1);
  input.events.push({id:r.id,label:r.label+' — opnieuw te betalen',date,amount:-r.cents,source:'returned-payment',basis:'assumption'});
  input.commitments.push({label:r.label,expected:r.cents,paid:0,remaining:r.cents,date,note:(r.dueMonth?'Betaalmaand bevestigd: '+r.dueMonth+'. Laatste dag van de maand is een planningsaanname, geen afgesproken betaaldatum. ':'')+'Incasso teruggedraaid op '+r.date+'. Voorlopig morgen ingepland; dit is geen aangekondigde incassodatum. Een nieuwe betaling sluit deze post alleen bij een unieke factuurreferentie. Het schuldsaldo is niet automatisch gewijzigd.'});
 }
 for(const r of returned.filter(r=>r.status==='review'))input.missing.push(r.label+': terugboeking controleren; afhandeling nog niet vastgesteld');
 input.assumptions.push('De huidige salarisperiode loopt van '+bounds.start+' tot '+bounds.end+'. Reeds herkende betalingen zitten in het banksaldo en worden niet opnieuw afgetrokken. Nog niet herkende lasten blijven gepland; een verstreken datum bewijst geen betaling.','Budgetten voor dagelijkse uitgaven gebruiken alleen het resterende bedrag tot de 22ste. Hetzelfde uitgaventempo is een indicatie, geen bewezen extra uitgave. Zonder gekoppelde bunq-rekening blijven bunq-betalingen beperkt zichtbaar. Een top-up of contante opname bewijst geen betaling van een specifieke last. Bij gekoppelde bunq-rekeningen telt de werkelijke aankoop, niet de top-up.');
}
