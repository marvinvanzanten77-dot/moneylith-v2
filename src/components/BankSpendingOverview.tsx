import { potColors } from "../data/potColors";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BankPatterns, type BankPatternsProps } from "./BankPatterns";
import { emptyBankRules } from "../bank/classificationRules";
import { indexBankPatterns, type BankPattern } from "../bank/patterns";
import { spendingRows, spendingSummary } from "../bank/spending";
import { SpendingCoach } from "./SpendingCoach";
import { Button, Input, Select, SurfaceCard } from "./WorkspaceUI";
import { formatCurrency } from "../utils/format";
const Donut = lazy(() => import("./charts/CategoryPotsDonut").then(m => ({default: m.CategoryPotsDonut})));
const euro = (cents: number) => formatCurrency(cents / 100, true);
const monthLabel = (month: string) => new Intl.DateTimeFormat("nl-NL", {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(month + "-01T00:00:00Z"));
const suggested = ["Boodschappen", "Tanken", "Koffie en snacks", "Uit eten", "Kleding", "Vrije tijd", "Overige aankopen"];
function ClassificationQuestion({ group, labels, onSave, onSkip }: { group: BankPattern; labels: string[]; onSave: (label: string) => void; onSkip: () => void }) {
  const [label, setLabel] = useState(""), [error, setError] = useState("");
  const save = (value: string) => { try { if(!value.trim()) throw Error("Geef je potje een naam."); onSave(value.trim()); } catch(e) { setError(e instanceof Error ? e.message : "Opslaan mislukt."); } };
  const latest = group.transactions[group.transactions.length - 1];
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">Jij kent deze aankoop het best. Met jouw antwoord komen vergelijkbare betalingen voortaan in het juiste potje.</p>
    <div className="rounded-xl bg-slate-100 p-4"><h3 className="break-words font-semibold">{group.label}</h3><p className="mt-1 text-sm">{euro(Math.abs(Math.round(latest.amount * 100)))} · {latest.date} · {group.transactions.length} {group.transactions.length === 1 ? "aankoop" : "vergelijkbare aankopen"}</p><p className="mt-2 break-words text-sm text-slate-600">{latest.description}</p></div>
    <p className="font-semibold">In welk potje hoort dit?</p>
    <div className="flex flex-wrap gap-2">{[...new Set([...labels, ...suggested])].slice(0, 12).map(name => <Button key={name} onClick={() => save(name)}>{name}</Button>)}</div>
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); save(label); }}><label className="block text-sm">Of geef een eigen potnaam<Input value={label} onChange={e => setLabel(e.target.value)} maxLength={150} required /></label><Button type="submit" variant="primary">Indelen en volgende</Button></form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button onClick={onSkip}>Deze weet ik nog niet</Button>
  </div>;
}
function ClassificationModule({ props, groups, labels, onClose }: { props: BankPatternsProps; groups: BankPattern[]; labels: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [skipped, setSkipped] = useState<string[]>([]), [advanced, setAdvanced] = useState(false);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const pending = groups.filter(g => !skipped.includes(g.key));
  const group = pending[0];
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="classification-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/70">
    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="classification-title" className="text-xl font-semibold">Samen je potjes vullen</h2><p className="text-sm text-slate-600">{pending.length} {pending.length === 1 ? "groep" : "groepen"} om te benoemen</p></div><Button onClick={onClose}>Sluiten</Button></div>
    {!advanced && (group ? <ClassificationQuestion key={group.key} group={group} labels={labels} onSave={label => props.onDecide(group,{kind:"variable",label},null,0)} onSkip={() => setSkipped(s => [...s, group.key])} /> : <div className="rounded-xl bg-emerald-50 p-5"><h3 className="font-semibold">Je bent weer een stap verder.</h3><p className="mt-2 text-sm">{skipped.length ? "Wat je nog niet wist, blijft bewaard. Je kunt daar later op terugkomen." : "Er zijn geen onbekende aankopen meer in deze maand. Je potjes zijn bijgewerkt."}</p></div>)}
    <div className="mt-6 border-t border-slate-200 pt-4"><Button onClick={() => setAdvanced(v => !v)}>{advanced ? "Terug naar één vraag tegelijk" : "Bestaande indeling of herkenningsregels aanpassen"}</Button><p className="mt-2 text-xs text-slate-500">Is een betaling eigenlijk een vaste last, overboeking of lening? Pas hier de soort aan; zo blijft je aankoopoverzicht zuiver.</p></div>
    {advanced && <div className="mt-4"><BankPatterns {...props} /></div>}
  </dialog>;
}
export function BankSpendingOverview(props: BankPatternsProps) {
  const asOf = props.asOf ?? new Date().toISOString().slice(0,10);
  const [month, setMonth] = useState(asOf.slice(0,7)), [classifying, setClassifying] = useState(false);
  const rows = useMemo(() => spendingRows(props.transactions, props.rules ?? emptyBankRules, props.fixedCosts), [props.transactions, props.rules, props.fixedCosts]);
  const summary = useMemo(() => spendingSummary(rows, month, asOf), [rows, month, asOf]);
  const unknownIds = new Set(rows.filter(r => r.date.startsWith(month) && !r.label).map(r => r.id));
  const unknownGroups = indexBankPatterns(props.transactions.filter(t => unknownIds.has(t.id)), asOf, 730);
  const months = [...new Set([asOf.slice(0,7), ...rows.filter(r => r.date <= asOf).map(r => r.date.slice(0,7))])].filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  const coachRows = rows.filter(r => r.date.startsWith(month) || r.date.startsWith(summary.previousMonth));
  const coachKey = JSON.stringify([month, coachRows]);
  const chart = [...summary.pots.map((p,i) => ({naam:p.label,bedrag:p.cents/100,color:potColors[i % potColors.length]})), ...(summary.unknownCents ? [{naam:"Nog in te delen",bedrag:summary.unknownCents/100,color:"#94a3b8"}] : [])];
  return <div className="space-y-5" data-spending-overview>
    <SurfaceCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-purple-700">Patronen</p><h2 className="mt-1 text-2xl font-semibold">Je uitgaven in potjes</h2><p className="mt-2 max-w-lg text-sm text-slate-600">Je dagelijkse en terugkerende aankopen, overzichtelijk in potjes. Zo ontdek je welke keuzes bij jou passen.</p></div><label className="text-sm">Maand<Select aria-label="Maand" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select></label></div>
      <div className="grid items-center gap-5 sm:grid-cols-2">
        <div><p className="text-sm text-slate-600">Uitgaven aan aankopen</p><p className="mt-1 text-3xl font-semibold">{summary.totalCents === null ? "Nog geen inzicht" : euro(summary.totalCents)}</p><p className="mt-2 text-sm text-slate-600">{summary.count} aankopen · {summary.pots.length} potjes</p><p className="mt-3 text-sm">{summary.unknownCount ? `${summary.unknownCount} aankopen (${euro(summary.unknownCents)}) zijn nog niet ingedeeld.` : summary.count ? "Alle opgehaalde aankopen in deze maand zijn ingedeeld." : "Synchroniseer je bankgegevens of kies een maand met aankopen."}</p></div>
        {chart.length ? <div role="img" aria-label={`Verdeling van je aankopen: ${chart.map(p=>`${p.naam} ${formatCurrency(p.bedrag)}`).join(', ')}`}><Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-purple-50" />}><Donut data={chart} showLegend={false} /></Suspense><ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">{chart.map(p => <li key={p.naam} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:p.color}} />{p.naam}</li>)}</ul></div> : <div className="flex h-48 items-center justify-center rounded-2xl bg-purple-50 p-6 text-center text-sm text-purple-800">Je potjes krijgen kleur zodra er aankopen zijn ingedeeld.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4"><p className="max-w-sm text-sm">{summary.unknownCount ? "Help de herkenning een stapje verder. Eén aankoop tegelijk, op jouw tempo." : "Een indeling klopt niet helemaal? Je kunt die altijd aanpassen."}</p><Button variant="primary" onClick={() => setClassifying(true)}>Help met indelen{unknownGroups.length ? ` (${unknownGroups.length})` : ""}</Button></div>
      <p className="text-xs text-slate-500">Dit overzicht gebruikt je opgehaalde privé-aankopen. Vaste lasten, interne overboekingen, creditcard-top-ups, geleend geld en zakelijke rekeningtransacties tellen hier niet mee. Er kunnen transacties ontbreken. Terugbetalingen zijn niet verrekend.</p>
    </SurfaceCard>
    <section aria-label="Je uitgavenpotjes" className="grid gap-4 sm:grid-cols-2">
      {summary.pots.map((p,i) => <SurfaceCard key={p.label} className="space-y-3"><div className="flex items-start justify-between gap-3"><h3 className="flex items-center gap-2 break-words font-semibold"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:potColors[i % potColors.length]}} />{p.label}</h3><span className="shrink-0 text-xs text-slate-500">{p.count}×</span></div><p className="text-2xl font-semibold">{euro(p.cents)}</p><div className="h-2 overflow-hidden rounded-full bg-purple-100"><div className="h-full rounded-full bg-purple-500" style={{width:`${p.share*100}%`, backgroundColor:potColors[i % potColors.length]}} /></div><p className="text-xs text-slate-600">{Math.round(p.share*100)}% van de aankopen in dit overzicht</p><p className="text-xs text-slate-500">{p.previousCents === null ? "Nog geen vergelijkbare waarneming uit de vorige maand." : `Vorige maand${summary.elapsedDay < 31 ? ` t/m dag ${summary.elapsedDay}` : ""}: ${euro(p.previousCents)} aan aankopen.`}</p></SurfaceCard>)}
    </section>
    <SpendingCoach key={coachKey} month={month} rows={coachRows} available={summary.pots.length > 0} />
    {classifying && <ClassificationModule props={props} groups={unknownGroups} labels={summary.pots.map(p=>p.label)} onClose={() => setClassifying(false)} />}
  </div>;
}
