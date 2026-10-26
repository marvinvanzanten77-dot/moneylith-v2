import {useLocalStorage} from '../hooks/useLocalStorage';
import type {BankScan} from '../bank/processSync';
const date=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}):'Nog niet bekend';
export function BankScanStatus(){
 const [scan]=useLocalStorage<BankScan|null>('moneylith.personal.bankScan.v1',null);
 if(!scan)return <p className="w-full text-xs">Nog geen opgeslagen bankcontrole.</p>;
 const last=scan.lastSuccessfulAt??(scan.ok>0&&!scan.failed?scan.at:undefined);
 return <details className="w-full text-xs"><summary className="cursor-pointer">Laatste bankcontrole: {date(scan.at)} · {scan.failed?(scan.ok?'gedeeltelijk geslaagd':'mislukt'):scan.ok?(scan.added?'nieuwe transacties verwerkt':scan.updatedTransactions?'bestaande transacties bijgewerkt':'geen nieuwe transacties'):'geen gekoppelde rekeningen'}</summary><p className="mt-2">{scan.message}</p><p>Laatste volledig geslaagde controle: {date(last)}. Dit is het ophaalmoment bij Lunch Flow, geen garantie dat de bank nieuwe gegevens heeft aangeleverd.</p></details>;
}
