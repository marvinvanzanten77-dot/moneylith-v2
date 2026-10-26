import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {BunqClient,BunqError,bunqMoney,type BunqContext} from '../server/bunq/client';
import {processBankSync} from '../src/bank/processSync';
import {mobileBankBalance} from '../src/mobile/bankBalance';
import {emptyBankRules} from '../src/bank/classificationRules';
import {makePeriodPlan,reconcilePeriod} from '../src/bank/periodReconciliation';
import {emptyDebtLedger} from '../src/bank/debtPayments';
import {personalInput} from '../src/projection/adapters';
import {emptyOptions} from '../src/projection/engine';
import {spendingRows} from '../src/bank/spending';
import type {LunchSnapshot} from '../src/bank/lunchflowTypes';
function fixture(){
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{format:'pem',type:'spki'},privateKeyEncoding:{format:'pem',type:'pkcs8'}});
 let saved:BunqContext|null=null,clientPublic='',count=0;const paths:string[]=[];
 const store={async load(){return saved&&structuredClone(saved);},async save(c:BunqContext){saved=structuredClone(c);}};
 const reply=(payload:unknown)=>{const body=JSON.stringify(payload);return new Response(body,{headers:{'X-Bunq-Server-Signature':sign('RSA-SHA256',Buffer.from(body),pair.privateKey).toString('base64')}});};
 const payment=(id:number)=>({Payment:{id,monetary_account_id:2,amount:{value:'-12.34',currency:'EUR'},created:'2026-10-25 23:15:00.000000',description:'Fictieve aankoop',counterparty_alias:{display_name:'Test winkel'},type:'FIS',sub_type:'PAYMENT'}});
 const request=(async(url,init)=>{const path=new URL(String(url)).pathname+new URL(String(url)).search;paths.push(path);
  if(path==='/v1/installation'){clientPublic=JSON.parse(String(init?.body)).client_public_key;return reply({Response:[{Token:{token:'installation'}},{ServerPublicKey:{server_public_key:pair.publicKey}}]});}
  assert.ok(verify('RSA-SHA256',Buffer.from(String(init?.body??'')),clientPublic,Buffer.from((init?.headers as Record<string,string>)['X-Bunq-Client-Signature'],'base64')));
  if(path==='/v1/device-server'){assert.deepEqual(JSON.parse(String(init?.body)).permitted_ips,[]);return reply({Response:[{Id:{id:1}}]});}
  if(path==='/v1/session-server'){count++;return reply({Response:[{Token:{token:'session'+count}},{UserPerson:{id:1}}]});}
  if(path==='/v1/user/1/monetary-account?count=200')return reply({Response:[{MonetaryAccountCard:{id:2,currency:'EUR',description:'Test card',status:'ACTIVE',balance:{value:'50.00',currency:'EUR'},alias:[]}}],Pagination:{older_url:null}});
  if(path==='/v1/user/1/monetary-account/2')return reply({Response:[{MonetaryAccountCard:{id:2,balance:{value:'50.00',currency:'EUR'}}}]});
  if(path==='/v1/user/1/monetary-account/2/payment?count=200')return reply({Response:[payment(4)],Pagination:{older_url:'/v1/user/1/monetary-account/2/payment?count=200&older_id=4'}});
  if(path.includes('older_id=4'))return reply({Response:[payment(3)],Pagination:{older_url:null}});
  throw Error('Unexpected request');
 }) as typeof fetch;
 return {store,request,reply,paths,get saved(){return saved;},client:()=>new BunqClient('fictitious-key',store,request)};
}
test('bunq signed installation, persisted session, separate balance and paginated booked payments',async()=>{
 const f=fixture(),client=f.client(),accounts=await client.accounts();assert.equal(accounts[0].id,'1:2');const result=await client.snapshot(accounts[0]);assert.equal(result.balance.ok,true);assert.equal(result.transactions.ok,true);
 if(result.transactions.ok){assert.equal(result.transactions.value.length,2);assert.equal(result.transactions.value[0].date,'2026-10-26');assert.equal(result.transactions.value[0].amount,-12.34);}
 await f.client().accounts();assert.equal(f.paths.filter(p=>p==='/v1/installation').length,1);assert.equal(f.paths.filter(p=>p==='/v1/session-server').length,1);
 assert.ok(f.paths.every(p=>!p.includes('mastercard-action')));assert.ok(f.saved?.privateKey);
});
test('bunq rejects missing credentials, unsigned responses and foreign pagination before leaking credentials',async()=>{
 const f=fixture();await assert.rejects(()=>new BunqClient('',f.store,f.request).accounts(),(e:BunqError)=>e.code==='configuration');assert.equal(f.paths.length,0);
 await f.client().accounts();
 const bad=new BunqClient('fictitious-key',f.store,(async()=>new Response(JSON.stringify({Response:[]}))) as typeof fetch);await assert.rejects(()=>bad.accounts(),/cryptografisch/);
 const evil=new BunqClient('fictitious-key',f.store,(async()=>f.reply({Response:[],Pagination:{older_url:'https://evil.test/steal'}})) as typeof fetch);await assert.rejects(()=>evil.accounts(),/paginalink/);
});
test('bunq error states are safe and expired sessions renew once',async()=>{
 const f=fixture();await f.client().accounts();let calls=0;
 const client=new BunqClient('fictitious-key',f.store,(async(url,init)=>{if(++calls===1)return new Response('{}',{status:401});return f.request(url,init);}) as typeof fetch);
 await client.accounts();assert.equal(f.paths.filter(p=>p==='/v1/session-server').length,2);
 for(const [status,code] of [[403,'forbidden'],[429,'rate_limit'],[500,'provider']] as const){const c=new BunqClient('fictitious-key',f.store,(async()=>new Response('private upstream details',{status})) as typeof fetch);await assert.rejects(()=>c.accounts(),(e:BunqError)=>e.code===code&&!e.message.includes('private'));}
});
test('bunq decimal values retain cents and reject unknown or overprecise values',()=>{
 assert.equal(bunqMoney({value:'-144.95',currency:'EUR'}).amount,-144.95);assert.equal(bunqMoney({value:'0',currency:'EUR'}).amount,0);
 for(const value of [null,0,'1.001','NaN','9007199254740993'])assert.throws(()=>bunqMoney({value,currency:'EUR'}));
});
const snapshot=(payments:LunchSnapshot['transactions']):LunchSnapshot=>({account:{id:'1:2',label:'Test bunq',iban:'NL00TEST0000000002',institution:'bunq',upstream:'bunq',status:'ACTIVE',currency:'EUR'},balance:{ok:true,value:{amount:250,currency:'EUR'}},transactions:payments,fetchedAt:'2026-10-26T12:00:00Z'});
test('bunq and ING share totals, preserve manual edits, allocate subscriptions and do not consume topups twice',()=>{
 const state={'moneylith.personal.accounts':JSON.stringify([{id:'ing',name:'Test ING',active:true,bankProvider:'lunchflow',bankAccountId:'i',iban:'NL00TEST0000000001',bankBalance:1000,currency:'EUR',bankBalanceFetchedAt:'2026-10-26T12:00:00Z'}]),'moneylith.personal.fixedCosts':JSON.stringify([{id:'chat',naam:'ChatGPT',bedrag:30,amountEntered:true,dagVanMaand:28,paymentRoute:'card',costGroup:'work-tools'}]),'moneylith.business.real.v1':'{"untouched":true}'};
 const txs=[{id:'a',accountId:'1:2',amount:100,currency:'EUR',date:'2026-10-24',description:'Overboeking',merchant:'Eigen rekening',counterpartyIban:'NL00TEST0000000001'},{id:'b',accountId:'1:2',amount:-20,currency:'EUR',date:'2026-10-25',description:'Subscription',merchant:'ChatGPT'}];
 const first=processBankSync(state,[snapshot({ok:true,value:txs})],[{providerId:'1:2',targetId:'new'}],'2026-10-26','bunq');
 assert.equal(first.result.transactions[0].bankPatternKind,'transfer');assert.equal(first.result.transactions[1].bankPatternKind,'fixed');assert.equal(mobileBankBalance(first.result.accounts,emptyBankRules)?.cents,125000);
 const fixed=JSON.parse(first.state['moneylith.personal.fixedCosts']);const report=reconcilePeriod('2026-10','2026-10-26',makePeriodPlan([],fixed,[],[],'2026-10-26'),true,first.result.transactions,emptyDebtLedger(),emptyBankRules);assert.equal(report.rows[0].actual,2000);
 assert.equal(spendingRows(first.result.transactions,emptyBankRules,fixed).length,0);
 first.result.transactions[1].notes='Bewaren';first.state['moneylith.personal.transactions']=JSON.stringify(first.result.transactions);
 const again=processBankSync(first.state,[snapshot({ok:true,value:txs})],[{providerId:'1:2',targetId:'bunq:account:1:2'}],'2026-10-26','bunq');assert.equal(again.result.reports[0].added,0);assert.equal(again.result.transactions[1].notes,'Bewaren');assert.equal(again.state['moneylith.business.real.v1'],state['moneylith.business.real.v1']);
 const input=personalInput({accounts:again.result.accounts,fixedCosts:fixed,transactions:[...again.result.transactions,{id:'topup',provider:'lunchflow',accountId:'ing',date:'2026-10-24',amount:-100,currency:'EUR',description:'Naar bunq',counterparty:'bunq',bankPatternKind:'transfer'}]},emptyOptions(),'2026-10-26');assert.equal(input.commitments?.find(r=>r.label==='ChatGPT')?.remaining,1000);
 const failed=processBankSync(again.state,[snapshot({ok:false,error:{code:'network',message:'Test'}})],[{providerId:'1:2',targetId:'bunq:account:1:2'}],'2026-10-26','bunq');assert.deepEqual(failed.result.accounts,again.result.accounts);assert.equal(failed.result.reports[0].ok,false);
});

