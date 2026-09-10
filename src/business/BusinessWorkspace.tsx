import { NavigationStep } from "../components/NavigationStep";
import { BusinessGuide, GoalSummary, PatternsPanel } from "./InsightPanels";
import { stepProgress } from "./insights";
import { useEffect, useRef, useState } from "react";
import { Collection, ConfirmAction, EditDialog, type Field } from "./Editor";
import {
  assumptions,
  businessTabs,
  forecastAssumptions,
  type BusinessTab,
} from "./copy";
import {
  businessAiContext,
  calculateBusiness,
  changeBusiness,
  confirmSection,
  forecastBusiness,
  missingFor,
  type Scenario,
} from "./finance";
import {
  gross,
  monthEnd,
  sectionLabels,
  workspaceKeys,
  type Account,
  type Asset,
  type BusinessData,
  type Debt,
  type Document,
  type Goal,
  type Movement,
  type Section,
  type Workspace,
} from "./model";
import {
  loadBusiness,
  resetBusinessDemo,
  restoreBusiness,
  saveBusiness,
} from "./storage";
import "./business.css";

const currency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money = (cents: number) => currency.format(cents / 100);
const vatOptions: [string, string][] = [
  ["0", "0%"],
  ["9", "9%"],
  ["21", "21%"],
];
const movementNames: Record<Movement["kind"], string> = {
  document: "Factuur/bon betalen of ontvangen",
  loan_in: "Lening ontvangen (geen omzet)",
  loan_out: "Hoofdsom aflossen (geen kosten)",
  owner_draw: "Privéonttrekking (geen kosten)",
  owner_deposit: "Privéstorting (geen omzet)",
  vat_payment: "Btw betalen",
  tax_payment: "Inkomstenbelasting betalen",
  transfer: "Tussen eigen rekeningen",
};
const docNames = {
  sale: "Omzetfactuur",
  cost: "Kosten/bon",
  asset: "Investering",
};
const documentFields: Field[] = [
  { key: "label", label: "Omschrijving / klant of leverancier" },
  {
    key: "number",
    label: "Uniek kenmerk (bij inkoop: leverancier + factuurnummer)",
  },
  {
    key: "kind",
    label: "Soort",
    type: "select",
    options: Object.entries(docNames),
  },
  { key: "date", label: "Factuurdatum", type: "date" },
  { key: "due", label: "Vervaldatum", type: "date" },
  { key: "net", label: "Bedrag exclusief btw (€)", type: "money" },
  {
    key: "vatRate",
    label: "Btw-percentage",
    type: "select",
    options: vatOptions,
  },
  {
    key: "deductible",
    label: "Inkoop-btw is aftrekbaar (alleen kosten/investeringen)",
    type: "boolean",
  },
];
const accountFields: Field[] = [
  { key: "label", label: "Rekeningnaam" },
  {
    key: "type",
    label: "Soort",
    type: "select",
    options: [
      ["payment", "Betaalrekening"],
      ["savings", "Spaarrekening"],
    ],
  },
  {
    key: "opening",
    label: "Beginsaldo (€), vóór de eerste ingevoerde betaling",
    type: "money",
  },
  { key: "date", label: "Begindatum", type: "date" },
];
const debtFields: Field[] = [
  { key: "label", label: "Lening of regeling" },
  {
    key: "type",
    label: "Soort",
    type: "select",
    options: [
      ["loan", "Zakelijke lening"],
      ["arrangement", "Betalingsregeling"],
    ],
  },
  { key: "opening", label: "Hoofdsom op begindatum (€)", type: "money" },
  { key: "date", label: "Begindatum", type: "date" },
  {
    key: "monthly",
    label: "Geplande maandaflossing hoofdsom (€), zonder rente",
    type: "money",
    nullable: true,
  },
];
const planFields: Field[] = [
  {
    key: "revenue",
    label: "Verwachte nieuwe omzet per maand excl. btw (€)",
    type: "money",
    nullable: true,
  },
  {
    key: "salesVat",
    label: "Btw op verwachte omzet",
    type: "select",
    options: vatOptions,
    nullable: true,
  },
  {
    key: "costs",
    label: "Terugkerende en overige bedrijfskosten per maand excl. btw (€)",
    type: "money",
    nullable: true,
  },
  {
    key: "costsVat",
    label: "Btw op verwachte kosten",
    type: "select",
    options: vatOptions,
    nullable: true,
  },
  {
    key: "deductible",
    label: "Deze inkoop-btw is volledig aftrekbaar",
    type: "boolean",
  },
  {
    key: "draw",
    label: "Geplande privéonttrekking per maand (€)",
    type: "money",
    nullable: true,
  },
];
const reserveFields: Field[] = [
  {
    key: "taxPaymentCadence",
    label: "Belastingbetalingen in de prognose",
    type: "select",
    nullable: true,
    options: [
      ["monthly", "Elke prognosemaand"],
      ["quarterly", "Elke drie prognosemaanden"],
      ["hold", "Alleen reserveren, geen betalingen"],
    ],
  },
  {
    key: "taxPercent",
    label: "Geschatte inkomstenbelastingreserve (%)",
    type: "number",
    nullable: true,
  },
  {
    key: "buffer",
    label: "Extra bedrijfsbuffer om apart te houden (€)",
    type: "money",
    nullable: true,
  },
];

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail?: string;
}) {
  return (
    <div className="biz-metric">
      <span>{label}</span>
      <strong>{value === null ? "Nog niet ingevuld" : money(value)}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Missing({ names }: { names: string[] }) {
  return names.length > 0 ? (
    <p className="biz-notice" role="status">
      Nog onvoldoende gecontroleerde gegevens. Controleer:{" "}
      {names.join(", ").toLowerCase()}. Een lege lijst is geen bevestigde nul.
    </p>
  ) : null;
}
export default function BusinessWorkspace({
  workspace,
  onWorkspace,
  onPersonal,
}: {
  workspace: Workspace;
  onWorkspace: (workspace: Workspace) => void;
  onPersonal: () => void;
}) {
  const [loaded] = useState(() => {
    try {
      return { data: loadBusiness(localStorage, workspace), error: "" };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e.message : "Opslag niet beschikbaar.",
      };
    }
  });
  const [data, setData] = useState<BusinessData | null>(loaded.data);
  const [error, setError] = useState(loaded.error);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<BusinessTab>(() => {
    try {
      const saved = localStorage.getItem(workspaceKeys[workspace] + ".tab");
      return businessTabs.some(([key]) => key === saved)
        ? (saved as BusinessTab)
        : "foundation";
    } catch {
      return "foundation";
    }
  });
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const reveal = () => {
      const nav = navigation.current;
      const active = nav?.querySelector<HTMLButtonElement>(
        "button[aria-current]",
      );
      if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
      nav.scrollLeft +=
        active.getBoundingClientRect().left -
        nav.getBoundingClientRect().left -
        (nav.clientWidth - active.clientWidth) / 2;
    };
    reveal();
    window.addEventListener("resize", reveal);
    return () => window.removeEventListener("resize", reveal);
  }, [tab]);
  const [backup, setBackup] = useState("");
  const [showRestore, setShowRestore] = useState(false);
  const isDemo = workspace === "demo";
  const go = (next: BusinessTab) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setTab(next);
    setMessage("");
    try {
      localStorage.setItem(workspaceKeys[workspace] + ".tab", next);
    } catch {
      setError("De tabkeuze kon niet worden bewaard.");
    }
  };
  const perform = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "De wijziging is niet opgeslagen.",
      );
    }
  };
  const commit = (edit: (next: BusinessData) => void) => {
    if (!data) throw new Error("Herstel eerst de opgeslagen gegevens.");
    const next = changeBusiness(data, edit);
    saveBusiness(localStorage, workspace, next);
    setData(next);
    setMessage("Opgeslagen in deze browser.");
  };
  const reset = () => {
    setData(resetBusinessDemo(localStorage));
    go("foundation");
    setMessage("Alleen de demo is teruggezet.");
    setError("");
  };
  const header = (
    <header className={`biz-topbar ${isDemo ? "demo" : "real"}`}>
      <div>
        <b>
          {isDemo
            ? "Zakelijke demo — fictieve gegevens"
            : "Zakelijk — eigen administratie"}
        </b>
        <span>
          {isDemo
            ? "Vrij bewerkbaar. Geen echte bank- of AI-verbinding."
            : "Eigen gegevens, uitsluitend in deze browser opgeslagen."}
        </span>
      </div>
      <div className="biz-actions">
        <button className="biz-button" onClick={onPersonal}>
          Persoonlijk
        </button>
        <button
          className="biz-button"
          onClick={() => onWorkspace(isDemo ? "real" : "demo")}
        >
          {isDemo
            ? "Open eigen zakelijke administratie"
            : "Open zakelijke demo"}
        </button>
        {isDemo && (
          <ConfirmAction
            button="Alleen demo terugzetten"
            message="Je bewerkingen in de demo verdwijnen. Uitsluitend de fictieve demo wordt teruggezet. Persoonlijke en echte zakelijke gegevens blijven bewaard."
            onConfirm={reset}
          />
        )}
      </div>
    </header>
  );
  if (!data)
    return (
      <main className="business-shell">
        {header}
        <div className="biz-content">
          <h1>Gegevens konden niet worden geopend</h1>
          <p role="alert">{error}</p>
          <p>
            De opgeslagen inhoud is niet overschreven. Exporteer die voordat je
            een herstel uitvoert.
          </p>
          <button
            className="biz-button"
            onClick={() =>
              perform(() =>
                download("moneylith-opslag-herstel.json", {
                  raw: localStorage.getItem(workspaceKeys[workspace]),
                }),
              )
            }
          >
            Opgeslagen inhoud downloaden
          </button>
        </div>
      </main>
    );
  const scenario = data.scenario;
  const result = calculateBusiness(data);
  const check = (section: Section) => {
    const review = result.checks[section];
    return (
      <div className="biz-review" key={section}>
        <strong>
          {sectionLabels[section]} —{" "}
          {review.ready
            ? "Gecontroleerd"
            : review.hasRows
              ? "Nog te controleren"
              : "Nog niet ingevuld"}
        </strong>
        <label>
          <input
            type="checkbox"
            checked={review.ready}
            disabled={!review.valid}
            onChange={(event) =>
              perform(() => {
                const next = confirmSection(
                  data,
                  section,
                  event.target.checked,
                );
                saveBusiness(localStorage, workspace, next);
                setData(next);
                setMessage("Controlebevestiging opgeslagen.");
              })
            }
          />
          <span>
            {review.hasRows
              ? "Ik heb dit overzicht gecontroleerd en het is compleet voor deze berekening."
              : "Ik bevestig dat dit overzicht volledig is en er geen posten zijn (expliciet € 0)."}
          </span>
        </label>
        {!review.valid && (
          <p>
            Vul ontbrekende bedragen of percentages in. Vul 0 in als de waarde
            echt nul is.
          </p>
        )}
        <small>
          Wijzigingen die deze berekening raken maken de bevestiging ongeldig.
        </small>
      </div>
    );
  };
  const saveRow = <T extends { id: string }>(
    key: "documents" | "movements" | "accounts" | "debts" | "assets" | "goals",
    row: T,
  ) =>
    commit((next) => {
      const rows = next[key] as unknown as T[];
      const index = rows.findIndex((old) => old.id === row.id);
      if (index === -1) rows.push(row);
      else rows[index] = row;
    });
  const removeRow = (
    key: "documents" | "movements" | "accounts" | "debts" | "assets" | "goals",
    id: string,
  ) =>
    commit((next) => {
      if (
        (key === "documents" &&
          next.movements.some((m) => m.documentId === id)) ||
        (key === "accounts" &&
          next.movements.some(
            (m) => m.accountId === id || m.toAccountId === id,
          )) ||
        (key === "debts" && next.movements.some((m) => m.debtId === id))
      )
        throw new Error(
          "Er zijn nog gekoppelde betalingen. Verwijder die eerst om dubbeltelling of ontbrekende koppelingen te voorkomen.",
        );
      (next as unknown as Record<string, unknown>)[key] = next[key].filter(
        (row) => row.id !== id,
      );
    });
  const documentList = (kind?: Document["kind"]) => (
    <Collection<Document>
      title={
        kind === "sale"
          ? "Omzetfacturen"
          : kind === "cost"
            ? "Bedrijfskosten en bonnetjes"
            : kind === "asset"
              ? "Investeringsfacturen"
              : "Facturen en zakelijke documenten"
      }
      items={data.documents.filter(
        (d) => (!kind || d.kind === kind) && d.date.slice(0, 7) === data.month,
      )}
      fields={documentFields}
      defaults={{
        kind: kind ?? "sale",
        vatRate: 21,
        deductible: true,
        date: data.month + "-01",
        due: data.month + "-28",
      }}
      onSave={(row) =>
        saveRow("documents", { ...row, vatRate: Number(row.vatRate) })
      }
      onDelete={(id) => removeRow("documents", id)}
      summary={(d) => (
        <>
          <span>
            {d.number} · {docNames[d.kind]} · {d.date} · vervalt {d.due}
          </span>
          <span>
            Excl. btw {money(d.net)} · btw {money(gross(d) - d.net)} (
            {d.vatRate}%) · incl. btw {money(gross(d))}
          </span>
          <span>
            Openstaand{" "}
            {money(
              result.outstanding.find((x) => x.id === d.id)?.unpaid ?? gross(d),
            )}
            {d.kind !== "sale" && !d.deductible
              ? " · Inkoop-btw niet aftrekbaar"
              : ""}
          </span>
        </>
      )}
    />
  );
  const planPanel = (
    <section className="biz-card">
      <div className="biz-section-heading">
        <h2>Maandplan voor nieuw werk</h2>
        <EditDialog
          title="Maandplan aanpassen"
          button="Maandplan aanpassen"
          value={data.plan}
          fields={planFields}
          onSave={(patch) =>
            commit((next) => {
              Object.assign(next.plan, patch);
              next.plan.salesVat =
                patch.salesVat === null ? null : Number(patch.salesVat);
              next.plan.costsVat =
                patch.costsVat === null ? null : Number(patch.costsVat);
            })
          }
        />
      </div>
      <p>
        Neem terugkerende bedrijfskosten hier één keer op. Dit plan verandert
        geen geboekte facturen of betalingen. De gekozen btw-percentages zijn
        vereenvoudigde aannames voor toekomstige maanden.
      </p>
      <div className="biz-metrics">
        <Metric
          label="Verwachte omzet excl. btw / maand"
          value={data.plan.revenue}
        />
        <Metric
          label="Verwachte kosten excl. btw / maand"
          value={data.plan.costs}
        />
        <Metric label="Privéonttrekking / maand" value={data.plan.draw} />
      </div>
      {check("plan")}
    </section>
  );
  const reservePanel = (
    <section className="biz-card">
      <div className="biz-section-heading">
        <h2>Reserveringen</h2>
        <EditDialog
          title="Reserveringen aanpassen"
          button="Reserveringen aanpassen"
          value={data.plan}
          fields={reserveFields}
          onSave={(patch) =>
            commit((next) => {
              Object.assign(next.plan, patch);
            })
          }
        />
      </div>
      <p>
        Inkomstenbelasting:{" "}
        {data.plan.taxPercent === null
          ? "nog niet ingevuld"
          : `${data.plan.taxPercent}% van de positieve winstindicatie`}
        . Dit is jouw instelbare schatting, geen definitieve
        belastingberekening.
      </p>
      <p>
        Extra bedrijfsbuffer:{" "}
        {data.plan.buffer === null
          ? "nog niet ingevuld"
          : money(data.plan.buffer)}
        . Geld op een spaarrekening is al onderdeel van je geldmiddelen en wordt
        niet nogmaals opgeteld.
      </p>
      <p>
        Betaalplan:{" "}
        {data.plan.taxPaymentCadence === "monthly"
          ? "iedere prognosemaand"
          : data.plan.taxPaymentCadence === "quarterly"
            ? "iedere derde prognosemaand"
            : data.plan.taxPaymentCadence === "hold"
              ? "geen betalingen, alleen reserveren"
              : "nog niet gekozen"}
        . Op die momenten wordt de opgebouwde reserve van vóór die maand
        afgeboekt. Dit is een vereenvoudigd scenario voor btw en
        inkomstenbelasting samen, geen aangifteschema; controleer je echte
        betaaldata afzonderlijk.
      </p>
      {check("reserves")}
    </section>
  );
  const movementFields: Field[] = [
    { key: "label", label: "Omschrijving" },
    {
      key: "kind",
      label: "Soort betaling",
      type: "select",
      options: Object.entries(movementNames),
    },
    { key: "date", label: "Betaaldatum", type: "date" },
    {
      key: "amount",
      label:
        "Werkelijk betaald / ontvangen bedrag incl. btw (€), positief invullen",
      type: "money",
    },
    {
      key: "accountId",
      label: "Van/op rekening",
      type: "select",
      options: data.accounts.map((a) => [a.id, a.label]),
    },
    {
      key: "documentId",
      visibleWhen: { key: "kind", values: ["document"] },
      label: "Factuur (verplicht bij factuur/bon)",
      type: "select",
      options: data.documents.map((d) => [d.id, `${d.number} — ${d.label}`]),
      optional: false,
    },
    {
      key: "debtId",
      visibleWhen: { key: "kind", values: ["loan_in", "loan_out"] },
      label: "Lening/regeling (verplicht bij lening of aflossing)",
      type: "select",
      options: data.debts.map((d) => [d.id, d.label]),
      optional: false,
    },
    {
      key: "toAccountId",
      visibleWhen: { key: "kind", values: ["transfer"] },
      label: "Naar eigen rekening (alleen bij overboeking)",
      type: "select",
      options: data.accounts.map((a) => [a.id, a.label]),
      optional: false,
    },
  ];
  const payments = (
    <>
      <p className="biz-notice">
        Boek iedere betaling één keer. Koppel omzet, kosten en investeringen aan
        de bestaande factuur. Er is geen actieve bankkoppeling of automatische
        import in deze zakelijke versie.
      </p>
      <Collection<Movement>
        title="Ontvangsten en betalingen"
        items={data.movements.filter((m) => m.date.slice(0, 7) === data.month)}
        fields={movementFields}
        defaults={{
          kind: "document",
          date: data.month + "-01",
          documentId: "",
          debtId: "",
          toAccountId: "",
        }}
        onSave={(row) =>
          saveRow("movements", {
            ...row,
            documentId: row.kind === "document" ? row.documentId : "",
            debtId: ["loan_in", "loan_out"].includes(row.kind)
              ? row.debtId
              : "",
            toAccountId: row.kind === "transfer" ? row.toAccountId : "",
          })
        }
        onDelete={(id) => removeRow("movements", id)}
        summary={(m) => (
          <>
            <span>
              {m.date} · {movementNames[m.kind]} · {money(m.amount)}
            </span>
            <span>
              {data.accounts.find((a) => a.id === m.accountId)?.label}
              {m.documentId &&
                ` · ${data.documents.find((d) => d.id === m.documentId)?.number}`}
            </span>
          </>
        )}
      />
      {check("cash")}
    </>
  );
  const missingForecast = missingFor(data, "forecast");
  const forecast = forecastBusiness(data, scenario);
  const content = () => {
    switch (tab) {
      case "intent":
        return (
          <section className="biz-card">
            <h2>Jouw onderneming en richting</h2>
            <dl className="biz-definition">
              <dt>Onderneming</dt>
              <dd>{data.profile.name || "Nog niet ingevuld"}</dd>
              <dt>Bedrijfsdoel</dt>
              <dd>{data.profile.goal || "Nog niet ingevuld"}</dd>
              <dt>Financiële druk</dt>
              <dd>{data.profile.pressure || "Nog niet ingevuld"}</dd>
              <dt>Gewenste richting</dt>
              <dd>{data.profile.direction || "Nog niet ingevuld"}</dd>
            </dl>
            <EditDialog
              title="Bedrijfsrichting aanpassen"
              button="Bedrijfsrichting aanpassen"
              value={data.profile}
              fields={[
                { key: "name", label: "Bedrijfsnaam" },
                {
                  key: "goal",
                  label: "Wat wil je met je onderneming bereiken?",
                  type: "textarea",
                  optional: true,
                },
                {
                  key: "pressure",
                  label: "Waar ervaar je financiële druk?",
                  type: "textarea",
                  optional: true,
                },
                {
                  key: "direction",
                  label: "Welke richting wil je op?",
                  type: "textarea",
                  optional: true,
                },
              ]}
              onSave={(patch) =>
                commit((next) => {
                  Object.assign(next.profile, patch);
                })
              }
            />
            <p>
              Financiële conclusies volgen pas uit gecontroleerde bedragen, niet
              uit je gekozen richting.
            </p>
          </section>
        );
      case "foundation":
        return (
          <>
            <Missing names={missingFor(data, "profit")} />
            <div className="biz-metrics">
              <Metric
                label="Omzet excl. btw"
                value={result.checks.income.ready ? result.income : null}
                detail="Uitgereikte facturen, ook nog onbetaalde"
              />
              <Metric
                label="Bedrijfskosten"
                value={result.checks.costs.ready ? result.costs : null}
                detail="Incl. niet-aftrekbare inkoop-btw"
              />
              <Metric
                label="Winstindicatie"
                value={missingFor(data, "profit").length ? null : result.profit}
                detail="Vóór afschrijving, belasting en fiscale correcties"
              />
            </div>
            <div className="biz-metrics">
              <Metric
                label="Btw op omzet"
                value={result.checks.income.ready ? result.outputVat : null}
              />
              <Metric
                label="Aftrekbare inkoop-btw"
                value={result.checks.costs.ready ? result.inputVat : null}
              />
              <Metric
                label="Beschikbaar na reserveringen"
                value={
                  missingFor(data, "available").length ? null : result.available
                }
                detail="Geldmiddelen − maandreserves − buffer − open inkoopfacturen"
              />
            </div>
            {documentList("sale")}
            {check("income")}
            {documentList("cost")}
            {documentList("asset")}
            {check("costs")}
            {planPanel}
          </>
        );
      case "debts":
        return (
          <>
            <p className="biz-notice">
              Registreer een open leveranciersfactuur bij Inbox, niet ook als
              lening. Een lening of betalingsregeling heeft een eigen hoofdsom;
              ontvangsten en aflossingen koppel je bij Patronen. Rente is een
              aparte kostenpost.
            </p>
            <div className="biz-metrics">
              <Metric
                label="Openstaande leningen en regelingen"
                value={
                  result.checks.debts.ready
                    ? result.debts.reduce((s, d) => s + d.balance, 0)
                    : null
                }
              />
              <Metric
                label="Open inkoopfacturen incl. btw"
                value={missingFor(data, "vat").length ? null : result.payables}
              />
            </div>
            <Collection<Debt>
              title="Zakelijke leningen en regelingen"
              items={data.debts}
              fields={debtFields}
              defaults={{
                type: "loan",
                date: data.month + "-01",
                monthly: null,
              }}
              onSave={(row) => saveRow("debts", row)}
              onDelete={(id) => removeRow("debts", id)}
              summary={(d) => (
                <>
                  <span>
                    Beginhoofdsom {money(d.opening)} · restant{" "}
                    {money(
                      result.debts.find((x) => x.id === d.id)?.balance ?? 0,
                    )}
                  </span>
                  <span>
                    Aflossing p/m{" "}
                    {d.monthly === null
                      ? "nog niet ingevuld"
                      : money(d.monthly)}{" "}
                    · rente apart opnemen in kosten
                  </span>
                </>
              )}
            />
            {check("debts")}
            <section className="biz-card">
              <h2>Openstaande leveranciersfacturen</h2>
              {result.outstanding
                .filter((d) => d.kind !== "sale" && d.unpaid > 0)
                .map((d) => (
                  <p key={d.id}>
                    {d.number} · {d.label} · {money(d.unpaid)} · vervalt {d.due}
                  </p>
                ))}
              <button className="biz-button" onClick={() => go("inbox")}>
                Open Inbox
              </button>
            </section>
          </>
        );
      case "assets":
        return (
          <>
            <div className="biz-metrics">
              <Metric
                label="Liquide geldmiddelen"
                value={missingFor(data, "cash").length ? null : result.cash}
                detail={`Rekeningen t/m ${monthEnd(data.month)}`}
              />
              <Metric
                label="Handmatige boekwaarde bedrijfsmiddelen"
                value={result.checks.assets.ready ? result.assetValue : null}
                detail="Geen beschikbaar geld; geen automatische afschrijving"
              />
              <Metric
                label="Geschatte belastingreserve"
                value={
                  missingFor(data, "available").length
                    ? null
                    : result.taxReserve
                }
              />
            </div>
            {reservePanel}
            <Collection<Asset>
              title="Bedrijfsmiddelen"
              items={data.assets}
              defaults={{ note: "" }}
              fields={[
                { key: "label", label: "Bedrijfsmiddel" },
                {
                  key: "value",
                  label: "Actuele boekwaarde (€)",
                  type: "money",
                },
                {
                  key: "note",
                  label: "Toelichting / factuurkenmerk",
                  type: "textarea",
                  optional: true,
                },
              ]}
              onSave={(row) => saveRow("assets", row)}
              onDelete={(id) => removeRow("assets", id)}
              summary={(a) => (
                <>
                  <span>{money(a.value)}</span>
                  <span>{a.note}</span>
                </>
              )}
            />
            {check("assets")}
          </>
        );
      case "goals":
        return (
          <>
            <p className="biz-notice">
              Doelen zijn plannen. Een doel maakt geen betaling, kostenpost of
              extra reserve aan. Verwerk een daadwerkelijke investering of
              aflossing bij Inbox/Patronen.
            </p>
            <Collection<Goal>
              title="Zakelijke doelen"
              items={data.goals}
              defaults={{
                kind: "buffer",
                current: 0,
                monthly: 0,
                date: data.month + "-28",
              }}
              fields={[
                { key: "label", label: "Doel" },
                {
                  key: "kind",
                  label: "Soort doel",
                  type: "select",
                  options: [
                    ["revenue", "Maandomzet"],
                    ["buffer", "Bedrijfsbuffer"],
                    ["investment", "Investering"],
                    ["repay", "Aflossen"],
                  ],
                },
                {
                  key: "target",
                  label: "Doelbedrag (€)",
                  labelFor: (draft) =>
                    draft.kind === "revenue"
                      ? "Gewenste maandomzet excl. btw (€)"
                      : draft.kind === "repay"
                        ? "Totaal af te lossen bedrag (€)"
                        : "Benodigd budget (€)",
                  type: "money",
                },
                {
                  key: "current",
                  label: "Huidige voortgang (€)",
                  visibleWhen: {
                    key: "kind",
                    values: ["buffer", "investment", "repay"],
                  },
                  labelFor: (draft) =>
                    draft.kind === "repay"
                      ? "Al afgeloste hoofdsom (€)"
                      : "Al apart gezet (€)",
                  type: "money",
                },
                {
                  key: "monthly",
                  label: "Maandelijks bedrag (€)",
                  visibleWhen: {
                    key: "kind",
                    values: ["buffer", "investment", "repay"],
                  },
                  labelFor: (draft) =>
                    draft.kind === "repay"
                      ? "Geplande maandaflossing (€)"
                      : "Maandelijks apart zetten (€)",
                  type: "money",
                },
                { key: "date", label: "Streefdatum", type: "date" },
              ]}
              onSave={(row) =>
                saveRow("goals", {
                  ...row,
                  monthly: row.kind === "revenue" ? 0 : row.monthly,
                })
              }
              onDelete={(id) => removeRow("goals", id)}
              summary={(g) => <GoalSummary data={data} goal={g} />}
            />
          </>
        );
      case "accounts":
        return (
          <>
            <p className="biz-notice">
              Handmatige rekeningadministratie. Er wordt geen bankverbinding
              geopend. Bevestig dat beginsaldi en betalingen volledig zijn
              voordat je de geldstand gebruikt.
            </p>
            <div className="biz-metrics">
              <Metric
                label="Totaal geldmiddelen"
                value={missingFor(data, "cash").length ? null : result.cash}
              />
            </div>
            <Collection<Account>
              title="Zakelijke rekeningen"
              items={data.accounts}
              fields={accountFields}
              defaults={{ type: "payment", date: data.month + "-01" }}
              onSave={(row) => saveRow("accounts", row)}
              onDelete={(id) => removeRow("accounts", id)}
              summary={(a) => (
                <>
                  <span>
                    Beginsaldo {money(a.opening)} op {a.date}
                  </span>
                  <span>
                    Stand t/m {monthEnd(data.month)}:{" "}
                    {!result.checks.cash.ready
                      ? "nog niet gecontroleerd"
                      : result.accounts.find((x) => x.id === a.id)?.balance ===
                          null
                        ? "rekening begint later"
                        : money(
                            result.accounts.find((x) => x.id === a.id)!
                              .balance!,
                          )}
                  </span>
                </>
              )}
            />
            {check("cash")}
            <button className="biz-button" onClick={() => go("patterns")}>
              Betalingen bekijken en toevoegen
            </button>
          </>
        );
      case "patterns":
        return (
          <>
            <PatternsPanel data={data} />
            <div className="biz-metrics">
              <Metric
                label="Werkelijke maandkasstroom"
                value={missingFor(data, "cash").length ? null : result.cashflow}
                detail="Ontvangsten minus betalingen; eigen overboekingen tellen netto niet mee"
              />
              <Metric
                label="Nog te ontvangen facturen incl. btw"
                value={
                  missingFor(data, "vat").length ? null : result.receivables
                }
              />
            </div>
            {payments}
          </>
        );
      case "inbox":
        return (
          <>
            <p className="biz-notice">
              Registreer facturen, bonnetjes en investeringen handmatig.
              PDF-opslag, OCR, versturen en bankimport zijn hier niet gekoppeld.
              Een factuur registreren is nog geen betaling. Koppel de echte
              betaling bij Patronen.
            </p>
            {documentList()}
            {check("income")}
            {check("costs")}
            <button className="biz-button" onClick={() => go("patterns")}>
              Betaling aan factuur koppelen
            </button>
          </>
        );
      case "forecast":
        return (
          <>
            <Missing names={missingForecast} />
            {forecast ? (
              <>
                <div className="biz-metrics">
                  <Metric
                    label="Verwacht banksaldo over 12 maanden"
                    detail={data.plan.taxPaymentCadence === "hold" ? "Zonder belastingbetalingen" : "Na geplande belastingbetalingen"}
                    value={forecast[12].bank}
                  />
                  <Metric
                    label="Daarvan gereserveerd voor btw/belasting"
                    value={forecast[12].reserves}
                  />
                  <Metric
                    label="Beschikbaar na reserves, buffer en open inkoop"
                    value={forecast[12].available}
                  />
                </div>
                <section className="biz-card">
                  <div className="biz-section-heading">
                    <h2>Verken een scenario</h2>
                    <EditDialog
                      title="Scenario aanpassen"
                      button="Scenario aanpassen"
                      value={scenario}
                      fields={[
                        {
                          key: "revenueDelta",
                          label:
                            "Extra of minder omzet excl. btw per maand (€), negatief mag",
                          type: "money",
                        },
                        {
                          key: "extraCost",
                          label: "Extra bedrijfskosten excl. btw per maand (€)",
                          type: "money",
                        },
                        {
                          key: "oneOff",
                          label:
                            "Eenmalige netto tegenvaller in eerste maand (€), zonder btw/belastingeffect",
                          type: "money",
                        },
                      ]}
                      onSave={(patch) => {
                        const next = patch as Scenario;
                        forecastBusiness(data, next);
                        commit((data) => {
                          data.scenario = next;
                        });
                      }}
                    />
                  </div>
                  <p>
                    Extra omzet {money(scenario.revenueDelta)} p/m · extra
                    kosten {money(scenario.extraCost)} p/m · eenmalig{" "}
                    {money(scenario.oneOff)}. Negatieve bedragen bij beschikbaar
                    geld blijven zichtbaar.
                  </p>
                  <button
                    className="biz-button"
                    onClick={() =>
                      perform(() =>
                        commit((next) => {
                          next.scenario = {
                            revenueDelta: 0,
                            extraCost: 0,
                            oneOff: 0,
                          };
                        }),
                      )
                    }
                  >
                    Terug naar maandplan
                  </button>
                  <div className="biz-table-scroll">
                    <table>
                      <caption>
                        Verwachte kaspositie — geen gegarandeerde uitkomst
                      </caption>
                      <thead>
                        <tr>
                          <th>Maand</th>
                          <th>Geldmiddelen</th>
                          <th>Belasting betaald</th>
                          <th>Btw/belastingreserve</th>
                          <th>Beschikbaar</th>
                          <th>Restant leningen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.map((row) => (
                          <tr key={row.month}>
                            <th>{row.month}</th>
                            <td>{money(row.bank)}</td>
                            <td>{money(row.taxPaid)}</td>
                            <td>{money(row.reserves)}</td>
                            <td>{money(row.available)}</td>
                            <td>{money(row.loanBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <p className="biz-notice">
                Vul de genoemde onderdelen aan. Zonder gecontroleerde basis
                tonen we geen scenario of financiële conclusie.
              </p>
            )}
            {planPanel}
            {reservePanel}
            <section className="biz-card">
              <h2>Aannames bij de vooruitblik</h2>
              <ul>
                {forecastAssumptions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </section>
          </>
        );
      case "backup":
        return (
          <section className="biz-card">
            <h2>
              Backup van alleen{" "}
              {isDemo ? "de demo" : "je eigen zakelijke administratie"}
            </h2>
            <p>
              Persoonlijke en andere zakelijke administraties zitten niet in
              deze export. Bewaar je backup op een veilige plek; browseropslag
              is geen automatische backup.
            </p>
            <button
              className="biz-button primary"
              onClick={() =>
                download(
                  `moneylith-zakelijk-${workspace}-${data.month}.json`,
                  data,
                )
              }
            >
              Backup downloaden
            </button>
            <div className="biz-import">
              <label>
                Een backupbestand kiezen
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2_000_000) {
                      setError("Maximaal 2 MB.");
                      return;
                    }
                    try {
                      setBackup(await file.text());
                      setShowRestore(true);
                    } catch {
                      setError("Het backupbestand kon niet worden gelezen.");
                    }
                  }}
                />
              </label>
              {showRestore && (
                <>
                  <p>
                    Dit vervangt uitsluitend deze{" "}
                    {isDemo ? "demo" : "echte zakelijke administratie"}.
                    Controlebevestigingen vervallen. Maak eerst een export als
                    je de huidige inhoud wilt bewaren.
                  </p>
                  <ConfirmAction
                    button="Deze backup bevestigen en herstellen"
                    message={`Deze ${isDemo ? "demo" : "echte zakelijke administratie"} vervangen door de gekozen backup? Alleen deze administratie wordt gewijzigd.`}
                    onConfirm={() => {
                      setData(restoreBusiness(localStorage, workspace, backup));
                      setBackup("");
                      setShowRestore(false);
                      setMessage(
                        "Backup ingelezen. Controleer de gegevens opnieuw.",
                      );
                    }}
                  />
                  <button
                    className="biz-button"
                    onClick={() => {
                      setShowRestore(false);
                      setBackup("");
                    }}
                  >
                    Annuleren
                  </button>
                </>
              )}
            </div>
          </section>
        );
      case "settings": {
        const context = businessAiContext(data);
        return (
          <>
            {reservePanel}
            <section className="biz-card">
              <h2>Administratie en privacy</h2>
              <p>
                {isDemo
                  ? "Je bewerkt uitsluitend fictieve demo-data. De knop bovenaan opent een aparte eigen administratie, zonder voorbeeldgegevens. Bestaan daar al gegevens, dan blijven die behouden."
                  : "Deze eigen administratie start leeg. De demo blijft afzonderlijk bestaan. Er wordt niets automatisch samengevoegd."}
              </p>
              <p>
                Zakelijke bankkoppeling, betalingen, cloudsync en externe AI
                zijn niet actief. Er worden geen gegevens automatisch verstuurd.
              </p>
              <p>
                Voor een eventuele analyse ontbreken nog:{" "}
                {context.missing.length
                  ? context.missing.join(", ")
                  : "geen noodzakelijke basisgegevens"}
                . Onbekende bedragen blijven onbekend, ook in de analyse-invoer.
              </p>
              <button
                className="biz-button"
                onClick={() =>
                  download(`moneylith-analyse-${workspace}.json`, context)
                }
              >
                Analyse-invoer lokaal downloaden
              </button>
              <button
                className="biz-button"
                onClick={() =>
                  perform(() => {
                    const old: Record<string, unknown> = {};
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i)!;
                      if (
                        (key.startsWith("moneylith.business.") &&
                          !key.startsWith("moneylith.business.demo.") &&
                          !key.startsWith("moneylith.business.real.") &&
                          key !== "moneylith.business.lastWorkspace.v1") ||
                        key.endsWith("-business")
                      )
                        old[key] = localStorage.getItem(key);
                    }
                    download("moneylith-oude-zakelijke-opslag.json", old);
                  })
                }
              >
                Oude zakelijke browsergegevens exporteren
              </button>
              <p>
                Eventuele oudere zakelijke gegevens blijven op hun
                oorspronkelijke plek staan. Ze worden niet automatisch
                geïmporteerd of opgeteld; controleer eerst op overlap.
              </p>
            </section>
            <section className="biz-card">
              <h2>Rekenafspraken en beperkingen</h2>
              <ul>
                {assumptions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </section>
          </>
        );
      }
    }
  };
  return (
    <main className="business-shell">
      {header}
      <div className="biz-layout">
        <aside className="biz-sidebar">
          <div className="biz-brand">
            MONEYLITH <span>ZAKELIJK</span>
          </div>
          <nav ref={navigation} aria-label="Zakelijke onderdelen">
            {businessTabs.map(([key, label, detail]) => (
              <NavigationStep
                key={key}
                label={label}
                description={detail}
                active={tab === key}
                status={
                  tab === key
                    ? "Actief"
                    : stepProgress(data, key, result.checks)
                }
                onClick={() => go(key)}
              />
            ))}
          </nav>
        </aside>
        <div className="biz-content">
          <div className="biz-page-heading">
            <div>
              <p className="biz-eyebrow">
                {data.profile.name || "Jouw onderneming — nog niet ingevuld"}
              </p>
              <h1>{businessTabs.find(([key]) => key === tab)?.[1]}</h1>
            </div>
            <label className="biz-month">
              Maand
              <input
                type="month"
                min="2000-01"
                max="2099-12"
                value={data.month}
                onChange={(e) =>
                  perform(() =>
                    commit((next) => {
                      next.month = e.target.value;
                    }),
                  )
                }
              />
            </label>
          </div>
          {error && (
            <p className="biz-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="biz-save" role="status">
              {message}
            </p>
          )}
          {content()}
          <footer className="biz-footer">
            {isDemo
              ? "Zakelijke demo — fictieve gegevens"
              : "Eigen zakelijke administratie"}{" "}
            · Bedragen in euro · Geen belastingaangifteprogramma ·{" "}
            <a href="/privacy">Privacy</a>
          </footer>
        </div>
        <BusinessGuide data={data} tab={tab} go={go} />
      </div>
    </main>
  );
}
