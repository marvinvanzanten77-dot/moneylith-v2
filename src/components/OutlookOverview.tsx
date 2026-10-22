import {SpendingCoach} from "./SpendingCoach";
import {useMemo,useState} from 'react';
import {outlook,type OutlookAssumption} from '../projection/outlook';
import {addDays,validDate,type Input as ProjectionInput,type Options,type Scenario} from '../projection/engine';
import {SurfaceCard,Input,Button} from './WorkspaceUI';
import {formatCurrency} from '../utils/format';
import {ProjectionDetails} from './ProjectionDetails';
const money=(n:number|null|undefined)=>n==null?'Nog onbekend':formatCurrency(n/100,true);
const labels=['Huidige verwachting','Best case','Worst case'];
const colors=['#7c3aed','#047857','#b45309'];
const dateLabel=(date:string)=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
type Props={input:ProjectionInput;options:Options;onOptions:(o:Options)=>void;scenario:Scenario|null;onScenario:(s:Scenario|null)=>void};
export function OutlookOverview(props:Props){
  // Scope changes remount the controls so personal and business assumptions never mix.
  return <OutlookContent key={props.input.scope} {...props}/>;
}
function OutlookContent(props:Props){
  const {input,scenario}=props;
  const [best,setBest]=useState<OutlookAssumption|null>(null),[worst,setWorst]=useState<OutlookAssumption|null>({amount:15000,date:addDays(input.asOf,7),monthly:true}),[horizon,setHorizon]=useState(30),[reset,setReset]=useState(0);
  const {result,error}=useMemo(()=>{try{return {result:outlook(input,best,worst,scenario),error:''};}catch(e){return {result:outlook(input,null,null),error:e instanceof Error?e.message:'Controleer je scenario.'};}},[input,best,worst,scenario]);
  const branches=[result.current,result.best,result.worst];
  const points=branches.map(r=>r?.timeline.slice(0,horizon)??[]);
  const values=points.flatMap(row=>row.flatMap(p=>p.available===null?[]:[p.available]));
  const minimum=Math.min(0,...values),maximum=Math.max(100,...values),span=maximum-minimum;
  const y=(value:number)=>170-(value-minimum)/span*140;
  const current=result.current.horizons.find(p=>p.day===horizon)?.available??null;
  const tight=result.current.timeline.slice(0,horizon).filter(p=>p.available!==null).reduce<{date:string;available:number|null}|null>((lowest,p)=>!lowest||p.available!<lowest.available!?p:lowest,null);
  return <div className="space-y-4" data-outlook>
    <SurfaceCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-purple-700">Vooruitblik</p><h2 className="mt-1 text-2xl font-semibold">Hoeveel ruimte houd je over?</h2><p className="mt-2 text-sm text-slate-600">Vandaag: {money(input.opening===null||input.reserve===null?null:input.opening-input.reserve)} na reserveringen.</p></div><div role="group" aria-label="Kijk vooruit" className="flex gap-2">{[7,30,90].map(day=><Button key={day} aria-pressed={horizon===day} variant={horizon===day?'primary':'secondary'} onClick={()=>setHorizon(day)}>{day} dagen</Button>)}</div></div>
      <p className="text-sm text-slate-600">Dezelfde financiële basis, drie mogelijke uitkomsten. Best en worst case volgen jouw aannames; het zijn geen garanties of uiterste grenzen.</p>
      {scenario&&<p className="rounded-lg bg-purple-50 p-2 text-sm">Je eigen scenario is actief en vormt de basis van alle drie de lijnen. Je kunt het onderaan aanpassen of verwijderen.</p>}
      {values.length ? <svg role="img" aria-label={`Verloop van beschikbare ruimte over ${horizon} dagen. Exacte eindbedragen staan onder de grafiek.`} viewBox="0 0 560 210" className="w-full" preserveAspectRatio="xMidYMid meet">
        {[minimum,(minimum+maximum)/2,maximum].map((value,i)=><g key={i}><line x1="76" x2="544" y1={y(value)} y2={y(value)} stroke="#e2e8f0"/><text x="70" y={y(value)+4} textAnchor="end" fontSize="11" fill="#64748b">{formatCurrency(value/100)}</text></g>)}
        <line x1="76" x2="544" y1={y(0)} y2={y(0)} stroke="#64748b" strokeDasharray="3 3"/>
        {points.map((row,i)=>row.length&&row.every(p=>p.available!==null)?<path key={i} d={row.map((p,n)=>`${n?'L':'M'} ${76+n/(horizon-1)*468} ${y(p.available!)}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth={i===0?3:2} strokeDasharray={i===0?undefined:i===1?'7 3':'2 3'}/>:null)}
        <text x="76" y="198" fontSize="11" fill="#64748b">{dateLabel(addDays(input.asOf,1))}</text><text x="544" y="198" textAnchor="end" fontSize="11" fill="#64748b">{dateLabel(addDays(input.asOf,horizon))}</text>
      </svg>:<div className="rounded-xl bg-slate-50 p-6 text-center"><p className="font-semibold">Je vooruitblik heeft nog een basis nodig</p><p className="mt-2 text-sm text-slate-600">Controleer hieronder wat ontbreekt. Onbekende bedragen worden niet als nul getekend.</p></div>}
      <div className="grid gap-3 sm:grid-cols-3">{branches.map((branch,i)=>{const value=branch?.horizons.find(p=>p.day===horizon)?.available??null;return <div key={labels[i]} className="min-w-0 rounded-xl border border-slate-200 p-3"><p className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:colors[i]}}/>{labels[i]}</p><p className="mt-2 break-words text-xl font-semibold">{i>0&&!branch?'Stel hieronder in':money(value)}</p><p className="mt-1 text-xs text-slate-500">{i===0?`Over ${horizon} dagen`:value!==null&&current!==null?`${money(value-current)} verschil met huidig`:'Nog geen verschil berekend'}</p></div>;})}</div>
      <p className="text-sm">{tight?`${tight.available!<0?'Verwacht tekort':'Minste ruimte'} op ${dateLabel(tight.date)}: ${money(tight.available)} in de huidige verwachting.`:'Vul de ontbrekende basis aan om te zien waar het krap wordt.'}</p>
      {!!result.current.missing.length&&<details className="rounded-xl bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Wat ontbreekt nog? ({result.current.missing.length})</summary><ul className="mt-2 list-disc pl-5 text-sm">{result.current.missing.map(m=><li key={m}>{m}</li>)}</ul></details>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    </SurfaceCard>
    <SurfaceCard className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Wat kan meevallen of tegenvallen?</h3><Button onClick={()=>{setBest(null);setWorst(null);setReset(v=>v+1);}}>Aannames wissen</Button></div>
      <p className="text-xs text-slate-600">Vul alleen mogelijke extra bedragen in, boven op je huidige verwachting. Bedragen zijn netto na belasting. Het startvoorbeeld is een fictief budget van €150 per maand voor onverwachte uitgaven, vanaf de gekozen datum. Je kunt dit aanpassen of wissen. Deze aannames blijven tijdelijk; je administratie verandert niet.</p>
      <div className="grid gap-5 sm:grid-cols-2"><AssumptionEditor key={'best'+reset} title="Best case: extra inkomsten" asOf={input.asOf} onChange={setBest}/><AssumptionEditor key={'worst'+reset} title="Worst case: onverwachte uitgaven" asOf={input.asOf} initial={reset===0 ? {amount:15000,date:addDays(input.asOf,7),monthly:true}:undefined} onChange={setWorst}/></div>
    </SurfaceCard>
    <SpendingCoach key={input.scope+input.asOf} scope={input.scope} purpose="income-ideas" month={input.asOf.slice(0,7)} rows={[]} available />
    <details className="rounded-2xl border border-slate-300 bg-white p-4 text-slate-900"><summary className="cursor-pointer font-semibold">Basis aanvullen, betalingen bekijken of een eigen scenario maken</summary><div className="mt-4"><ProjectionDetails {...props}/></div></details>
  </div>;
}
function AssumptionEditor({title,asOf,initial,onChange}:{title:string;asOf:string;initial?:OutlookAssumption;onChange:(v:OutlookAssumption|null)=>void}){
  const [amount,setAmount]=useState(initial ? String(initial.amount/100):''),[date,setDate]=useState(initial?.date??addDays(asOf,7)),[monthly,setMonthly]=useState(initial?.monthly??false);
  const update=(a:string,d:string,m:boolean)=>{setAmount(a);setDate(d);setMonthly(m);const value=Number(a.replace(',','.'));onChange(a.trim()&&Number.isFinite(value)&&value>=0&&validDate(d)&&d>asOf&&d<=addDays(asOf,365)?{amount:Math.round(value*100),date:d,monthly:m}:null);};
  const invalidAmount=amount.trim() && (!Number.isFinite(Number(amount.replace(',','.')))||Number(amount.replace(',','.'))<0);
  const invalidDate=!validDate(date)||date<=asOf||date>addDays(asOf,365);
  return <fieldset className="min-w-0 space-y-2"><legend className="font-semibold">{title}</legend><label className="block text-sm">Bedrag (€)<Input aria-label={title+' bedrag'} inputMode="decimal" placeholder="Nog niet gekozen" value={amount} onChange={e=>update(e.target.value,date,monthly)}/></label><label className="block text-sm">Vanaf<Input className="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 p-2" aria-label={title+' datum'} type="date" value={date} min={addDays(asOf,1)} max={addDays(asOf,365)} onChange={e=>update(amount,e.target.value,monthly)}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={monthly} onChange={e=>update(amount,date,e.target.checked)}/>Iedere maand herhalen</label>{!!invalidAmount&&<p role="alert" className="text-xs text-red-700">Vul een positief bedrag of expliciet nul in.</p>}{invalidDate&&<p role="alert" className="text-xs text-red-700">Kies een toekomstige datum binnen één jaar.</p>}</fieldset>;
}
