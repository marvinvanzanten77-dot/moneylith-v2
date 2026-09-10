import { useRef, useState, type ReactNode } from "react";
import { parseDateNlToIso } from "../utils/date";
export type GoalView = {
  id: string;
  label: string;
  kind: string;
  target: number | null;
  current: number | null;
  monthly: number | null;
  date: string | null;
  isActive: boolean;
  priority?: number;
  linkedBucketIds?: string[];
};
export type GoalDraft = Omit<
  GoalView,
  "id" | "target" | "current" | "monthly"
> & { id?: string; target: string; current: string; monthly: string };
export const blankGoalDraft = (): GoalDraft => ({
  label: "",
  kind: "",
  target: "",
  current: "",
  monthly: "",
  date: "",
  isActive: true,
  linkedBucketIds: [],
});
export function readGoalDraft(
  draft: GoalDraft,
  allowUnknown: boolean,
  revenue = false,
): Omit<GoalView, "id"> {
  if (!draft.label.trim() || !draft.kind)
    throw new Error("Vul een doelnaam in en kies een doeltype.");
  const amount = (raw: string) => {
    if (!raw.trim()) {
      if (allowUnknown) return null;
      throw new Error("Vul alle bedragen in. Vul 0 in als het bedrag nul is.");
    }
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw))
      throw new Error(
        "Gebruik een positief bedrag of expliciet 0, met maximaal twee decimalen.",
      );
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) throw new Error("Ongeldig bedrag.");
    return n;
  };
  const date = draft.date?.trim() ? parseDateNlToIso(draft.date) : null;
  if (draft.date?.trim() && !date)
    throw new Error("Gebruik een geldige deadline: DD-MM-JJJJ.");
  return {
    ...draft,
    label: draft.label.trim(),
    target: amount(draft.target),
    current: revenue ? null : amount(draft.current),
    monthly: revenue ? null : amount(draft.monthly),
    date,
  };
}
const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300";
const money = (v: number | null) =>
  v === null
    ? "Nog niet ingevuld"
    : new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
      }).format(v);
