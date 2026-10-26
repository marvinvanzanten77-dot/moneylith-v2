import type {FixedCostManualItem,MoneylithTransaction,SchuldItem} from '../types.js';
import {applyConfirmedDebtPayment,validateDebtLedger,type DebtLedger,type DebtPayment,type PaymentAudit} from './debtPayments.js';
import {findBankReversals} from './periodReconciliation.js';
export function confirmPaymentDistribution(debts:SchuldItem[],fixed:FixedCostManualItem[],transactions:MoneylithTransaction[],ledger:DebtLedger,transactionId:string,allocations:DebtPayment['allocations'],fixedAllocations:NonNullable<DebtPayment['fixedAllocations']>,asOf:string,businessIds:string[]=[]){
 const tx=transactions.find(t=>t.id===transactionId),reversals=findBankReversals(transactions);
 if(!validateDebtLedger(ledger)||!tx||tx.provider!=='lunchflow'||tx.currency!=='EUR'||tx.date>asOf||businessIds.includes(tx.accountId)||reversals.reversedDebits.has(tx.id)||reversals.uncertainDebits.has(tx.id))throw Error('Kies een persoonlijke geboekte betaling zonder onzekere terugboeking.');
 const old=ledger.entries.find(e=>e.transactionId===tx.id);
 const payment:DebtPayment={transactionId:tx.id,accountId:tx.accountId,date:tx.providerData?.date??tx.date,paidCents:Math.round(-(tx.providerData?.amount??tx.amount)*100),allocations:[...(old?.allocations??[]),...allocations],fixedAllocations:[...(old?.fixedAllocations??[]),...fixedAllocations],source:'confirmed'};
 if(old&&(old.paidCents!==payment.paidCents||old.date!==payment.date||old.accountId!==payment.accountId))throw Error('De bankbetaling is gewijzigd. Controleer eerst de bestaande verdeling.');
 if(!allocations.length&&!fixedAllocations.length)throw Error('Voeg minimaal één verdeling toe.');
 if(!validateDebtLedger({version:1,entries:[payment]}))throw Error('De verdeling bevat een dubbel doel, ongeldig bedrag of is hoger dan de betaling.');
 if(fixedAllocations.some(a=>!fixed.some(f=>f.id===a.fixedId&&f.paymentRoute!=='withheld'&&!f.budgetCategory)))throw Error('Kies een bestaande vaste last zonder ingehouden bedrag of aankoopbudget.');
 const next=allocations.length?applyConfirmedDebtPayment(debts,{...payment,allocations,fixedAllocations:[]}):debts;
 const changed=new Set(allocations.map(a=>a.debtId));
 const audit:PaymentAudit={id:crypto.randomUUID(),at:new Date().toISOString(),transactionId:tx.id,beforeEntry:old,afterEntry:payment,beforeDebts:structuredClone(debts.filter(d=>changed.has(d.id))),afterDebts:structuredClone(next.filter(d=>changed.has(d.id)))};
 return {debts:next,ledger:{...ledger,entries:[...ledger.entries.filter(e=>e.transactionId!==tx.id),payment],history:[...(ledger.history??[]),audit],ignoredTransactionIds:ledger.ignoredTransactionIds?.filter(id=>id!==tx.id)}};
}
export function undoPaymentDistribution(debts:SchuldItem[],ledger:DebtLedger,auditId:string){
 const audit=ledger.history?.find(a=>a.id===auditId&&!a.undoneAt);
 if(!audit||JSON.stringify(ledger.entries.find(e=>e.transactionId===audit.transactionId))!==JSON.stringify(audit.afterEntry))throw Error('Deze verdeling is later aangepast. Draai eerst de laatste wijziging terug.');
 if(audit.afterDebts.some(d=>JSON.stringify(debts.find(current=>current.id===d.id))!==JSON.stringify(d)))throw Error('Een betrokken schuld is ondertussen gewijzigd. Controleer het saldo handmatig; er is niets teruggedraaid.');
 const before=new Map(audit.beforeDebts.map(d=>[d.id,d]));
 return {debts:debts.map(d=>before.get(d.id)??d),ledger:{...ledger,entries:[...ledger.entries.filter(e=>e.transactionId!==audit.transactionId),...(audit.beforeEntry?[audit.beforeEntry]:[])],history:ledger.history!.map(a=>a.id===auditId?{...a,undoneAt:new Date().toISOString()}:a),ignoredTransactionIds:[...new Set([...(ledger.ignoredTransactionIds??[]),...(!audit.beforeEntry?[audit.transactionId]:[])])]}};
}
