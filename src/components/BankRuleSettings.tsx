import { useState } from "react";
import { emptyBankRules, validateBankRules, type BankRuleSettings as Settings, type BankRule } from "../bank/classificationRules";
import { Button, Input, Select, SurfaceCard } from "./WorkspaceUI";
export function BankRuleSettings({ settings = emptyBankRules, onSave }: { settings?: Settings; onSave: (s: Settings) => void }) {
  const [editing, setEditing] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState<BankRule[]>([]);
  return <SurfaceCard className="space-y-3">
    <h3 className="font-semibold">Automatische herkenning</h3>
    <p className="text-sm">Boodschappen, Action en sauna’s worden op winkelnaam gegroepeerd. Je eigen regels gaan voor. Eerder opgeslagen antwoorden en handmatige categorieën blijven behouden. Een top-up of lening is geen gewone uitgave of inkomen.</p>
    <Button onClick={() => { setDraft(settings.rules.map(r => ({ ...r }))); setEditing(!editing); setError(""); }}>{editing ? "Annuleren" : `Eigen regels beheren (${settings.rules.length})`}</Button>
    {editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); try {
      const next = { ...settings, rules: draft.map(r => ({ ...r, terms: r.terms.map(t => t.trim()).filter(Boolean) })) };
      if (!validateBankRules(next)) throw Error("Controleer de naam, zoektermen en bedraggrenzen van elke regel.");
      onSave(next); setEditing(false); setError("");
    } catch(e) { setError(e instanceof Error ? e.message : "Opslaan mislukt."); } }}>
      {draft.map((r, i) => {
        const update = (patch: Partial<BankRule>) => setDraft(rows => rows.map((row, j) => j === i ? { ...row, ...patch } : row));
        return <fieldset key={r.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
          <legend className="text-sm font-semibold">Regel {i + 1}</legend>
          <label className="block text-sm">Groepsnaam<Input required value={r.label} onChange={e => update({ label: e.target.value })} /></label>
          {r.counterpartyIban ? <p className="text-sm">Rekeninggebonden regel voor overboekingen naar …{r.counterpartyIban.slice(-2)}. De volledige rekeningidentificatie blijft bewaard.</p> : <label className="block text-sm">Zoektermen (gescheiden door komma’s)<Input required value={r.terms.join(",")} onChange={e => update({ terms: e.target.value.split(",") })} /></label>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Soort<Select value={r.kind} onChange={e => update({kind: e.target.value as BankRule["kind"]})}><option value="variable">Variabele aankoop</option><option value="transfer">Overboeking / top-up</option><option value="financing">Geleend geld / terugbetaling</option><option value="ignore">Niet meenemen in herkenning</option></Select></label>
            <label className="text-sm">Richting<Select value={r.direction ?? "both"} onChange={e => update({ direction: e.target.value === "both" ? undefined : e.target.value as "in" | "out" })}><option value="both">Beide richtingen</option><option value="out">Afschrijvingen</option><option value="in">Bijschrijvingen</option></Select></label>
            <label className="text-sm">Bedrag hoger dan (€; leeg = geen grens)<Input type="number" min={0} step="0.01" value={r.aboveCents === undefined ? "" : r.aboveCents / 100} onChange={e => update({ aboveCents: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100) })} /></label>
            <label className="text-sm">Bedrag lager dan (€; leeg = geen grens)<Input type="number" min={0} step="0.01" value={r.belowCents === undefined ? "" : r.belowCents / 100} onChange={e => update({ belowCents: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100) })} /></label>
          </div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={r.enabled !== false} onChange={e => update({ enabled: e.target.checked })} />Regel actief</label>
          <Button type="button" onClick={() => setDraft(rows => rows.filter((_, j) => i !== j))}>Regel verwijderen</Button>
        </fieldset>;
      })}
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setDraft(rows => [...rows, { id: crypto.randomUUID(), label: "", kind: "variable", terms: [], direction: "out" }])}>Regel toevoegen</Button><Button type="submit" variant="primary">Regels bewaren en toepassen</Button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </SurfaceCard>;
}
