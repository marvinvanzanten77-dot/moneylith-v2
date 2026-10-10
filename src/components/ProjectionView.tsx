import { useMemo, useState } from "react";
import { SurfaceCard, Input, Select, Button } from "./WorkspaceUI";
import {
  compare,
  addDays,
  validateScenario,
  type Input as ProjectionInput,
  type Options,
  type Scenario,
} from "../projection/engine";
import { formatCurrency } from "../utils/format";
const money = (n: number | null) =>
  n === null ? "Nog niet ingevuld" : formatCurrency(n / 100);
export function ProjectionView({
  input,
  options,
  onOptions,
  scenario,
  onScenario,
}: {
  input: ProjectionInput;
  options: Options;
  onOptions: (o: Options) => void;
  scenario: Scenario | null;
  onScenario: (s: Scenario | null) => void;
}) {
  const [kind, setKind] = useState<Scenario["kind"]>("purchase");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(addDays(input.asOf, 1));
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const { result, stale } = useMemo(() => {
    try {
      return { result: compare(input, scenario), stale: "" };
    } catch (e) {
      return {
        result: compare(input, null),
        stale: e instanceof Error ? e.message : "Scenario ongeldig.",
      };
    }
  }, [input, scenario]);
  const base = result.baseline,
    alternative = result.scenario;
  const apply = () => {
    try {
      if (
        !["move", "saved"].includes(kind) &&
        (!amount.trim() || !Number.isFinite(Number(amount.replace(",", "."))))
      )
        throw Error("Vul een bedrag in, ook als dit nul is.");
      const next = {
        kind,
        amount: ["move", "saved"].includes(kind)
          ? 0
          : Math.round(Number(amount.replace(",", ".")) * 100),
        date,
        target,
      };
      validateScenario(next, input);
      onScenario(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Controleer het scenario.");
    }
  };
  return (
    <div className="space-y-4" data-projection>
      <SurfaceCard className="space-y-3">
        <h2 className="text-lg font-semibold">
          Waar sta ik en wat komt eraan?
        </h2>
        <p className="text-sm">
          Peildatum {input.asOf}. Huidige geldmiddelen:{" "}
          <strong>{money(base.opening)}</strong>. Daarvan gereserveerd:{" "}
          {money(base.reserve)}.
        </p>
        <p className="text-xs text-slate-600">
          Dit is een verwachting onder de hieronder genoemde aannames. Een
          onbekend saldo is geen nul. Vermogen zoals bezittingen wordt niet als
          bankgeld opgeteld.
        </p>
        <div className="overflow-x-auto">
          <table
            data-projection-table
            className="w-full table-fixed text-xs sm:text-sm text-left whitespace-normal"
          >
            <caption className="text-left font-semibold mb-2">
              Beschikbaar na reserveringen
            </caption>
            <thead>
              <tr>
                <th>Termijn</th>
                <th>Huidige verwachting</th>
                <th>Scenario</th>
                <th>Verschil</th>
              </tr>
            </thead>
            <tbody>
              {base.horizons
                .filter((p) => p.day <= 90)
                .map((p, i) => (
                  <tr key={p.day} className="border-t border-slate-300">
                    <th className="py-3">{p.day} dagen</th>
                    <td>{money(p.available)}</td>
                    <td>
                      {scenario
                        ? money(alternative.horizons[i].available)
                        : "—"}
                    </td>
                    <td>
                      {scenario ? money(result.differences[i].available) : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          {alternative.tightestWeek
            ? `Laagste ruimte in de week ${alternative.tightestWeek.from} t/m ${alternative.tightestWeek.to}: ${money(alternative.tightestWeek.minimum)}. ${alternative.pressureWeeks.length ? "Er zijn weken met een verwacht tekort." : "Binnen dit model is geen negatief beschikbaar bedrag berekend."}`
            : "Nog onvoldoende gegevens om de krapste week te bepalen."}
        </p>
        {alternative.missing.length > 0 && (
          <div role="status" className="text-sm">
            <strong>Nog nodig voor een volledige verwachting</strong>
            <ul className="list-disc pl-5">
              {alternative.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </SurfaceCard>
      <SurfaceCard className="space-y-3">
        <h2 className="text-lg font-semibold">Aannames aanvullen</h2>
        <p className="text-xs text-slate-600">
          Alleen voor deze sessie en deze modus. De administratie verandert
          niet. Herladen wist deze aannames en het tijdelijke scenario.
        </p>
        <label className="block text-sm">
          Dag voor ontbrekende maandelijkse betaalmomenten
          <Input
            type="number"
            min="1"
            max="31"
            value={options.monthlyDay ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              onOptions({
                ...options,
                monthlyDay:
                  e.target.value && Number.isInteger(n) && n >= 1 && n <= 31
                    ? n
                    : null,
              });
            }}
          />
        </label>
        {input.scope === "personal" && (
          <>
            <label className="block text-sm">
              Variabele uitgaven per maand (€; leeg is onbekend)
              <Input
                inputMode="decimal"
                value={
                  options.variableMonthly === null
                    ? ""
                    : options.variableMonthly / 100
                }
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  onOptions({
                    ...options,
                    variableMonthly:
                      e.target.value.trim() && Number.isFinite(n) && n >= 0
                        ? Math.round(n * 100)
                        : null,
                  });
                }}
              />
            </label>
            <label className="block text-sm">
              Reeds gereserveerd binnen je saldi (€; leeg is onbekend)
              <Input
                inputMode="decimal"
                value={
                  options.reservedNow == null ? "" : options.reservedNow / 100
                }
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  onOptions({
                    ...options,
                    reservedNow:
                      e.target.value.trim() && Number.isFinite(n) && n >= 0
                        ? Math.round(n * 100)
                        : null,
                  });
                }}
              />
            </label>
            <label className="flex gap-2 text-sm">
              <Input
                type="checkbox"
                checked={options.confirmOpening}
                onChange={(e) =>
                  onOptions({ ...options, confirmOpening: e.target.checked })
                }
              />
              Ik bevestig dat de bedragen bij mijn actieve rekeningen mijn
              huidige saldi zijn, inclusief reeds verwerkte transacties.
            </label>
          </>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Feiten, aannames en doelen
          </summary>
          <ul className="list-disc pl-5 text-sm mt-2">
            {base.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {base.goals.map((g, i) => (
            <p key={i} className="text-sm mt-2">
              Doel {g.label}: nog {money(g.remaining)}, deadline{" "}
              {g.date ?? "niet ingevuld"}, voorgenomen inleg {money(g.monthly)}{" "}
              per maand. Rekenkundige benodigde inleg:{" "}
              {money(g.requiredMonthly)} per 30 dagen tot de deadline. Dit is
              geen geboekte betaling; gebruik een reserveringsscenario om ruimte
              te onderzoeken.
            </p>
          ))}
        </details>
      </SurfaceCard>
      <SurfaceCard className="space-y-3">
        <h2 className="text-lg font-semibold">
          Wat als ik een andere keuze maak?
        </h2>
        <p className="text-xs text-slate-600">
          Bedragen zijn veranderingen in geldmiddelen na btw en belasting. Een
          bruto omzetverhoging is niet automatisch netto extra geld. Reserveren
          verlaagt de beschikbare ruimte, niet het banksaldo.
        </p>
        <label className="block text-sm">
          Keuze
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Scenario["kind"]);
              setTarget("");
            }}
          >
            <option value="income">Extra maandelijkse inkomsten</option>
            <option value="expense">Maandlast wijzigen (verschil)</option>
            <option value="purchase">Eenmalige aankoop</option>
            <option value="repayment">Extra schuld aflossen</option>
            <option value="reserve">Eenmalig reserveren</option>
            <option value="move">Factuur eerder of later betalen</option>
            {input.savedScenario?.length ? (
              <option value="saved">Eerder opgeslagen zakelijk scenario</option>
            ) : null}
          </Select>
        </label>
        {kind === "saved" ? (
          <p className="text-sm">
            De eerder opgeslagen omzet-, kosten- en eenmalige verschillen worden
            tijdelijk toegepast, inclusief het bestaande btw- en belastingmodel.
            Verwijderen wist alleen deze tijdelijke toepassing.
          </p>
        ) : kind === "move" ? (
          <label className="block text-sm">
            Factuur
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Kies een factuur</option>
              {input.events
                .filter((e) => e.source === "invoice")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label} — {money(e.amount)}
                  </option>
                ))}
            </Select>
          </label>
        ) : (
          <label className="block text-sm">
            Bedrag of verschil (€)
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        {kind === "repayment" && (
          <label className="block text-sm">
            Schuld
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Kies een schuld</option>
              {Object.entries(input.debts).map(([id, n]) => (
                <option key={id} value={id}>
                  {input.events.find((e) => e.debtId === id)?.label ?? id} —{" "}
                  {money(n)}
                </option>
              ))}
            </Select>
          </label>
        )}
        {kind !== "saved" && (
          <label className="block text-sm">
            {["income", "expense"].includes(kind)
              ? "Eerste datum; daarna maandelijks"
              : "Datum"}
            <Input
              type="date"
              value={date}
              min={addDays(input.asOf, 1)}
              max={addDays(input.asOf, 365)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={apply}>Scenario toepassen</Button>
          <Button
            disabled={!scenario}
            onClick={() => {
              onScenario(null);
              setAmount("");
              setError("");
            }}
          >
            Scenario verwijderen
          </Button>
        </div>
        {(error || stale) && (
          <p role="alert" className="text-sm text-red-700">
            {error || stale}
          </p>
        )}
        {scenario && !stale && (
          <p className="text-sm">
            Tijdelijk scenario actief. De AI ontvangt dezelfde vergelijking als
            hierboven.
          </p>
        )}
      </SurfaceCard>
      <SurfaceCard className="space-y-3">
        <h2 className="text-lg font-semibold">Belangrijke momenten</h2>
        <p className="text-xs text-slate-600">
          Ingevoerde bedragen zijn geen garantie voor ontvangst of betaling. Een
          factuur op vervaldatum is een aanname. Onbekende gebeurtenissen
          ontbreken niet uit de lijst.
        </p>
        {alternative.events
          .filter((e) => e.date === null || e.date <= addDays(input.asOf, 90))
          .slice(0, 60)
          .map((e) => (
            <div
              key={e.id}
              className="border-t border-slate-300 py-2 text-sm flex flex-wrap justify-between gap-2"
            >
              <div>
                {e.date ?? "Betaaldatum onbekend"} · {e.label}
                <span className="block text-xs text-slate-600">
                  {e.basis === "input"
                    ? "Ingevoerd"
                    : e.basis === "scenario"
                      ? "Scenario"
                      : "Aanname"}
                  {e.kind === "reserve"
                    ? " · reservering, geen bankbetaling"
                    : ""}
                </span>
              </div>
              <strong>{money(e.amount)}</strong>
            </div>
          ))}
        {!alternative.events.length && (
          <p className="text-sm">Nog geen bekende toekomstige geldstromen.</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm">
            Geldmiddelen en langere termijn
          </summary>
          {base.horizons.map((p, i) => (
            <p key={p.day} className="text-sm mt-2">
              {p.day} dagen: geldmiddelen {money(p.cash)}
              {scenario
                ? ` → ${money(alternative.horizons[i].cash)} (verschil ${money(result.differences[i].cash)})`
                : ""}
              .
            </p>
          ))}
        </details>
      </SurfaceCard>
    </div>
  );
}
