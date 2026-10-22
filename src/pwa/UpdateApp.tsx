import {useState} from 'react';
import {prepareCloudReload} from '../storage/cloudSync';
import {latestVersion,updateUrl,updateWorker} from './update';
export function UpdateApp(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const update=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    try{
      if(!navigator.onLine)throw Error('Je bent offline. Maak verbinding om de app bij te werken.');
      const version=await latestVersion();
      if('serviceWorker' in navigator){
        const registration=await navigator.serviceWorker.getRegistration('/');
        if(registration)await updateWorker(registration);
      }
      await prepareCloudReload();
      // A fresh document loads the release's hashed assets; data and push registration stay intact.
      window.location.replace(updateUrl(window.location.href,version));
    }catch(e){setError(e instanceof Error?e.message:'Bijwerken is niet gelukt. Probeer het opnieuw.');setBusy(false);}
  };
  return <div className="space-y-2 text-sm">
    <button type="button" className="min-h-11 rounded-xl border border-current px-4 py-2 font-medium hover:opacity-80 focus-visible:outline focus-visible:outline-2 disabled:opacity-50" disabled={busy} onClick={()=>void update()}>{busy?'App bijwerken…':'App bijwerken'}</button>
    <p className="text-xs opacity-80">Sla open bewerkingen eerst op. De app herlaadt; je opgeslagen gegevens en meldingsinstellingen blijven behouden.</p>
    {busy&&<p role="status">Nieuwste versie controleren en opgeslagen wijzigingen synchroniseren…</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
