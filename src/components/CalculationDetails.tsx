import {formatCurrency} from '../utils/format';
export function CalculationDetails({children,title='Hoe is dit berekend?'}:{children:React.ReactNode;title?:string}){
 return <details className="w-full rounded-xl border border-current/20 p-3 text-sm" data-calculation-details><summary className="cursor-pointer font-semibold">{title}</summary><div className="mt-3 space-y-2">{children}</div></details>;
}
export const calculationMoney=(cents:number|null|undefined)=>cents==null?'Nog niet bekend':formatCurrency(cents/100);
