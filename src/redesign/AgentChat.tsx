import {agentHistory,agentDocuments,documentKey,enterSends,type AgentDocument} from '../ai/agentMemory';
import {readAgentAttachment} from '../ai/agentAttachments';
import {useEffect,useRef,useState} from 'react';
import {ChatRequestGuard,chatKey} from '../ai/conversation';
import type {ChatMessage} from '../ai/context';
import {cloudRequest,prepareCloudReload,refreshCloudChanges} from '../storage/cloudSync';
const loadChat=(_scope:string)=>{try{return agentHistory(JSON.parse(localStorage.getItem(chatKey('personal'))??'[]'));}catch{return [];}};
const loadDocuments=()=>{try{return agentDocuments(JSON.parse(localStorage.getItem(documentKey)??'[]'));}catch{return [];}};
type Receipt={id:string;at:string;summary:string;undone:boolean};
export function AgentChat(){
 const [messages,setMessages]=useState(()=>loadChat('personal')),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[changes,setChanges]=useState<Receipt[]>([]);
 const [documents,setDocuments]=useState<AgentDocument[]>(loadDocuments),[reading,setReading]=useState(false),[phase,setPhase]=useState('');
 const upload=async(files:FileList|null)=>{
  if(!files?.length)return;
  setReading(true);setError('');
  try{
   if(files.length>3)throw Error('Voeg maximaal drie bestanden tegelijk toe.');
   const next=[...loadDocuments()];
   for(const file of Array.from(files))next.push(await readAgentAttachment(file));
   const valid=agentDocuments(next);localStorage.setItem(documentKey,JSON.stringify(valid));setDocuments(valid);window.dispatchEvent(new Event('moneylith:local-change'));
   await prepareCloudReload();
  }catch(e){setError(e instanceof Error?e.message:'Bijlage lezen mislukt.');}finally{setReading(false);}
 };
 const removeDocument=(id:string)=>{try{const next=loadDocuments().filter(d=>d.id!==id);localStorage.setItem(documentKey,JSON.stringify(next));setDocuments(next);window.dispatchEvent(new Event('moneylith:local-change'));void prepareCloudReload().catch(()=>setError('Verwijdering nog niet met de cloud gesynchroniseerd.'));}catch{setError('Bijlage verwijderen lukt niet.');}};
 useEffect(()=>{const refresh=()=>{setMessages(loadChat('personal'));setDocuments(loadDocuments());};window.addEventListener('moneylith:cloud-restored',refresh);return()=>window.removeEventListener('moneylith:cloud-restored',refresh);},[]);
 const guard=useRef(new ChatRequestGuard());
 const pending=useRef<{text:string;id:string}|null>(null);
 const refresh=async()=>{const data=await cloudRequest('agent','POST',{operation:'status'});return data.changes as Receipt[];};
 useEffect(()=>{let active=true;void refresh().then(r=>{if(active)setChanges(r);}).catch(()=>{if(active)setError('Log in op je privéomgeving om de assistent te gebruiken.');});return()=>{active=false;guard.current.cancel();};},[]);
 const save=(next:ChatMessage[])=>{localStorage.setItem(chatKey('personal'),JSON.stringify(agentHistory(next)));window.dispatchEvent(new Event('moneylith:local-change'));setMessages(agentHistory(next));};
 const run=async(operation:'chat'|'undo',receiptId?:string)=>{
  if(busy||reading||operation==='chat'&&!question.trim())return;
  const request=guard.current.start(),text=question.trim();setBusy(true);setError('');
  try{
   if(localStorage.getItem('moneylith.storage.mode')==='"local"')throw Error('Laad bij je profiel eerst je cloudadministratie om wijzigingen op al je apparaten te verwerken.');
   if(operation==='chat'){
    if(pending.current?.text!==text){pending.current={text,id:crypto.randomUUID()};save([...messages,{role:'user',content:text}]);}
   }
   setPhase('Actuele gegevens synchroniseren…');
   await prepareCloudReload();
   setPhase('De assistent denkt mee…');
   const result=await cloudRequest('agent','POST',{operation,question:text,requestId:pending.current?.id??crypto.randomUUID(),receiptId});
   if(!request.current())return;
   save([...loadChat('personal'),{role:'assistant',content:result.content+(operation==='chat'&&!result.changed&&!result.receipt?'\n\nGeen gegevens gewijzigd.':'')}]);pending.current=null;setQuestion('');
   setPhase('Antwoord bewaren…');
   // Read-only answers need no second download/decryption of the full finances.
   if(result.changed||result.receipt)await refreshCloudChanges();
   if(result.receipt)setChanges(previous=>[result.receipt,...previous.filter(r=>r.id!==result.receipt.id)].slice(0,10));
   else if(operation==='undo')setChanges(await refresh());
   await prepareCloudReload();
  }catch(e){if(request.current()){setError(e instanceof Error?e.message:'De opdracht kon niet worden afgerond. Controleer de laatste wijzigingen.');try{setChanges(await refresh());}catch{/* Keep visible prior receipts. */}}}
  finally{if(request.current())setBusy(false);}
 };
 return <div className="ml-agent"><p className="ml-help">Vraag om inzicht of geef een concrete opdracht. Administratieve wijzigingen worden direct opgeslagen; de assistent voert geen bankbetalingen uit.</p>
 <div className="ml-agent-messages" role="log" aria-label="Gesprek met Moneylith">{messages.length?messages.map((m,i)=><div className={'ml-agent-message '+m.role} key={i}><small>{m.role==='user'?'Jij':'Moneylith'}</small><p>{m.content}</p></div>):<p className="ml-help">Bijvoorbeeld: “Voeg een spaarrekening toe” of “Ik heb een betalingsregeling getroffen”. Ik vraag door als gegevens ontbreken.</p>}</div>
 <form onSubmit={e=>{e.preventDefault();void run('chat');}}><label htmlFor="agent-question">Wat wil je weten of bijwerken?</label><textarea id="agent-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={6000} rows={3} disabled={busy||reading} onKeyDown={e=>{if(enterSends(e)){e.preventDefault();void run('chat');}}}/><small className="ml-help">Enter verstuurt · Shift+Enter voor een nieuwe regel</small><button className="nw-primary" disabled={busy||reading||!question.trim()}>{busy?'Bezig met verwerken…':'Versturen'}</button></form>
 <label className="ml-text-button">Bijlage toevoegen<input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" multiple disabled={busy||reading} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label>
 {reading&&<p role="status">Document lezen… Bij scans kan dit even duren.</p>}
 {documents.length>0&&<details><summary>Bijlagen in geheugen ({documents.length})</summary>{documents.map(d=><div key={d.id} className="ml-agent-receipt"><strong>{d.name}</strong><p className="ml-help">{d.note}</p><details><summary>Gelezen tekst controleren</summary><pre className="ml-document-text">{d.text}</pre></details><button disabled={busy||reading} className="ml-text-button" onClick={()=>removeDocument(d.id)}>Bijlage verwijderen</button></div>)}</details>}
 <p className="ml-help">Maximaal 100 berichten en 10 bijlagen worden in je privéadministratie bewaard en als AI-context gebruikt. Het originele bestand wordt niet bewaard. Uploaden verandert je financiën niet; geef daarna je opdracht.</p>
 {busy&&<p className="ml-help" role="status">{phase||'De server verwerkt je opdracht…'} Je kunt het venster minimaliseren.</p>}
 {error&&<p role="alert" className="ml-warning">{error}</p>}
 <button className="ml-text-button" disabled={busy} onClick={()=>{guard.current.cancel();try{save([]);pending.current=null;setError('');}catch{setError('Het gesprek kon niet worden gewist.');}}}>Gesprek wissen</button>
 {changes.length>0&&<details><summary>Laatste wijzigingen</summary>{changes.map(r=><div className="ml-agent-receipt" key={r.id}><p>{r.summary}</p><small>{new Date(r.at).toLocaleString('nl-NL')}{r.undone?' · Ongedaan gemaakt':''}</small>{!r.undone&&<button className="ml-text-button" disabled={busy} onClick={()=>void run('undo',r.id)}>Ongedaan maken</button>}</div>)}</details>}
 </div>;
}
