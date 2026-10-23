import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCloudState, restoreCloudState } from '../src/storage/cloudState';

function limitedStorage(limit: number) {
  const map = new Map<string,string>();
  return {
    get length(){return map.size;}, key:(i:number)=>[...map.keys()][i]??null,
    getItem:(k:string)=>map.get(k)??null, removeItem:(k:string)=>{map.delete(k);},
    clear:()=>map.clear(),
    setItem(k:string,v:string){
      const next=new Map(map);next.set(k,v);
      if([...next].reduce((n,[key,value])=>n+key.length+value.length,0)>limit)
        throw new DOMException('Full','QuotaExceededError');
      map.set(k,v);
    },
  } satisfies Storage;
}
const key='moneylith.personal.income';
const legacyKey='moneylith.cloud.localRecovery';
test('cloud restore works when a duplicate localStorage backup exceeds quota; migrates old backup',async()=>{
  const storage=limitedStorage(450);
  storage.setItem(key,JSON.stringify('x'.repeat(180)));
  storage.setItem(legacyKey,'{"older":"backup"}');
  storage.setItem('unrelated','preserved');
  const previous=collectCloudState(storage);
  assert.throws(()=>storage.setItem(legacyKey,JSON.stringify(previous)),/Full/);
  let saved:unknown;let old:unknown;
  await restoreCloudState(storage,{[key]:JSON.stringify('y'.repeat(300))},async(state,legacy)=>{saved=state;old=legacy;});
  assert.deepEqual(saved,previous);
  assert.equal(old,'{"older":"backup"}');
  assert.equal(storage.getItem(legacyKey),null);
  assert.equal(storage.getItem('unrelated'),'preserved');
  assert.equal(JSON.parse(storage.getItem(key)!).length,300);
});
test('backup failure leaves all active data and legacy backup untouched',async()=>{
  const storage=limitedStorage(500);storage.setItem(key,'[1]');storage.setItem(legacyKey,'old');
  await assert.rejects(restoreCloudState(storage,{[key]:'[2]'},async()=>{throw Error('disk full');}),/niets overschreven/);
  assert.equal(storage.getItem(key),'[1]');assert.equal(storage.getItem(legacyKey),'old');
});
test('cloud snapshot exceeding available storage rolls back to previous financial data',async()=>{
  const storage=limitedStorage(150);storage.setItem(key,'[1]');
  let backup:unknown;
  await assert.rejects(restoreCloudState(storage,{[key]:JSON.stringify('x'.repeat(500))},async state=>{backup=state;}),/Herstellen mislukt/);
  assert.deepEqual(collectCloudState(storage),{[key]:'[1]'});
  assert.deepEqual(backup,{[key]:'[1]'});
});
test('edits during asynchronous backup are not overwritten',async()=>{
  const storage=limitedStorage(500);storage.setItem(key,'[1]');
  await assert.rejects(restoreCloudState(storage,{[key]:'[2]'},async()=>{storage.setItem(key,'[3]');}),/ondertussen gewijzigd/);
  assert.equal(storage.getItem(key),'[3]');
});
