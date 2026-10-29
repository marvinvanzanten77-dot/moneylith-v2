import test from 'node:test';import assert from 'node:assert/strict';
import {agentHistory,relevantHistory,agentDocuments,enterSends} from '../src/ai/agentMemory';
import {cloudKey} from '../src/storage/cloudState';
test('Enter sends, Shift+Enter and IME do not',()=>{
 assert.equal(enterSends({key:'Enter',shiftKey:false,nativeEvent:{}}),true);
 assert.equal(enterSends({key:'Enter',shiftKey:true,nativeEvent:{}}),false);
 assert.equal(enterSends({key:'Enter',shiftKey:false,nativeEvent:{isComposing:true}}),false);
});
test('bounded memory preserves older context beyond twelve turns, rejects injected roles',()=>{
 const history=Array.from({length:80},(_,n)=>({role:'user',content:'Context '+n}));
 const result=agentHistory([{role:'system',content:'instruction'},...history]);
 assert.equal(result.length,80);assert.equal(result[0].content,'Context 0');
 assert.equal(agentHistory(Array.from({length:150},()=>({role:'user',content:'x'}))).length,100);
 assert.ok(agentHistory([{role:'user',content:'x'.repeat(100001)}]).length===0);
});
test('private document memory validates size, type, duplicates and cloud namespace',()=>{
 const d={id:'one',name:'brief.txt',text:'Factuur 120 euro',note:'Tekstbestand',createdAt:'2026-10-29T12:00:00Z'};
 assert.equal(agentDocuments([d])[0].text,d.text);
 assert.throws(()=>agentDocuments([d,d]));
 assert.throws(()=>agentDocuments([{...d,text:''}]));
 assert.throws(()=>agentDocuments([{...d,text:'x'.repeat(20001)}]));
 assert.throws(()=>agentDocuments(Array.from({length:6},(_,i)=>({...d,id:String(i),text:'x'.repeat(20000)}))));
 assert.equal(cloudKey('moneylith.personal.agentDocuments.v1'),true);
});

test('prompt context selects relevant older memories without sending the entire archive',()=>{
 const history=Array.from({length:100},(_,i)=>({role:'user' as const,content:i===0?'Mijn project heet merel':'Los bericht '+i}));
 const selected=relevantHistory(history,'Hoe gaat het met project merel?');
 assert.ok(selected.some(m=>m.content.includes('merel')));assert.equal(selected.length,17);
 assert.ok(relevantHistory(history,'Hallo').length<=16);
});
