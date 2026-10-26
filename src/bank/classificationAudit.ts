import {patternKey,type PatternDecision,type PatternDecisions} from './patterns.js';
import type {MoneylithTransaction} from '../types.js';
export const classificationAuditKey='moneylith.personal.classificationAudit.v1';
export type ClassificationAudit={id:string;at:string;transactionId:string;keys:string[];before:Record<string,PatternDecision|undefined>;after:PatternDecision;beforeCategory?:Pick<MoneylithTransaction,'category'|'bankPatternCategory'|'bankPatternKind'|'bankRuleId'|'bankRuleLabel'>;undoneAt?:string};
export function correctClassification(tx:MoneylithTransaction,label:string,future:boolean,decisions:PatternDecisions,history:ClassificationAudit[]){
 if((tx.provider !== 'lunchflow' && tx.provider !== 'bunq')||!label.trim()||label.length>150)throw Error('Kies een geldige bankbetaling en categorie.');
 const keys=['transaction:'+tx.id,...(future?[patternKey({...tx,bankRuleId:undefined,bankRuleLabel:undefined})]:[])];
 const after:PatternDecision={kind:'variable',label:label.trim()};
 const audit:ClassificationAudit={id:crypto.randomUUID(),at:new Date().toISOString(),transactionId:tx.id,keys,beforeCategory:{category:tx.category,bankPatternCategory:tx.bankPatternCategory,bankPatternKind:tx.bankPatternKind,bankRuleId:tx.bankRuleId,bankRuleLabel:tx.bankRuleLabel},before:Object.fromEntries(keys.map(k=>[k,decisions[k]])),after};
 return {decisions:{...decisions,...Object.fromEntries(keys.map(k=>[k,after]))},history:[...history,audit]};
}
export function undoClassification(decisions:PatternDecisions,history:ClassificationAudit[],transactions?:MoneylithTransaction[]){
 const last=history.slice().reverse().find(a=>!a.undoneAt);if(!last)throw Error('Geen indelingscorrectie om terug te draaien.');
 if(last.keys.some(k=>JSON.stringify(decisions[k])!==JSON.stringify(last.after)))throw Error('De indeling is later gewijzigd. Controleer eerst de huidige keuze.');
 const next={...decisions};for(const k of last.keys){if(last.before[k])next[k]=last.before[k]!;else delete next[k];}
 const current=transactions?.find(t=>t.id===last.transactionId);
 if(current&&current.category!==last.after.label&&current.category!==last.beforeCategory?.category)throw Error('De categorie van deze betaling is later gewijzigd; controleer eerst die wijziging.');
 const restored=transactions?.map(t=>t.id===last.transactionId&&last.beforeCategory?{...t,category:undefined,bankPatternCategory:undefined,bankPatternKind:undefined,bankRuleId:undefined,bankRuleLabel:undefined,...last.beforeCategory}:t);
 return {...(restored?{transactions:restored}:{}),decisions:next,history:history.map(a=>a.id===last.id?{...a,undoneAt:new Date().toISOString()}:a)};
}
export function persistClassificationReview(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,next:{decisions:PatternDecisions;history:ClassificationAudit[];transactions?:MoneylithTransaction[]}){
 const keys=['moneylith.personal.bankPatterns.v1',classificationAuditKey,...(next.transactions?['moneylith.personal.transactions']:[])],before=keys.map(k=>storage.getItem(k));
 try{storage.setItem(keys[0],JSON.stringify(next.decisions));storage.setItem(keys[1],JSON.stringify(next.history));if(next.transactions)storage.setItem(keys[2],JSON.stringify(next.transactions));}
 catch{keys.forEach((k,i)=>{try{if(before[i]===null)storage.removeItem(k);else storage.setItem(k,before[i]!);}catch{/* previous values remain in browser recovery when storage is unavailable */}});throw Error('Indeling kon niet veilig worden opgeslagen. Maak ruimte vrij en probeer opnieuw.');}
}
