import {findBankReversals} from "./periodReconciliation.js";
import type {SchuldItem,MoneylithTransaction} from '../types.js';
export const debtLedgerKey='moneylith.personal.debtPayments.v1';
export type RepaymentRule={enabled:boolean;counterparty:string;reference:string;fromDate:string;accountId?:string};
export type DebtPayment={transactionId:string;accountId:string;date:string;paidCents:number;allocations:{debtId:string;cents:number;period?:string}[];fixedAllocations?:{fixedId:string;cents:number;period?:string}[];source:'confirmed'|'automatic'};
export type PaymentAudit={id:string;at:string;transactionId:string;beforeEntry?:DebtPayment;afterEntry:DebtPayment;beforeDebts:SchuldItem[];afterDebts:SchuldItem[];undoneAt?:string};
export type DebtLedger={version:1;entries:DebtPayment[];history?:PaymentAudit[];ignoredTransactionIds?:string[]};
export const emptyDebtLedger=():DebtLedger=>({version:1,entries:[]});
const cents=(n:number|undefined)=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*100):NaN;
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const validDate=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function validateDebtLedger(value:unknown):value is DebtLedger{
 const v=value as DebtLedger;
 return !!v&&v.version===1&&(v.ignoredTransactionIds===undefined||(Array.isArray(v.ignoredTransactionIds)&&v.ignoredTransactionIds.every(id=>typeof id==='string')))&&(v.history===undefined||(Array.isArray(v.history)&&v.history.every(a=>a&&typeof a.id==='string'&&typeof a.transactionId==='string'&&Number.isFinite(Date.parse(a.at))&&Array.isArray(a.beforeDebts)&&Array.isArray(a.afterDebts)&&validateDebtLedger({version:1,entries:[a.afterEntry]})&&(!a.beforeEntry||validateDebtLedger({version:1,entries:[a.beforeEntry]}))&&(a.undoneAt===undefined||Number.isFinite(Date.parse(a.undoneAt))))))&&Array.isArray(v.entries)&&new Set(v.entries.map(e=>e?.transactionId)).size===v.entries.length&&v.entries.every(e=>e&&typeof e.transactionId==='string'&&!!e.transactionId&&typeof e.accountId==='string'&&validDate(e.date)&&Number.isSafeInteger(e.paidCents)&&e.paidCents>0&&['confirmed','automatic'].includes(e.source)&&Array.isArray(e.allocations)&&(e.allocations.length>0||(e.fixedAllocations?.length??0)>0)&&new Set(e.allocations.map(a=>a?.debtId)).size===e.allocations.length&&e.allocations.every(a=>a&&typeof a.debtId==='string'&&Number.isSafeInteger(a.cents)&&a.cents>0&&(a.period===undefined||/^\d{4}-(0[1-9]|1[0-2])$/.test(a.period)))&&(e.fixedAllocations===undefined||(Array.isArray(e.fixedAllocations)&&new Set(e.fixedAllocations.map(a=>a?.fixedId)).size===e.fixedAllocations.length&&e.fixedAllocations.every(a=>a&&typeof a.fixedId==='string'&&!!a.fixedId&&Number.isSafeInteger(a.cents)&&a.cents>0&&(a.period===undefined||/^\d{4}-(0[1-9]|1[0-2])$/.test(a.period)))))&&e.allocations.reduce((n,a)=>n+a.cents,0)+(e.fixedAllocations??[]).reduce((n,a)=>n+a.cents,0)<=e.paidCents);
}
/** References are explicit opt-in. A scheduled date or creditor name alone never establishes payment. */
export function reconcileDebtPayments(debts:SchuldItem[],transactions:MoneylithTransaction[],ledger:DebtLedger,asOf:string,businessAccountIds:string[]=[]){
 if(!validDate(asOf)||!validateDebtLedger(ledger))throw Error('Ongeldige aflossingsadministratie.');
 let next=structuredClone(debts);const entries=structuredClone(ledger.entries),questions:{transactionId:string;date:string;reason:string}[]=[];
 const reversalCheck=findBankReversals(transactions.filter(t=>t.provider==='lunchflow'&&t.currency==='EUR'&&t.date<=asOf&&!businessAccountIds.includes(t.accountId)));
 const reversed=reversalCheck.reversedDebits;
 const history=structuredClone(ledger.history??[]);
 const apply=(payment:DebtPayment)=>{const ids=new Set(payment.allocations.map(a=>a.debtId));const beforeDebts=structuredClone(next.filter(d=>ids.has(d.id)));next=applyConfirmedDebtPayment(next,payment);history.push({id:crypto.randomUUID(),at:new Date().toISOString(),transactionId:payment.transactionId,afterEntry:structuredClone(payment),beforeDebts,afterDebts:structuredClone(next.filter(d=>ids.has(d.id)))});};
 let applied=0,appliedCents=0;
 const seen=new Set<string>();
 for(const tx of transactions.map(t=>({...t,amount:t.providerData?.amount??t.amount,date:t.providerData?.date??t.date})).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){
  if(seen.has(tx.id))continue;seen.add(tx.id);
  const old=entries.find(e=>e.transactionId===tx.id);
  if(!old&&ledger.ignoredTransactionIds?.includes(tx.id))continue;
  if(reversalCheck.uncertainDebits.has(tx.id)){questions.push({transactionId:tx.id,date:tx.date,reason:'Mogelijke terugboeking bij deze aflossing; controleer de bankbetaling. Er is niets automatisch gewijzigd.'});continue;}
  if(old){if(reversed.has(tx.id)){questions.push({transactionId:tx.id,date:tx.date,reason:'Een verwerkte aflossing is teruggeboekt. Controleer het schuldsaldo; de eerdere afboeking is niet automatisch teruggedraaid.'});continue;}if(cents(tx.amount)!==-old.paidCents||tx.date!==old.date||tx.accountId!==old.accountId)questions.push({transactionId:tx.id,date:tx.date,reason:'Een eerder verwerkte betaling is gewijzigd. Controleer de aflossing; er is niets opnieuw afgeboekt.'});continue;}
  if(tx.provider!=='lunchflow'||tx.currency!=='EUR'||!validDate(tx.date)||tx.date>asOf||cents(tx.amount)>=0||!Number.isSafeInteger(cents(tx.amount))||businessAccountIds.includes(tx.accountId)||['transfer','fixed','ignore'].includes(tx.bankPatternKind??''))continue;
  if(reversed.has(tx.id))continue;
  const party=normalize(tx.providerData?.counterparty??tx.counterparty??'');
  const related=next.filter(d=>{const r=d.bankRepayment;return r?.enabled&&normalize(r.counterparty)===party&&!!party&&(!r.accountId||r.accountId===tx.accountId)&&validDate(r.fromDate)&&tx.date>=r.fromDate&&cents(d.saldo??d.openBedrag)>0;});
  if(!related.length)continue;
  const text=' '+normalize(tx.providerData?.description??tx.description)+' ';
  const matched=related.filter(d=>normalize(d.bankRepayment!.reference).length>=8&&text.includes(' '+normalize(d.bankRepayment!.reference)+' '));
  const question=(reason:string)=>questions.push({transactionId:tx.id,date:tx.date,reason});
  // Small informal transfers do not need a new question unless an explicit debt reference was used.
  if(!matched.length){if(related.some(d=>cents(d.minimaleMaandlast??d.minBetaling)>0&&-cents(tx.amount)>=cents(d.minimaleMaandlast??d.minBetaling)))question('Betaling aan een gekoppelde schuldeiser zonder unieke aflossingsomschrijving. Controleer de verdeling bij Schulden.');continue;}
  if(new Set(matched.map(d=>normalize(d.bankRepayment!.reference))).size!==matched.length){question('Dezelfde aflossingsomschrijving is aan meerdere schulden gekoppeld. Maak de omschrijvingen uniek.');continue;}
  if(matched.length===1&&matched[0].firstPaymentDate===undefined&&matched[0].remainingPayments===undefined){
    const d=matched[0],paid=-cents(tx.amount);
    if(paid>cents(d.saldo??d.openBedrag)){question('Betaling is hoger dan de openstaande schuld. Controleer kosten en verdeling; er is niets afgeboekt.');continue;}
    const payment:DebtPayment={transactionId:tx.id,accountId:tx.accountId,date:tx.date,paidCents:paid,allocations:[{debtId:d.id,cents:paid}],source:'automatic'};
    apply(payment);entries.push(payment);applied++;appliedCents+=paid;continue;
  }
  if(matched.some(d=>!validDate(d.firstPaymentDate)||!Number.isInteger(d.remainingPayments)||d.remainingPayments!<1||d.firstPaymentDate.slice(0,7)!==tx.date.slice(0,7)||!(cents(d.minimaleMaandlast??d.minBetaling)>0))){question('De betaling past niet bij het resterende maandelijkse aflosschema. Controleer de schuld; er is niets afgeboekt.');continue;}
  const allocations=matched.map(d=>({debtId:d.id,cents:Math.min(cents(d.saldo??d.openBedrag),cents(d.minimaleMaandlast??d.minBetaling))}));
  if(allocations.reduce((n,a)=>n+a.cents,0)>-cents(tx.amount)){question('Het bankbedrag is kleiner dan de gekoppelde maandaflossingen. Controleer de verdeling; er is niets afgeboekt.');continue;}
  const payment:DebtPayment={transactionId:tx.id,accountId:tx.accountId,date:tx.date,paidCents:-cents(tx.amount),allocations,source:'automatic'};
  apply(payment);entries.push(payment);applied+=allocations.length;appliedCents+=allocations.reduce((n,a)=>n+a.cents,0);
 }
 return {debts:next,ledger:{...ledger,version:1 as const,entries,...(history.length?{history}:{})},questions,applied,appliedCents};
}
/** Apply an explicitly allocated principal payment. Does not touch cash, income or bank transactions. */
export function applyConfirmedDebtPayment(debts:SchuldItem[],payment:DebtPayment):SchuldItem[]{
 if(!validateDebtLedger({version:1,entries:[payment]}))throw Error('Ongeldige aflossing.');
 for(const a of payment.allocations){const d=debts.find(d=>d.id===a.debtId);if(!d||!Number.isSafeInteger(cents(d.saldo??d.openBedrag))||cents(d.saldo??d.openBedrag)<a.cents)throw Error('Aflossing past niet bij het schuldsaldo.');}
 return debts.map(d=>{
  const a=payment.allocations.find(a=>a.debtId===d.id);if(!a)return d;
  const balance=(cents(d.saldo??d.openBedrag)-a.cents)/100;
  const next={...d,saldo:balance,openBedrag:balance};
  if(balance===0){next.minBetaling=0;next.minimaleMaandlast=0;delete next.remainingPayments;delete next.firstPaymentDate;}
  else if(validDate(d.firstPaymentDate)&&Number.isInteger(d.remainingPayments)&&d.remainingPayments!>0&&a.cents>=cents(d.minimaleMaandlast??d.minBetaling)){
   const remaining=d.remainingPayments!-1;
   if(remaining>0){const date=new Date(d.firstPaymentDate+'T00:00:00Z'),y=date.getUTCFullYear(),m=date.getUTCMonth()+1,day=d.afschrijfDag||date.getUTCDate();next.firstPaymentDate=new Date(Date.UTC(y,m,Math.min(day,new Date(Date.UTC(y,m+1,0)).getUTCDate()))).toISOString().slice(0,10);next.remainingPayments=remaining;}
   else{delete next.remainingPayments;delete next.firstPaymentDate;}
  }
  return next;
 });
}

