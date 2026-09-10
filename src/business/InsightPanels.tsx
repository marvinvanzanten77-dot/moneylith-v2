import { analyzePatterns, goalProgress, guideFor } from "./insights";
import type { BusinessData, Goal } from "./model";
import type { BusinessTab } from "./copy";

const currency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const money = (value: number) => currency.format(value / 100);
export function PatternsPanel({ data }: { data: BusinessData }) {
  const result = analyzePatterns(data);
  if (!result)
    return (
      <section className="biz-card">
        <h2>Inkomsten- en uitgavenpatronen</h2>
        <p>
          Nog onvoldoende gecontroleerde gegevens. Controleer rekeningen en
          betalingen voordat we patronen vergelijken.
        </p>
      </section>
    );
  return (
    <>
      <section className="biz-card">
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
      </section>
      <section className="biz-card">
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
            meerdere maanden nodig. Bestaande demo behouden? Voeg historie toe,
            of zet uitsluitend de demo terug voor de uitgebreidere voorbeelden.
          </p>
        )}
      </section>
      <section className="biz-card">
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
      </section>
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
        {title} · streefdatum {goal.date}
      </span>
      <span>
        {progress.source}:{" "}
        {progress.current === null
          ? "Nog niet gecontroleerd"
          : money(progress.current)}{" "}
        / doel {money(goal.target)}
      </span>
      {progress.current !== null && (
        <progress
          max={Math.max(1, goal.target)}
          value={Math.min(progress.current, goal.target)}
          aria-label={`Voortgang ${goal.label}`}
        />
      )}
      <span>
        {progress.remaining === null
          ? "Controleer de omzet bij Fundament."
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
          : {money(goal.monthly)} per maand. Dit is een plan, geen automatische
          betaling of oordeel over haalbaarheid.
        </span>
      )}
    </>
  );
}

export function BusinessGuide({
  data,
  tab,
  go,
}: {
  data: BusinessData;
  tab: BusinessTab;
  go: (tab: BusinessTab) => void;
}) {
  const guide = guideFor(data, tab);
  return (
    <aside className="biz-guide" aria-label="Zakelijke gids">
      <section className="biz-card">
        <p className="biz-eyebrow">GIDS</p>
        <h2>Jouw volgende stap</h2>
        <p>{guide.text}</p>
        <button className="biz-button" onClick={() => go(guide.target)}>
          {guide.action}
        </button>
        <small>
          Lokale hulp op basis van deze administratie. AI is niet aangesloten;
          er worden geen gegevens verstuurd.
        </small>
      </section>
    </aside>
  );
}
