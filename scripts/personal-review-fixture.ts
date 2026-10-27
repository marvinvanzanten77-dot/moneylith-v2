import {manualReviewRows,reviewSection} from '../src/logic/inputReadiness.ts';
import {today,addDays} from '../src/projection/engine.ts';
const now=today();
const income=[{id:'fixture-income',naam:'Voorbeeldsalaris',bedrag:2300,amountEntered:true,dagVanMaand:23,bankEvidence:{key:'fixture-income',transactionIds:['fixture-pay'],through:addDays(now,-2)}}];
const fixed=[{id:'fixture-rent',naam:'Voorbeeldhuur',bedrag:650,amountEntered:true,dagVanMaand:1,paymentRoute:'bank'},{id:'fixture-food',naam:'Boodschappen',bedrag:240,amountEntered:true,dagVanMaand:23,budgetCategory:'Boodschappen',budgetSince:now.slice(0,7)},{id:'fixture-tool',naam:'Voorbeeldtool — nog te plannen',bedrag:0,amountEntered:false,dagVanMaand:8,paymentRoute:'card',bankObservedOnly:true,costKind:'subscription'}];
export const reviewSeed={
 'moneylith.workspace.v1':'personal',
 'moneylith.onboarding.mode':'manual','moneylith.intro.seen':true,'moneylith.storage.mode':'local',
 'moneylith.personal.income':income,'moneylith.personal.fixedCosts':fixed,
 'moneylith.personal.inputReviews.v1':{income:reviewSection('income','Inkomen',manualReviewRows(income),{}).signature,fixed:reviewSection('fixed','Vaste lasten',manualReviewRows(fixed),{}).signature},
 'moneylith.personal.accounts':[{id:'fixture-a',name:'Voorbeeld betaalrekening',active:true,type:'betaalrekening',bankProvider:'lunchflow',currency:'EUR',bankBalance:780,bankBalanceFetchedAt:new Date().toISOString(),bankLastSync:new Date().toISOString()},{id:'fixture-b',name:'Voorbeeld tweede rekening',active:true,type:'betaalrekening',bankProvider:'bunq',currency:'EUR',bankBalance:220,bankBalanceFetchedAt:new Date().toISOString(),bankLastSync:new Date().toISOString()}],
 'moneylith.personal.transactions':[{id:'fixture-pay',accountId:'fixture-a',provider:'lunchflow',currency:'EUR',amount:2300,date:addDays(now,-2),description:'Voorbeeldsalaris',counterparty:'Voorbeeld werkgever',bankPatternKind:'income'},{id:'fixture-food-payment',accountId:'fixture-a',provider:'lunchflow',currency:'EUR',amount:-40,date:addDays(now,-1),description:'Voorbeeld supermarkt',category:'Boodschappen',bankPatternKind:'variable',bankRuleLabel:'Boodschappen'},{id:'fixture-card-payment',accountId:'fixture-b',provider:'bunq',currency:'EUR',amount:-18,date:addDays(now,-1),description:'<b>Voorbeeld</b> &amp; aankoop',counterparty:'Voorbeeldwinkel',bankPatternKind:'variable'}],
 'moneylith.personal.debts':[{id:'fixture-debt',naam:'Voorbeeldschuld',openBedrag:300,minBetaling:30,afschrijfDag:28}],
};
