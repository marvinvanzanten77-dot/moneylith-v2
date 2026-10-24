import {cloudCommand} from '../utils/cloudStore.js';
import {amsterdamDate,type Signal} from '../../src/monitoring/engine.js';
/** A fixed, disclosed sample, not coverage of all Gelderland or a distance ranking. */
export const stations = [
 ['arnhem-eduard-van-beinumlaan','Arnhem · Eduard van Beinumlaan'],
 ['apeldoorn-arnhemseweg','Apeldoorn · Arnhemseweg'],
 ['bemmel-herckenrathweg','Bemmel · Herckenrathweg'],
 ['bennekom-dr-w-dreeslaan','Bennekom · Dr. W. Dreeslaan'],
] as const;
export const stationUrl=(id:string)=>`https://www.tinq.nl/tankstations/${id}`;
export type FuelSample={station:string;day:string;fetchedAt:string;milliEuros:number};
export type FuelState={checkedAt:string|null;failed:number;samples:FuelSample[]};
const key='ml:fuel:tinq-e10:v1';
export const emptyFuel=():FuelState=>({checkedAt:null,failed:0,samples:[]});
/** Read only the named product's pump price; advisory prices and other products are never substitutes. */
export function parseTinqE10(html:string){
 const blocks=html.split(/<div\b[^>]*class="[^"]*node--type-price[^\"]*"[^>]*>/);
 const match=blocks.filter(b=>/field--name-taxonomy-term-title[^>]*>[\s\S]*?<p>\s*Euro95 E10\s*<\/p>/.test(b));
 if(match.length!==1)throw Error('Euro95 E10-prijs ontbreekt of is dubbel.');
 const tags=match[0].match(/<div\b[^>]*field--name-field-prices-price-pump[^>]*>/g)??[];
 const value=tags.length===1?tags[0].match(/\bcontent="([0-9]+\.[0-9]{3})"/)?.[1]:undefined;
 if(!value)throw Error('Onbekend prijsformaat.');
 const price=Math.round(Number(value)*1000);
 if(!Number.isSafeInteger(price)||price<500||price>5000)throw Error('Prijs buiten controlebereik.');
 return price;
}
export async function getFuel():Promise<FuelState>{
 const raw=await cloudCommand(['GET',key]);
 if(raw===null)return emptyFuel();
 const value=JSON.parse(String(raw)) as FuelState;
 if(!Array.isArray(value.samples)||value.samples.length>200||value.samples.some(s=>!stations.some(([id])=>id===s.station)||!Number.isSafeInteger(s.milliEuros)||s.milliEuros<500||s.milliEuros>5000||!Number.isFinite(Date.parse(s.fetchedAt))||s.day!==amsterdamDate(new Date(s.fetchedAt))))throw Error('Ongeldige brandstofhistorie.');
 return value;
}
export function mergeFuel(previous:FuelState,samples:FuelSample[],failed:number,now:Date):FuelState{
 const since=amsterdamDate(new Date(now.getTime()-30*86400000));
 const merged=new Map(previous.samples.filter(s=>s.day>=since).map(s=>[s.station+':'+s.day,s]));
 for(const s of samples)merged.set(s.station+':'+s.day,s); // latest observation per station per day
 return {checkedAt:now.toISOString(),failed,samples:[...merged.values()]};
}
export async function scanFuel(now=new Date(),fetcher:typeof fetch=fetch):Promise<FuelState>{
 const previous=await getFuel();
 if(previous.checkedAt&&now.getTime()-Date.parse(previous.checkedAt)<3600000)return previous;
 // Global lock: manual requests cannot multiply external requests or overwrite history concurrently.
 if(await cloudCommand(['SET',key+':lock','1','NX','EX',60])!=='OK')return previous;
 try{
  const results=await Promise.allSettled(stations.map(async([station])=>{
   const r=await fetcher(stationUrl(station),{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'text/html'}});
   if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('Prijsbron niet bereikbaar.');
   const html=await r.text();if(html.length>2000000)throw Error('Te groot antwoord.');
   return {station,day:amsterdamDate(now),fetchedAt:now.toISOString(),milliEuros:parseTinqE10(html)};
  }));
  const samples=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const next=mergeFuel(previous,samples,results.length-samples.length,now);
  await cloudCommand(['SET',key,JSON.stringify(next)]);return next;
 }finally{await cloudCommand(['DEL',key+':lock']);}
}
const price=(milli:number)=>(milli/1000).toLocaleString('nl-NL',{minimumFractionDigits:3,maximumFractionDigits:3});
export function fuelSignals(state:FuelState,now:Date):Signal[]{
 const day=amsterdamDate(now),from=amsterdamDate(new Date(now.getTime()-14*86400000));
 const fresh=state.samples.filter(s=>s.day===day&&now.getTime()-Date.parse(s.fetchedAt)>=0&&now.getTime()-Date.parse(s.fetchedAt)<=12*3600000);
 const signals:Signal[]=[];
 for(const current of fresh){
  const history=state.samples.filter(s=>s.station===current.station&&s.day<day&&s.day>=from).sort((a,b)=>a.milliEuros-b.milliEuros);
  if(new Set(history.map(s=>s.day)).size<7)continue;
  const middle=Math.floor(history.length/2),median=history.length%2?history[middle].milliEuros:(history[middle-1].milliEuros+history[middle].milliEuros)/2;
  const difference=current.milliEuros-median;if(Math.abs(difference)<20)continue;
  const high=difference>0,label=stations.find(([id])=>id===current.station)![1];
  signals.push({id:`personal:fuel:${day}:${current.station}:${high?'high':'low'}`,scope:'personal',kind:'fuel',month:day.slice(0,7),label:'Brandstofprijzen',title:`TinQ ${label}: ${high?'hoger':'lager'} dan recent`,message:`Euro95 E10: € ${price(current.milliEuros)} per liter volgens de opgehaalde TinQ-pagina. Minstens 2 cent ${high?'boven':'onder'} de mediaan van ${history.length} eerdere meetdagen in de afgelopen 14 dagen bij deze vestiging. ${high?'Kun je tanken veilig uitstellen? Vergelijk eerst een station op je route; morgen is niet voorspelbaar.':'Heb je brandstof nodig? Bekijk of deze vestiging op je route ligt en controleer eerst je resterende tankbudget en saldo.'} Dit is geen garantie op de pompprijs of op besparing door omrijden.`,observedCents:0,referenceCents:null});
 }
 // One fuel notification per day/direction, not one push per station. Keep the selected station named in each notice.
 return signals.sort((a,b)=>a.id.localeCompare(b.id)).filter((s,i,all)=>all.findIndex(x=>x.id.endsWith(s.id.endsWith(':high')?':high':':low'))===i).map(s=>({...s,id:`personal:fuel:${day}:${s.id.endsWith(':high')?'high':'low'}`}));
}
export function fuelOverview(state:FuelState,now:Date){
 const day=amsterdamDate(now);
 return {checkedAt:state.checkedAt,failed:state.failed,stations:stations.map(([id,name])=>{
  const samples=state.samples.filter(s=>s.station===id).sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt));
  const latest=samples[0];return {name,url:stationUrl(id),price:latest?price(latest.milliEuros):null,fetchedAt:latest?.fetchedAt??null,fresh:!!latest&&latest.day===day&&now.getTime()-Date.parse(latest.fetchedAt)>=0&&now.getTime()-Date.parse(latest.fetchedAt)<=12*3600000,days:new Set(samples.filter(s=>s.day<day&&s.day>=amsterdamDate(new Date(now.getTime()-14*86400000))).map(s=>s.day)).size};
 })};
}
