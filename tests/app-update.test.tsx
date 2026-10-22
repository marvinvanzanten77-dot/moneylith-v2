import test from 'node:test';
import assert from 'node:assert/strict';
import {latestVersion,updateUrl,updateWorker} from '../src/pwa/update';
test('update keeps the current mode and query, replacing only the release marker',()=>{
 const url=new URL(updateUrl('https://www.moneylith.nl/?app=1&view=notifications&appUpdate=old#zakelijk','new'));
 assert.equal(url.hash,'#zakelijk');assert.equal(url.searchParams.get('view'),'notifications');assert.equal(url.searchParams.get('app'),'1');assert.deepEqual(url.searchParams.getAll('appUpdate'),['new']);
});
test('version check bypasses cache and rejects offline fallback or failed responses',async()=>{
 const request=(async(_input,init)=>{assert.equal(init?.cache,'no-store');return new Response('{"version":"release-123"}');}) as typeof fetch;
 assert.equal(await latestVersion(request),'release-123');
 for(const response of [new Response('offline',{status:503}),new Response('<html>offline</html>'),new Response('{}')])await assert.rejects(()=>latestVersion((async()=>response) as typeof fetch));
});
test('worker update waits for activation and never unregisters the push subscription',async()=>{
 class Worker extends EventTarget {state='installing';}
 const worker=new Worker();let updated=false;
 const registration={installing:worker,update:async()=>{updated=true;},unregister:()=>{throw Error('Must not unregister');}} as unknown as ServiceWorkerRegistration;
 let finished=false;const promise=updateWorker(registration).then(()=>{finished=true;});
 await new Promise(resolve=>setTimeout(resolve,5));assert.equal(updated,true);assert.equal(finished,false);
 worker.state='activated';worker.dispatchEvent(new Event('statechange'));await promise;assert.equal(finished,true);
 await updateWorker({update:async()=>{},installing:null,waiting:null} as unknown as ServiceWorkerRegistration);
 const failed=new Worker();failed.state='redundant';await assert.rejects(()=>updateWorker({update:async()=>{},installing:failed} as unknown as ServiceWorkerRegistration),/niet gelukt/);
});
