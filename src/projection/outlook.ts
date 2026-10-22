import { project, monthlyDates, addDays, validDate, type Input, type Scenario, type Event } from './engine.js';
export type OutlookAssumption = { amount:number; date:string; monthly:boolean };
export function outlook(input:Input, favorable:OutlookAssumption | null, adverse:OutlookAssumption | null, choice:Scenario | null = null) {
  const branch=(assumption:OutlookAssumption | null, sign:1 | -1) => {
    if(!assumption)return null;
    if(!Number.isSafeInteger(assumption.amount)||assumption.amount<0||assumption.amount>1e11||!validDate(assumption.date)||assumption.date<=input.asOf||assumption.date>addDays(input.asOf,365)||typeof assumption.monthly!=='boolean')throw Error('Vul een positief bedrag of expliciet nul in en kies een datum binnen één jaar.');
    const dates=assumption.monthly ? monthlyDates(input.asOf,Number(assumption.date.slice(8)),assumption.date):[assumption.date];
    const extra:Event[]=dates.map(date=>({id:`outlook:${sign}:${date}`,label:sign===1?'Mogelijke extra inkomsten':'Onverwachte uitgaven',date,amount:sign*assumption.amount,source:'scenario',basis:'scenario'}));
    return project({...input,events:[...input.events,...extra]},choice);
  };
  return {current:project(input,choice),best:branch(favorable,1),worst:branch(adverse,-1)};
}
