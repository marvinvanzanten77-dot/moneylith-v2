import {returnedPayments} from '../bank/returnedPayments';
import type { CloudState } from '../storage/cloudState';
import type { MoneylithAccount, MoneylithTransaction, FixedCostManualItem } from '../types';
import { emptyBankRules, validateBankRules } from '../bank/classificationRules';
import { debtLedgerKey, emptyDebtLedger, validateDebtLedger } from '../bank/debtPayments';
import { salaryPeriod, periodBounds } from '../bank/periodReconciliation';
import { spendingRows, spendingSummary, spendingAboveBudgets } from '../bank/spending';
import { personalInput } from '../projection/adapters';
import { emptyOptions, type Options } from '../projection/engine';
import { dailyOverview } from '../projection/dailyOverview';
import { mobileBankBalance } from '../mobile/bankBalance';

function read(state: CloudState, key: string, fallback: unknown): unknown {
  try { return state[key] === undefined ? fallback : JSON.parse(state[key]); } catch { return fallback; }
}
function list<T>(value: unknown): T[] { return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') as T[] : []; }

/** A read-only presentation model. Nothing here writes or reclassifies financial records. */
export function dashboard(state: CloudState, asOf: string, options: Options = emptyOptions()) {
  const get = (key: string, fallback: unknown = []) => read(state, 'moneylith.personal.' + key, fallback);
  return presentPersonal({
    accounts:list<MoneylithAccount>(get('accounts')),transactions:list<MoneylithTransaction>(get('transactions')),fixedCosts:get('fixedCosts'),income:get('income'),
    detectedFixedCosts:read(state,'fixed-cost-items',[]),futureIncome:get('futureIncome'),debts:get('debts'),assets:get('assets'),goals:get('goals'),
    inputReviews:get('inputReviews.v1',{}),bankRules:get('bankRules.v1',emptyBankRules),debtPayments:read(state,debtLedgerKey,emptyDebtLedger()),periodPaid:get('periodPaid.v1',{}),
  },asOf,options);
}
/** Uses the controller snapshot, including reviewed classifications and merged obligations. */
export function presentPersonal(source: Parameters<typeof personalInput>[0], asOf:string, options:Options=emptyOptions()) {
  const rules=validateBankRules(source.bankRules)?source.bankRules:emptyBankRules;
  const accounts=list<MoneylithAccount>(source.accounts).filter(a=>a.active&&rules.accountRoles[a.id]!=='business');
  const transactions=list<MoneylithTransaction>(source.transactions);
  const fixed=list<FixedCostManualItem>(source.fixedCosts);
  const ledger=validateDebtLedger(source.debtPayments)?source.debtPayments:emptyDebtLedger();
  const input=personalInput(source,options,asOf);
  const view = dailyOverview(input);
  const rows = spendingAboveBudgets(spendingRows(transactions, rules, fixed, ledger), fixed, 'salary');
  const spending = spendingSummary(rows, salaryPeriod(asOf), asOf, 'salary');
  // Missing dates and incomplete obligations must not produce a deceptively exact total.
  const planned = !input.missing.length && view.outgoing.every(e => e.amount !== null && e.date !== null)
    ? view.outgoing.reduce((sum, e) => sum + Math.abs(e.amount!), 0) : null;
  // A subtotal is useful even when completeness is not yet established. Never
  // change the authoritative projection or silently turn missing amounts into zero.
  const knownOutgoing=view.outgoing.filter(e=>e.amount!==null);
  const knownPlanned=knownOutgoing.length?knownOutgoing.reduce((sum,e)=>sum+Math.abs(e.amount!),0):planned;
  const relevant=input.events.filter(e=>e.date===null||e.date>asOf&&e.date<=view.until);
  const knownCommitments=relevant.filter(e=>e.amount!==null&&(e.kind==='reserve'?e.amount>0:e.amount<0));
  // Deduct all known obligations, including undated ones, and no future income.
  // This is a cautious remaining subtotal, not a complete affordability verdict.
  const knownProtected=knownCommitments.reduce((sum,e)=>sum+Math.abs(e.amount!),input.reserve??0);
  const provisional=view.available===null;
  const available=view.available??(input.opening!==null&&knownCommitments.length>0?input.opening-knownProtected:null);
  return { returnedPayments:returnedPayments(transactions,rules,asOf), input, view, available, provisional, knownPlanned, knownProtected, accounts, bank: mobileBankBalance(accounts, rules), spending,
    planned, period: periodBounds(salaryPeriod(asOf)),
    protected: input.opening !== null && view.available !== null ? input.opening - view.available : null,
  };
}
