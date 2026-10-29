import {useState} from 'react';
import type {IncomeItem,FixedCostManualItem,MoneylithGoal} from '../types';
import {costForMonth,setCostMonth} from '../logic/monthlyCosts';
import {moneyInput,saveRecord,notifySaved,paymentDate} from './workspaceModel';
import {Sheet} from './WorkspaceParts';
type Common={month:string;onClose:()=>void;onSaved:()=>void};
export type EditRequest={kind:'income';item:IncomeItem|null}|{kind:'fixedCosts';item:FixedCostManualItem|null;budget?:string}|{kind:'goals';item:MoneylithGoal|null};
export function RecordEditor({request,month,onClose,onSaved}:Common&{request:EditRequest}){
 const original=request.item;
 const fixed=request.kind==='fixedCosts'?request.item:null;
 const resolved=fixed?costForMonth(fixed,month):null;
 const goal=request.kind==='goals'?request.item:null;
 const income=request.kind==='income'?request.item:null;
 const [name,setName]=useState(goal?.label??fixed?.naam??income?.naam??(request.kind==='fixedCosts'?request.budget??'':''));
 const amount=goal?.targetAmount??(resolved?.amountEntered===false?undefined:resolved?.bedrag)??(income?.amountEntered===false?undefined:income?.bedrag);
 const [value,setValue]=useState(amount===undefined?'':String(amount));
 const [date,setDate]=useState(String(fixed?.dagVanMaand||income?.dagVanMaand||''));
 const [current,setCurrent]=useState(String(goal?.currentAmount??''));
 const [deadline,setDeadline]=useState(goal?.deadline??'');
 const [billingMonth,setBillingMonth]=useState(month);
 const [variable,setVariable]=useState(!!fixed?.monthlyAmounts&&fixed.monthlyVariable!==false);
 const [route,setRoute]=useState<FixedCostManualItem['paymentRoute']>(fixed?.paymentRoute??'bank');
 const [error,setError]=useState('');
 const save=()=>{try{
  if(!name.trim())throw Error('Geef deze post een naam.');const amount=moneyInput(value),id=original?.id??crypto.randomUUID();
  if(request.kind==='goals'){
   const saved=moneyInput(current);const next:MoneylithGoal={...goal,id,label:name.trim(),targetAmount:amount,currentAmount:saved,deadline:deadline||undefined,monthlyContribution:goal?.monthlyContribution??0,type:goal?.type??'savings',isActive:goal?.isActive??true};
   if(amount===0)throw Error('Kies een doelbedrag groter dan nul.');
   saveRecord(localStorage,'goals',goal,next);
  }else{
   const day=date===''?0:Number(date);if(!Number.isInteger(day)||day<0||day>31)throw Error('Kies een betaaldag van 1 tot en met 31, of laat deze leeg.');
   if(request.kind==='income')saveRecord<IncomeItem>(localStorage,'income',income,{...income,id,naam:name.trim(),bedrag:amount,amountEntered:true,dagVanMaand:day||undefined,...(income?.bankEvidence?{followLatestBank:false}:{}),reviewedInput:undefined});
   else {
    let next:FixedCostManualItem={...fixed,id,naam:name.trim(),bedrag:amount,amountEntered:true,dagVanMaand:day,paymentRoute:route,reviewedInput:undefined,bankObservedOnly:false};
    if(request.budget&&!fixed)next={...next,budgetCategory:request.budget,budgetSince:month};
    if(variable)next=setCostMonth({...next,monthlyVariable:true},billingMonth,amount);else if(fixed?.monthlyAmounts)next.monthlyVariable=false;
    saveRecord(localStorage,'fixedCosts',fixed,next);
   }
  }
  notifySaved();onSaved();onClose();
 }catch(e){setError(e instanceof Error?e.message:'Opslaan lukt nu niet. Je eerdere gegevens blijven bewaard.');}};
 return <Sheet title={request.kind==='goals'?'Jouw doel':request.kind==='income'?'Inkomen':request.budget?'Maandbudget':'Geplande uitgave'} onClose={onClose}><form className="nw-form" onSubmit={e=>{e.preventDefault();save();}}>
 <label>Naam<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>{request.kind==='goals'?'Doelbedrag':'Bedrag'} (€)<input required inputMode="decimal" placeholder="Nog niet ingevuld" value={value} onChange={e=>setValue(e.target.value)}/></label>
 {request.kind==='goals'?<><label>Al opgebouwd (€)<input required inputMode="decimal" placeholder="0 als je nog begint" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>Streefdatum (optioneel)<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><p className="nw-note">Alleen wat je werkelijk hebt opgebouwd. Een doel wijzigt je banksaldo niet.</p></>:<><label>Dag van de maand (optioneel)<input inputMode="numeric" type="number" min="1" max="31" placeholder="Nog niet bekend" value={date} onChange={e=>{setDate(e.target.value);if(request.kind==='fixedCosts'&&!fixed&&!request.budget)setBillingMonth(paymentDate(month,Number(e.target.value))?.slice(0,7)??month);}}/></label>{request.kind==='fixedCosts'&&!request.budget&&<><label>Betaalwijze<select value={route} onChange={e=>setRoute(e.target.value as typeof route)}><option value="bank">Via rekening</option><option value="card">Via bunq / creditcard</option><option value="third-party">Via iemand anders</option><option value="cash">Contant</option><option value="withheld">Al ingehouden</option></select></label><label className="nw-check"><input type="checkbox" checked={variable} onChange={e=>setVariable(e.target.checked)}/>Bedrag verschilt per maand</label>{variable&&<><label>Bedrag voor maand<input required type="month" value={billingMonth} onChange={e=>setBillingMonth(e.target.value)}/></label><p className="nw-note">Andere maanden blijven behouden.</p></>}</>}{income?.bankEvidence&&<p className="nw-note">Met een eigen bedrag zet je het volgen van de laatste bankontvangst voor deze post uit.</p>}<p className="nw-note">Dit wijzigt je verwachting, niet een geboekte bankbetaling.</p></>}
 {error&&<p role="alert" className="nw-error">{error}</p>}<button className="nw-primary" type="submit">Opslaan</button></form></Sheet>;
}
