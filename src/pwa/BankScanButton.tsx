import {useState} from 'react';
import {runBankScan} from '../storage/cloudSync';
import {Button} from '../components/WorkspaceUI';
export function BankScanButton(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 return <div className="space-y-2 text-sm"><Button disabled={busy} onClick={()=>void(async()=>{
  setBusy(true);setMessage('');setFailed(false);
  try{const scan=await runBankScan();setMessage(scan.message);setFailed(scan.failed>0);}catch(e){setMessage(e instanceof Error?e.message:'Bankcontrole mislukt.');setFailed(true);}finally{setBusy(false);}
 })()}>{busy?'Bankgegevens ophalen…':'Bankgegevens bijwerken'}</Button>{message&&<p role={failed?'alert':'status'}>{message}</p>}</div>;
}
