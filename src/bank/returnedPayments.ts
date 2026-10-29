import type {MoneylithTransaction} from '../types.js';
import type {BankRuleSettings} from './classificationRules.js';
import {findBankReversals} from './periodReconciliation.js';
export type ReturnedPayment={id:string;debitId:string|null;creditId:string;label:string;cents:number;date:string;status:'pending'|'repaid'|'review';replacementId?:string;dueMonth?:string;userConfirmed?:boolean};
export type PaymentResolution={id:string;returnedId:string;status:'paid'|'open';dueMonth?:string;note:string};
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'').trim();
const ref=(s:string)=>s.match(/(?:factuur(?:nummer)?|invoice|kenmerk|referentie|reference)\s*[:#-]?\s*([a-z0-9-]{4,})/i)?.[1]?.toLowerCase();
/** Derived bank evidence, not a second debt ledger. Retail refunds never create obligations. */
export function returnedPayments(transactions:MoneylithTransaction[],rules:BankRuleSettings,asOf:string,resolutions:unknown=[]):ReturnedPayment[]{
 const seen=new Set<string>();
 const all=transactions.map(t=>({...t,...t.providerData})).filter(t=>{
  if(seen.has(t.id)||!['bunq','lunchflow'].includes(t.provider??'')||t.currency!=='EUR'||rules.accountRoles[t.accountId]==='business'||!Number.isFinite(t.amount)||t.date>asOf||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||['transfer','ignore'].includes(t.bankPatternKind??''))return false;
  seen.add(t.id);return true;
 });
 const reversed=findBankReversals(all);
 const decisions=Array.isArray(resolutions)?resolutions as PaymentResolution[]:[];
 const directDebit=(t:MoneylithTransaction)=>t.providerData?.paymentSubType==='SDD'||/incasso|storno|terugboek/i.test(t.description);
 const usedDebits=new Set<string>(),usedReplacements=new Set<string>();
 return all.filter(t=>t.amount>0&&(
  (t.providerData?.paymentSubType==='REVERSAL'&&all.some(d=>d.amount<0&&d.accountId===t.accountId&&norm(d.counterparty??'')===norm(t.counterparty??'')&&Math.round(-d.amount*100)===Math.round(t.amount*100)&&d.date<=t.date&&directDebit(d)))||
  /storno|terugboeking|(?:incasso.*(?:terug|geweigerd)|terug.*incasso)/i.test(t.description)
 )).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(credit=>{
  const cents=Math.round(credit.amount*100),party=norm(credit.counterparty??'');
  const candidates=all.filter(t=>t.amount<0&&t.accountId===credit.accountId&&t.date<=credit.date&&Math.round(-t.amount*100)===cents&&party&&norm(t.counterparty??'')===party&&!usedDebits.has(t.id));
  const reference=ref(credit.description);
  const matching=reference?candidates.filter(d=>ref(d.description)===reference):candidates;
  const debit=matching.length===1?matching[0]:null;
  const base={id:'returned:'+credit.id,debitId:debit?.id??null,creditId:credit.id,label:credit.counterparty||'Teruggedraaide incasso',cents,date:credit.date};
  if(!debit)return {...base,status:'review' as const};
  usedDebits.add(debit.id);
  const debitReference=ref(debit.description);
  const retries=all.filter(t=>t.amount<0&&t.accountId===credit.accountId&&t.date>credit.date&&Math.round(-t.amount*100)===cents&&norm(t.counterparty??'')===party&&!reversed.reversedDebits.has(t.id)&&!reversed.uncertainDebits.has(t.id)&&!usedReplacements.has(t.id)&&!!debitReference&&ref(t.description)===debitReference);
  if(retries.length===1){usedReplacements.add(retries[0].id);return {...base,status:'repaid' as const,replacementId:retries[0].id};}
  // A generic bank refund does not prove the underlying invoice is still due.
  return {...base,status:(!/storno|incasso/i.test(credit.description)&&credit.providerData?.paymentSubType!=='REVERSAL'?'review':'pending') as ReturnedPayment['status']};
 }).map(row=>{const decision=decisions.find(d=>d.returnedId===row.id);return decision?.status==='paid'?{...row,status:'repaid',userConfirmed:true}:decision?.status==='open'?{...row,status:'pending',...(/^\d{4}-(0[1-9]|1[0-2])$/.test(decision.dueMonth??'')?{dueMonth:decision.dueMonth}:{}),userConfirmed:true}:row;});
}
