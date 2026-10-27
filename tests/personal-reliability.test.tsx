import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {dailyOverview} from '../src/projection/dailyOverview';
import {project,missingThrough,emptyOptions,type Input} from '../src/projection/engine';
import {personalInput} from '../src/projection/adapters';
import {periodRoom} from '../src/logic/periodRoom';
import {makePeriodPlan,reconcilePeriod} from '../src/bank/periodReconciliation';
import {emptyDebtLedger} from '../src/bank/debtPayments';
import {emptyBankRules} from '../src/bank/classificationRules';
import {bankText} from '../src/utils/bankText';
import {BankPatterns} from '../src/components/BankPatterns';
import {PersonalNavigation} from '../src/components/PersonalNavigation';
const base=():Input=>({scope:'personal',asOf:'2026-04-24',opening:50000,reserve:0,debts:{},events:[],missing:[],assumptions:[],goals:[]});
test('unknown reserves do not become confirmed zero; cash remains distinct from spendable',()=>{
 const unknown=personalInput({},emptyOptions(),'2026-04-24');assert.equal(unknown.reserve,null);
 const p=project({...base(),reserve:null});assert.equal(p.horizons[0].cash,50000);assert.equal(p.horizons[0].available,null);
 assert.equal(dailyOverview({...base(),reserve:null}).available,null);
 assert.equal(dailyOverview(base()).available,50000);
});
test('spendable excludes next salary and highlights an interim deficit despite positive ending',()=>{
 const input=base();input.events=[{id:'rent',label:'Testhuur',date:'2026-04-26',amount:-70000,source:'fixed',basis:'input'},{id:'salary',label:'Testloon',date:'2026-05-03',amount:120000,source:'income',basis:'assumption'}];
 const before=JSON.stringify(input),v=dailyOverview(input);
 assert.equal(project(input).horizons[1].cash,100000);assert.equal(v.available,-20000);assert.equal(v.until,'2026-05-02');assert.equal(v.lowest?.date,'2026-04-26');assert.equal(JSON.stringify(input),before);
});
test('unknown future costs affect only horizons reaching the event, with no manufactured range',()=>{
 const input=base();input.events=[{id:'subscription',label:'Testtool',date:'2026-05-10',amount:null,source:'fixed',basis:'input'}];
 const result=project(input);assert.equal(result.horizons[0].cash,50000);assert.deepEqual(result.horizons[0].missing,[]);assert.equal(result.horizons[1].cash,null);assert.match(result.horizons[1].missing.join(),/Testtool/);
 assert.deepEqual(missingThrough(input,'2026-05-09'),[]);
});
test('observed recurring costs remain unknown in forecast and period capacity; credits do not become subscriptions',()=>{
 const fixed={id:'tool',naam:'Testtool',bedrag:0,dagVanMaand:5,amountEntered:false,bankObservedOnly:true,paymentRoute:'card' as const,costKind:'subscription' as const};
 const input=personalInput({fixedCosts:[fixed]},emptyOptions(),'2026-04-24');assert.ok(input.events.some(e=>e.label.includes('Testtool')&&e.amount===null));
 const credits=personalInput({fixedCosts:[{...fixed,costKind:'credits'}]},emptyOptions(),'2026-04-24');assert.ok(!credits.events.some(e=>e.id.includes('unknown-future')));
 const report=reconcilePeriod('2026-04','2026-04-24',makePeriodPlan([], [fixed],[],[],'2026-04-24'),true,[],emptyDebtLedger(),emptyBankRules,{'fixed:tool':2200});
 assert.equal(report.rows[0].actual,2200);assert.equal(report.forecast.fixed,null);assert.equal(periodRoom(report.forecast),null);
 assert.equal(periodRoom({income:100000,fixed:40000,debt:10000}),50000);
});
test('dashboard groups daily budget allocations while keeping their full remaining sum',()=>{
 const input=base();input.events=[1,2,3].map(n=>({id:'fixed:food:budget:2026-04-'+(24+n),label:'Testbudget',date:'2026-04-'+(24+n),amount:-1000,source:'fixed',basis:'assumption' as const}));
 const overview=dailyOverview(input);assert.equal(overview.outgoing.length,1);assert.equal(overview.outgoing[0].amount,-3000);assert.equal(overview.available,47000);
});
test('bank descriptions normalize only for display; tags are not rendered as HTML',()=>{
 const raw='<b>TEST</b>&nbsp;&amp; &#65;';assert.equal(bankText(raw),'TEST & A');assert.equal(raw,'<b>TEST</b>&nbsp;&amp; &#65;');
});
test('daily navigation exposes five sections and transaction review exposes existing filters',()=>{
 const nav=renderToStaticMarkup(<PersonalNavigation step="transactions" onNavigate={()=>{}}/>);
 for(const name of ['Overzicht','Transacties','Planning','Schulden &amp; doelen','Inzicht'])assert.ok(nav.includes(name));
 const html=renderToStaticMarkup(<BankPatterns accounts={[]} transactions={[]} income={[]} fixedCosts={[]} decisions={{}} onDecide={()=>{}} onBank={()=>{}}/>);
 for(const name of ['Periode','Rekening','Richting','Zoek tegenpartij'])assert.ok(html.includes(name));
});

