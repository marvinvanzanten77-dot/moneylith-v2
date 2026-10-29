import {useEffect,useRef,useState} from 'react';
import {ChatRequestGuard,loadChat,chatKey} from '../ai/conversation';
import type {ChatMessage} from '../ai/context';
import {cloudRequest,prepareCloudReload,refreshCloudChanges} from '../storage/cloudSync';
type Receipt={id:string;at:string;summary:string;undone:boolean};
export function AgentChat(){
 const [messages,setMessages]=useState(()=>loadChat('personal')),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[changes,setChanges]=useState<Receipt[]>([]);
 const guard=useRef(new ChatRequestGuard());
 const pending=useRef<{text:string;id:string}|null>(null);
 const refresh=async()=>{const data=await cloudRequest('agent','POST',{operation:'status'});return data.changes as Receipt[];};
 useEffect(()=>{let active=true;void refresh().then(r=>{if(active)setChanges(r);}).catch(()=>{if(active)setError('Log in op je privéomgeving om de assistent te gebruiken.');});return()=>{active=false;guard.current.cancel();};},[]);
 const save=(next:ChatMessage[])=>{localStorage.setItem(chatKey('personal'),JSON.stringify(next.slice(-24)));window.dispatchEvent(new Event('moneylith:local-change'));setMessages(next.slice(-24));};
 const run=async(operation:'chat'|'undo',receiptId?:string)=>{
  if(busy||operation==='chat'&&!question.trim())return;
  const request=guard.current.start(),text=question.trim();setBusy(true);setError('');
  try{
   if(localStorage.getItem('moneylith.storage.mode')==='"local"')throw Error('Laad bij je profiel eerst je cloudadministratie om wijzigingen op al je apparaten te verwerken.');
   if(operation==='chat'){
    if(pending.current?.text!==text){pending.current={text,id:crypto.randomUUID()};save([...messages,{role:'user',content:text}]);}
   }
   await prepareCloudReload();
   const result=await cloudRequest('agent','POST',{operation,question:text,requestId:pending.current?.id??crypto.randomUUID(),receiptId});
   // Merge the authoritative server changes with any unrelated local edits.
   await refreshCloudChanges();
   if(!request.current())return;
   save([...loadChat('personal'),{role:'assistant',content:result.content+(operation==='chat'&&!result.changed&&!result.receipt?'\n\nGeen gegevens gewijzigd.':'')}]);pending.current=null;setQuestion('');setChanges(await refresh());
   await prepareCloudReload();
  }catch(e){if(request.current()){setError(e instanceof Error?e.message:'De opdracht kon niet worden afgerond. Controleer de laatste wijzigingen.');try{setChanges(await refresh());}catch{/* Keep visible prior receipts. */}}}
  finally{if(request.current())setBusy(false);}
 };
 return <div className="ml-agent"><p className="ml-help">Vraag om inzicht of geef een concrete opdracht. Administratieve wijzigingen worden direct opgeslagen; de assistent voert geen bankbetalingen uit.</p>
 <div className="ml-agent-messages" role="log" aria-label="Gesprek met Moneylith">{messages.length?messages.map((m,i)=><div className={'ml-agent-message '+m.role} key={i}><small>{m.role==='user'?'Jij':'Moneylith'}</small><p>{m.content}</p></div>):<p className="ml-help">Bijvoorbeeld: “Voeg een spaarrekening toe” of “Ik heb een betalingsregeling getroffen”. Ik vraag door als gegevens ontbreken.</p>}</div>
 <form onSubmit={e=>{e.preventDefault();void run('chat');}}><label htmlFor="agent-question">Wat wil je weten of bijwerken?</label><textarea id="agent-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={6000} rows={3} disabled={busy}/><button className="nw-primary" disabled={busy||!question.trim()}>{busy?'Bezig met verwerken…':'Versturen'}</button></form>
 {busy&&<p className="ml-help" role="status">De server verwerkt je opdracht, ook als je dit venster sluit. Het resultaat verschijnt bij Laatste wijzigingen.</p>}
 {error&&<p role="alert" className="ml-warning">{error}</p>}
 <button className="ml-text-button" disabled={busy} onClick={()=>{guard.current.cancel();try{save([]);pending.current=null;setError('');}catch{setError('Het gesprek kon niet worden gewist.');}}}>Gesprek wissen</button>
 {changes.length>0&&<details><summary>Laatste wijzigingen</summary>{changes.map(r=><div className="ml-agent-receipt" key={r.id}><p>{r.summary}</p><small>{new Date(r.at).toLocaleString('nl-NL')}{r.undone?' · Ongedaan gemaakt':''}</small>{!r.undone&&<button className="ml-text-button" disabled={busy} onClick={()=>void run('undo',r.id)}>Ongedaan maken</button>}</div>)}</details>}
 </div>;
}