export function GoalWorkspace({
  goals,
  types,
  examples,
  onSave,
  onDelete,
  business = false,
  readOnly = false,
  summary,
  additional,
  beforeList,
}: {
  goals: GoalView[];
  types: readonly { value: string; label: string }[];
  examples: readonly { label: string; kind: string }[];
  onSave: (value: Omit<GoalView, "id">, id?: string) => void;
  onDelete: (id: string) => void;
  business?: boolean;
  readOnly?: boolean;
  summary?: (goal: GoalView) => ReactNode;
  additional?: (
    draft: GoalDraft,
    change: (draft: GoalDraft) => void,
  ) => ReactNode;
  beforeList?: ReactNode;
}) {
  const [draft, setDraft] = useState<GoalDraft>(blankGoalDraft);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const reset = () => {
    setDraft(blankGoalDraft());
    setExpanded(null);
    setError("");
  };
  const edit = (goal: GoalView) => {
    setDraft({
      ...goal,
      target: goal.target === null ? "" : String(goal.target),
      current: goal.current === null ? "" : String(goal.current),
      monthly: goal.monthly === null ? "" : String(goal.monthly),
      date: goal.date ? goal.date.split("-").reverse().join("-") : "",
    });
    setError("");
  };
  const focusForm = () => {
    form.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    form.current?.querySelector("input")?.focus({ preventScroll: true });
  };
  const remove = (id: string) => {
    if (!confirm("Weet je zeker dat je dit doel wilt verwijderen?")) return;
    try {
      onDelete(id);
      if (draft.id === id) reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen mislukt.");
    }
  };
  const active = goals.filter((g) => g.isActive).length;
  const revenue = business && draft.kind === "revenue";
  return (
    <div className="space-y-6" data-goal-workspace>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Doelen</h1>
        <p className="text-sm text-slate-400">
          {active
            ? "Je focus brengt je intentie naar concreet geldgedrag."
            : "Zonder doel is er geen brug tussen intentie en gedrag."}
        </p>
        {business && (
          <p className="text-sm text-slate-400">
            Doelen zijn plannen. Ze boeken geen omzet, betaling of reserve.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {beforeList}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  Actieve doelen
                </h2>
                <p className="text-xs text-slate-400">
                  Zet meerdere doelen aan en bepaal de volgorde met prioriteit.
                </p>
              </div>
              <span className="text-xs text-slate-400">{active} actief</span>
            </div>
            {!goals.length && (
              <p className="text-sm text-slate-300">
                Zonder doel ontbreekt richting.
              </p>
            )}
            <div className="space-y-3">
              {[...goals]
                .sort(
                  (a, b) =>
                    Number(b.isActive) - Number(a.isActive) ||
                    (b.priority ?? 0) - (a.priority ?? 0) ||
                    (a.date ?? "9999").localeCompare(b.date ?? "9999"),
                )
                .map((g) => (
                  <div
                    key={g.id}
                    className={`rounded-xl border bg-slate-900/60 text-sm text-slate-200 ${expanded === g.id ? "border-amber-400 ring-2 ring-amber-100/30" : "border-slate-800 hover:border-amber-300/40"}`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-800/60"
                      aria-expanded={expanded === g.id}
                      onClick={() => {
                        setExpanded(expanded === g.id ? null : g.id);
                        if (expanded !== g.id) edit(g);
                      }}
                    >
                      <span>
                        <strong className="block text-slate-50">
                          {g.label}
                        </strong>
                        <span className="text-[11px] text-slate-400">
                          {types.find((t) => t.value === g.kind)?.label} ·{" "}
                          {g.isActive ? "Actief" : "Passief"}
                        </span>
                      </span>
                      <span>
                        {money(g.target)} {expanded === g.id ? "▲" : "▼"}
                      </span>
                    </button>
                    {expanded === g.id && (
                      <div
                        className="border-t border-amber-200/30 px-3 py-3 text-xs space-y-3"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setExpanded(null);
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          {summary ? (
                            summary(g)
                          ) : (
                            <>
                              <span>Huidige stand: {money(g.current)}</span>
                              <span>Inleg p/m: {money(g.monthly)}</span>
                              <span>Deadline: {g.date || "Niet gekozen"}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={readOnly}
                            className="rounded-md border border-amber-200/60 bg-amber-500/10 px-2 py-1 text-amber-50"
                            onClick={() => {
                              edit(g);
                              focusForm();
                            }}
                          >
                            Bewerk in formulier
                          </button>
                          <button
                            type="button"
                            disabled={readOnly}
                            className="rounded-md border border-red-400 px-2 py-1 text-red-200"
                            onClick={() => remove(g.id)}
                          >
                            Verwijderen
                          </button>
                          {[-1, 1].map((delta) => (
                            <button
                              key={delta}
                              type="button"
                              disabled={readOnly}
                              aria-label={
                                delta === 1
                                  ? "Prioriteit verhogen"
                                  : "Prioriteit verlagen"
                              }
                              className="rounded-full bg-slate-800 px-2 py-0.5"
                              onClick={() => {
                                try {
                                  onSave(
                                    {
                                      ...g,
                                      priority: (g.priority ?? 0) + delta,
                                    },
                                    g.id,
                                  );
                                } catch (e) {
                                  setError(String(e));
                                }
                              }}
                            >
                              {delta === 1 ? "↑" : "↓"}
                            </button>
                          ))}
                          <span>Prioriteit: {g.priority ?? 0}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
        <form
          ref={form}
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200"
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            try {
              const goal = readGoalDraft(draft, business, revenue);
              onSave(goal, draft.id);
              reset();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Opslaan mislukt.");
            }
          }}
        >
          <h3 className="text-lg font-semibold text-slate-50">
            Actief doel instellen
          </h3>
          <div className="grid gap-3">
            <label className="text-xs text-slate-300">
              Doelnaam
              <input
                className={fieldClass}
                readOnly={readOnly}
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-300">
              Doeltype
              <select
                className={fieldClass}
                disabled={readOnly}
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                <option value="">- kies -</option>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {(
              ["target", ...(!revenue ? ["current", "monthly"] : [])] as (
                "target" | "current" | "monthly"
              )[]
            ).map((key) => (
              <label key={key} className="text-xs text-slate-300">
                {key === "target"
                  ? revenue
                    ? "Gewenste maandomzet excl. btw (€)"
                    : "Doelwaarde (€)"
                  : key === "current"
                    ? draft.kind === "repay"
                      ? "Al afgeloste hoofdsom (€)"
                      : "Huidige stand (€)"
                    : draft.kind === "repay"
                      ? "Geplande maandaflossing (€)"
                      : "Maandelijks apart zetten (€)"}
                <input
                  inputMode="decimal"
                  className={fieldClass}
                  placeholder="Nog niet ingevuld"
                  readOnly={readOnly}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            {revenue && (
              <p className="text-xs text-slate-400">
                Voortgang volgt de gecontroleerde omzet bij Fundament. Geen
                spaarinleg.
              </p>
            )}
            <label className="text-xs text-slate-300">
              Deadline (optioneel, DD-MM-JJJJ)
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="Niet gekozen"
                readOnly={readOnly}
                value={draft.date ?? ""}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <div className="text-xs text-slate-300">
              <p className="mb-1 text-slate-400">
                Voorbeelden (klik om te vullen):
              </p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    type="button"
                    key={ex.label}
                    disabled={readOnly}
                    className="rounded-md border border-amber-200/60 bg-amber-500/10 px-2 py-1 text-amber-50 hover:bg-amber-500/20"
                    onClick={() => {
                      setDraft({
                        ...blankGoalDraft(),
                        label: ex.label,
                        kind: ex.kind,
                      });
                      setExpanded(null);
                      setError("");
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-slate-400">
                Een voorbeeld vult alleen naam en type. Kies zelf bedragen en
                eventueel een deadline.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.isActive}
                onChange={(e) =>
                  setDraft({ ...draft, isActive: e.target.checked })
                }
              />
              Actief doel
            </label>
            {additional?.(draft, setDraft)}
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={readOnly}
                type="submit"
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                {draft.id ? "Doel bijwerken" : "Actief doel instellen"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                onClick={reset}
              >
                Formulier leegmaken
              </button>
              {draft.id && (
                <button
                  type="button"
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                  onClick={reset}
                >
                  Annuleren
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
