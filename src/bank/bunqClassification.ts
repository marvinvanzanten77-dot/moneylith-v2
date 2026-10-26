import type {FixedCostManualItem,MoneylithAccount,MoneylithTransaction} from '../types.js';
import {patternKey,type PatternDecisions} from './patterns.js';
import type {BankRuleSettings} from './classificationRules.js';
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Only known own IBANs prove internal transfers. Amount/name similarity is insufficient. */
export function classifyBunq(transactions:MoneylithTransaction[],accounts:MoneylithAccount[],fixed:FixedCostManualItem[],rules:BankRuleSettings,decisions:PatternDecisions={}){
 const own=new Set(accounts.flatMap(a=>a.iban?[a.iban.replace(/\s/g,'').toUpperCase()]:[]));
 for(const r of rules.rules)if(r.enabled!==false&&r.kind==='transfer'&&r.counterpartyIban&&r.accountId&&accounts.some(a=>a.id===r.accountId))own.add(r.counterpartyIban);
 return transactions.map(t=>{
  if(t.provider!=='bunq'||rules.accountRoles[t.accountId]==='business')return t;
  if(decisions['transaction:'+t.id]||decisions[patternKey(t)]||decisions[patternKey({...t,bankRuleId:undefined})])return t;
  const iban=t.providerData?.counterpartyIban?.replace(/\s/g,'').toUpperCase();
  const set=(kind:'transfer'|'fixed',label:string)=>({...t,bankPatternKind:kind,bankRuleLabel:label,bankPatternCategory:!t.category||t.category===t.bankPatternCategory?label:t.bankPatternCategory,category:!t.category||t.category===t.bankPatternCategory?label:t.category});
  if((iban&&own.has(iban))||t.providerData?.paymentSubType==='WITHDRAWAL')return set('transfer',t.providerData?.paymentSubType==='WITHDRAWAL'?'Contant opgenomen':'Eigen overboeking');
  if(t.amount>=0||t.bankPatternKind)return t;
  // Only an existing named commitment can match. No invented subscriptions, prices or future credits.
  const party=norm(t.providerData?.counterparty??t.counterparty??''),description=' '+norm(t.providerData?.description??t.description)+' ';
  const matches=fixed.filter(f=>f.paymentRoute!=='withheld'&&f.paymentRoute!=='cash'&&!f.budgetCategory&&norm(f.naam).length>=4&&(party===norm(f.naam)||(supplier(party)!==undefined&&supplier(party)===supplier(norm(f.naam)))||(f.costGroup==='work-tools'&&description.includes(' '+norm(f.naam)+' '))));
  return matches.length===1?set('fixed',matches[0].naam):t;
 });
}

/** Named suppliers only; generic processors and OpenAI do not prove a subscription. */
const suppliers:Record<string,string[]>={
 'Simyo':['simyo'], 'GitHub':['github'], 'Vercel':['vercel'], 'Suno':['suno'],
 'Mage.space':['mage space'], 'Grok':['grok xai','grok','grok ai'], 'Supabase':['supabase'],
 'ChatGPT':['chatgpt'], 'bunq-bankkosten':['bunq bankkosten','bunq bv'],
};
function supplier(text:string){return Object.entries(suppliers).find(([,aliases])=>aliases.some(a=>(' '+text+' ').includes(' '+a+' ')))?.[0];}
/** Add observed supplier rows, never a guessed recurring obligation. Existing rows win. */
export function addBunqObservedCosts(transactions:MoneylithTransaction[],fixed:FixedCostManualItem[],rules:BankRuleSettings,seen:string[],asOf:string){
 const next=[...fixed],nextSeen=new Set(seen);
 for(const t of transactions){
  if(t.provider!=='bunq'||t.currency!=='EUR'||t.amount>=0||t.date>asOf||rules.accountRoles[t.accountId]==='business'||['ignore','transfer','financing','variable'].includes(t.bankPatternKind??''))continue;
  const name=supplier(norm(t.providerData?.counterparty??t.counterparty??''));
  if(!name||name==='Simyo'||name==='bunq-bankkosten'&&t.providerData?.paymentSubType!=='BILLING')continue;
  const id='bunq-observed:'+name;
  if(nextSeen.has(id)||next.some(f=>supplier(norm(f.naam))===name))continue;
  next.push({id,naam:name,bedrag:0,amountEntered:false,dagVanMaand:0,paymentRoute:'card',bankObservedOnly:true,
   ...(name!=='bunq-bankkosten'?{costGroup:'work-tools' as const}:{}),
   opmerking:'Via bunq herkende kosten. Werkelijk betaald staat in het periodeoverzicht. Nog geen toekomstig abonnementbedrag aangenomen; vul zelf een verwachting in.'});nextSeen.add(id);
 }
 return {fixedCosts:next,seen:[...nextSeen]};
}