test('bunq requires explicitly mapping an existing manual IBAN instead of silently duplicating it',()=>{
 const state={'moneylith.personal.accounts':JSON.stringify([{id:'manual',name:'Test bunq',active:true,iban:'NL00TEST0000000002'}])};
 assert.throws(()=>processBankSync(state,[snapshot({ok:true,value:[]})],[{providerId:'1:2',targetId:'new'}],'2026-10-26','bunq'),/bestaande rekening/);
 const linked=processBankSync(state,[snapshot({ok:true,value:[]})],[{providerId:'1:2',targetId:'manual'}],'2026-10-26','bunq');assert.equal(linked.result.accounts.length,1);assert.equal(linked.result.accounts[0].id,'manual');assert.equal(linked.result.accounts[0].bankProvider,'bunq');
});

test('bunq billing is a cost, supplier variants match, manual forecasts survive and observed costs do not repeat',async()=>{
 const {classifyBunq,addBunqObservedCosts}=await import('../src/bank/bunqClassification');
 const {classifyBankTransactions}=await import('../src/bank/patterns');
 const {manualReviewRows}=await import('../src/logic/inputReadiness');
 const rules={accountRoles:{},rules:[{id:'topup',kind:'transfer' as const,label:'Top-up',terms:['bunq']}]};
 const fixed=[{id:'phone',naam:'Simyo — telefoonabonnement',bedrag:144.95,amountEntered:true,dagVanMaand:19,paymentRoute:'card' as const,bankPaymentFrom:'2026-10-25'}];
 const t=(id:string,party:string,amount:number,subtype='PAYMENT')=>({id,provider:'bunq' as const,accountId:'card',date:'2026-10-26',amount,currency:'EUR',description:party,counterparty:party,providerData:{counterparty:party,description:party,amount,date:'2026-10-26',paymentSubType:subtype}});
 const tx=[t('fee','bunq BV',-9.99,'BILLING'),t('fund','bunq',-100),t('phone','SIMYO',-144.95),t('git','GITHUB, INC.',-2.76),t('suno','SUNO INC.',-16.46),t('processor','Adyen Merchant Payout EUR',-80)];
 const initial=classifyBankTransactions(tx,{},rules);
 assert.equal(initial[0].bankPatternKind,undefined);assert.equal(initial[1].bankPatternKind,'transfer');
 const costs=addBunqObservedCosts(initial,fixed,rules,[],'2026-10-26');
 assert.deepEqual(costs.fixedCosts[0],fixed[0]);assert.equal(costs.fixedCosts.length,4);
 const classified=classifyBunq(initial,[],costs.fixedCosts,rules);
 assert.equal(classified[0].bankPatternKind,'fixed');assert.equal(classified[2].bankRuleLabel,fixed[0].naam);assert.equal(classified[5].bankPatternKind,undefined);
 const report=reconcilePeriod('2026-10','2026-10-26',makePeriodPlan([],costs.fixedCosts,[],[],'2026-10-26'),true,classified,emptyDebtLedger(),rules);
 assert.equal(report.rows.find(r=>r.label==='GitHub')?.actual,276);assert.equal(report.rows.find(r=>r.label==='GitHub')?.expected,null);
 assert.equal(report.rows[0].actual,14495);
 const input=personalInput({fixedCosts:costs.fixedCosts,transactions:classified,bankRules:rules},emptyOptions(),'2026-10-26');
 assert.ok(!input.events.some(e=>e.id.includes('bunq-observed:')));assert.ok(input.assumptions.some(s=>s.includes('GitHub')));
 assert.equal(manualReviewRows(costs.fixedCosts).length,1);
 assert.equal(addBunqObservedCosts(classified,costs.fixedCosts,rules,costs.seen,'2026-10-26').fixedCosts.length,4);
 assert.equal(addBunqObservedCosts(classified,fixed,rules,costs.seen,'2026-10-26').fixedCosts.length,1,'deleted suggestions stay deleted');
 const decision={'transaction:git':{kind:'variable' as const,label:'Eigen keuze'}};
 const corrected=classifyBunq(classifyBankTransactions(tx,decision,rules),[],costs.fixedCosts,rules,decision);
 assert.equal(corrected[3].bankPatternKind,'variable');
 const business=classifyBunq(tx,[],costs.fixedCosts,{...rules,accountRoles:{card:'business'}});
 assert.equal(business[2].bankPatternKind,undefined);
});

