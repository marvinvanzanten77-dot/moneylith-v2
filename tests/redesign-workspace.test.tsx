import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceModel,saveRecord,moneyInput,foundationChecks,paymentDate} from '../src/redesign/workspaceModel';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions,project} from '../src/projection/engine';
const date='2026-10-28';
const state=(v:Record<string,unknown>)=>Object.fromEntries(Object.entries(v).map(([k,v])=>['moneylith.personal.'+k,JSON.stringify(v)]));
function memory(initial:Record<string,string>={}){const map=new Map(Object.entries(initial));return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},map};}
test('salary-period dates cover the next month and clamp a short month',()=>{assert.equal(paymentDate('2026-10',1),'2026-11-01');assert.equal(paymentDate('2026-10',23),'2026-10-23');assert.equal(paymentDate('2026-02',31),'2026-02-28');assert.equal(paymentDate('2026-10',0),null);});
test('record patch preserves bank metadata, unrelated rows and business keys',()=>{const original={id:'rent',naam:'Huur',bedrag:1000,bankEvidence:{transactionIds:['tx']},monthlyAmounts:{'2026-09':990}};const s=memory({'moneylith.personal.fixedCosts':JSON.stringify([original,{id:'other',bedrag:50}]),'moneylith.business.fixedCosts':'private-business-value'});saveRecord(s,'fixedCosts',original,{...original,bedrag:1100});assert.deepEqual(JSON.parse(s.getItem('moneylith.personal.fixedCosts')!)[0].bankEvidence,original.bankEvidence);assert.equal(JSON.parse(s.getItem('moneylith.personal.fixedCosts')!)[1].bedrag,50);assert.equal(s.getItem('moneylith.business.fixedCosts'),'private-business-value');});
test('stale form cannot overwrite a changed cloud record',()=>{const original={id:'x',bedrag:10},s=memory({'moneylith.personal.fixedCosts':JSON.stringify([{id:'x',bedrag:20}])});assert.throws(()=>saveRecord(s,'fixedCosts',original,{id:'x',bedrag:30}),/intussen gewijzigd/);assert.equal(JSON.parse(s.getItem('moneylith.personal.fixedCosts')!)[0].bedrag,20);});
test('failed storage write is surfaced without pretending a save succeeded',()=>{assert.throws(()=>saveRecord({getItem:()=>null,setItem:()=>{throw Error('quota');}},'income',null,{id:'i',bedrag:100}),/quota/);});
test('amount parsing keeps explicit zero and cents but rejects missing or excessive precision',()=>{assert.equal(moneyInput('0'),0);assert.equal(moneyInput('144,95'),144.95);for(const bad of ['','-1','1.999','abc','1e3'])assert.throws(()=>moneyInput(bad));});
test('historical periods do not pretend current expectations were stored historically',()=>{const s=state({income:[{id:'i',naam:'Salaris',bedrag:2500,amountEntered:true}],fixedCosts:[],transactions:[]});const m=workspaceModel(s,'2026-08',date);assert.equal(m.report.hasSavedPlan,false);assert.equal(m.report.rows[0].expected,null);assert.equal(m.report.forecast.income,null);});
test('bank salary matching is separate from expectations and source data is not mutated',()=>{const s=state({income:[{id:'i',naam:'Salaris',bedrag:2500,amountEntered:true,bankEvidence:{key:'unused',transactionIds:['salary']}}],transactions:[{id:'salary',accountId:'a',date:'2026-10-23',amount:2530,currency:'EUR',provider:'lunchflow',description:'Salary'}]});const before=JSON.stringify(s);const m=workspaceModel(s,'2026-10',date);assert.equal(m.report.rows[0].expected,250000);assert.equal(m.report.rows[0].actual,253000);assert.equal(m.report.rows[0].forecast,253000);assert.equal(JSON.stringify(s),before);});
test('complete-section confirmation uses projection-compatible review signatures',()=>{const income=[{id:'i',naam:'Salaris',bedrag:2500,amountEntered:true,dagVanMaand:23}],fixedCosts=[{id:'f',naam:'Huur',bedrag:1000,amountEntered:true,dagVanMaand:1,paymentRoute:'bank'}];const s=state({income,fixedCosts});const checks=foundationChecks(s,date);assert.equal(checks.income.ready,false);const input=personalInput({income,fixedCosts,inputReviews:{income:checks.income.signature,fixed:checks.fixed.signature}},emptyOptions(),date);assert.ok(!input.missing.some(s=>s==='Inkomen nog controleren'||s==='Vaste lasten nog controleren'));});
test('unknown spending stays unknown; own transfers and business transactions are excluded',()=>{const tx={id:'t',accountId:'a',date:'2026-10-24',amount:-20,currency:'EUR',provider:'lunchflow',description:'Test',category:'Kleding en schoenen'};const m=workspaceModel(state({transactions:[{...tx,bankPatternKind:'transfer'},{...tx,id:'b',accountId:'business'}],'bankRules.v1':{accountRoles:{business:'business'},rules:[]}}),'2026-10',date);assert.deepEqual(m.gross,[]);assert.equal(m.spending.totalCents,null);});
test('forecast groups daily budgets without losing cents or hiding real payments',async()=>{const {forecastMoments}=await import('../src/redesign/workspaceModel');const events=[{id:'fixed:food:budget:2026-10-29',label:'Boodschappen',date:'2026-10-29',amount:-848,source:'fixed',basis:'assumption' as const},{id:'fixed:food:budget:2026-10-30',label:'Boodschappen',date:'2026-10-30',amount:-849,source:'fixed',basis:'assumption' as const},{id:'rent',label:'Huur',date:'2026-11-01',amount:-110000,source:'fixed',basis:'input' as const}];const result=forecastMoments(events,date,'2026-11-10');assert.equal(result.length,2);assert.equal(result[0].amount,-1697);assert.equal(result[1].label,'Huur');assert.equal(events.length,3);});
test('editing a current bill uses latest inputs even when the initial period estimate exists',()=>{const s=state({fixedCosts:[{id:'rent',naam:'Huur',bedrag:1150,amountEntered:true,dagVanMaand:1,paymentRoute:'bank'}],periodPlans:{}});s['moneylith.personal.periodPlans.v1']=JSON.stringify({'2026-10':{capturedAt:'2026-10-23',rows:[{id:'fixed:rent',label:'Huur',kind:'fixed',expected:100000}]}});const m=workspaceModel(s,'2026-10',date);assert.equal(m.report.rows[0].expected,115000);assert.equal(m.report.rows[0].forecast,115000);});
test('future planning uses selected period monthly amounts, not the current month',()=>{
 const s=state({fixedCosts:[{id:'phone',naam:'Telefoon',bedrag:20,amountEntered:true,dagVanMaand:19,paymentRoute:'bank',monthlyVariable:true,monthlyAmounts:{'2026-11':144.95,'2026-12':30,'2027-01':40}}]});
 const before=JSON.stringify(s);
 assert.equal(workspaceModel(s,'2026-11',date).report.rows[0].expected,3000);
 assert.equal(workspaceModel(s,'2026-12',date).report.rows[0].expected,4000);
 assert.equal(JSON.stringify(s),before);
});
test('forecast displays known cash movements with explicit omissions without changing strict results',async()=>{
 const {forecastDisplay}=await import('../src/redesign/forecastDisplay');
 const input:import('../src/projection/engine').Input={scope:'personal',asOf:date,opening:100000,reserve:null,missing:['Vaste lasten nog controleren'],assumptions:[],goals:[],debts:{},events:[
 {id:'rent',label:'Huur',date:'2026-10-30',amount:-36900,source:'fixed',basis:'input'},
 {id:'unknown',label:'Nog onbekende last',date:'2026-11-01',amount:null,source:'fixed',basis:'input'},
 {id:'undated',label:'Zonder datum',date:null,amount:-1000,source:'fixed',basis:'input'}]};
 const before=JSON.stringify(input);
 for(const days of [7,30,90]){
 const result=forecastDisplay(input,days);assert.equal(result.provisional,true);assert.equal(result.base.timeline[days-1].cash,63100);
 assert.ok(result.issues.includes('Nog onbekende last: bedrag onbekend'));assert.ok(result.issues.includes('Zonder datum: betaaldatum onbekend'));
 assert.ok(!result.issues.some(s=>s.startsWith('Huidige reserveringen')));
 }
 const alt=forecastDisplay(input,30,{kind:'purchase',date:'2026-11-02',amount:10000});assert.equal(alt.alt!.timeline[29].cash,53100);
 assert.equal(forecastDisplay(input,30).alt,null);assert.equal(project(input).timeline[29].cash,null);assert.equal(JSON.stringify(input),before);
 const absent=forecastDisplay({...input,opening:null},30);assert.equal(absent.base.timeline[29].cash,null);assert.ok(absent.issues.some(s=>s.includes('rekeningsaldo')));
});
