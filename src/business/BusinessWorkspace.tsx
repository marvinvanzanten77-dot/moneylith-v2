import { ProjectionView } from "../components/ProjectionView";
import { businessInput } from "../projection/adapters";
import { emptyOptions, today, type Scenario as ProjectionScenario } from "../projection/engine";
import { BusinessAccounts } from "./BusinessAccounts";
import { BackupCard } from "../components/BackupCard";
import { StepSettings } from "../components/steps/StepSettings";
import {
  NavigationHint,
  type NavigationHintValue,
} from "../components/NavigationHint";
import { PageIntro } from "../components/PageIntro";
import { IntentQuestions } from "../components/IntentQuestions";
import {
  businessStrategies,
  businessPressures,
  emptyBusinessIntent,
} from "../logic/businessIntent";
import { BusinessGoals } from "./BusinessGoals";
import { InputReview } from "../components/InputReview";
import { AiAssistantCard } from "../components/AiAssistantCard";
import {
  Input,
  Textarea,
  Button,
  SurfaceCard,
  ReviewPanel,
} from "../components/WorkspaceUI";
import { ApplicationLayout, ModeBanner } from "../components/ApplicationLayout";
import {
  readBusinessStep,
  rememberWorkspaceStep,
  workspaceStepMap,
} from "../components/workspaceNavigation";
import { NavigationStep } from "../components/NavigationStep";
import { GoalSummary, PatternsPanel } from "./InsightPanels";
import { stepProgress } from "./insights";
import { useState } from "react";
import { Collection, ConfirmAction, EditDialog, type Field } from "./Editor";
import {
  assumptions,
  businessTabs,
  type BusinessTab,
} from "./copy";
import {
  businessAiContext,
  calculateBusiness,
  changeBusiness,
  confirmSection,
  missingFor,
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
} from "./model";
import { loadBusiness, restoreBusiness, saveBusiness } from "./storage";
import "./business.css";

