import {useState} from 'react';
import {choiceAssessment,type ChoiceLimits} from '../bank/choiceGuidance';
import type {SpendingPot} from '../bank/spending';
import {Button,Input} from './WorkspaceUI';
import {formatCurrency} from '../utils/format';
const euro=(cents:number)=>formatCurrency(cents/100,true);
export function ChoiceGuidance({pot,limits,onSave,room,current}:{pot:SpendingPot;limits:ChoiceLimits;onSave:(label:string,cents:number|null)=>void;room:number|null;current:boolean}){
 const choice=choiceAssessment(pot,limits);
 const [editing,setEditing]=useState(false),[value,setValue]=useState(''),[error,setError]=useState('');
 const budgeted=['Tanken','Boodschappen'].includes(pot.label)||pot.label.endsWith(' — boven maandbudget');
 const warning=choice.status==='over'||choice.status==='near'||current&&room!==null&&room<=0;
 return <div className={`space-y-2 rounded-xl p-3 text-sm ${warning?'bg-amber-50 text-amber-950':'bg-slate-50 text-slate-700'}`}>
   <p className="font-semibold">{choice.title}</p>
   {!budgeted&&<p className="font-medium">{choice.limit===null?'Nog geen keuzegrens ingesteld.':choice.status==='over'?`${euro(pot.cents-choice.limit)} boven je maandgrens van ${euro(choice.limit)}. Plan voorlopig geen extra optionele aankopen in dit potje.`:`${euro(pot.cents)} van ${euro(choice.limit)} gebruikt; ${euro(choice.remaining!)} binnen je grens over.${choice.status==='near'?' Je grens komt in zicht.':''}`}</p>}
   {current?<p>{room===null?'Betaalbaarheid is nog onbekend. Controleer je ontbrekende invoer en reserveringen in Vooruitblik.':room<=0?'Je verwachting voor de komende maand biedt geen ruimte voor extra uitgaven. Kies voorlopig een alternatief zonder extra kosten.':'Een keuzegrens is geen vrij besteedbaar saldo. Controleer vóór een extra aankoop ook je komende betalingen en reserveringen.'}</p>:<p>Dit is een terugblik op deze maand, geen oordeel over je huidige betaalbaarheid.</p>}
   <details><summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600">Een haalbare volgende stap</summary><p className="mt-2">{choice.tip}</p></details>
   {!budgeted&&!editing&&<Button onClick={()=>{setValue(choice.limit===null?'':String(choice.limit/100));setError('');setEditing(true);}}>Maandgrens kiezen</Button>}
   {editing&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();try{if(!value.trim()||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e7)throw Error('Vul een geldig bedrag in.');onSave(pot.label,Math.round(Number(value)*100));setEditing(false);}catch(e){setError(e instanceof Error?e.message:'Opslaan mislukt.');}}}>
    <label>Maandgrens {pot.label}<Input aria-label={'Maandgrens '+pot.label} type="number" min="0" max="10000000" step="0.01" value={value} onChange={e=>setValue(e.target.value)} required/></label>
    <p className="text-xs">Geldt als vergelijkingsgrens voor je maanduitgaven, ook voor eerdere aankopen. Wordt niet als vaste last afgetrokken. Nul betekent: geen uitgaven gepland.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit">Bewaren</Button><Button type="button" onClick={()=>setEditing(false)}>Annuleren</Button>{choice.limit!==null&&<Button type="button" onClick={()=>{try{onSave(pot.label,null);setEditing(false);}catch(e){setError(e instanceof Error?e.message:'Opslaan mislukt.');}}}>Grens verwijderen</Button>}</div>
    {error&&<p role="alert">{error}</p>}
   </form>}
 </div>;
}
