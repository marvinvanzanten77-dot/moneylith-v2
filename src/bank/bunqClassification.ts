import type {FixedCostManualItem,MoneylithAccount,MoneylithTransaction} from '../types.js';
import type {BankRuleSettings} from './classificationRules.js';
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Only known own IBANs prove internal transfers. Amount/name similarity is insufficient. */
export function classifyBunq(transactions:MoneylithTransaction[],accounts:MoneylithAccount[],fixed:FixedCostManualItem[],rules:BankRuleSettings){
 const own=new Set(accounts.flatMap(a=>a.iban?[a.iban.replace(/\s/g,'').toUpperCase()]:[]));
 for(const r of rules.rules)if(r.enabled!==false&&r.kind==='transfer'&&r.counterpartyIban&&r.accountId&&accounts.some(a=>a.id===r.accountId))own.add(r.counterpartyIban);
 return transactions.map(t=>{
  if(t.provider!=='bunq')return t;
  const iban=t.providerData?.counterpartyIban?.replace(/\s/g,'').toUpperCase();
  const set=(kind:'transfer'|'fixed',label:string)=>({...t,bankPatternKind:kind,bankRuleLabel:label,bankPatternCategory:!t.category||t.category===t.bankPatternCategory?label:t.bankPatternCategory,category:!t.category||t.category===t.bankPatternCategory?label:t.category});
  if((iban&&own.has(iban))||t.providerData?.paymentSubType==='WITHDRAWAL')return set('transfer',t.providerData?.paymentSubType==='WITHDRAWAL'?'Contant opgenomen':'Eigen overboeking');
  if(t.amount>=0||t.bankPatternKind||rules.accountRoles[t.accountId]==='business')return t;
  // Only an existing named commitment can match. No invented subscriptions, prices or future credits.
  const party=norm(t.providerData?.counterparty??t.counterparty??''),description=' '+norm(t.providerData?.description??t.description)+' ';
  const matches=fixed.filter(f=>f.paymentRoute!=='withheld'&&f.paymentRoute!=='cash'&&!f.budgetCategory&&norm(f.naam).length>=4&&(party===norm(f.naam)||(f.costGroup==='work-tools'&&description.includes(' '+norm(f.naam)+' '))));
  return matches.length===1?set('fixed',matches[0].naam):t;
 });
}
