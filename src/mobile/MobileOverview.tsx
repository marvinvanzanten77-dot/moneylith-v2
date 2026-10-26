import {CalculationDetails,calculationMoney} from '../components/CalculationDetails';
import type {MobileBankBalance} from "./bankBalance";
import {useMemo} from 'react';
import {project,addDays,type Input} from '../projection/engine';
import {SurfaceCard,Button} from '../components/WorkspaceUI';
import {formatCurrency} from '../utils/format';
export type MobileDestination='spending'|'forecast'|'bank'|'foundation';
export type MobileData={input:Input;bank?:MobileBankBalance;onNavigate:(page:MobileDestination)=>void};
const money=(value:number|null)=>value===null?'Nog onbekend':formatCurrency(value/100,true);
export function MobileOverview({input,onNavigate,bank}:MobileData){
  const forecast=useMemo(()=>project(input),[input]);
  const current=input.opening===null||input.reserve===null?null:input.opening-input.reserve;
  const next=forecast.horizons.find(h=>h.day===7)?.available??null;
  const upcoming=forecast.events.filter(e=>e.date&&e.date>input.asOf&&e.date<=addDays(input.asOf,7)&&e.amount!==0).slice(0,3);
  const unknownDates=input.events.some(e=>!e.date&&e.amount!==0);
  return <div className="space-y-4" data-mobile-overview>
    <div><p className="text-sm text-slate-400">Vandaag</p><h1 className="mt-1 text-2xl font-semibold">Je geld, in het kort</h1></div>
    <SurfaceCard className="space-y-4"><CalculationDetails><p>Opgehaald banksaldo: {calculationMoney(bank?.cents)}. Dit omvat de actieve persoonlijke bankrekeningen. Reserveringen: {calculationMoney(input.reserve)}. De verwachting gebruikt dezelfde toekomstige betalingen en resterende budgetten als Vooruitblik.</p><p>Reeds geboekte uitgaven zijn niet nogmaals afgetrokken. Zonder complete invoer blijft de verwachting onbekend.</p></CalculationDetails><div><p className="text-sm text-slate-600">{bank?"Laatst opgehaald banksaldo":"Ruimte na reserveringen"}</p><p className="mt-1 text-3xl font-semibold">{money(bank?bank.cents:current)}</p>{bank&&<p className="mt-2 text-xs text-slate-500">Gekoppelde privébanken · {bank.fetchedAt?new Date(bank.fetchedAt).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"short",timeStyle:"short"}):"ophaalmoment onbekend"}</p>}</div>{bank&&<div className="flex flex-wrap justify-between gap-2 text-sm"><span>Ruimte na reserveringen</span><strong>{money(current)}</strong></div>}<div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm"><span>Verwachting over 7 dagen</span><strong>{money(next)}</strong></div>
      <p className="text-xs text-slate-600">{current===null||next===null?'Controleer je saldi, reserveringen en ontbrekende invoer in Vooruitblik. Onbekend telt niet als nul.':'Berekend met je bevestigde basis en de aannames in Vooruitblik; geen garantie voor je banksaldo.'}</p><Button onClick={()=>onNavigate('forecast')}>Bekijk vooruitblik</Button>
    </SurfaceCard>
    <SurfaceCard className="space-y-3"><h2 className="font-semibold">Wat komt eraan?</h2><p className="text-xs text-slate-600">Komende 7 dagen · maximaal drie geplande momenten</p>{upcoming.length?<ul className="divide-y divide-slate-200">{upcoming.map(e=><li key={e.id} className="flex items-start justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{e.label}</p><p className="mt-1 text-xs text-slate-500">{e.date} · {e.basis==='input'?'Ingevoerd':'Aanname'}{e.kind==='reserve'?' · reservering':''}</p></div><strong className="shrink-0">{money(e.amount)}</strong></li>)}</ul>:<p className="text-sm">Geen gedateerde betalingen bekend voor deze periode.</p>}{unknownDates&&<p className="text-xs text-amber-800">Van sommige bedragen ontbreekt de betaaldatum. Dit overzicht is nog niet compleet.</p>}</SurfaceCard>
    <div className="grid grid-cols-2 gap-3"><Button onClick={()=>onNavigate('spending')}>Mijn potjes</Button><Button onClick={()=>onNavigate('bank')}>{input.scope==='personal'?'Bank bijwerken':'Bankstatus'}</Button></div>
  </div>;
}
