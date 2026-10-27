/** Same definition for Planning and Debts: salary-period estimate, not current spendable cash. */
export function periodRoom(forecast:{income:number|null;fixed:number|null;debt:number|null}):number|null {
 return forecast.income===null||forecast.fixed===null||forecast.debt===null?null:forecast.income-forecast.fixed-forecast.debt;
}

/** An explicitly checked empty section is zero; a missing amount in an existing row is not. */
export function reviewedPeriodForecast(report:{forecast:{income:number|null;fixed:number|null;debt:number|null};rows:Array<{kind:string;route?:string}>},readiness?:{income:boolean;fixed:boolean}) {
 const forecast={...report.forecast};
 for(const kind of ['income','fixed'] as const) {
  if(readiness?.[kind]&&!report.rows.some(r=>r.kind===kind&&r.route!=='withheld'))forecast[kind]=0;
 }
 return forecast;
}
