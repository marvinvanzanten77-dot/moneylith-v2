/** Existing fixed-cost records are the source of truth; monthly values are EUR, like bedrag. */
export function currentCostMonth(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 return parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value;
}
export type MonthlyCostFields={costKind?:"subscription"|"credits";bedrag:number;amountEntered?:boolean;monthlyVariable?:boolean;monthlyAmounts?:Record<string,number|null>};
export function costForMonth<T extends MonthlyCostFields>(item:T,month=currentCostMonth()):T {
 if(item.monthlyAmounts===undefined||item.monthlyVariable===false)return item;
 const map=item.monthlyAmounts;
 const value=map&&typeof map==='object'&&!Array.isArray(map)&&Object.hasOwn(map,month)?map[month]:null;
 const known=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e9;
 return {...item,bedrag:known?value:0,amountEntered:known};
}
export function setCostMonth<T extends MonthlyCostFields>(item:T,month:string,value:number|null):T{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||value!==null&&(!Number.isFinite(value)||value<0||value>1e9))throw Error('Ongeldige maand of bedrag.');
 return {...item,monthlyAmounts:{...item.monthlyAmounts,[month]:value===null?null:Math.round(value*100)/100}};
}

/** Unscheduled one-off credits are not recurring obligations or confirmed zero spending. */
export function costPlannedInMonth(item:MonthlyCostFields,month:string){
 return item.costKind!=='credits'||!!item.monthlyAmounts&&Object.hasOwn(item.monthlyAmounts,month);
}