test('notification groups keep overlapping financial signals separate without summing amounts',async()=>{
 const {groupNotices}=await import('../src/monitoring/groupNotices');
 const first={id:'one',scope:'personal' as const,kind:'budget' as const,month:'2026-04',label:'Testpot',title:'Test',message:'Test',observedCents:1000,referenceCents:500,createdAt:'2026-04-24',updatedAt:'2026-04-24',readAt:null,dismissedAt:null,active:true};
 const notices=[first,{...first,id:'two'},{...first,id:'three',kind:'pace' as const}];const original=JSON.stringify(notices);
 const grouped=groupNotices(notices);assert.equal(grouped.length,2);assert.equal(grouped[0].notices.length,2);assert.equal(JSON.stringify(notices),original);
});
test('known subscription due date limits its uncertainty to affected horizons',()=>{
 const p=personalInput({fixedCosts:[{id:'futuretool',naam:'Testtool',bedrag:0,amountEntered:false,bankObservedOnly:true,paymentRoute:'card',dagVanMaand:15}]},emptyOptions(),'2026-04-24');
 const event=p.events.find(e=>e.id.endsWith(':unknown-future'));assert.equal(event?.date,'2026-05-15');assert.equal(event?.amount,null);
 const ready={...p,opening:50000,reserve:0,missing:[]};assert.deepEqual(project(ready).horizons[0].missing,[]);assert.match(project(ready).horizons[1].missing.join(),/Testtool/);
});

test('monitoring retains cash-shortfall warnings without pretending unknown reserves are zero',async()=>{
 const {evaluateMonitoring}=await import('../src/monitoring/engine');
 const {reviewSection,manualReviewRows}=await import('../src/logic/inputReadiness');
 const income=[{id:'i',naam:'Voorbeeldloon',bedrag:1200,amountEntered:true,dagVanMaand:23}];
 const fixed=[{id:'f',naam:'Voorbeeldlast',bedrag:600,amountEntered:true,dagVanMaand:28}];
 const state=Object.fromEntries(Object.entries({'moneylith.personal.income':income,'moneylith.personal.fixedCosts':fixed,'moneylith.personal.accounts':[{id:'p',active:true,bankProvider:'lunchflow',currency:'EUR',bankBalance:100,bankLastSync:'2026-04-24T09:00:00Z',bankBalanceFetchedAt:'2026-04-24T09:00:00Z'}],'moneylith.personal.inputReviews.v1':{debts:reviewSection('debts','Schulden',[],{}).signature,income:reviewSection('income','Inkomen',manualReviewRows(income),{}).signature,fixed:reviewSection('fixed','Vaste lasten',manualReviewRows(fixed),{}).signature}}).map(([k,v])=>[k,JSON.stringify(v)]));
 const signal=evaluateMonitoring(state,{enabled:true,mutedLabels:[]},new Date('2026-04-24T10:00:00Z')).signals.find(s=>s.label==='Vooruitblik');
 assert.ok(signal);assert.match(signal.message,/banksaldoverwachting, geen besteedbaar/);assert.match(signal.message,/Reserveringen zijn onbekend/);
 state['moneylith.personal.fixedCosts']=JSON.stringify([{...fixed[0],amountEntered:false}]);
 assert.ok(!evaluateMonitoring(state,{enabled:true,mutedLabels:[]},new Date('2026-04-24T10:00:00Z')).signals.some(s=>s.label==='Vooruitblik'));
});

test('currency labels distinguish unknown amounts from explicit zero and consistently show cents',async()=>{
 const {formatCurrency}=await import('../src/utils/format');assert.equal(formatCurrency(null),'Nog onbekend');assert.equal(formatCurrency(undefined),'Nog onbekend');assert.match(formatCurrency(0),/0,00/);assert.match(formatCurrency(12),/12,00/);
});

test('an elapsed subscription date without payment evidence cannot postpone uncertainty to next month',()=>{
 const p=personalInput({fixedCosts:[{id:'late',naam:'Voorbeeld onzekere last',bedrag:0,amountEntered:false,bankObservedOnly:true,paymentRoute:'card',dagVanMaand:25}]},emptyOptions(),'2026-04-28');
 assert.equal(p.events.find(e=>e.id.endsWith(':unknown-future'))?.date,null);
 assert.ok(missingThrough({...p,missing:[],opening:50000,reserve:0},'2026-04-29').some(m=>m.includes('Voorbeeld onzekere last')));
});

test('explicitly confirmed empty period sections are zero, while missing rows and historical planning stay unknown',async()=>{
 const {reviewedPeriodForecast}=await import('../src/logic/periodRoom');
 const empty={forecast:{income:null,fixed:null,debt:0},rows:[]};
 assert.equal(periodRoom(reviewedPeriodForecast(empty)),null);
 assert.equal(periodRoom(reviewedPeriodForecast(empty,{income:true,fixed:true})),0);
 assert.equal(reviewedPeriodForecast({...empty,rows:[{kind:'fixed'}]},{income:true,fixed:true}).fixed,null);
 assert.equal(reviewedPeriodForecast({...empty,rows:[{kind:'fixed',route:'withheld'}]},{income:true,fixed:true}).fixed,0);
});
