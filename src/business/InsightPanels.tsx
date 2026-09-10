import { SurfaceCard } from "../components/WorkspaceUI";
import { analyzePatterns, goalProgress } from "./insights";
import type { BusinessData, Goal } from "./model";

const currency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const money = (value: number) => currency.format(value / 100);
export function PatternsPanel({ data }: { data: BusinessData }) {
  const result = analyzePatterns(data);
  if (!result)
    return (
      <SurfaceCard className="space-y-4">
        <h2>Inkomsten- en uitgavenpatronen</h2>
        <p>
          Nog onvoldoende gecontroleerde gegevens. Controleer rekeningen en
          betalingen voordat we patronen vergelijken.
        </p>
      </SurfaceCard>
    );
  return (
    <>
      <SurfaceCard className="space-y-4">
        <h2>Kasstroom door de maanden</h2>
        <p>
          Ontvangsten en uitgaven inclusief btw, leningen en privéonttrekkingen;
          eigen overboekingen tellen niet mee. Maanden zonder geregistreerde
          betalingen blijven onbekend.
        </p>
        <div className="biz-table-scroll">
          <table>
            <caption>Waargenomen kasstroom in zes maanden</caption>
            <thead>
              <tr>
                <th>Maand</th>
                <th>Ontvangen</th>
                <th>Uitgegeven</th>
                <th>Verschil</th>
              </tr>
            </thead>
            <tbody>
              {result.trend.map((m) => (
                <tr key={m.month}>
                  <th>{m.month}</th>
                  <td>{m.observed ? money(m.incoming) : "Geen gegevens"}</td>
                  <td>{m.observed ? money(m.outgoing) : "Geen gegevens"}</td>
                  <td>{m.observed ? money(m.net) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
      <SurfaceCard className="space-y-4">
        <h2>Terugkerende omzet en kosten</h2>
        <p>
          Dezelfde factuuromschrijving in ten minste twee verschillende maanden.
          Gemiddelden zijn exclusief btw over de maanden met waarnemingen; er
          wordt geen abonnement of toekomstige ontvangst aangenomen.
        </p>
        {result.recurring.length ? (
          <ul>
            {result.recurring.map((r) => (
              <li key={r.kind + r.label}>
                <strong>{r.label}</strong> —{" "}
                {r.kind === "sale" ? "omzet" : "kosten"}, {r.months} maanden,
                gemiddeld {money(r.average)} per waargenomen maand.{" "}
                {r.varying ? "Bedrag varieert." : "Gelijk bedrag waargenomen."}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nog geen herhaling aantoonbaar. Er zijn vergelijkbare facturen in
            meerdere maanden nodig. Voeg facturen uit eerdere maanden toe om
            herhaling te kunnen herkennen.
          </p>
        )}
      </SurfaceCard>
      <SurfaceCard className="space-y-4">
        <h2>Waar gaat de omzet naartoe?</h2>
        {result.largestShare === null ? (
          <p>Nog geen positieve omzetbasis voor een verdeling.</p>
        ) : (
          <p>
            De grootste omzetfactuur ({result.largestSale?.label})
            vertegenwoordigt {result.largestShare}% van de geregistreerde
            maandomzet. Dit is een factuurverdeling, geen vastgestelde
            klantafhankelijkheid.
          </p>
        )}
        <h3>Grootste kostenfacturen deze maand, excl. btw</h3>
        {result.topCosts.length ? (
          <ul>
            {result.topCosts.map((d) => (
              <li key={d.id}>
                {d.label}: {money(d.net)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Geen kostenfacturen geregistreerd in deze maand.</p>
        )}
      </SurfaceCard>
    </>
  );
}

export function GoalSummary({
  data,
  goal,
}: {
  data: BusinessData;
  goal: Goal;
}) {
  const progress = goalProgress(data, goal);
  const title = {
    revenue: "Maandomzetdoel",
    buffer: "Bedrijfsbuffer",
    investment: "Investeringsbudget",
    repay: "Aflosdoel",
  }[goal.kind];
  return (
    <>
      <span>
        {title} ·{" "}
        {goal.date ? `streefdatum ${goal.date}` : "Geen deadline gekozen"}
      </span>
      <span>
        {progress.source}:{" "}
        {progress.current === null
          ? goal.kind === "revenue"
            ? "Nog niet gecontroleerd"
            : "Nog niet ingevuld"
          : money(progress.current)}{" "}
        / doel {goal.target === null ? "Nog niet ingevuld" : money(goal.target)}
      </span>
      {progress.current !== null && goal.target !== null && (
        <progress
          max={Math.max(1, goal.target)}
          value={Math.min(progress.current, goal.target)}
          aria-label={`Voortgang ${goal.label}`}
        />
      )}
      <span>
        {progress.remaining === null
          ? "Vul de ontbrekende doelbedragen in en controleer waar nodig de omzet bij Fundament."
          : progress.remaining === 0
            ? "Doelbedrag bereikt op basis van deze invoer."
            : `Nog ${money(progress.remaining)} ${goal.kind === "revenue" ? "maandomzet nodig" : goal.kind === "repay" ? "af te lossen" : "apart te zetten"}.`}
      </span>
      {goal.kind === "revenue" ? (
        <span>
          Geen spaarinleg: dit doel volgt de geselecteerde omzetmaand. Eén goede
          maand bewijst nog geen voorspelbare omzet.
        </span>
      ) : (
        <span>
          {goal.kind === "repay"
            ? "Geplande aflossing"
            : "Gepland apart zetten"}
          : {goal.monthly === null ? "Nog niet ingevuld" : money(goal.monthly)}{" "}
          per maand. Dit is een plan, geen automatische betaling of oordeel over
          haalbaarheid.
        </span>
      )}
    </>
  );
}
