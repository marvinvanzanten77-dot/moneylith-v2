import type {MoneylithAccount} from '../types';
import type {BankRuleSettings} from '../bank/classificationRules';
export type MobileBankBalance={cents:number|null;fetchedAt:string|null};
/** A view of the existing provider balances, not a new financial source or spendable amount. */
export function mobileBankBalance(accounts:MoneylithAccount[],rules:BankRuleSettings):MobileBankBalance|undefined{
 const selected=accounts.filter(a=>a.active&&a.bankProvider==='lunchflow'&&rules.accountRoles[a.id]!=='business');
 if(!selected.length)return;
 const known=selected.every(a=>a.currency==='EUR'&&typeof a.bankBalance==='number'&&Number.isFinite(a.bankBalance)&&Math.abs(a.bankBalance)<=1e9);
 const dates=selected.map(a=>a.bankBalanceFetchedAt??a.bankLastSync).filter((d):d is string=>typeof d==='string'&&Number.isFinite(Date.parse(d)));
 return {cents:known?selected.reduce((sum,a)=>sum+Math.round(a.bankBalance!*100),0):null,fetchedAt:dates.length===selected.length?dates.sort()[0]:null};
}