const pageHelp: Record<string, string> = {
  foundation:
    "Hier leg je je zakelijke basis vast: omzetfacturen, bedrijfskosten en investeringen. Controleer de overzichten; daarna volgen de resultaten. Omzet is nog geen ontvangst.",
  debts:
    "Leg vast aan wie je bedrijf geld verschuldigd is, hoeveel en welke maandelijkse aflossing is afgesproken.",
  assets:
    "Breng bedrijfsmiddelen en reserveringen in kaart. Rekeninggeld telt niet nogmaals mee als bedrijfsmiddel.",
  accounts:
    "Voeg je betaal- en spaarrekeningen toe. Beginsaldi en geboekte betalingen vormen samen de geldstand.",
  bank: "Beheer de herkomst van je bankgegevens. Zakelijke bankkoppeling is nog niet beschikbaar.",
  patterns:
    "Bekijk herhaling in gecontroleerde facturen en betalingen. Voeg ontbrekende betalingen toe en controleer opnieuw.",
  inbox:
    "Leg documenten vast als facturen, bonnetjes of investeringen. Koppel betalingen afzonderlijk.",
  forecast:
    "Bekijk de gevolgen van je gecontroleerde gegevens en aannames. Pas het scenario aan zonder je echte administratie te wijzigen.",
  backup:
    "Exporteer of herstel alleen je eigen zakelijke administratie. Maak vóór herstel een backup van de huidige gegevens.",
  settings:
    "Beheer je zakelijke aannames en bekijk hoe opslag, privacy en de AI-assistent werken.",
};
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
  onPersonal,
}: {
  onPersonal: () => void;
}) {
  const workspace = "real" as const;
  const [projectionOptions, setProjectionOptions] = useState(emptyOptions);
  const [projectionScenario, setProjectionScenario] = useState<ProjectionScenario | null>(null);
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
  const [tab, setTab] = useState<BusinessTab>(readBusinessStep);
  const [showModeBanner, setShowModeBanner] = useState(true);
  const [helpMode, setHelpMode] = useState(false);
  const [helpTooltip, setHelpTooltip] = useState<NavigationHintValue | null>(
    null,
  );
  const go = (next: BusinessTab) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setTab(next);
    rememberWorkspaceStep(workspaceStepMap[next]);
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
  const header = (
    <ModeBanner
      mode="business"
      visible={showModeBanner}
      onHide={() => setShowModeBanner(false)}
    />
  );
  if (!data)
    return (
      <ApplicationLayout
        mode="business"
        onPersonal={onPersonal}
        onBusiness={() => {}}
        onSettings={() => {}}
        step="Opslag herstellen"
        banner={header}
        navigation={null}
        guide={null}
      >
        <div className="card-shell p-5 text-slate-900 space-y-4">
          <h1>Gegevens konden niet worden geopend</h1>
          <p role="alert">{error}</p>
          <p>
            De opgeslagen inhoud is niet overschreven. Exporteer die voordat je
            een herstel uitvoert.
          </p>
          <Button
            onClick={() =>
              perform(() =>
                download("moneylith-opslag-herstel.json", {
                  raw: localStorage.getItem(workspaceKeys[workspace]),
                }),
              )
            }
          >
            Opgeslagen inhoud downloaden
          </Button>
        </div>
      </ApplicationLayout>
    );
  const result = calculateBusiness(data);
  const check = (section: Section) => {
    const review = result.checks[section];
    return (
      <InputReview
        key={section}
        section={{
          ...review,
          label: sectionLabels[section],
          total: review.total / 100,
        }}
        showTotal={
          section === "income" || section === "costs" || section === "assets"
        }
        onReview={(signature) =>
          perform(() => {
            const next = confirmSection(data, section, signature !== null);
            saveBusiness(localStorage, workspace, next);
            setData(next);
            setMessage("Controlebevestiging opgeslagen.");
          })
        }
      />
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
      inline
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
      primaryValue={(d) => money(d.net)}
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
    <SurfaceCard className="space-y-4">
      <h2>Maandplan voor nieuw werk</h2>
      <p>
        Leg aannames voor nieuw werk vast. Dit verandert geen geboekte facturen
        of betalingen. Vul 0 in als een bedrag nul is.
      </p>
      <div>
        <EditDialog
          inline
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
    </SurfaceCard>
  );
  const reservePanel = (
    <SurfaceCard className="space-y-4">
      <h2>Reserveringen</h2>
      <p>
        Kies je belastingreserve, buffer en betaalfrequentie. Dit zijn aannames
        voor je planning, geen aangifteberekening.
      </p>
      <div>
        <EditDialog
          inline
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
    </SurfaceCard>
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
        inline
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
        primaryValue={(m) => money(m.amount)}
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
  const content = () => {
    switch (tab) {
      case "intent":
        return (
          <IntentQuestions
            business
            value={data.intent ?? emptyBusinessIntent()}
            strategies={businessStrategies}
            pressures={businessPressures}
            onChange={(intent) =>
              perform(() =>
                commit((next) => {
                  next.intent = intent;
                }),
              )
            }
          >
            <div className="space-y-4 border-t border-slate-300 pt-4">
              <label className="block text-sm font-semibold text-slate-800">
                Bedrijfsnaam
                <Input
                  value={data.profile.name}
                  onChange={(e) =>
                    perform(() =>
                      commit((next) => {
                        next.profile.name = e.target.value;
                      }),
                    )
                  }
                />
              </label>
              <details
                open={Boolean(
                  data.profile.goal ||
                  data.profile.pressure ||
                  data.profile.direction,
                )}
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  Aanvullende toelichting
                </summary>
                <p className="text-xs text-slate-500">
                  Bestaande teksten blijven behouden. Ze kiezen geen strategie,
                  drukfactor of termijn voor je.
                </p>
                {(
                  [
                    ["goal", "Toelichting bij je doel"],
                    ["pressure", "Toelichting bij financiële druk"],
                    ["direction", "Toelichting bij je richting"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="mt-3 block text-sm font-semibold text-slate-800"
                  >
                    {label}
                    <Textarea
                      rows={2}
                      value={data.profile[key]}
                      onChange={(e) =>
                        perform(() =>
                          commit((next) => {
                            next.profile[key] = e.target.value;
                          }),
                        )
                      }
                    />
                  </label>
                ))}
              </details>
            </div>
          </IntentQuestions>
        );
      case "bank":
        return (
          <SurfaceCard className="space-y-4">
            <h2>Zakelijke bankkoppeling</h2>
            <p className="biz-notice">
              Nog niet beschikbaar. Er is geen zakelijke bank verbonden en er
              worden geen bankgegevens opgehaald.
            </p>
            <p>
              Registreer rekeningen en betalingen handmatig. Facturen, leningen
              en privéonttrekkingen blijven afzonderlijk verwerkt.
            </p>
            <Button onClick={() => go("accounts")}>Naar rekeningen</Button>
          </SurfaceCard>
        );
      case "foundation":
        return (
          <>
            {documentList("sale")}
            {check("income")}
            {documentList("cost")}
            {documentList("asset")}
            {check("costs")}
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

            <Collection<Debt>
              inline
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
              primaryValue={(d) => money(d.opening)}
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
            <SurfaceCard className="space-y-4">
              <h2>Openstaande leveranciersfacturen</h2>
              {result.outstanding
                .filter((d) => d.kind !== "sale" && d.unpaid > 0)
                .map((d) => (
                  <p key={d.id}>
                    {d.number} · {d.label} · {money(d.unpaid)} · vervalt {d.due}
                  </p>
                ))}
              <Button onClick={() => go("inbox")}>Open Inbox</Button>
            </SurfaceCard>
          </>
        );
      case "assets":
        return (
          <>
            <Collection<Asset>
              inline
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
              primaryValue={(a) => money(a.value)}
              summary={(a) => (
                <>
                  <span>{money(a.value)}</span>
                  <span>{a.note}</span>
                </>
              )}
            />
            {check("assets")}
            {reservePanel}
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
          </>
        );
      case "goals":
        return (
          <BusinessGoals
            data={data}
            onSave={(goal) => saveRow("goals", goal)}
            onDelete={(id) => removeRow("goals", id)}
          />
        );
      case "accounts":
        return (
          <>
            <p className="biz-notice">
              Handmatige rekeningadministratie. Er wordt geen bankverbinding
              geopend. Bevestig dat beginsaldi en betalingen volledig zijn
              voordat je de geldstand gebruikt.
            </p>

            <BusinessAccounts
              data={data}
              fields={accountFields}
              onSave={(row) => saveRow("accounts", row)}
              onDelete={(id) => removeRow("accounts", id)}
            />
            {check("cash")}
            <div className="biz-metrics">
              <Metric
                label="Totaal geldmiddelen"
                value={missingFor(data, "cash").length ? null : result.cash}
              />
            </div>
            <Button onClick={() => go("patterns")}>
              Betalingen bekijken en toevoegen
            </Button>
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
            <Button onClick={() => go("patterns")}>
              Betaling aan factuur koppelen
            </Button>
          </>
        );
      case "forecast":
        return <ProjectionView input={businessInput(data, projectionOptions, today())} options={projectionOptions} onOptions={setProjectionOptions} scenario={projectionScenario} onScenario={setProjectionScenario} />;
      case "backup":
        return (
          <div className="max-w-xl">
            <BackupCard
              scoped={{
                snapshot: data as unknown as Record<string, unknown>,
                versionKey: "moneylith.business.real.backup.versions",
                restore: (restored) => {
                  setData(
                    restoreBusiness(
                      localStorage,
                      workspace,
                      JSON.stringify(restored),
                    ),
                  );
                },
              }}
            />
          </div>
        );
      case "settings": {
        const context = businessAiContext(data);
        return (
          <>
            <StepSettings
              business
              storageMode="local"
              onStorageModeChange={() => {}}
              helpMode={helpMode}
              onHelpModeChange={setHelpMode}
              showModeBanner={showModeBanner}
              onShowModeBannerChange={setShowModeBanner}
              onOpenBackup={() => go("backup")}
              onResetIntro={() => {
                setShowModeBanner(true);
                go("intent");
              }}
            />
            {reservePanel}
            <SurfaceCard className="space-y-4">
              <h2>Administratie en privacy</h2>
              <p>
                Je eigen zakelijke gegevens worden in deze browser bewaard.
                Persoonlijke gegevens blijven gescheiden.
              </p>
              <p>
                Zakelijke bankkoppeling, automatische betalingen en cloudsync
                zijn niet actief. Wanneer je een AI-vraag verstuurt, worden
                uitsluitend deze zakelijke context en dit gesprek voor het
                antwoord verwerkt.
              </p>
              <p>
                Voor een eventuele analyse ontbreken nog:{" "}
                {context.missing.length
                  ? context.missing.join(", ")
                  : "geen noodzakelijke basisgegevens"}
                . Onbekende bedragen blijven onbekend, ook in de analyse-invoer.
              </p>
              <Button
                onClick={() =>
                  download(`moneylith-analyse-${workspace}.json`, context)
                }
              >
                Analyse-invoer lokaal downloaden
              </Button>
              <Button
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
              </Button>
              <p>
                Eventuele oudere zakelijke gegevens blijven op hun
                oorspronkelijke plek staan. Ze worden niet automatisch
                geïmporteerd of opgeteld; controleer eerst op overlap.
              </p>
            </SurfaceCard>
            <SurfaceCard className="space-y-4">
              <h2>Rekenafspraken en beperkingen</h2>
              <ul>
                {assumptions.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </SurfaceCard>
          </>
        );
      }
    }
  };
  return (
    <ApplicationLayout
      mode="business"
      onPersonal={onPersonal}
      onBusiness={() => {}}
      onSettings={() => go("settings")}
      step={businessTabs.find(([key]) => key === tab)?.[1]}
      banner={header}
      navigation={businessTabs.map(([key, label, detail]) => (
        <NavigationStep
          key={key}
          label={label}
          description={detail}
          active={tab === key}
          backup={key === "backup"}
          status={
            key === "bank"
              ? "Niet beschikbaar"
              : tab === key
                ? "Actief"
                : stepProgress(data, key, result.checks)
          }
          onMouseEnter={(e) => {
            if (!helpMode) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setHelpTooltip({
              label,
              desc: detail,
              x: rect.right + 8,
              y: rect.top,
            });
          }}
          onMouseLeave={() => setHelpTooltip(null)}
          onClick={() => {
            setHelpTooltip(null);
            go(key);
          }}
        />
      ))}
      guide={<AiAssistantCard scope="business-real" businessData={data} projectionOptions={projectionOptions} projectionScenario={projectionScenario} />}
      overlays={<NavigationHint hint={helpMode ? helpTooltip : null} />}
    >
      <div className="business-content space-y-4">
        {tab !== "intent" && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <p>{data.profile.name || "Jouw onderneming — nog niet ingevuld"}</p>
            <label className="flex items-center gap-2">
              Maand
              <Input
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
        )}
        {error && (
          <p className="biz-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs text-emerald-200" role="status">
            {message}
          </p>
        )}
        {tab !== "intent" && tab !== "goals" && tab !== "settings" && (
          <PageIntro
            title={businessTabs.find(([key]) => key === tab)?.[1] ?? ""}
          >
            {pageHelp[tab]}
          </PageIntro>
        )}
        {content()}
        <p className="text-[11px] text-slate-400">
          Bedragen in euro · Geen belastingaangifteprogramma · Eigen zakelijke
          administratie
        </p>
      </div>
    </ApplicationLayout>
  );
}
