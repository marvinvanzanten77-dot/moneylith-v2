import {addDays, missingThrough, project, type Input, type Scenario} from '../projection/engine';

/** Presentation-only partial forecast. Never promotes incomplete data to a complete financial verdict. */
export function forecastDisplay(input:Input,horizon:number,scenario:Scenario|null=null) {
  const strict=project(input,scenario);
  const provisional=strict.timeline.slice(0,horizon).some(p=>p.cash===null);
  const issues=missingThrough(input,addDays(input.asOf,horizon))
    .filter(s=>!s.startsWith('Huidige reserveringen niet ingevuld'));
  // Reserves do not affect bank cash. Missing cash amounts/dates stay in the
  // issue list and source model, instead of becoming invented zero entries.
  const known:Input={...input,missing:[],events:input.events.filter(e=>e.amount!==null&&e.date!==null)};
  const source=provisional?known:input;
  return {provisional,issues,base:project(source),alt:scenario?project(source,scenario):null};
}