test('bunq positive direct debit requires review; explicit reversal offsets once and cannot settle a future Simyo bill',async()=>{
 const {findBankReversals}=await import('../src/bank/periodReconciliation');
 const debit={id:'d',provider:'bunq' as const,accountId:'card',date:'2026-09-24',amount:-94.49,currency:'EUR',description:'SIMYO',counterparty:'SIMYO',bankPatternKind:'fixed' as const,bankRuleLabel:'Simyo — telefoonabonnement'};
 const credit={...debit,id:'c',amount:94.49,date:'2026-10-14',providerData:{paymentSubType:'SDD'}};
 assert.ok(findBankReversals([debit,credit]).uncertainDebits.has('d'));
 assert.equal(findBankReversals([debit,credit]).reversedDebits.size,0);
 const explicit={...credit,description:'Terugboeking SIMYO'};
 assert.ok(findBankReversals([debit,explicit]).reversedDebits.has('d'));
 const fixed=[{id:'phone',naam:debit.bankRuleLabel,bedrag:144.95,amountEntered:true,dagVanMaand:19,paymentRoute:'card' as const,bankPaymentFrom:'2026-10-25'}];
 const report=reconcilePeriod('2026-10','2026-10-26',makePeriodPlan([],fixed,[],[],'2026-10-26'),true,[debit,explicit],emptyDebtLedger(),emptyBankRules);
 assert.equal(report.rows[0].actual,null);assert.equal(report.rows[0].expected,14495);
 const past=reconcilePeriod('2026-09','2026-10-26',makePeriodPlan([],fixed,[],[],'2026-09-26'),true,[debit,credit],emptyDebtLedger(),emptyBankRules);
 assert.equal(past.rows[0].actual,null);assert.match(past.rows[0].status,/Mogelijke terugboeking/);
});
