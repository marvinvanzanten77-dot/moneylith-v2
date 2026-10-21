import { BankRuleSettings } from "./BankRuleSettings";
import { accountRoleLabel, emptyBankRules, type BankRuleSettings as RuleSettings } from "../bank/classificationRules";
import { useMemo, useState } from "react";
import type { FixedCostManualItem, IncomeItem, MoneylithAccount, MoneylithTransaction } from "../types";
import { cadenceLabels, indexBankPatterns, type BankPattern, type PatternDecision, type PatternDecisions, type PatternKind } from "../bank/patterns";
import { SurfaceCard, Button, Input, Select } from "./WorkspaceUI";
import { formatCurrency } from "../utils/format";
const kinds: Record<PatternKind, string> = { fixed: "Vaste last", income: "Inkomen", variable: "Variabele uitgave / overige ontvangst", transfer: "Overboeking / top-up", financing: "Geleend geld / terugbetaling", ignore: "Niet meenemen in herkenning" };
type Props = {
  asOf?: string;
  rules?: RuleSettings; onRulesChange?: (rules: RuleSettings) => void;
  accounts: MoneylithAccount[]; transactions: MoneylithTransaction[];
  income: IncomeItem[]; fixedCosts: FixedCostManualItem[]; decisions: PatternDecisions;
  onDecide: (pattern: BankPattern, decision: PatternDecision, monthly: number | null, paymentDay: number) => void;
  onBank: () => void;
};
function PatternEditor({ pattern, decisions, income, fixedCosts, onDecide }: Pick<Props, "decisions" | "income" | "fixedCosts" | "onDecide"> & { pattern: BankPattern }) {
  const saved = decisions[pattern.key];
  const automatic = pattern.transactions.find(t => t.bankRuleId);
  const possibleTargets = pattern.incoming ? income : fixedCosts;
  const ids = new Set(pattern.transactions.map(t => t.id));
  const recognized = possibleTargets.find(i => i.bankEvidence?.key === pattern.key || i.bankEvidence?.transactionIds.some(id => ids.has(id)));
  const [kind, setKind] = useState<PatternKind | "">(saved?.kind ?? automatic?.bankPatternKind ?? "");
  const [label, setLabel] = useState(saved?.label ?? pattern.label);
  const [target, setTarget] = useState(saved?.targetId ?? recognized?.id ?? "");
  const [monthly, setMonthly] = useState(pattern.monthlyEstimate === null ? "" : String(pattern.monthlyEstimate));
  const [paymentDay, setPaymentDay] = useState(pattern.frequency === "monthly" ? String(Number(pattern.lastDate.slice(8))) : "");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(6);
  const linked = saved?.targetId && [...income, ...fixedCosts].some(i => i.id === saved.targetId);
  const financial = kind === "fixed" || kind === "income";
  return <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
    <p className="text-sm">{linked ? "Je antwoord wordt ook op nieuwe transacties van deze groep toegepast." : "Wat is deze betaling? Je antwoord blijft bewaard en wordt ook op nieuwe transacties van deze groep toegepast."}</p>
    {pattern.possibleTransfer && <p className="text-sm text-amber-800">Mogelijk een overboeking tussen eigen rekeningen: er zijn tegengestelde bedragen of aanwijzingen in de omschrijving. Dit is nog niet bevestigd.</p>}
    {recognized && !linked && <p className="text-sm">Staat al in Fundament als ‘{recognized.naam}’. Koppel deze bestaande post om dubbeltelling te voorkomen. Is de post onjuist? Pas hem eerst aan of verwijder hem in Fundament.</p>}
    {linked ? <p className="text-sm font-semibold">Gekoppeld aan Fundament. Bedrag en betaaldag bewerk je daar.</p> : <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); setStatus("");
      try {
        if (!kind) throw Error("Kies eerst wat deze betaling betekent.");
        if (recognized && (!financial || target !== recognized.id)) throw Error("Koppel de bestaande post, of pas deze eerst aan in Fundament.");
        if (financial && !target) throw Error("Kies een bestaande post of maak bewust een nieuwe post aan.");
        onDecide(pattern, { kind, label, ...(financial ? { targetId: target } : {}) }, monthly.trim() ? Number(monthly.replace(",", ".")) : null, paymentDay.trim() ? Number(paymentDay) : 0);
        setStatus("Bewaard. Controleer in Fundament of je volledige overzicht klopt.");
      } catch (e) { setStatus(e instanceof Error ? e.message : "Opslaan mislukt."); }
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Soort betaling<Select value={kind} onChange={e => setKind(e.target.value as PatternKind | "")} required>
          <option value="">Maak een keuze</option>
          {Object.entries(kinds).filter(([key]) => key !== (pattern.incoming ? "fixed" : "income")).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </Select></label>
        <label className="text-sm">Betekenis / naam<Input value={label} onChange={e => setLabel(e.target.value)} required maxLength={150} /></label>
      </div>
      {financial && <>
        <label className="block text-sm">Koppelen aan Fundament<Select value={target} onChange={e => setTarget(e.target.value)} required>
          <option value="">Kies bestaande of nieuwe post</option>
          {possibleTargets.map(i => <option key={i.id} value={i.id}>{i.naam || "Naam ontbreekt"} — {formatCurrency(i.bedrag)} (bestaand)</option>)}
          <option value="new">Nieuwe post toevoegen</option>
        </Select></label>
        {target === "new" && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Verwacht bedrag per maand<Input inputMode="decimal" value={monthly} onChange={e => setMonthly(e.target.value)} required /></label>
          <label className="text-sm">Verwachte dag van de maand (leeg = onbekend)<Input type="number" min={1} max={31} value={paymentDay} onChange={e => setPaymentDay(e.target.value)} /></label>
          <p className="text-xs text-slate-600 sm:col-span-2">Een maandbedrag is een verwachting. Wekelijkse en jaarlijkse betalingen worden omgerekend; dat maakt hun echte betaaldatums niet maandelijks. Laat een onbekende betaaldag leeg.</p>
        </div>}
      </>}
      <Button type="submit" variant="primary">Antwoord bewaren</Button>
    </form>}
    {status && <p role="status" className="text-sm text-slate-700">{status}</p>}
    <div className="space-y-2 text-sm">
      <p className="font-semibold">Onderliggende transacties ({pattern.transactions.length})</p>
      {pattern.transactions.slice().reverse().slice(0, limit).map(tx => <div key={tx.id} className="rounded-lg bg-slate-50 p-3">
        <div className="flex flex-wrap justify-between gap-2"><span>{tx.date}</span><strong>{formatCurrency(tx.amount)}</strong></div>
        <p className="mt-1 break-words">{tx.description || "Geen omschrijving"}</p>
        {tx.category && <p className="text-xs text-slate-600">Categorie: {tx.category}</p>}
      </div>)}
      {limit < pattern.transactions.length && <Button onClick={() => setLimit(n => n + 20)}>Meer transacties tonen</Button>}
    </div>
  </div>;
}
export function BankPatterns(props: Props) {
  const [notice, setNotice] = useState("");
  const [days, setDays] = useState(365), [account, setAccount] = useState(""), [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"), [limit, setLimit] = useState(20), [selected, setSelected] = useState<string | null>(null);
  const now = new Date();
  const asOf = props.asOf ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const groups = useMemo(() => indexBankPatterns(props.transactions, asOf, days), [props.transactions, asOf, days]);
  const questions = groups.filter(g => g.active && g.transactions.length >= 2 && !props.decisions[g.key] && !g.transactions.every(t => t.bankRuleId));
  const visible = groups.filter(g => (!account || g.accountId === account) &&
    `${g.label} ${props.decisions[g.key]?.label ?? ""} ${g.transactions.map(t => t.description).join(" ")}`.toLowerCase().includes(search.toLowerCase()) &&
    (filter === "all" || (filter === "questions" && questions.includes(g)) || (filter === "repeating" && g.transactions.length >= 2) || (filter === "classified" && (props.decisions[g.key] || g.transactions.every(t => t.bankRuleId)))));
  return <div className="space-y-4" data-bank-patterns>
    <SurfaceCard className="space-y-3">
      <h2 className="text-lg font-semibold">Patronen uit je rekeningen</h2>
      <p className="text-sm">Analyse van de opgehaalde banktransacties, zonder afschriften te uploaden. Ook wisselende bedragen, onregelmatige herhalingen en bijschrijvingen blijven zichtbaar. Voor nieuwe bankgegevens gebruik je Synchroniseren.</p>
      <p className="text-sm font-semibold">{groups.reduce((n, g) => n + g.transactions.length, 0)} transacties · {groups.length} {groups.length === 1 ? "groep" : "groepen"} · {questions.length} herhalingen om te benoemen</p>
      <Button onClick={props.onBank}>Naar bankkoppeling</Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Periode<Select value={days} onChange={e => { setDays(Number(e.target.value)); setLimit(20); setSelected(null); }}>
          <option value={90}>Laatste 90 dagen</option><option value={180}>Laatste 180 dagen</option><option value={365}>Laatste jaar</option><option value={730}>Laatste twee jaar</option>
        </Select></label>
        <label className="text-sm">Rekening<Select value={account} onChange={e => { setAccount(e.target.value); setLimit(20); }}>
          <option value="">Alle rekeningen</option>{props.accounts.filter(a => a.bankProvider === "lunchflow").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select></label>
        <label className="text-sm">Tonen<Select value={filter} onChange={e => { setFilter(e.target.value); setLimit(20); }}>
          <option value="questions">Nog te benoemen herhalingen</option><option value="all">Alle transactiegroepen</option><option value="repeating">Alle herhalingen (ook oudere)</option><option value="classified">Benoemd / automatisch herkend</option>
        </Select></label>
        <label className="text-sm">Zoek tegenpartij of omschrijving<Input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(20); }} /></label>
      </div>
      <p className="text-xs text-slate-600">Een herhaling is nog geen vaste last. Bedragen hieronder zijn waarnemingen binnen de gekozen periode. De beschikbare bankhistorie kan korter zijn; ontbrekende transacties worden niet aangevuld.</p>
    </SurfaceCard>
    {props.onRulesChange && <BankRuleSettings settings={props.rules} onSave={props.onRulesChange} />}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p>}
    {!visible.length && <SurfaceCard>{groups.length ? "Geen groepen voor deze selectie. Kies ‘Alle transactiegroepen’ om je overige betalingen te bekijken." : "Nog geen banktransacties in deze periode. Synchroniseer je rekeningen of kies een langere periode."}</SurfaceCard>}
    {visible.slice(0, limit).map(g => <SurfaceCard key={g.key} className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="break-words font-semibold">{props.decisions[g.key]?.label ?? g.label}</h3>
          <p className="text-xs text-slate-600">{props.accounts.find(a => a.id === g.accountId)?.name ?? "Rekening"} · {accountRoleLabel(props.accounts.find(a => a.id === g.accountId), props.rules ?? emptyBankRules)} · {g.incoming ? "Bijschrijvingen" : "Afschrijvingen"} · {g.transactions.length} transacties</p></div>
        <Button aria-expanded={selected === g.key} onClick={() => setSelected(k => k === g.key ? null : g.key)}>{selected === g.key ? "Sluiten" : props.decisions[g.key] ? "Bekijk keuze en transacties" : "Wat is dit?"}</Button>
      </div>
      <p className="text-sm">{cadenceLabels[g.frequency]}{g.varying ? " · wisselende bedragen" : ""}{!g.active ? " · niet recent waargenomen" : ""}</p>
      <p className="text-sm">Totaal waargenomen: {formatCurrency(g.total)} · {g.firstDate} t/m {g.lastDate}</p>
      {g.monthlyEstimate !== null && <p className="text-xs text-slate-600">Indicatie omgerekend per maand: {formatCurrency(g.monthlyEstimate)} — {props.decisions[g.key]?.targetId ? "de actuele maandpost staat in Fundament" : "nog geen bevestigde maandpost"}.</p>}
      {!props.decisions[g.key] && g.transactions.every(t => t.bankRuleId) && <p className="text-sm font-semibold">Automatisch herkend · {kinds[g.transactions[0].bankPatternKind!]} — pas zo nodig aan via ‘Wat is dit?’.</p>}
      {props.decisions[g.key] && <p className="text-sm font-semibold">Jouw keuze: {kinds[props.decisions[g.key].kind]}</p>}
      {selected === g.key && <PatternEditor key={g.key + (props.decisions[g.key]?.targetId ?? "")} pattern={g} decisions={props.decisions} income={props.income} fixedCosts={props.fixedCosts} onDecide={(...args) => { props.onDecide(...args); setNotice("Je antwoord is bewaard en wordt bij volgende synchronisaties opnieuw gebruikt. Eventuele nieuwe maandposten staan in Fundament; controleer daar de volledigheid."); }} />}
    </SurfaceCard>)}
    {limit < visible.length && <Button onClick={() => setLimit(n => n + 20)}>Meer groepen tonen ({visible.length - limit} resterend)</Button>}
  </div>;
}
