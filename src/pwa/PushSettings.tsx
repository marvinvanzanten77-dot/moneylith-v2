import {useEffect,useState} from 'react';
import {cloudRequest} from '../storage/cloudSync';
import {Button} from '../components/WorkspaceUI';
const supported=()=>typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
export async function disableDevicePush(){
  if(!supported())return;
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=await registration?.pushManager.getSubscription();
  if(subscription){
    await cloudRequest('push','POST',{operation:'unsubscribe',endpoint:subscription.endpoint});
    await subscription.unsubscribe();
  }
}
export function PushSettings(){
  const [key,setKey]=useState<string|null>(null),[active,setActive]=useState(false),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  const available=supported()&&(!ios||installed);
  useEffect(()=>{
    let alive=true;
    if(!available){setBusy(false);return;}
    void (async()=>{
      const registration=await navigator.serviceWorker.getRegistration('/');
      const subscription=await registration?.pushManager.getSubscription();
      const data=await cloudRequest('push','POST',{operation:'status',endpoint:subscription?.endpoint});
      if(alive){setKey(data.publicKey);setActive(!!subscription&&data.subscribed);}
    })().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Pushstatus niet bereikbaar.');}).finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;};
  },[available]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage('');setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Meldingen konden niet worden ingesteld.');}finally{setBusy(false);}};
  const enable=()=>{
    // Request directly from the tap, before any awaited server operation (required on iOS).
    const permission=Notification.requestPermission();
    void run(async()=>{
      if(await permission!=='granted')throw Error('Toestemming niet gegeven. Je kunt meldingen toestaan bij de instellingen van je browser of telefoon.');
      if(!key)throw Error('Pushmeldingen zijn nog niet beschikbaar. Herlaad en probeer opnieuw.');
      const registration=await navigator.serviceWorker.getRegistration('/');
      if(!registration?.active)throw Error('De app wordt nog voorbereid. Herlaad en probeer opnieuw.');
      let sub=await registration.pushManager.getSubscription();
      const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      if(sub?.options.applicationServerKey&&Array.from(new Uint8Array(sub.options.applicationServerKey)).join()!==Array.from(bytes).join()){await sub.unsubscribe();sub=null;}
      sub??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      await cloudRequest('push','POST',{operation:'subscribe',subscription:sub.toJSON()});
      setActive(true);setMessage('Aangezet op dit apparaat. Verstuur een test om de ontvangst te controleren.');
    });
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 p-3" aria-label="Pushmeldingen">
    <h3 className="font-semibold">Meldingen op dit apparaat</h3>
    <p className="text-sm">Ook als Moneylith gesloten is. Je vergrendelscherm toont geen bedragen of rekeninggegevens.</p>
    {!available?<p className="text-sm">{ios?'Open Moneylith vanaf je beginscherm. Op iPhone heb je iOS 16.4 of nieuwer nodig. Voeg de app via Safari → Deel → Zet op beginscherm toe.':'Deze browser ondersteunt hier geen pushmeldingen. Probeer een actuele versie van Chrome, Edge, Firefox of Safari.'}</p>:<>
      <p className="text-sm">{busy?'Even controleren…':active?'Aangezet op dit apparaat.':key?'Nog niet aangezet op dit apparaat.':'Push is nog niet beschikbaar. Herlaad om opnieuw te controleren.'}</p>
      <div className="flex flex-wrap gap-2">
        {!active?<Button disabled={busy||!key} onClick={enable}>Meldingen aanzetten</Button>:<>
          <Button disabled={busy} onClick={()=>void run(async()=>{
            const sub=await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
            if(!sub){setActive(false);throw Error('Zet meldingen opnieuw aan.');}
            await cloudRequest('push','POST',{operation:'test',endpoint:sub.endpoint});
            setMessage('Test aangeboden aan de pushdienst. Controleer of de melding op je apparaat verschijnt.');
          })}>Testmelding</Button>
          <Button disabled={busy} onClick={()=>void run(async()=>{await disableDevicePush();setActive(false);setMessage('Meldingen uitgezet op dit apparaat.');})}>Uitschakelen</Button>
        </>}
      </div>
    </>}
    {message&&<p className="text-sm" role="status">{message}</p>}{error&&<p className="text-sm text-amber-800" role="alert">{error}</p>}
    <p className="text-xs text-slate-600">Elke vijftien minuten controleren we je laatst opgeslagen gegevens. Synchroniseer je bank zelf voor nieuwe transacties. Bestaande meldingen van vóór het aanzetten worden niet alsnog verstuurd. Uitloggen zet push op dit apparaat uit.</p>
  </section>;
}
