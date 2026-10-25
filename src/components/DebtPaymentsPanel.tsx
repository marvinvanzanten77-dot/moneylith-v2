import {useLocalStorage} from '../hooks/useLocalStorage';
import {debtLedgerKey,emptyDebtLedger,reconcileDebtPayments,validateDebtLedger,type DebtLedger} from '../bank/debtPayments';
import {emptyBankRules,type BankRuleSettings} from '../bank/classificationRules';
import type {SchuldItem,MoneylithTransaction} from '../types';
import {SurfaceCard} from './WorkspaceUI';
import {amsterdamDate} from '../monitoring/engine';
import {formatCurrency} from '../utils/format';
export function DebtPaymentsPanel({debts,transactions}:{debts:SchuldItem[];transactions:MoneylithTransaction[]}){
 const [ledger]=useLocalStorage<DebtLedger>(debtLedgerKey,emptyDebtLedger());
 const [rules]=useLocalStorage<BankRuleSettings>('moneylith.personal.bankRules.v1',emptyBankRules);
 if(!validateDebtLedger(ledger))return <p role="alert">De aflossingshistorie kan niet worden gelezen. Er worden geen aflossingen verondersteld.</p>;
 const result=reconcileDebtPayments(debts,transactions,ledger,amsterdamDate(new Date()),Object.entries(rules.accountRoles).filter(([,r])=>r==='business').map(([id])=>id));
 if(!ledger.entries.length&&!debts.some(d=>d.bankRepayment))return null;
 return <SurfaceCard className="space-y-3"><h2 className="text-xl font-semibold">Verwerkte aflossingen</h2><p className="text-sm">De drie dagelijkse scans en handmatig bijwerken herkennen ingestelde aflossingsomschrijvingen. Gebruik de exacte omschrijving bij de bijbehorende schuld. Zet bij een gecombineerde betaling beide omschrijvingen in de bankbetaling. Alleen de afgesproken maandtermijnen worden van de schulden afgeboekt; je banksaldo wordt niet nogmaals verlaagd.</p>
 {!!result.questions.length&&<div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm"><strong>{result.questions.length} betalingen vragen controle</strong>{result.questions.slice(-10).map(q=><p key={q.transactionId}>{q.date}: {q.reason}</p>)}<p>Een gewijzigde of onduidelijke betaling wordt niet automatisch verwerkt. Controleer eerst welk deel daadwerkelijk op welke schuld is afgelost.</p></div>}
 <details><summary className="cursor-pointer">Betaalhistorie ({ledger.entries.length})</summary><ul className="mt-3 space-y-3 text-sm">{ledger.entries.slice().reverse().slice(0,30).map(e=>{const sum=e.allocations.reduce((n,a)=>n+a.cents,0);return <li key={e.transactionId} className="rounded-lg border p-3"><p>{e.date} · {e.source==='confirmed'?'Bevestigde verdeling':'Automatisch herkend'} · {formatCurrency(sum/100)} afgelost</p>{e.allocations.map(a=><p key={a.debtId}>{debts.find(d=>d.id===a.debtId)?.naam??'Eerdere schuld'}: {formatCurrency(a.cents/100)}</p>)}{e.paidCents>sum&&<p>{formatCurrency((e.paidCents-sum)/100)} van deze betaling is niet op deze geregistreerde schulden afgeboekt.</p>}</li>;})}</ul></details></SurfaceCard>;
}
