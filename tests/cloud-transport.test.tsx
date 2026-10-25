import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {packCloudRequest,unpackCloudResponse,cloudEncoding,cloudDecodedLimit,cloudWireLimit} from '../src/storage/cloudTransport';
import {packCloudResponse,unpackCloudRequest} from '../server/utils/cloudTransport';
const state={'moneylith.personal.transactions':JSON.stringify(Array.from({length:18000},(_,i)=>({id:'tx-'+i,date:'2026-10-25',description:'Test fictieve betaling — koffie €',amount:-12.34,accountId:'personal',note:'Bewaar mijn handmatige categorie en notitie'}))),'moneylith.business.real.v1':'{"invoices":[]}','moneylith.chat.v1.personal':'["Test"]'};
test('large history roundtrips losslessly through browser upload and server download',async()=>{
 const body={state,revision:'revision-before'};
 assert.ok(Buffer.byteLength(JSON.stringify(body))>3_500_000);
 const packed=await packCloudRequest(body);assert.ok(Buffer.byteLength(packed)<cloudWireLimit);
 assert.equal(JSON.parse(packed).encoding,cloudEncoding);
 assert.deepEqual(unpackCloudRequest(JSON.parse(packed)),body);
 assert.deepEqual(await unpackCloudResponse(packCloudResponse({ok:true,...body})),{ok:true,...body});
});
test('legacy small bodies remain supported and oversized fallback never silently drops records',async()=>{
 const small={state:{'moneylith.personal.income':'[]'},revision:null};
 assert.equal(await packCloudRequest(small),JSON.stringify(small));
 assert.equal(unpackCloudRequest(small),small);assert.equal(await unpackCloudResponse(small),small);
 const prior=globalThis.CompressionStream;
 try{Object.assign(globalThis,{CompressionStream:undefined});await assert.rejects(packCloudRequest({notes:'a'.repeat(cloudWireLimit)}),/bijwerken|bij;/);}finally{globalThis.CompressionStream=prior;}
});
test('malformed and decompression-bomb payloads are rejected before storage',async()=>{
 for(const body of [{encoding:'unknown',payload:'x'},{encoding:cloudEncoding,payload:'!!!!'},{encoding:cloudEncoding,payload:Buffer.from('invalid').toString('base64')},{encoding:cloudEncoding,payload:gzipSync('[]').toString('base64')}])assert.throws(()=>unpackCloudRequest(body));
 const bomb={encoding:cloudEncoding,payload:gzipSync('a'.repeat(cloudDecodedLimit+1)).toString('base64')};
 assert.throws(()=>unpackCloudRequest(bomb));await assert.rejects(unpackCloudResponse(bomb));
});
