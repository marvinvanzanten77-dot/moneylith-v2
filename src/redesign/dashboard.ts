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
  return { input, view, accounts, bank: mobileBankBalance(accounts, rules), spending,
    planned, period: periodBounds(salaryPeriod(asOf)),
    protected: input.opening !== null && view.available !== null ? input.opening - view.available : null,
  };
}
