import {BankScanStatus} from './BankScanStatus';
import {CalculationDetails} from './CalculationDetails';
import {useState} from 'react';
import type {MobileBankBalance} from '../mobile/bankBalance';
import {runBankScan} from '../storage/cloudSync';
import {formatCurrency} from '../utils/format';
export function BankBalanceSync({bank}:{bank?:MobileBankBalance}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/10 p-3 text-slate-100" data-bank-balance>
  <div><p className="text-xs">Laatst opgehaald banksaldo · persoonlijke rekeningen samen</p><p className="text-xl font-semibold">{bank?.cents!=null?formatCurrency(bank.cents/100):'Nog niet opgehaald'}</p><p className="text-xs text-slate-300">{bank?.fetchedAt?new Date(bank.fetchedAt).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}):'Ophaalmoment onbekend'}</p></div>
  <button type="button" disabled={busy} className="rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50" onClick={async()=>{setBusy(true);setStatus('');try{const scan=await runBankScan();setStatus(scan.message);}catch(e){setStatus(e instanceof Error?e.message:'Synchroniseren mislukt. Eerdere gegevens blijven behouden.');}finally{setBusy(false);}}}>{busy?'Synchroniseren…':'Saldo en betalingen synchroniseren'}</button>
  <BankScanStatus/>
  <CalculationDetails><p>Som van de laatst opgehaalde EUR-saldi van je actieve persoonlijke gekoppelde bankrekeningen. Een rekening die als zakelijk is ingesteld telt niet mee. Bij een ontbrekend saldo blijft de som onbekend.</p><p>Het ophaalmoment is het oudste saldomoment van deze rekeningen. Reeds geboekte betalingen zitten in dit saldo. Geplande lasten, schulden en reserveringen zijn hier niet nogmaals van afgetrokken.</p></CalculationDetails>
  <p className="w-full text-xs text-slate-300">Providergegevens; geen garantie voor een nieuwe verversing bij de bank. Dit saldo is niet hetzelfde als vrij besteedbaar geld.</p>{status&&<p role="status" className="w-full text-sm">{status}</p>}
 </div>;
}
