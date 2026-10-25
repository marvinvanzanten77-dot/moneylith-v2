import test from 'node:test';
import assert from 'node:assert/strict';
import {processBankSync} from '../src/bank/processSync';
import {mergeCloudVersions} from '../src/storage/mergeCloud';
import {syncBankAccount} from '../server/lunchflow/accountSync';
import {encryptCloudPayload,decryptCloudPayload} from '../server/utils/cloudAuth';
import {evaluateMonitoring,emptyMonitoring,reconcileNotices} from '../src/monitoring/engine';
import type {LunchSnapshot} from '../src/bank/lunchflowTypes';
import type {CloudState} from '../src/storage/cloudState';
import type {LunchClient} from '../server/lunchflow/client';
const now=new Date('2026-10-23T12:00:00Z');
const account={id:'a',name:'Eigen rekening',active:true,type:'betaalrekening',bankProvider:'lunchflow',bankAccountId:'provider-a',bankBalance:40,currency:'EUR'};
const old={id:'lunchflow:provider-a:sep',provider:'lunchflow',accountId:'a',currency:'EUR',amount:2000,date:'2026-09-23',description:'Salaris',counterparty:'Werkgever'};
const state:CloudState={
 'moneylith.personal.accounts':JSON.stringify([account]),'moneylith.personal.transactions':JSON.stringify([old]),
 'moneylith.personal.income':JSON.stringify([{id:'income',naam:'Mijn salaris',bedrag:2000,followLatestBank:true,bankEvidence:{key:'salary',transactionIds:[old.id],through:old.date},payrollDeductions:{'2026-10':100}}]),
 'moneylith.personal.fixedCosts':JSON.stringify([{id:'own',naam:'Eigen budget',bedrag:100,budgetCategory:'Boodschappen'}]),
 'moneylith.personal.debts':'[{"id":"manual","bedrag":123}]',
 'moneylith.business.real.v1':'{"untouched":true}',
 'moneylith.chat.v1.personal':'[{"content":"preserve"}]',
};
const snapshot:LunchSnapshot={account:{id:'provider-a',label:'Test',institution:'ING',status:'ACTIVE',upstream:'gocardless',currency:'EUR'},balance:{ok:true,value:{amount:2100,currency:'EUR'}},transactions:{ok:true,value:[{id:'oct',accountId:'provider-a',amount:2100,currency:'EUR',date:'2026-10-23',description:'Salaris',merchant:'Werkgever'},{id:'food',accountId:'provider-a',amount:-30,currency:'EUR',date:'2026-10-23',description:'Albert Heijn',merchant:'Albert Heijn'}]},fetchedAt:now.toISOString()};
const mappings=[{providerId:'provider-a',targetId:'a'}];
test('shared processing routes latest salary, bank balance and categorized purchases without overwriting manual/business fields',()=>{
 const before=JSON.stringify(state),r=processBankSync(state,[snapshot],mappings,'2026-10-23');
 assert.equal(JSON.parse(r.state['moneylith.personal.accounts'])[0].bankBalance,2100);
 const salary=JSON.parse(r.state['moneylith.personal.income'])[0];assert.equal(salary.bedrag,2100);assert.equal(salary.bankEvidence.through,'2026-10-23');assert.equal(salary.payrollDeductions['2026-10'],100);
 const transactions=JSON.parse(r.state['moneylith.personal.transactions']);assert.equal(transactions.find((t:any)=>t.id.endsWith(':food')).category,'Boodschappen');
 for(const key of ['moneylith.personal.fixedCosts','moneylith.personal.debts','moneylith.business.real.v1','moneylith.chat.v1.personal'])assert.equal(r.state[key],state[key]);
 assert.equal(JSON.stringify(state),before);
 const repeat=processBankSync(r.state,[snapshot],mappings,'2026-10-23');assert.deepEqual(repeat.state,r.state);assert.equal(repeat.result.reports[0].added,0);
});
test('failed snapshots preserve old balances; business income needs an explicit personal evidence link',()=>{
 const broken={...snapshot,balance:{ok:false as const,error:{code:'network' as const,message:'Niet bereikbaar'}}};
 const result=processBankSync(state,[broken],mappings,'2026-10-23');assert.equal(result.state['moneylith.personal.accounts'],state['moneylith.personal.accounts']);assert.equal(result.state['moneylith.personal.income'],state['moneylith.personal.income']);
 const business={...state,'moneylith.personal.bankRules.v1':JSON.stringify({rules:[],accountRoles:{a:'business'}})};
 const linked=processBankSync(business,[snapshot],mappings,'2026-10-23');assert.equal(JSON.parse(linked.state['moneylith.personal.income'])[0].bedrag,2100);
 const manual={...business,'moneylith.personal.income':JSON.stringify([{id:'manual',naam:'Handmatig',bedrag:2000}])};
 const excluded=processBankSync(manual,[snapshot],mappings,'2026-10-23');assert.equal(excluded.state['moneylith.personal.income'],manual['moneylith.personal.income']);
 assert.equal(linked.state['moneylith.personal.bankRules.v1'],business['moneylith.personal.bankRules.v1']);
});
test('cross-device reconciliation merges separate fields, deletions and identical edits; conflicts preserve originals',()=>{
 const base={a:'1',b:'2'},local={a:'3',b:'2'},remote={a:'1',b:'4'};
 assert.deepEqual(mergeCloudVersions(base,local,remote),{a:'3',b:'4'});
 assert.deepEqual(mergeCloudVersions(base,{b:'2'},remote),{b:'4'});
 assert.deepEqual(mergeCloudVersions(base,{a:'3',b:'2'},{a:'3',b:'2'}),{a:'3',b:'2'});
 assert.throws(()=>mergeCloudVersions(base,local,{a:'5',b:'2'}),/lokale wijzigingen/);assert.deepEqual(local,{a:'3',b:'2'});
});
test('scan receipts stay visible without budget signals, are idempotent, respect pause, and report failure on stale bank data',()=>{
 const scan={id:'scheduled:2026-10-23T12',at:now.toISOString(),ok:1,failed:0,added:2,updatedIncome:1,message:'Bankgegevens verwerkt.'};
 const source={...state,'moneylith.personal.bankScan.v1':JSON.stringify(scan)};
 const r=evaluateMonitoring(source,emptyMonitoring().preferences,now);assert.equal(r.signals[0].kind,'sync');
 const notices=reconcileNotices([],r.signals,now.toISOString());assert.equal(reconcileNotices(notices,r.signals,now.toISOString()).length,1);
 assert.equal(evaluateMonitoring(source,{enabled:false,mutedLabels:[]},now).signals.length,0);
 source['moneylith.personal.bankScan.v1']=JSON.stringify({...scan,failed:1,message:'Ophalen mislukt.'});assert.match(evaluateMonitoring(source,emptyMonitoring().preferences,now).signals[0].title,/aandacht/);
});
test('server scan rebases a concurrent edit, persists encrypted results, deduplicates scheduled runs and releases lock',async()=>{
 const previous={...process.env},fetchBefore=globalThis.fetch;Object.assign(process.env,{KV_REST_API_URL:'https://redis.test',KV_REST_API_TOKEN:'test',CLOUD_ENCRYPTION_KEY:'a'.repeat(64)});
 const redis=new Map<string,string>();const snapshotKey='ml:cloud:snapshot:owner@test.nl';redis.set(snapshotKey,JSON.stringify({revision:'initial',encrypted:encryptCloudPayload(JSON.stringify(state))}));let conflict=true,fetches=0;
 globalThis.fetch=async(_url,init)=>{
  const a=JSON.parse(String(init?.body));let result:unknown=null;
  if(a[0]==='GET')result=redis.get(a[1])??null;
  else if(a[0]==='SET'){if(!redis.has(a[1])){redis.set(a[1],a[2]);result='OK';}}
  else if(a[0]==='EVAL'&&a[1].includes("redis.call('DEL'")){if(redis.get(a[3])===a[4]){redis.delete(a[3]);result=1;}}
  else if(a[0]==='EVAL'){
   if(conflict){conflict=false;redis.set(snapshotKey,JSON.stringify({revision:'concurrent',encrypted:encryptCloudPayload(JSON.stringify({...state,'moneylith.personal.intent':'{"note":"concurrent edit"}'}))}));result=0;}
   else{const old=JSON.parse(redis.get(a[3])!);result=old.revision===a[4]?1:0;if(result===1)redis.set(a[3],a[5]);}
  }else throw Error('Unexpected command');return new Response(JSON.stringify({result}));
 };
 const client={accounts:async()=>{fetches++;return [snapshot.account];},snapshot:async()=>snapshot} as unknown as LunchClient;
 try{
  const scan=await syncBankAccount('owner@test.nl','fake','scheduled:test',now,client);assert.equal(scan.ok,1);assert.equal(scan.updatedIncome,1);
  const stored=JSON.parse(decryptCloudPayload(JSON.parse(redis.get(snapshotKey)!).encrypted));assert.equal(stored['moneylith.personal.intent'],'{"note":"concurrent edit"}');assert.equal(JSON.parse(stored['moneylith.personal.income'])[0].bedrag,2100);
  await syncBankAccount('owner@test.nl','fake','scheduled:test',now,client);assert.equal(fetches,1);assert.equal([...redis.keys()].some(k=>k.startsWith('ml:bank-sync:')),false);
  const failed=await syncBankAccount('owner@test.nl','fake','failure:test',now,{accounts:async()=>{throw Error('network');}} as unknown as LunchClient);assert.equal(failed.failed,1);
  const preserved=JSON.parse(decryptCloudPayload(JSON.parse(redis.get(snapshotKey)!).encrypted));assert.equal(preserved['moneylith.personal.accounts'],stored['moneylith.personal.accounts']);
 }finally{globalThis.fetch=fetchBefore;for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
test('scheduled bank processor loads with native production ESM resolution',async()=>{
 const fs=await import('node:fs/promises'),path=await import('node:path'),os=await import('node:os'),url=await import('node:url'),ts=await import('typescript');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'moneylith-bank-esm-'));
 try{
  await fs.writeFile(path.join(folder,'package.json'),'{"type":"module"}');
  for(const file of ['server/lunchflow/accountSync','server/lunchflow/client','server/utils/cloudStore','server/utils/cloudAuth','server/utils/cookies','src/bank/processSync','src/bank/debtPayments','src/bank/lunchflowMerge','src/bank/patterns','src/bank/financialImport','src/bank/classificationRules','src/bank/lunchflowTypes','src/storage/cloudState','src/storage/cloudRecovery','src/monitoring/engine','src/bank/spending','src/bank/choiceGuidance']){
   const source=await fs.readFile(file+'.ts','utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
   const dest=path.join(folder,file+'.js');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,output);
  }
  const {execFileSync}=await import('node:child_process');const output=execFileSync(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(url.pathToFileURL(path.join(folder,'server/lunchflow/accountSync.js')).href)});console.log(typeof m.syncBankAccount);`],{encoding:'utf8'});assert.equal(output.trim(),'function');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
