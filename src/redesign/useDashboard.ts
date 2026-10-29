import { useEffect, useMemo, useState } from 'react';
import { collectCloudState } from '../storage/cloudState';
import { today, type Options } from '../projection/engine';
import {workspaceModel,stored} from './workspaceModel';
import {salaryPeriod,periodPlansKey,capturePeriodPlan,type PeriodPlans} from '../bank/periodReconciliation';
import { dashboard } from './dashboard';

export function useDashboard(options: Options) {
  const read = () => ({ state: collectCloudState(localStorage), date: today() });
  const [snapshot, setSnapshot] = useState(read);
  useEffect(() => {
    const refresh = () => setSnapshot(read());
    const events = ['moneylith:cloud-restored', 'moneylith:local-change', 'storage', 'focus'];
    events.forEach(event => window.addEventListener(event, refresh));
    const timer = setInterval(() => setSnapshot(s => s.date === today() ? s : read()), 60000);
    return () => { events.forEach(event => window.removeEventListener(event, refresh)); clearInterval(timer); };
  }, []);
  useEffect(()=>{
    const latest=collectCloudState(localStorage),asOf=today(),period=salaryPeriod(asOf);
    const plans=stored<PeriodPlans>(latest,periodPlansKey,{});
    if(plans[period])return;
    const plan=workspaceModel(latest,period,asOf).latestPlan;
    if(!plan.rows.length&&!plans[period])return;
    const next=capturePeriodPlan(plans,plan,asOf);
    if(JSON.stringify(next)===JSON.stringify(plans))return;
    try{localStorage.setItem(periodPlansKey,JSON.stringify(next));window.dispatchEvent(new Event('moneylith:local-change'));}
    catch{window.dispatchEvent(new CustomEvent('moneylith:storage-error',{detail:'De periode-inschatting kon niet worden opgeslagen. Eerdere gegevens blijven bewaard.'}));}
  },[snapshot]);
  return useMemo(() => ({...dashboard(snapshot.state, snapshot.date, options),state:snapshot.state,asOf:snapshot.date}), [snapshot, options]);
}