/** User-confirmed allocation; a second click or duplicate debt allocation cannot reduce a balance again. */
export function confirmDebtAllocation(debts:SchuldItem[],transaction:MoneylithTransaction,ledger:DebtLedger,debtId:string,allocationCents:number){
 if(!validateDebtLedger(ledger)||transaction.provider!=='lunchflow'||transaction.currency!=='EUR'||!Number.isSafeInteger(allocationCents)||allocationCents<=0)throw Error('Ongeldige aflossing.');
 const paid=-cents(transaction.providerData?.amount??transaction.amount),date=transaction.providerData?.date??transaction.date;
 if(!Number.isSafeInteger(paid)||paid<=0||!validDate(date))throw Error('Kies een geboekte uitgaande betaling.');
 const existing=ledger.entries.find(e=>e.transactionId===transaction.id);
 if(existing&&(existing.paidCents!==paid||existing.accountId!==transaction.accountId||existing.date!==date))throw Error('De bankbetaling is gewijzigd; controleer de bestaande verdeling.');
 if(existing?.allocations.some(a=>a.debtId===debtId))throw Error('Deze betaling is al op deze schuld verwerkt.');
 const allocations=[...(existing?.allocations??[]),{debtId,cents:allocationCents}];
 if(allocations.reduce((n,a)=>n+a.cents,0)+(existing?.fixedAllocations??[]).reduce((n,a)=>n+a.cents,0)>paid)throw Error('De verdeling is hoger dan de bankbetaling.');
 const payment:DebtPayment={transactionId:transaction.id,accountId:transaction.accountId,date,paidCents:paid,allocations,...(existing?.fixedAllocations?{fixedAllocations:existing.fixedAllocations}:{}),source:'confirmed'};
 const next=applyConfirmedDebtPayment(debts,{...payment,allocations:[{debtId,cents:allocationCents}]});
 return {debts:next,ledger:{...ledger,version:1 as const,entries:[...ledger.entries.filter(e=>e.transactionId!==transaction.id),payment]}};
}
