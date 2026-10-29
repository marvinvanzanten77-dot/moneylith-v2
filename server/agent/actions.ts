import {returnedPayments} from '../../src/bank/returnedPayments.js';
import {emptyBankRules,validateBankRules} from '../../src/bank/classificationRules.js';
import {today} from '../../src/projection/engine.js';
import {correctClassification,classificationAuditKey} from '../../src/bank/classificationAudit.js';
import type {MoneylithTransaction} from '../../src/types.js';
import {randomUUID} from 'node:crypto';
import type {CloudState} from '../../src/storage/cloudState.js';
import {validDate} from '../../src/projection/engine.js';
export class AgentInputError extends Error {}
export const fields={
 paymentResolutions:['returnedId','status','dueMonth','note'],
 accounts:['name','type','description','startBalance','active'],
 assets:['naam','bedrag','type'],
 futureIncome:['naam','bedrag','datum','opmerking'],
 income:['opmerking','naam','bedrag','dagVanMaand','amountEntered','followLatestBank','payrollDeductions'],
 fixedCosts:['naam','bedrag','dagVanMaand','amountEntered','monthlyVariable','monthlyAmounts','paymentRoute','costGroup','costKind','budgetCategory','opmerking'],
 debts:['naam','crediteur','openBedrag','minBetaling','afschrijfDag','firstPaymentDate','remainingPayments','notitie'],
 goals:['label','type','targetAmount','currentAmount','monthlyContribution','deadline','isActive'],
 transactions:['notes','category'],
} as const;
export type Collection=keyof typeof fields;
export type Edit={collection:Collection;id:string|null;changes:Record<string,unknown>};
export type Change={collection:Collection;id:string;before:Record<string,unknown>|null;after:Record<string,unknown>};
export type Receipt={id:string;questionHash:string;at:string;summary:string;changes:Change[];extras?:{key:string;before:string|null;after:string}[];undone?:boolean};
export const journalKey='moneylith.personal.agentActions.v1';
function fail(message:string):never {throw new AgentInputError(message);}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('Ongeldige wijziging.');
const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9&&Math.abs(v*100-Math.round(v*100))<1e-5;
const key=(c:Collection)=>'moneylith.personal.'+c;
export function records(state:CloudState,c:Collection):Record<string,unknown>[] {const data=JSON.parse(state[key(c)]??'[]');if(!Array.isArray(data))return fail('De opgeslagen lijst is niet leesbaar.');return data;}
export function receipts(state:CloudState):Receipt[]{const data=JSON.parse(state[journalKey]??'[]');return Array.isArray(data)?data:[];}
const required:Record<Collection,string[]>={paymentResolutions:['returnedId','status','note'],assets:['naam','bedrag'],futureIncome:['naam','bedrag','datum'],accounts:['name','type'],income:['naam','bedrag','dagVanMaand'],fixedCosts:['naam','bedrag','dagVanMaand'],debts:['naam','openBedrag'],goals:['label','type','targetAmount','currentAmount','monthlyContribution'],transactions:[]};
const moneyFields=new Set(['bedrag','startBalance','openBedrag','minBetaling','targetAmount','currentAmount','monthlyContribution']);
const labels:Record<string,string>={naam:'naam',name:'naam',label:'naam',bedrag:'bedrag',startBalance:'beginsaldo',openBedrag:'openstaand',minBetaling:'maandelijkse aflossing',dagVanMaand:'betaaldag',afschrijfDag:'betaaldag',firstPaymentDate:'eerste betaling',remainingPayments:'resterende termijnen',targetAmount:'doelbedrag',currentAmount:'al opgebouwd',monthlyContribution:'maandinleg',monthlyAmounts:'maandbedragen',payrollDeductions:'looninhoudingen',deadline:'doeldatum',datum:'datum',category:'categorie',notes:'notitie',followLatestBank:'banksalaris volgen',active:'actief'};
function summary(change:Change){const details=(fields[change.collection] as readonly string[]).filter(k=>change.after[k]!==undefined&&JSON.stringify(change.before?.[k])!==JSON.stringify(change.after[k])&&!['name','naam','label','amountEntered'].includes(k)).map(k=>`${labels[k]??k}: ${moneyFields.has(k)?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(change.after[k])):typeof change.after[k]==='object'?JSON.stringify(change.after[k]):String(change.after[k])}`).join('; ');return `${change.before?'Bijgewerkt':'Toegevoegd'}: ${String(change.after.naam??change.after.name??change.after.label??'transactienotitie')}${details?' — '+details:''}.`;}
export function applyEdits(state:CloudState,input:unknown):{state:CloudState;changes:Change[];summary:string;extras:{key:string;before:string|null;after:string}[]}{
 if(!Array.isArray(input)||!input.length||input.length>10)fail('Er zijn één tot tien wijzigingen per opdracht toegestaan.');
 const next={...state},changes:Change[]=[],seen=new Set<string>();
 for(const value of input){const edit=record(value);if(Object.keys(edit).some(k=>!['collection','id','changes'].includes(k)))fail('Onbekende actievelden.');
 const c=edit.collection as Collection;if(typeof c!=='string'||!Object.hasOwn(fields,c))fail('Dit onderdeel kan nog niet via de assistent worden gewijzigd.');
 const patch={...record(edit.changes)};if(!Object.keys(patch).length||Object.keys(patch).some(k=>!(fields[c] as readonly string[]).includes(k)))fail('Deze velden zijn beschermd of niet ondersteund.');
 const rows=records(next,c),id=edit.id===null?'agent:'+randomUUID():typeof edit.id==='string'?edit.id:fail('Een bestaande identificatie of null is verplicht.');
 if(seen.has(c+':'+id))fail('Dezelfde regel kan niet tweemaal in één opdracht worden gewijzigd.');seen.add(c+':'+id);
 const before=rows.find(r=>r.id===id)??null;if(before){const roles=JSON.parse(state['moneylith.personal.bankRules.v1']??'{}').accountRoles??{};if((c==='accounts'&&roles[id]==='business')||(c==='transactions'&&roles[String(before.accountId)]==='business'))fail('Zakelijke gegevens kunnen niet vanuit de persoonlijke assistent worden gewijzigd.');}
 if(edit.id!==null&&!before)fail('Deze regel bestaat niet meer. Vraag opnieuw met de actuele gegevens.');
 if(!before&&c==='transactions')fail('Banktransacties kunnen niet door de assistent worden aangemaakt.');
 for(const [field,v]of Object.entries(patch)){
  if(moneyFields.has(field)){if(!money(v))fail('Een bedrag moet een geldig niet-negatief eurobedrag zijn.');}
  else if(['dagVanMaand','afschrijfDag','remainingPayments'].includes(field)){if(!Number.isInteger(v)||Number(v)<(field==='remainingPayments'?1:0)||Number(v)>(field==='remainingPayments'?600:31))fail('Ongeldige betaaldag of aantal termijnen.');}
  else if(['active','amountEntered','followLatestBank','monthlyVariable','isActive'].includes(field)){if(typeof v!=='boolean')fail('Ongeldige instelling.');}
  else if(['firstPaymentDate','deadline','datum'].includes(field)){if(!validDate(v))fail('Gebruik een geldige datum.');}
  else if(['monthlyAmounts','payrollDeductions'].includes(field)){for(const [month,amount]of Object.entries(record(v)))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||amount!==null&&!money(amount))fail('Ongeldig maandbedrag.');}
  else if(typeof v!=='string'||!v.trim()||v.length>2000)fail('Een tekstveld ontbreekt of is te lang.');
 }
 if(c==='paymentResolutions'){
  const merged={...before,...patch};
  if(!['paid','open'].includes(String(merged.status))||merged.dueMonth!==undefined&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(merged.dueMonth)))fail('Ongeldige betaalstatus of betaalmaand.');
  const rawRules=JSON.parse(state['moneylith.personal.bankRules.v1']??'{}');
  const returns=returnedPayments(JSON.parse(state['moneylith.personal.transactions']??'[]').filter((t:MoneylithTransaction)=>rawRules.accountRoles?.[t.accountId]!=='business'),validateBankRules(rawRules)?rawRules:emptyBankRules,today(),[],{includeHistorical:true});
  const target=returns.find(r=>r.id===merged.returnedId);
  if(!target)fail('Deze terugboeking bestaat niet in je persoonlijke bankgegevens.');
  if(rows.some(r=>r.id!==id&&r.returnedId===merged.returnedId))fail('Deze terugboeking heeft al een afhandeling. Wijzig die bestaande regel.');
  if(before&&patch.returnedId&&patch.returnedId!==before.returnedId)fail('De oorspronkelijke terugboeking mag niet veranderen.');
  patch.label=target.label;
 }
 if(c==='accounts'){
  if(patch.type&&!['betaalrekening','spaarrekening','contant'].includes(String(patch.type)))fail('Ongeldig rekeningtype.');
  if(before?.bankProvider&&('startBalance'in patch||patch.active===false))fail('Een bankrekening kan niet via AI worden ontkoppeld of van saldo veranderd.');
 }
 if(c==='assets'&&patch.type&&!['liquid','investment','other'].includes(String(patch.type)))fail('Ongeldige vermogenssoort.');
 if(c==='goals'&&patch.type&&!['debt_payoff','savings','buffer','project'].includes(String(patch.type)))fail('Ongeldig doeltype.');
 if(c==='fixedCosts'){
  if(patch.paymentRoute&&!['bank','card','cash','third-party','withheld'].includes(String(patch.paymentRoute)))fail('Ongeldige betaalwijze.');
  if(patch.costGroup&&patch.costGroup!=='work-tools'||patch.costKind&&!['subscription','credits'].includes(String(patch.costKind)))fail('Ongeldige kostensoort.');
  if(patch.monthlyAmounts||'bedrag'in patch)patch.bankObservedOnly=false;
  if(patch.monthlyAmounts)patch.monthlyAmounts={...record(before?.monthlyAmounts??{}),...record(patch.monthlyAmounts)};
  if('bedrag'in patch)patch.amountEntered=true;
 }
 if(c==='income'){
  if(patch.payrollDeductions)patch.payrollDeductions={...record(before?.payrollDeductions??{}),...record(patch.payrollDeductions)};
  if('bedrag'in patch){patch.amountEntered=true;if(before?.bankEvidence)patch.followLatestBank=false;}
 }
 if(c==='debts'){
  if('openBedrag'in patch)patch.saldo=patch.openBedrag;
  if('minBetaling'in patch){patch.minimaleMaandlast=patch.minBetaling;if(patch.minBetaling===0){patch.remainingPayments=undefined;patch.firstPaymentDate=undefined;patch.afschrijfDag=0;}}
  if(typeof patch.firstPaymentDate==='string'&&!('afschrijfDag'in patch))patch.afschrijfDag=Number(patch.firstPaymentDate.slice(8));
 }
 if(c==='transactions'&&typeof patch.category==='string'&&before){
  if(['transfer','financing','fixed'].includes(String(before.bankPatternKind)))fail('Deze betaling is gekoppeld aan een overboeking, lening of vaste last. Herindeling vraagt eerst controle.');
  const decisionsKey='moneylith.personal.bankPatterns.v1';
  const corrected=correctClassification(before as unknown as MoneylithTransaction,patch.category,false,JSON.parse(next[decisionsKey]??'{}'),JSON.parse(next[classificationAuditKey]??'[]'));
  next[decisionsKey]=JSON.stringify(corrected.decisions);next[classificationAuditKey]=JSON.stringify(corrected.history);
  Object.assign(patch,{bankPatternKind:'variable',bankPatternCategory:patch.category,bankRuleLabel:undefined,bankRuleId:undefined});
 }
 const after:Record<string,unknown>={...(before??(c==='accounts'?{active:true,source:'manual',currency:'EUR'}:c==='goals'?{isActive:true}:{})),...patch,id};
 for(const field of before?[]:required[c])if(after[field]===undefined)fail(`Nog nodig voor ${c}: ${field}.`);
 if(c==='debts'&&after.firstPaymentDate&&after.remainingPayments&&Number(after.minBetaling??after.minimaleMaandlast??0)<=0)fail('Voor een regeling met termijnen is een maandbedrag nodig.');
 if(!before&&c!=='paymentResolutions'){const name=String(after.naam??after.name??after.label??'').trim().toLowerCase();if(rows.some(r=>String(r.naam??r.name??r.label??'').trim().toLowerCase()===name))fail('Een regel met deze naam bestaat al. Gebruik de bestaande regel.');}
 if(before&&JSON.stringify(before)===JSON.stringify(after))continue;
 next[key(c)]=JSON.stringify(before?rows.map(r=>r.id===id?after:r):[...rows,after]);changes.push({collection:c,id,before,after});
 }
 if(!changes.length)fail('Deze gegevens staan al zo ingesteld.');
 return {state:next,changes,extras:['moneylith.personal.bankPatterns.v1',classificationAuditKey].filter(k=>next[k]!==state[k]).map(k=>({key:k,before:state[k]??null,after:next[k]})),summary:changes.map(summary).join('\n')};
}
export function undoReceipt(state:CloudState,id:string){
 const all=receipts(state),entry=all.find(r=>r.id===id);if(!entry||entry.undone)fail('Deze wijziging is niet beschikbaar om ongedaan te maken.');
 const next={...state};for(const extra of entry.extras??[]){if(next[extra.key]!==extra.after)fail('De indeling is intussen gewijzigd. Ongedaan maken is gestopt.');if(extra.before===null)delete next[extra.key];else next[extra.key]=extra.before;}
 for(const change of entry.changes){const rows=records(next,change.collection);if(JSON.stringify(rows.find(r=>r.id===change.id))!==JSON.stringify(change.after))fail('Deze regel is intussen gewijzigd, mogelijk door banksync. Ongedaan maken is gestopt.');next[key(change.collection)]=JSON.stringify(change.before?rows.map(r=>r.id===change.id?change.before:r):rows.filter(r=>r.id!==change.id));}
 next[journalKey]=JSON.stringify(all.map(r=>r.id===id?{...r,undone:true}:r));return next;
}
