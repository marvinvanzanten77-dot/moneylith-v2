import { useCallback, useEffect, useMemo, useState } from "react";
import { FixedCostsList } from "./components/FixedCostsList";
import { SchuldenkaartCard } from "./components/SchuldenkaartCard";
import { VermogenCard } from "./components/VermogenCard";
import { AiAssistantCard } from "./components/AiAssistantCard";
import { FixedCostsWizard } from "./components/FixedCostsWizard";
import { IncomeList } from "./components/IncomeList";
import { StepIntent } from "./components/steps/StepIntent";
import { StepFocus } from "./components/steps/StepFocus";
import { StepVooruitblik } from "./components/steps/StepActie";
import { StepSchulden } from "./components/steps/StepSchulden";
import { StepVermogen } from "./components/steps/StepVermogen";
import { StepRitme } from "./components/steps/StepRitme";
import { StepRekeningen } from "./components/steps/StepRekeningen";
import { StepAfschriften } from "./components/steps/StepAfschriften";
import { StepBackup } from "./components/steps/StepBackup";
import { StepInbox, type InboxItem, type InboxSuggestion } from "./components/steps/StepInbox";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { detectRecurringCandidates } from "./utils/recurring";
import type {
  FixedCostItem,
  MonthId,
  MoneylithTransaction,
  UserIntent,
  MonthFocus,
  MoneylithAccount,
  AccountStatementMeta,
  MoneylithBucket,
  MoneylithGoal,
  IncomeItem,
  FixedCostManualItem,
  SchuldItem,
} from "./types";
import { deriveBuckets, mergeWithUserOverrides } from "./logic/buckets";
import { useObserver } from "./hooks/useObserver";
import type { FinanceMode } from "./state/financeRoot";
import { extractPrefillSuggestions } from "./logic/aiPrefill";
import { extractActionsFromContent } from "./logic/extractActions";
import type { AiActions } from "./logic/extractActions";
import { canApplyIncomeSuggestion, buildIncomePatchFromActions } from "./logic/applyIncomeSuggestion";
import { canApplyFixedCostsSuggestions, buildFixedCostsPatchesFromActions } from "./logic/applyFixedCostsSuggestions";
import { LegalPage } from "./components/LegalPage";
import { StatusPage } from "./components/StatusPage";
import { CookieBanner } from "./components/CookieBanner";
import { parseConsentCookie } from "./components/useConsentCookie";
import { initAnalytics } from "./analytics/initAnalytics";
import { AnalyticsGate } from "./components/AnalyticsGate";
import LogoFull from "../logo/ChatGPT Image Dec 21, 2025, 01_47_34 PM.png";

const MONTHS: { id: MonthId; label: string }[] = [
  { id: "2025-12", label: "dec 2025" },
  { id: "2026-01", label: "jan 2026" },
  { id: "2026-02", label: "feb 2026" },
  { id: "2026-03", label: "mrt 2026" },
  { id: "2026-04", label: "apr 2026" },
  { id: "2026-05", label: "mei 2026" },
  { id: "2026-06", label: "jun 2026" },
  { id: "2026-07", label: "jul 2026" },
  { id: "2026-08", label: "aug 2026" },
  { id: "2026-09", label: "sep 2026" },
  { id: "2026-10", label: "okt 2026" },
  { id: "2026-11", label: "nov 2026" },
  { id: "2026-12", label: "dec 2026" },
];

type StepKey = string;
type ActionZoneType = "overleven" | "aflossen" | "opbouwen" | "stabiliseren";
type AflosMode = "minimum" | "aggressive";

type DebtSummary = {
  totalDebt: number;
  totalMinPayment: number;
  debtCount: number;
};

type AssetSummary = {
  totalAssets: number;
  assetsCount: number;
};

type AssetItem = {
  id: string;
  naam: string;
  bedrag: number;
};

type FinancialSnapshot = {
  totalIncome: { value: number; source: "manual" | "transactions" | "buckets" };
  fixedCostsTotal: { value: number; source: "manual" | "transactions" | "buckets" };
  netFree: number;
  totalDebt: number;
  assetsTotal: number;
  monthlyPressure: number;
  runwayMonths: number | null;
  intent?: UserIntent | null;
  focus?: MonthFocus | null;
  optimizeCosts?: boolean;
};

type SpendBucket = {
  id: string;
  name: string;
  monthlyAverage: number;
  lastMonthTotal?: number;
  shareOfFree?: number;
  description?: string;
  isEssential?: boolean;
};

type Mode = "persoonlijk" | "zakelijk";

type TabConfig = { key: StepKey; label: string; desc: string };

const personalTabs: TabConfig[] = [
  { key: "intent", label: "Intentie", desc: "Doelen & richting" },
  { key: "fundament", label: "Fundament", desc: "Inkomen, vaste lasten, netto ruimte" },
  { key: "schulden", label: "Schulden", desc: "Wie, hoeveel, welke druk" },
  { key: "vermogen", label: "Vermogen", desc: "Sparen, buffers, bezittingen" },
  { key: "focus", label: "Doelen", desc: "Kies je richting voor deze maand" },
  { key: "rekeningen", label: "Rekeningen", desc: "Betaal- en spaarrekeningen" },
  { key: "afschriften", label: "Patronen", desc: "Maandelijkse afschriften" },
  { key: "inbox", label: "Inbox", desc: "Brieven & documenten" },
  { key: "action", label: "Vooruitblik", desc: "Wat gebeurt er als alles zo blijft?" },
  { key: "backup", label: "Backup", desc: "Export & import van je data" },
];

const businessTabs: TabConfig[] = [
  { key: "biz-strategie", label: "Strategie", desc: "Doel, fase, risico" },
  { key: "biz-cashflow", label: "Cashflow", desc: "Inkomend, uitgaand, runway" },
  { key: "biz-verplichtingen", label: "Verplichtingen", desc: "Facturen, belastingen, contracten" },
  { key: "biz-kapitaal", label: "Kapitaal/buffer", desc: "Assets, reserves, buffer" },
  { key: "biz-doelen", label: "Doelen (zakelijk)", desc: "Focus voor dit kwartaal" },
  { key: "biz-rekeningen", label: "Rekeningen", desc: "Zakelijke rekeningen" },
  { key: "biz-inbox", label: "Inbox", desc: "Documenten & brieven" },
  { key: "biz-afschriften", label: "Afschriften", desc: "AI-analyse" },
  { key: "biz-vooruitblik", label: "Vooruitblik", desc: "Scenario als alles zo blijft" },
  { key: "biz-backup", label: "Backup", desc: "Export & import van je data" },
];
const useActiveTabs = (mode: Mode) => useMemo(() => (mode === "zakelijk" ? businessTabs : personalTabs), [mode]);

const ActionZone = ({
  type,
  onDebtSummary,
  aflosMode,
  setAflosMode,
  debtClearMonthsAggressive,
  onAssetSummary,
}: {
  type: ActionZoneType;
  onDebtSummary: (s: DebtSummary) => void;
  aflosMode: AflosMode;
  setAflosMode: (mode: AflosMode) => void;
  debtClearMonthsAggressive: number | null;
  onAssetSummary: (s: AssetSummary) => void;
}) => {
  let primary: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Primary slot (leeg)</div>
  );
  let secondary: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Secondary slot (leeg)</div>
  );
  let timeline: React.ReactNode = (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">Timeline slot (leeg)</div>
  );

  if (type === "aflossen") {
    primary = (
      <div className="space-y-3">
        <div className="mb-2 flex flex-col gap-2 text-sm text-slate-800 md:flex-row md:items-center md:gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="aflosMode"
              value="minimum"
              checked={aflosMode === "minimum"}
              onChange={() => setAflosMode("minimum")}
            />
            Aflossen op minimum (minimale maandlast)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="aflosMode"
              value="aggressive"
              checked={aflosMode === "aggressive"}
              onChange={() => setAflosMode("aggressive")}
              disabled={!debtClearMonthsAggressive}
            />
            Aflossen op maximale ruimte
          </label>
        </div>
        <SchuldenkaartCard onSummaryChange={onDebtSummary} />
      </div>
    );
    secondary = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later offersimulatie.
      </div>
    );
    timeline = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een aflostijdlijn.
      </div>
    );
  }

  if (type === "opbouwen") {
    primary = <VermogenCard onSummaryChange={onAssetSummary} />;
    secondary = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een groeiplan.
      </div>
    );
    timeline = (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-3 text-sm text-slate-700">
        Hier komt later een vermogenslijn.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-shell p-4 text-slate-900 space-y-3">
        <p className="text-sm text-slate-600">Actiepad</p>
        <h3 className="text-lg font-semibold text-slate-900">Actiemodules voor {type}</h3>
        <p className="text-sm text-slate-700">Actiemodules voor {type} komen hier.</p>
        <div className="space-y-2 text-xs text-slate-500">
          <div className="action-primary">{primary}</div>
          <div className="action-secondary">{secondary}</div>
          <div className="action-timeline">{timeline}</div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const legalPaths = ["/privacy", "/disclaimer", "/terms", "/cookies"];
  const statusPaths = ["/status", "/about"];
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  if (legalPaths.includes(currentPath)) {
    return <LegalPage path={currentPath} />;
  }
  if (statusPaths.includes(currentPath)) {
    return <StatusPage />;
  }

  useEffect(() => {
    const indexablePaths = ["/", ...legalPaths];
    const isIndexable = typeof window !== "undefined" && indexablePaths.includes(window.location.pathname);
    const robots = document.querySelector('meta[name="robots"]');
    const value = isIndexable ? "index,follow" : "noindex,nofollow";
    if (robots) {
      robots.setAttribute("content", value);
    } else {
      const m = document.createElement("meta");
      m.name = "robots";
      m.content = value;
      document.head.appendChild(m);
    }

    const consent = parseConsentCookie();
    if (consent?.analytics) {
      if (import.meta.env.MODE === "development") {
        console.debug("[analytics] consent=true, init analytics");
      }
      initAnalytics();
    } else if (import.meta.env.MODE === "development") {
      console.debug("[analytics] consent missing/false, skip analytics");
    }
  }, []);

  const [currentStep, setCurrentStep] = useState<StepKey>("intent");
  const [mode, setMode] = useState<Mode>("persoonlijk");
  const [unlockedSteps, setUnlockedSteps] = useState<StepKey[]>([
    ...personalTabs.map((t) => t.key),
    ...businessTabs.map((t) => t.key),
  ]);
  const [helpMode, setHelpMode] = useState(false);
  const [helpTooltip, setHelpTooltip] = useState<{ label: string; desc: string; x: number; y: number } | null>(null);
  const [introSeen, setIntroSeen] = useLocalStorage<boolean>("moneylith.intro.seen", false);
  const [selectedMonth, setSelectedMonth] = useLocalStorage<MonthId>("selected-month", "2025-12");
  const [monthFocus, setMonthFocus] = useLocalStorage<MonthFocus>("month-focus", null);
  const [showOverview, setShowOverview] = useState(false);
  const [debts, setDebts] = useLocalStorage<SchuldItem[]>("moneylith.personal.debts", []);
  const [debtsBusiness, setDebtsBusiness] = useLocalStorage<SchuldItem[]>("moneylith.business.debts", []);
  const [assets, setAssets] = useLocalStorage<AssetItem[]>("moneylith.personal.assets", []);
  const [assetsBusiness, setAssetsBusiness] = useLocalStorage<AssetItem[]>("moneylith.business.assets", []);
  const [incomeItems, setIncomeItems] = useLocalStorage<IncomeItem[]>("moneylith.personal.income", []);
  const [incomeItemsBusiness, setIncomeItemsBusiness] = useLocalStorage<IncomeItem[]>("moneylith.business.income", []);
  const [fixedCostManualItems, setFixedCostManualItems] = useLocalStorage<FixedCostManualItem[]>(
    "moneylith.personal.fixedCosts",
    []
  );
  const [fixedCostManualItemsBusiness, setFixedCostManualItemsBusiness] = useLocalStorage<FixedCostManualItem[]>(
    "moneylith.business.fixedCosts",
    []
  );
  useEffect(() => {
    try {
      document.body.style.cursor = helpMode ? "help" : "";
    } catch {
      /* ignore */
    }
    if (!helpMode) {
      setHelpTooltip(null);
    }
    return () => {
      try {
        document.body.style.cursor = "";
      } catch {
        /* ignore */
      }
    };
  }, [helpMode]);
  const [debtsSummary, setDebtsSummary] = useState<DebtSummary>({ totalDebt: 0, totalMinPayment: 0, debtCount: 0 });
  const [debtsSummaryBusiness, setDebtsSummaryBusiness] = useState<DebtSummary>({
    totalDebt: 0,
    totalMinPayment: 0,
    debtCount: 0,
  });
  const [assetsSummary, setAssetsSummary] = useState<AssetSummary>({ totalAssets: 0, assetsCount: 0 });
  const [assetsSummaryBusiness, setAssetsSummaryBusiness] = useState<AssetSummary>({
    totalAssets: 0,
    assetsCount: 0,
  });
  const [aflosMode, setAflosMode] = useState<AflosMode>("minimum");
  const [transactions, setTransactions] = useLocalStorage<MoneylithTransaction[]>(
    "moneylith.personal.transactions",
    []
  );
  const [transactionsBusiness, setTransactionsBusiness] = useLocalStorage<MoneylithTransaction[]>(
    "moneylith.business.transactions",
    []
  );
  const [accounts, setAccounts] = useLocalStorage<MoneylithAccount[]>("moneylith.personal.accounts", []);
  const [accountsBusiness, setAccountsBusiness] = useLocalStorage<MoneylithAccount[]>("moneylith.business.accounts", []);
  const [statements, setStatements] = useLocalStorage<AccountStatementMeta[]>("moneylith.personal.statements", []);
  const [statementsBusiness, setStatementsBusiness] = useLocalStorage<AccountStatementMeta[]>(
    "moneylith.business.statements",
    []
  );
  const [inboxItems, setInboxItems] = useLocalStorage<InboxItem[]>("moneylith.personal.inbox", []);
  const [inboxItemsBusiness, setInboxItemsBusiness] = useLocalStorage<InboxItem[]>("moneylith.business.inbox", []);
  const [aiAnalysisDone, setAiAnalysisDone] = useLocalStorage<boolean>("moneylith.personal.aiAnalysisDone", false);
  const [aiAnalysisDoneAt, setAiAnalysisDoneAt] = useLocalStorage<string | null>(
    "moneylith.personal.aiAnalysisDoneAt",
    null
  );
  const [aiAnalysisRaw, setAiAnalysisRaw] = useLocalStorage<string | null>("moneylith.personal.aiAnalysisRaw", null);
  const [aiAnalysisDoneBusiness, setAiAnalysisDoneBusiness] = useLocalStorage<boolean>(
    "moneylith.business.aiAnalysisDone",
    false
  );
  const [aiAnalysisDoneAtBusiness, setAiAnalysisDoneAtBusiness] = useLocalStorage<string | null>(
    "moneylith.business.aiAnalysisDoneAt",
    null
  );
  const [aiAnalysisRawBusiness, setAiAnalysisRawBusiness] = useLocalStorage<string | null>(
    "moneylith.business.aiAnalysisRaw",
    null
  );
  const [aiActionsPersonal, setAiActionsPersonal] = useState<AiActions | null>(null);
  const [aiActionsBusiness, setAiActionsBusiness] = useState<AiActions | null>(null);
  const aiPrefillSuggestions = useMemo(() => extractPrefillSuggestions(aiAnalysisRaw), [aiAnalysisRaw]);
  const [goals, setGoals] = useLocalStorage<MoneylithGoal[]>("moneylith.personal.goals", []);
  const [goalsBusiness, setGoalsBusiness] = useLocalStorage<MoneylithGoal[]>("moneylith.business.goals", []);
  const [isFixedCostsWizardOpen, setIsFixedCostsWizardOpen] = useState(false);
  const [userIntent, setUserIntent] = useLocalStorage<UserIntent>("moneylith.personal.intention", {
    primaryGoal: null,
    mainPressure: [],
    timeHorizon: null,
    aiStyle: null,
    optimizeCosts: false,
  });
  const [userIntentBusiness, setUserIntentBusiness] = useLocalStorage<UserIntent>("moneylith.business.intention", {
    primaryGoal: null,
    mainPressure: [],
    timeHorizon: null,
    aiStyle: null,
    optimizeCosts: false,
  });
  // Sneltoets: F7 reset alle lokale data en herlaadt de app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F7") {
        try {
          localStorage.clear();
        } catch {
          // ignore
        }
        window.location.reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // spend buckets derived from transactions (diagnostisch)
  const [financialSnapshot, setFinancialSnapshot] = useState<FinancialSnapshot | null>(null);
  const [bucketOverrides] = useLocalStorage<Record<string, Partial<MoneylithBucket>>>(
    "moneylith.personal.bucket.overrides",
    {}
  );
  const [bucketOverridesBusiness] = useLocalStorage<Record<string, Partial<MoneylithBucket>>>(
    "moneylith.business.bucket.overrides",
    {}
  );

  const createId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  const applyInboxSuggestions = useCallback(
    (suggestions: InboxSuggestion[]) => {
      if (!suggestions.length) return;
      const nextIncome = [...incomeItems];
      const nextFixedCosts = [...fixedCostManualItems];
      const nextDebts = [...debts];
      const nextAssets = [...assets];
      const nextGoals = [...goals];
      const nextAccounts = [...accounts];
      const nextTransactions = [...transactions];

      const defaultAccountId =
        accounts.find((a) => a.active)?.id ?? accounts[0]?.id ?? null;
      const toNumber = (val: unknown) => {
        const num = typeof val === "string" && val.trim() === "" ? NaN : Number(val);
        return Number.isFinite(num) ? num : null;
      };

      suggestions.forEach((s) => {
        const fields = (s.fields ?? {}) as Record<string, any>;
        switch (s.kind) {
          case "income_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            nextIncome.push({
              id: createId(),
              naam,
              bedrag,
              opmerking: fields.opmerking ? String(fields.opmerking) : undefined,
            });
            break;
          }
          case "fixedcost_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            const dagRaw = toNumber(fields.dagVanMaand ?? 1) ?? 1;
            const dagVanMaand = Math.min(31, Math.max(1, Math.round(dagRaw)));
            nextFixedCosts.push({
              id: createId(),
              naam,
              bedrag,
              dagVanMaand,
              opmerking: fields.opmerking ? String(fields.opmerking) : undefined,
            });
            break;
          }
          case "debt_add": {
            const saldo = toNumber(fields.saldo ?? fields.openBedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.crediteur ?? fields.label ?? "").trim();
            if (!naam || saldo === null || saldo <= 0) return;
            const minimaleMaandlast = toNumber(fields.minimaleMaandlast ?? fields.minBetaling) ?? undefined;
            nextDebts.push({
              id: createId(),
              naam,
              saldo,
              minimaleMaandlast: minimaleMaandlast && minimaleMaandlast > 0 ? minimaleMaandlast : undefined,
              openBedrag: saldo,
              minBetaling: minimaleMaandlast && minimaleMaandlast > 0 ? minimaleMaandlast : undefined,
            });
            break;
          }
          case "asset_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            nextAssets.push({ id: createId(), naam, bedrag });
            break;
          }
          case "goal_add": {
            const label = String(fields.label ?? fields.naam ?? "").trim();
            if (!label) return;
            const targetAmount = toNumber(fields.targetAmount) ?? 0;
            nextGoals.push({
              id: createId(),
              label,
              type: (fields.type as any) ?? "buffer",
              targetAmount: targetAmount > 0 ? targetAmount : 0,
              currentAmount: toNumber(fields.currentAmount) ?? 0,
              monthlyContribution: Math.max(0, toNumber(fields.monthlyContribution) ?? 0),
              deadline: fields.deadline ? String(fields.deadline) : undefined,
              isActive: fields.isActive !== false,
            });
            break;
          }
          case "account_add": {
            const name = String(fields.name ?? fields.naam ?? "").trim();
            if (!name) return;
            const typeCandidate = String(fields.type ?? "betaalrekening");
            const type =
              typeCandidate === "spaarrekening" || typeCandidate === "contant" ? typeCandidate : "betaalrekening";
            nextAccounts.push({
              id: createId(),
              name,
              type,
              iban: fields.iban ? String(fields.iban) : undefined,
              description: fields.description ? String(fields.description) : undefined,
              active: fields.active !== false,
            });
            break;
          }
          case "transaction_add": {
            const description = String(fields.description ?? "").trim();
            const amount = toNumber(fields.amount);
            const date = String(fields.date ?? "").trim();
            if (!description || amount === null || amount === 0 || !date) return;
            if (Number.isNaN(Date.parse(date))) return;
            const accountId = fields.accountId ?? defaultAccountId;
            if (!accountId) return;
            nextTransactions.push({
              id: createId(),
              accountId: String(accountId),
              date,
              amount,
              description,
              counterparty: fields.counterparty ? String(fields.counterparty) : undefined,
              category: fields.category ? String(fields.category) : undefined,
            });
            break;
          }
          case "invoice_add": {
            const amount = toNumber(fields.amount ?? fields.saldo ?? fields.total);
            const name = String(fields.name ?? fields.naam ?? fields.creditor ?? fields.label ?? "").trim();
            if (!name || amount === null || amount <= 0) return;
            const dueDate = String(fields.dueDate ?? fields.deadline ?? "").trim();
            const invoiceNumber = String(fields.invoiceNumber ?? "").trim();
            const btw = toNumber(fields.btw);
            const noteParts = [
              invoiceNumber ? `factuurnr: ${invoiceNumber}` : "",
              dueDate ? `vervaldatum: ${dueDate}` : "",
              typeof btw === "number" && btw > 0 ? `btw: ${btw}%` : "",
            ]
              .filter(Boolean)
              .join(" | ");
            const typeRaw = String(fields.type ?? "payable").toLowerCase();
            const isReceivable = typeRaw === "receivable" || typeRaw === "ontvangst" || typeRaw === "te ontvangen";
            if (isReceivable && defaultAccountId) {
              nextTransactions.push({
                id: createId(),
                accountId: String(defaultAccountId),
                date: dueDate && !Number.isNaN(Date.parse(dueDate)) ? new Date(dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                amount: Math.abs(amount),
                description: name,
                counterparty: fields.counterparty ? String(fields.counterparty) : undefined,
                category: "factuur",
              });
            } else {
              nextDebts.push({
                id: createId(),
                naam: name,
                saldo: amount,
                openBedrag: amount,
                minimaleMaandlast: undefined,
                minBetaling: undefined,
                opmerking: noteParts || undefined,
              });
            }
            break;
          }
          case "offer_add": {
            // Optioneel: sla als notitie op in goals zodat de gebruiker het kan verwerken.
            const label = String(fields.label ?? fields.name ?? fields.naam ?? "").trim();
            if (!label) return;
            nextGoals.push({
              id: createId(),
              label,
              type: "buffer",
              targetAmount: toNumber(fields.amount) ?? 0,
              currentAmount: 0,
              monthlyContribution: 0,
              isActive: false,
            });
            break;
          }
          default:
            break;
        }
      });

      setIncomeItems(nextIncome);
      setFixedCostManualItems(nextFixedCosts);
      setDebts(nextDebts);
      setAssets(nextAssets);
      setGoals(nextGoals);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
    },
    [
      accounts,
      assets,
      debts,
      fixedCostManualItems,
      goals,
      incomeItems,
      setAccounts,
      setAssets,
      setDebts,
      setFixedCostManualItems,
      setGoals,
      setIncomeItems,
      setTransactions,
      transactions,
    ]
  );

  const applyInboxSuggestionsBusiness = useCallback(
    (suggestions: InboxSuggestion[]) => {
      if (!suggestions.length) return;
      const nextIncome = [...incomeItemsBusiness];
      const nextFixedCosts = [...fixedCostManualItemsBusiness];
      const nextDebts = [...debtsBusiness];
      const nextAssets = [...assetsBusiness];
      const nextGoals = [...goalsBusiness];
      const nextAccounts = [...accountsBusiness];
      const nextTransactions = [...transactionsBusiness];

      const defaultAccountId =
        accountsBusiness.find((a) => a.active)?.id ?? accountsBusiness[0]?.id ?? null;
      const toNumber = (val: unknown) => {
        const num = typeof val === "string" && val.trim() === "" ? NaN : Number(val);
        return Number.isFinite(num) ? num : null;
      };

      suggestions.forEach((s) => {
        const fields = (s.fields ?? {}) as Record<string, any>;
        switch (s.kind) {
          case "income_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            nextIncome.push({
              id: createId(),
              naam,
              bedrag,
              opmerking: fields.opmerking ? String(fields.opmerking) : undefined,
            });
            break;
          }
          case "fixedcost_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            const dagRaw = toNumber(fields.dagVanMaand ?? 1) ?? 1;
            const dagVanMaand = Math.min(31, Math.max(1, Math.round(dagRaw)));
            nextFixedCosts.push({
              id: createId(),
              naam,
              bedrag,
              dagVanMaand,
              opmerking: fields.opmerking ? String(fields.opmerking) : undefined,
            });
            break;
          }
          case "debt_add":
          case "invoice_add": {
            const saldo = toNumber(fields.saldo ?? fields.openBedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.crediteur ?? fields.label ?? fields.creditor ?? "").trim();
            if (!naam || saldo === null || saldo <= 0) return;
            const minimaleMaandlast = toNumber(fields.minimaleMaandlast ?? fields.minBetaling) ?? undefined;
            const dueDate = String(fields.dueDate ?? fields.deadline ?? "").trim();
            const invoiceNumber = String(fields.invoiceNumber ?? "").trim();
            const btw = toNumber(fields.btw);
            const typeRaw = String(fields.type ?? s.kind === "invoice_add" ? "payable" : "").toLowerCase();
            const isReceivable = typeRaw === "receivable" || typeRaw === "ontvangst" || typeRaw === "te ontvangen";
            const noteParts = [
              invoiceNumber ? `factuurnr: ${invoiceNumber}` : "",
              dueDate ? `vervaldatum: ${dueDate}` : "",
              typeof btw === "number" && btw > 0 ? `btw: ${btw}%` : "",
            ]
              .filter(Boolean)
              .join(" | ");

            if (isReceivable && defaultAccountId) {
              nextTransactions.push({
                id: createId(),
                accountId: String(defaultAccountId),
                date: dueDate && !Number.isNaN(Date.parse(dueDate)) ? new Date(dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                amount: Math.abs(saldo),
                description: naam,
                counterparty: fields.counterparty ? String(fields.counterparty) : undefined,
                category: "factuur",
              });
            } else {
              nextDebts.push({
                id: createId(),
                naam,
                saldo,
                openBedrag: saldo,
                minimaleMaandlast: minimaleMaandlast && minimaleMaandlast > 0 ? minimaleMaandlast : undefined,
                minBetaling: minimaleMaandlast && minimaleMaandlast > 0 ? minimaleMaandlast : undefined,
                opmerking: noteParts || undefined,
              });
            }
            break;
          }
          case "asset_add": {
            const bedrag = toNumber(fields.bedrag ?? fields.amount);
            const naam = String(fields.naam ?? fields.label ?? "").trim();
            if (!naam || bedrag === null || bedrag <= 0) return;
            nextAssets.push({ id: createId(), naam, bedrag });
            break;
          }
          case "goal_add": {
            const label = String(fields.label ?? fields.naam ?? "").trim();
            if (!label) return;
            const targetAmount = toNumber(fields.targetAmount) ?? 0;
            nextGoals.push({
              id: createId(),
              label,
              type: (fields.type as any) ?? "buffer",
              targetAmount: targetAmount > 0 ? targetAmount : 0,
              currentAmount: toNumber(fields.currentAmount) ?? 0,
              monthlyContribution: Math.max(0, toNumber(fields.monthlyContribution) ?? 0),
              deadline: fields.deadline ? String(fields.deadline) : undefined,
              isActive: fields.isActive !== false,
            });
            break;
          }
          case "account_add": {
            const name = String(fields.name ?? fields.naam ?? "").trim();
            if (!name) return;
            const typeCandidate = String(fields.type ?? "betaalrekening");
            const type =
              typeCandidate === "spaarrekening" || typeCandidate === "contant" ? typeCandidate : "betaalrekening";
            nextAccounts.push({
              id: createId(),
              name,
              type,
              iban: fields.iban ? String(fields.iban) : undefined,
              description: fields.description ? String(fields.description) : undefined,
              active: fields.active !== false,
            });
            break;
          }
          case "transaction_add": {
            const description = String(fields.description ?? "").trim();
            const amount = toNumber(fields.amount);
            const date = String(fields.date ?? "").trim();
            if (!description || amount === null || amount === 0 || !date) return;
            if (Number.isNaN(Date.parse(date))) return;
            const accountId = fields.accountId ?? defaultAccountId;
            if (!accountId) return;
            nextTransactions.push({
              id: createId(),
              accountId: String(accountId),
              date,
              amount,
              description,
              counterparty: fields.counterparty ? String(fields.counterparty) : undefined,
              category: fields.category ? String(fields.category) : undefined,
            });
            break;
          }
          case "offer_add": {
            const label = String(fields.label ?? fields.name ?? fields.naam ?? "").trim();
            if (!label) return;
            nextGoals.push({
              id: createId(),
              label,
              type: "buffer",
              targetAmount: toNumber(fields.amount) ?? 0,
              currentAmount: 0,
              monthlyContribution: 0,
              isActive: false,
            });
            break;
          }
          default:
            break;
        }
      });

      setIncomeItemsBusiness(nextIncome);
      setFixedCostManualItemsBusiness(nextFixedCosts);
      setDebtsBusiness(nextDebts);
      setAssetsBusiness(nextAssets);
      setGoalsBusiness(nextGoals);
      setAccountsBusiness(nextAccounts);
      setTransactionsBusiness(nextTransactions);
    },
    [
      accountsBusiness,
      assetsBusiness,
      debtsBusiness,
      fixedCostManualItemsBusiness,
      goalsBusiness,
      incomeItemsBusiness,
      setAccountsBusiness,
      setAssetsBusiness,
      setDebtsBusiness,
      setFixedCostManualItemsBusiness,
      setGoalsBusiness,
      setIncomeItemsBusiness,
      setTransactionsBusiness,
      transactionsBusiness,
    ]
  );
  const observation = useObserver(mode);
  const activeTabs = useActiveTabs(mode);

  const [netIncome, setNetIncome] = useLocalStorage<number>("income-netto", 0);
  const [netIncomeBusiness, setNetIncomeBusiness] = useLocalStorage<number>("income-netto-business", 0);
  // INVENTARISATIE (Hoofdstuk 3 - geen wijziging):
  // fixedCosts wordt nu alleen gehaald uit lokale invoer via useLocalStorage("fixed-costs").
  // Deze waarde voedt:
  // - stabiliteit (fixedCostPressure, runwayMonths)
  // - AI-context (via stateSnapshot richting AiAssistantCard/api-proxy)
  // Later vervangen door som uit een recurring-engine.
  const [manualFixedCosts, setManualFixedCosts] = useLocalStorage<number>("fixed-costs", 0);
  const [fixedCostItems, setFixedCostItems] = useLocalStorage<FixedCostItem[]>("fixed-cost-items", []);
  const [manualFixedCostsBusiness, setManualFixedCostsBusiness] = useLocalStorage<number>("fixed-costs-business", 0);
  const [fixedCostItemsBusiness, setFixedCostItemsBusiness] = useLocalStorage<FixedCostItem[]>(
    "fixed-cost-items-business",
    []
  );

  // systeemaanname v1 (geen UI)
  const bufferTargetMonths = 3;
  const bufferMonthlyReserve = 200;
  const assetMonthlyContribution = 300;
  const assetTarget = 10000;

  const addOrUpdateAccount = (account: MoneylithAccount) => {
    setAccounts((prev) => {
      const next = prev.map((a) =>
        account.isPrimary ? { ...a, isPrimary: false } : a
      );
      const idx = next.findIndex((a) => a.id === account.id);
      if (idx === -1) {
        return [...next, account];
      }
      next[idx] = account;
      return next;
    });
  };

  const addOrUpdateAccountBusiness = (account: MoneylithAccount) => {
    setAccountsBusiness((prev) => {
      const next = prev.map((a) => (account.isPrimary ? { ...a, isPrimary: false } : a));
      const idx = next.findIndex((a) => a.id === account.id);
      if (idx === -1) {
        return [...next, account];
      }
      next[idx] = account;
      return next;
    });
  };

  const addGoal = (goal: Omit<MoneylithGoal, "id">) => {
    const newGoal: MoneylithGoal = { ...goal, id: crypto.randomUUID() };
    setGoals((prev) => [...prev, newGoal]);
  };

  const updateGoal = (id: string, patch: Partial<MoneylithGoal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const addGoalBusiness = (goal: Omit<MoneylithGoal, "id">) => {
    const newGoal: MoneylithGoal = { ...goal, id: crypto.randomUUID() };
    setGoalsBusiness((prev) => [...prev, newGoal]);
  };

  const updateGoalBusiness = (id: string, patch: Partial<MoneylithGoal>) => {
    setGoalsBusiness((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const deleteGoalBusiness = (id: string) => {
    setGoalsBusiness((prev) => prev.filter((g) => g.id !== id));
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const addStatementMeta = (meta: AccountStatementMeta) => {
    setStatements((prev) => [...prev, meta]);
  };

  const addStatementMetaBusiness = (meta: AccountStatementMeta) => {
    setStatementsBusiness((prev) => [...prev, meta]);
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteAccountBusiness = (id: string) => {
    setAccountsBusiness((prev) => prev.filter((a) => a.id !== id));
  };

  const addTransaction = (tx: Transaction) => {
    setTransactions((prev) => [...prev, tx]);
  };

  const addTransactionBusiness = (tx: Transaction) => {
    setTransactionsBusiness((prev) => [...prev, tx]);
  };

  const handleAiAnalysisComplete = ({ raw, at }: { raw: string; at: string }) => {
    setAiAnalysisDone(true);
    setAiAnalysisDoneAt(at);
    setAiAnalysisRaw(raw);
  };

  const handleAiAnalysisCompleteBusiness = ({ raw, at }: { raw: string; at: string }) => {
    setAiAnalysisDoneBusiness(true);
    setAiAnalysisDoneAtBusiness(at);
    setAiAnalysisRawBusiness(raw);
  };

  const runFullAiRitme = async () => {
    const system = "Moneylith - bepaal variabele potjes uit afschriften";
    const user = [
      "Maak een overzicht van variabele uitgavencategorieën op basis van ALLE afschriften.",
      "Geef per categorie een maandgemiddelde (EUR).",
      "Format per regel: <label>: €<bedrag>",
      "Max 6 regels.",
    ].join("\n");
    try {
      // Gebruik alleen de geldige backend route; de oude variant gaf 404 in Vite.
      const endpoints = ["/api/moneylith/analyse"];
      let lastError: Error | null = null;
      let raw = "";
      for (const url of endpoints) {
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system, user }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          raw = (data.content as string | undefined) ?? "";
          break;
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));
          continue;
        }
      }
      if (!raw && lastError) throw lastError;
      const at = new Date().toISOString();
      handleAiAnalysisComplete({ raw, at });
      const { actions } = extractActionsFromContent(raw);
      if (actions) setAiActionsPersonal(actions);
    } catch (err) {
      console.error("AI ritme analyse mislukt", err);
    }
  };

  const handleAiActionsChange = (actions: AiActions | null) => {
    if (mode === "zakelijk") {
      setAiActionsBusiness(actions);
    } else {
      setAiActionsPersonal(actions);
    }
  };

  const updateTransaction = (tx: Transaction) => {
    setTransactions((prev) => {
      const idx = prev.findIndex((t) => t.id === tx.id);
      if (idx === -1) return [...prev, tx];
      const next = [...prev];
      next[idx] = tx;
      return next;
    });
  };

  const updateTransactionBusiness = (tx: Transaction) => {
    setTransactionsBusiness((prev) => {
      const idx = prev.findIndex((t) => t.id === tx.id);
      if (idx === -1) return [...prev, tx];
      const next = [...prev];
      next[idx] = tx;
      return next;
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteTransactionBusiness = (id: string) => {
    setTransactionsBusiness((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteStatement = (id: string) => {
    setStatements((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteStatementBusiness = (id: string) => {
    setStatementsBusiness((prev) => prev.filter((s) => s.id !== id));
  };

  const buildHeuristicBuckets = useCallback((netFreeValue: number): MoneylithBucket[] => {
    if (netFreeValue <= 0) return [];
    const buckets = [
      { id: "b-essentials", label: "Boodschappen & huishoudelijk", share: 0.35 },
      { id: "b-leefgeld", label: "Leefgeld & vrije tijd", share: 0.25 },
      { id: "b-vervoer", label: "Vervoer & mobiliteit", share: 0.15 },
      { id: "b-overig", label: "Overig variabel", share: 0.25 },
    ];
    return buckets.map((b) => {
      const monthly = Math.max(0, Math.round(netFreeValue * b.share));
      return {
        id: b.id,
        label: b.label,
        type: "variable" as const,
        monthlyAvg: monthly,
        lastAmount: monthly,
        recurring: true,
        sampleTransactions: [],
        userLocked: false,
      };
    });
  }, []);

  const deriveBucketsFromTransactions = useCallback(
    (txs: MoneylithTransaction[], netFreeValue: number): MoneylithBucket[] => {
      if (!txs.length) return [];

      const now = Date.now();
      const cutoffMs = now - 90 * 24 * 60 * 60 * 1000; // laatste 90 dagen
      let minDate = Number.MAX_SAFE_INTEGER;
      let maxDate = 0;

      let spendTxs = txs.filter((t) => {
        if (t.amount >= 0) return false;
        const ts = Date.parse(t.date);
        if (Number.isFinite(ts)) {
          minDate = Math.min(minDate, ts);
          maxDate = Math.max(maxDate, ts);
          return ts >= cutoffMs;
        }
        return true; // behoud uitgaven zonder geldige datum
      });

      // Als er niets binnen 90 dagen is gevonden, gebruik dan alle uitgaven als fallback
      if (!spendTxs.length) {
        spendTxs = txs.filter((t) => t.amount < 0);
        minDate = Number.MAX_SAFE_INTEGER;
        maxDate = 0;
        spendTxs.forEach((t) => {
          const ts = Date.parse(t.date);
          if (Number.isFinite(ts)) {
            minDate = Math.min(minDate, ts);
            maxDate = Math.max(maxDate, ts);
          }
        });
      }

      if (!spendTxs.length) return [];

      const map = new Map<string, { total: number; count: number }>();
      spendTxs.forEach((t) => {
        const key = (t.category || t.description || "onbekend").toLowerCase().slice(0, 60);
        const entry = map.get(key) ?? { total: 0, count: 0 };
        entry.total += Math.abs(t.amount);
        entry.count += 1;
        map.set(key, entry);
      });

      const spanDays =
        minDate !== Number.MAX_SAFE_INTEGER && maxDate > 0
          ? Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)))
          : 30;
      const months = Math.max(1, Math.round(spanDays / 30));

      const buckets = Array.from(map.entries())
        .map(([label, info]) => {
          const monthlyAvg = Math.round(info.total / months);
          return {
            id: `tx-${label}`,
            label: label || "potje",
            type: "variable" as const,
            monthlyAvg,
            lastAmount: monthlyAvg,
            recurring: true,
            sampleTransactions: [],
            userLocked: false,
          };
        })
        .filter((b) => b.monthlyAvg > 0)
        .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
        .slice(0, 6);

      if (!buckets.length && netFreeValue > 0) {
        return buildHeuristicBuckets(netFreeValue);
      }
      return buckets;
    },
    [buildHeuristicBuckets]
  );

  const debtClearMonths =
    debtsSummary.totalDebt > 0 && debtsSummary.totalMinPayment > 0
      ? Math.ceil(debtsSummary.totalDebt / debtsSummary.totalMinPayment)
      : null;
  const debtClearMonthsAggressive =
    netIncome > 0 && debtsSummary.totalDebt > 0 ? Math.ceil(debtsSummary.totalDebt / netIncome) : null;
  const debtClearMonthsBuffered =
    netIncome - bufferMonthlyReserve > 0 && debtsSummary.totalDebt > 0
      ? Math.ceil(debtsSummary.totalDebt / (netIncome - bufferMonthlyReserve))
      : null;

  const recurringCandidates = useMemo(() => detectRecurringCandidates(transactions), [transactions]);
  const recurringCandidatesBusiness = useMemo(() => detectRecurringCandidates(transactionsBusiness), [transactionsBusiness]);

  const mergeFixedItems = (candidates: FixedCostItem[], base: FixedCostItem[]) => {
    if (!candidates.length && !base.length) return [] as FixedCostItem[];
    const byPattern = new Map<string, FixedCostItem>();
    for (const item of base) {
      byPattern.set(item.descriptionPattern, item);
    }
    const result: FixedCostItem[] = [];
    for (const candidate of candidates) {
      const existing = byPattern.get(candidate.descriptionPattern);
      if (existing) {
        result.push({
          ...existing,
          averageAmount: candidate.averageAmount,
          estimatedMonthlyAmount: candidate.estimatedMonthlyAmount,
          frequency: candidate.frequency,
          sampleCount: candidate.sampleCount,
          lastDate: candidate.lastDate,
        });
        byPattern.delete(candidate.descriptionPattern);
      } else {
        result.push({
          id: candidate.id,
          descriptionPattern: candidate.descriptionPattern,
          averageAmount: candidate.averageAmount,
          estimatedMonthlyAmount: candidate.estimatedMonthlyAmount,
          frequency: candidate.frequency,
          sampleCount: candidate.sampleCount,
          lastDate: candidate.lastDate,
          isFixed: false,
          isIgnored: false,
        });
      }
    }
    for (const leftover of byPattern.values()) {
      result.push(leftover);
    }
    return result.sort((a, b) => {
      const byPat = a.descriptionPattern.localeCompare(b.descriptionPattern);
      if (byPat !== 0) return byPat;
      return a.id.localeCompare(b.id);
    });
  };

  const mergedFixedCostItems = useMemo(
    () => mergeFixedItems(recurringCandidates, fixedCostItems),
    [recurringCandidates, fixedCostItems]
  );
  const mergedFixedCostItemsBusiness = useMemo(
    () => mergeFixedItems(recurringCandidatesBusiness, fixedCostItemsBusiness),
    [recurringCandidatesBusiness, fixedCostItemsBusiness]
  );

  const fixedCostItemsEqual = (a: FixedCostItem, b: FixedCostItem) =>
    a.id === b.id &&
    a.descriptionPattern === b.descriptionPattern &&
    a.averageAmount === b.averageAmount &&
    a.estimatedMonthlyAmount === b.estimatedMonthlyAmount &&
    a.frequency === b.frequency &&
    a.sampleCount === b.sampleCount &&
    a.lastDate === b.lastDate &&
    a.isFixed === b.isFixed &&
    a.isIgnored === b.isIgnored &&
    a.customLabel === b.customLabel &&
    a.customMonthlyAmount === b.customMonthlyAmount;

  useEffect(() => {
    if (
      fixedCostItems.length === mergedFixedCostItems.length &&
      fixedCostItems.every((item, idx) => fixedCostItemsEqual(item, mergedFixedCostItems[idx]))
    ) {
      return;
    }
    setFixedCostItems(mergedFixedCostItems);
  }, [fixedCostItems, mergedFixedCostItems, setFixedCostItems]);

  useEffect(() => {
    if (
      fixedCostItemsBusiness.length === mergedFixedCostItemsBusiness.length &&
      fixedCostItemsBusiness.every((item, idx) => fixedCostItemsEqual(item, mergedFixedCostItemsBusiness[idx]))
    ) {
      return;
    }
    setFixedCostItemsBusiness(mergedFixedCostItemsBusiness);
  }, [fixedCostItemsBusiness, mergedFixedCostItemsBusiness, setFixedCostItemsBusiness]);

  const autoFixedCosts = mergedFixedCostItems
    .filter((item) => item.isFixed && !item.isIgnored)
    .reduce((sum, item) => {
      const monthly = item.customMonthlyAmount ?? item.estimatedMonthlyAmount ?? 0;
      return sum + monthly;
    }, 0);
  const autoFixedCostsBusiness = mergedFixedCostItemsBusiness
    .filter((item) => item.isFixed && !item.isIgnored)
    .reduce((sum, item) => {
      const monthly = item.customMonthlyAmount ?? item.estimatedMonthlyAmount ?? 0;
      return sum + monthly;
    }, 0);

  const fixedCosts = autoFixedCosts > 0 ? autoFixedCosts : manualFixedCosts;
  const fixedCostsBusiness = autoFixedCostsBusiness > 0 ? autoFixedCostsBusiness : manualFixedCostsBusiness;

  const derivedIncomeFromTransactions = useMemo(() => {
    const pos = transactions?.filter((t) => t.amount > 0) ?? [];
    return pos.reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const derivedIncomeFromTransactionsBusiness = useMemo(() => {
    const pos = transactionsBusiness?.filter((t) => t.amount > 0) ?? [];
    return pos.reduce((sum, t) => sum + t.amount, 0);
  }, [transactionsBusiness]);

  const derivedFixedFromTransactions = useMemo(() => {
    const neg = transactions?.filter((t) => t.amount < 0) ?? [];
    return neg.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const derivedFixedFromTransactionsBusiness = useMemo(() => {
    const neg = transactionsBusiness?.filter((t) => t.amount < 0) ?? [];
    return neg.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactionsBusiness]);

  const activeNetIncome = mode === "zakelijk" ? netIncomeBusiness : netIncome;
  const activeFixedCosts = mode === "zakelijk" ? fixedCostsBusiness : fixedCosts;
  const activeIncomeItems = mode === "zakelijk" ? incomeItemsBusiness : incomeItems;
  const activeFixedCostManualItems = mode === "zakelijk" ? fixedCostManualItemsBusiness : fixedCostManualItems;
  const activeDebts = mode === "zakelijk" ? debtsBusiness : debts;
  const activeAssets = mode === "zakelijk" ? assetsBusiness : assets;
  const activeTransactions = mode === "zakelijk" ? transactionsBusiness : transactions;
  const activeAccounts = mode === "zakelijk" ? accountsBusiness : accounts;
  const activeStatements = mode === "zakelijk" ? statementsBusiness : statements;
  const activeGoals = mode === "zakelijk" ? goalsBusiness : goals;
  const activeDebtsSummary = mode === "zakelijk" ? debtsSummaryBusiness : debtsSummary;
  const activeAssetsSummary = mode === "zakelijk" ? assetsSummaryBusiness : assetsSummary;
  const activeInboxItems = mode === "zakelijk" ? inboxItemsBusiness : inboxItems;

  const isFundamentValid = (income: number, costs: number) => income > 0 && costs >= 0 && Number.isFinite(income - costs);

  const fundamentValid = isFundamentValid(activeNetIncome ?? 0, activeFixedCosts ?? 0);
  const ritmeValid = false;
  const focusValid = fundamentValid && !!selectedMonth && !!monthFocus;

  const assetTargetMonths =
    assetMonthlyContribution > 0
      ? Math.ceil(Math.max(assetTarget - assetsSummary.totalAssets, 0) / assetMonthlyContribution)
      : null;

  const fixedCostPressure = netIncome > 0 ? fixedCosts / netIncome : null;
  const runwayMonths = fixedCosts > 0 && assetsSummary.totalAssets > 0 ? Math.floor(assetsSummary.totalAssets / fixedCosts) : null;

  const mapAiActionsToBuckets = useCallback(
    (actions: AiActions | null, netFreeValue: number): MoneylithBucket[] => {
      if (!actions?.buckets?.length) return [];
      const filtered = actions.buckets.filter((b) => (b.confidence ?? 0) >= 0.6);
      return filtered.map((b, idx) => {
        const monthlyFromAmount = typeof b.amount === "number" ? Math.abs(b.amount) : undefined;
        const monthlyFromShare =
          typeof b.share === "number" && netFreeValue > 0 ? Math.abs(b.share * netFreeValue) : undefined;
        const monthlyAvg = monthlyFromAmount ?? monthlyFromShare ?? 0;
        return {
          id: `ai-bucket-${idx}-${b.name ?? "potje"}`,
          label: b.name ?? "AI-potje",
          type: (b.type as MoneylithBucket["type"]) ?? "variable",
          monthlyAvg,
          lastAmount: monthlyAvg,
          recurring: b.recurring ?? false,
          sampleTransactions: [],
          userLocked: false,
        };
      });
    },
    []
  );

  const extractBucketsFromText = useCallback((text: string, netFreeValue: number): MoneylithBucket[] => {
    if (!text) return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const buckets: MoneylithBucket[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      if (buckets.length >= 5) break;
      const match = line.match(/(.{0,60}?)[€\s]*(-?\d+[.,]?\d*)/);
      if (!match) continue;
      const rawLabel = match[1].replace(/[-:•·]/g, " ").trim();
      const amount = Math.abs(parseFloat(match[2].replace(",", ".")));
      if (!amount || !Number.isFinite(amount)) continue;
      const label = (rawLabel || "AI-potje").trim();
      if (seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      const monthly = amount;
      // cap at 2x netFree to avoid runaway values
      const monthlyAvg = netFreeValue > 0 ? Math.min(monthly, netFreeValue * 2) : monthly;
      buckets.push({
        id: `ai-text-${buckets.length}-${label}`,
        label,
        type: "variable",
        monthlyAvg,
        lastAmount: monthlyAvg,
        recurring: false,
        sampleTransactions: [],
        userLocked: false,
      });
    }
    if (buckets.length > 0) {
      const hasValue = buckets.some((b) => b.monthlyAvg > 0);
      if (!hasValue && netFreeValue > 0) {
        // verdeel netjes over de gevonden labels
        const share = Math.max(1, Math.round(netFreeValue / buckets.length));
        return buckets.map((b, idx) => {
          const monthlyAvg = share;
          return { ...b, monthlyAvg, lastAmount: monthlyAvg };
        });
      }
    }
    return buckets;
  }, []);

  const netFreePersonal = netIncome - fixedCosts;
  const netFreeBusiness = netIncomeBusiness - fixedCostsBusiness;

  const autoBuckets = useMemo(() => deriveBuckets(transactions), [transactions]);
  const autoBucketsBusiness = useMemo(() => deriveBuckets(transactionsBusiness), [transactionsBusiness]);
  const aiBucketsPersonal = useMemo(
    () => mapAiActionsToBuckets(aiActionsPersonal, netFreePersonal),
    [aiActionsPersonal, mapAiActionsToBuckets, netFreePersonal]
  );
  const aiBucketsBusiness = useMemo(
    () => mapAiActionsToBuckets(aiActionsBusiness, netFreeBusiness),
    [aiActionsBusiness, mapAiActionsToBuckets, netFreeBusiness]
  );
  const fixedCostBucketsPersonal = useMemo<MoneylithBucket[]>(() => {
    return fixedCostItems
      .filter((item) => item.isFixed && !item.isIgnored)
      .map((item) => {
        const monthly = item.customMonthlyAmount ?? item.estimatedMonthlyAmount ?? item.averageAmount ?? 0;
        return {
          id: `fixed-${item.id}`,
          label: item.customLabel ?? item.descriptionPattern,
          type: "fixed" as const,
          monthlyAvg: monthly,
          lastAmount: monthly,
          recurring: true,
          sampleTransactions: [],
          userLocked: true,
        };
      });
  }, [fixedCostItems]);
  const fixedCostBucketsBusiness = useMemo<MoneylithBucket[]>(() => {
    return fixedCostItemsBusiness
      .filter((item) => item.isFixed && !item.isIgnored)
      .map((item) => {
        const monthly = item.customMonthlyAmount ?? item.estimatedMonthlyAmount ?? item.averageAmount ?? 0;
        return {
          id: `fixed-biz-${item.id}`,
          label: item.customLabel ?? item.descriptionPattern,
          type: "fixed" as const,
          monthlyAvg: monthly,
          lastAmount: monthly,
          recurring: true,
          sampleTransactions: [],
          userLocked: true,
        };
      });
  }, [fixedCostItemsBusiness]);

  const bucketsPersonal = useMemo(() => {
    const txBuckets = deriveBucketsFromTransactions(transactions, netFreePersonal);
    let base = txBuckets.length
      ? txBuckets
      : aiBucketsPersonal.length
      ? aiBucketsPersonal
      : autoBuckets;

    // Fallbacks zodat Ritme niet leeg blijft, ook zonder transacties:
    // 1) Als er AI-analyse is gedaan maar geen potjes zijn afgeleid -> vrije ruimte als enkel potje.
    if (base.length === 0 && aiAnalysisDone && netFreePersonal > 0) {
      const fromText = extractBucketsFromText(aiAnalysisRaw ?? "", netFreePersonal);
      base =
        fromText.length > 0
          ? fromText
          : [
              {
                id: "free-cash",
                label: "Vrij besteedbaar",
                type: "variable" as const,
                monthlyAvg: netFreePersonal,
                lastAmount: netFreePersonal,
                recurring: false,
                sampleTransactions: [],
                userLocked: true,
              },
            ];
    }

    // 2) Als er nog helemaal niets is (geen AI, geen transacties) maar er is wel netto vrije ruimte,
    //    verdeel heuristisch in een paar variabele potjes op basis van vrije ruimte.
    if (base.length === 0 && netFreePersonal > 0) {
      base = buildHeuristicBuckets(netFreePersonal);
    }

    return mergeWithUserOverrides(base, bucketOverrides);
  }, [
    aiAnalysisDone,
    aiAnalysisRaw,
    aiBucketsPersonal,
    deriveBucketsFromTransactions,
    autoBuckets,
    bucketOverrides,
    buildHeuristicBuckets,
    extractBucketsFromText,
    fixedCostBucketsPersonal,
    netFreePersonal,
  ]);
  // Potjes-engine tijdelijk uitgeschakeld
  const bucketsBusiness: MoneylithBucket[] = [];
  const [storedBuckets, setStoredBuckets] = useLocalStorage<MoneylithBucket[]>("moneylith.personal.buckets", []);
  const [storedBucketsBusiness, setStoredBucketsBusiness] = useLocalStorage<MoneylithBucket[]>(
    "moneylith.business.buckets",
    []
  );
  useEffect(() => {
    setStoredBuckets([]);
    setStoredBucketsBusiness([]);
  }, [setStoredBuckets, setStoredBucketsBusiness]);
  const activeBuckets = [];
  const activeNetFree = mode === "zakelijk" ? netIncomeBusiness - fixedCostsBusiness : netIncome - fixedCosts;
  const spendBuckets: SpendBucket[] = [];

  const incomeBuckets = bucketsPersonal.filter((b) => b.type === "income");
  const fixedBuckets = bucketsPersonal.filter((b) => b.type === "fixed");
  const variableBuckets = bucketsPersonal.filter((b) => b.type === "variable");
  const potentialFixedPerMonth = fixedBuckets.reduce((sum, b) => sum + b.monthlyAvg, 0);

  // SNAPSHOT-INVENTARISATIE (nog NIET herstructureren):
  // - Inkomsten: netIncome uit useLocalStorage("income-netto") + IncomeList-som; total via (netIncome ?? 0)
  // - Vaste lasten: fixedCosts = autoFixedCosts (fixedCostItems) fallback manualFixedCosts (useLocalStorage("fixed-costs")); fixedCostItems komen uit recurringCandidates merge
  // - Schulden: schuldenkaart slaat lokaal op, summary in debtsSummary (totalDebt/totalMinPayment/debtCount), aflos-modes/time variabelen
  // - Vermogen: VermogenCard slaat lokaal op, summary in assetsSummary (totalAssets/assetsCount), assetTarget/assetMonthlyContribution hardcoded v1
  // - Afgeleiden: netFree = netIncome - fixedCosts (quickSummary.free); fixedCostPressure, runwayMonths; assetTargetMonths uit assetTarget/assetMonthlyContribution; debtClearMonths* uit debtsSummary/netIncome/bufferMonthlyReserve

  const suggestedIncomeFromBuckets = incomeBuckets.reduce((sum, b) => sum + (b.monthlyAvg || 0), 0);
  const suggestedFixedFromBuckets = fixedBuckets.reduce((sum, b) => sum + (b.monthlyAvg || 0), 0);

  const recalculateFinancialSnapshot = () => {
    let incomeValue = netIncome ?? 0;
    let incomeSource: "manual" | "transactions" | "buckets" = "manual";
    if (incomeValue <= 0 && derivedIncomeFromTransactions > 0) {
      incomeValue = derivedIncomeFromTransactions;
      incomeSource = "transactions";
    } else if (incomeValue <= 0 && suggestedIncomeFromBuckets > 0) {
      incomeValue = suggestedIncomeFromBuckets;
      incomeSource = "buckets";
    }

    let fixedValue = fixedCosts ?? 0;
    let fixedSource: "manual" | "transactions" | "buckets" = "manual";
    if (fixedValue <= 0 && derivedFixedFromTransactions > 0) {
      fixedValue = derivedFixedFromTransactions;
      fixedSource = "transactions";
    } else if (fixedValue <= 0 && suggestedFixedFromBuckets > 0) {
      fixedValue = suggestedFixedFromBuckets;
      fixedSource = "buckets";
    }

    const netFree = incomeValue - fixedValue;
    const totalDebt = debtsSummary.totalDebt ?? 0;
    const assetsTotal = assetsSummary.totalAssets ?? 0;
    const monthlyPressure = debtsSummary.totalMinPayment ?? 0;
    const snapshot: FinancialSnapshot = {
      totalIncome: { value: incomeValue, source: incomeSource },
      fixedCostsTotal: { value: fixedValue, source: fixedSource },
      netFree,
      totalDebt,
      assetsTotal,
      monthlyPressure,
      runwayMonths,
      intent: userIntent,
      focus: monthFocus ?? null,
      optimizeCosts: userIntent?.optimizeCosts ?? false,
    };
    setFinancialSnapshot(snapshot);
    console.debug("SNAPSHOT INCOME", snapshot.totalIncome);
    console.debug("SNAPSHOT FIXED", snapshot.fixedCostsTotal);
  };

  useEffect(() => {
    recalculateFinancialSnapshot();
  }, [
    netIncome,
    fixedCosts,
    debtsSummary.totalDebt,
    debtsSummary.totalMinPayment,
    assetsSummary.totalAssets,
    assetsSummary.assetsCount,
    monthFocus,
    userIntent,
    runwayMonths,
    derivedIncomeFromTransactions,
    derivedFixedFromTransactions,
  ]);

  const focusLabelMap: Record<MonthFocus, string> = {
    schulden_afbouwen: "Schulden afbouwen",
    vermogen_opbouwen: "Vermogen opbouwen",
    overleven: "Overleven & stabiliseren",
    experiment: "Experiment",
    null: "Nog geen focus gekozen",
  };

  const quickSummary = useMemo(() => {
    const free = (netIncome ?? 0) - (fixedCosts ?? 0);
    return {
      free,
      month: selectedMonth,
      focus: focusLabelMap[monthFocus ?? null],
      status: free >= 0 ? "Onder controle" : "Kwetsbaar",
    };
  }, [netIncome, fixedCosts, selectedMonth, monthFocus, focusLabelMap]);

  const intentValid = Boolean(
    userIntent.primaryGoal &&
      userIntent.mainPressure &&
      userIntent.mainPressure.length > 0 &&
      userIntent.timeHorizon &&
      userIntent.aiStyle
  );

  const normalizeStep = (key: StepKey) => (key.startsWith("biz-") ? key.replace("biz-", "") : key);

  useEffect(() => {
    const base = [...personalTabs.map((t) => t.key), ...businessTabs.map((t) => t.key)];
    setUnlockedSteps(base);
  }, [mode, intentValid, fundamentValid, ritmeValid, focusValid]);

  useEffect(() => {
    const total = incomeItems.reduce((sum, item) => sum + (Number.isFinite(item.bedrag) ? item.bedrag : 0), 0);
    setNetIncome(total);
  }, [incomeItems, setNetIncome]);

  useEffect(() => {
    const total = incomeItemsBusiness.reduce((sum, item) => sum + (Number.isFinite(item.bedrag) ? item.bedrag : 0), 0);
    setNetIncomeBusiness(total);
  }, [incomeItemsBusiness, setNetIncomeBusiness]);

  useEffect(() => {
    const total = fixedCostManualItems.reduce((sum, item) => sum + (Number.isFinite(item.bedrag) ? item.bedrag : 0), 0);
    setManualFixedCosts(total);
  }, [fixedCostManualItems, setManualFixedCosts]);

  useEffect(() => {
    const total = fixedCostManualItemsBusiness.reduce(
      (sum, item) => sum + (Number.isFinite(item.bedrag) ? item.bedrag : 0),
      0
    );
    setManualFixedCostsBusiness(total);
  }, [fixedCostManualItemsBusiness, setManualFixedCostsBusiness]);

  useEffect(() => {
    if (focusValid && !unlockedSteps.includes("action") && mode === "persoonlijk") {
      setCurrentStep("action");
    }
  }, [mode, focusValid, unlockedSteps]);

  useEffect(() => {
    const activeIds = activeTabs.map((t) => t.key);
    if (!activeIds.includes(currentStep)) {
      setCurrentStep(activeIds[0] ?? "intent");
    }
  }, [mode, activeTabs, currentStep]);

  const handleStepClick = (step: StepKey) => {
    const unlocked =
      unlockedSteps.includes(step) || unlockedSteps.includes(normalizeStep(step));
    if (unlocked) {
      setCurrentStep(step);
    }
  };

  // TAB INTENTIE DATA-BINDING:
  // Ontvangt: userIntent (useLocalStorage)
  // Schrijft: setUserIntent (persist), geen lokale state
  // Gebruikt totals: geen
  const renderIntent = (variant: "personal" | "business" = "personal") => {
    const value = variant === "business" ? userIntentBusiness : userIntent;
    const handleChange = variant === "business" ? setUserIntentBusiness : setUserIntent;
    return (
      <div className="space-y-4">
        <StepIntent value={value} onChange={handleChange} variant={variant} />
      </div>
    );
  };

  // TAB FUNDAMENT DATA-BINDING:
  // Ontvangt: netIncome, manualFixedCosts (useLocalStorage), fixedCosts (afgeleid in App), IncomeList/FixedCostsList sommen
  // Schrijft: setNetIncome, setManualFixedCosts (persist)
  // Gebruikt totals: netFree (quickSummary.free), fixedCosts
  const renderFundament = (variant: "personal" | "business" = "personal", businessMode?: "cashflow" | "fundament") => {
    const isBusinessVariant = variant === "business";
    const incomeItemsSource = isBusinessVariant ? incomeItemsBusiness : incomeItems;
    const fixedManualSource = isBusinessVariant ? fixedCostManualItemsBusiness : fixedCostManualItems;
    const fixedItemsSource = isBusinessVariant ? mergedFixedCostItemsBusiness : mergedFixedCostItems;
    const setIncomeItemsFn = isBusinessVariant ? setIncomeItemsBusiness : setIncomeItems;
    const setFixedManualFn = isBusinessVariant ? setFixedCostManualItemsBusiness : setFixedCostManualItems;
    const setFixedItemsFn = isBusinessVariant ? setFixedCostItemsBusiness : setFixedCostItems;
    const setNetIncomeFn = isBusinessVariant ? setNetIncomeBusiness : setNetIncome;
    const setManualFixedFn = isBusinessVariant ? setManualFixedCostsBusiness : setManualFixedCosts;
    const goalsSource = isBusinessVariant ? goalsBusiness : goals;

    const pageTitle = isBusinessVariant
      ? businessMode === "cashflow"
        ? "Cashflow"
        : "Fundament (zakelijk)"
      : "Fundament";
    const pageIntro = isBusinessVariant
      ? "Inkomend vs uitgaand geld, zodat je runway en vaste verplichtingen helder zijn."
      : "Hier leg je je basis vast: wat komt er elke maand binnen en wat gaat er zeker uit.";
    const incomeHeading = isBusinessVariant ? "Inkomstenstromen" : "Inkomensstromen";
    const incomeSubheading = isBusinessVariant ? "Overzicht van je omzet/inkomsten" : "Overzicht van je inkomen";
    const incomeHelp = isBusinessVariant
      ? "Bijvoorbeeld: uren, projecten, licenties, abonnementen, productverkopen."
      : undefined;
    const fixedHeading = isBusinessVariant ? "Vaste bedrijfskosten" : "Vaste lasten";
    const fixedSubheading = isBusinessVariant ? "Overzicht van je vaste bedrijfskosten" : "Overzicht van je vaste lasten";
    const fixedHelp = isBusinessVariant
      ? "Kosten die hoe dan ook terugkomen: huur, tools, verzekeringen, platformkosten, belastingen-reservering."
      : undefined;
    const freeLabel = isBusinessVariant ? "Netto bedrijfsruimte / maand" : "Vrij te besteden per maand";

    const incomeValue = isBusinessVariant ? netIncomeBusiness ?? 0 : netIncome ?? 0;
    const fixedValue = isBusinessVariant ? fixedCostsBusiness ?? 0 : fixedCosts ?? 0;

    const incomeSourceLabel = snapshot?.totalIncome?.source === "transactions"
      ? "Bron: Afschriften"
      : snapshot?.totalIncome?.source === "buckets"
      ? "Bron: Buckets"
      : "Bron: Handmatig";
    const fixedSourceLabel = snapshot?.fixedCostsTotal?.source === "transactions"
      ? "Bron: Afschriften"
      : snapshot?.fixedCostsTotal?.source === "buckets"
      ? "Bron: Buckets"
      : "Bron: Handmatig";

    const freeAmount = incomeValue - fixedValue;
    const activeGoalsList = goalsSource.filter((g) => g.isActive);
    const totalGoalPressure = activeGoalsList.reduce((sum, g) => sum + (g.monthlyContribution ?? 0), 0);

    let marginStatus = "Geen doelen ingesteld";
    if (freeAmount <= 0) {
      marginStatus = "Onhoudbaar tempo";
    } else if (activeGoalsList.length > 0) {
      const margin = freeAmount - totalGoalPressure;
      const threshold = 0.2 * freeAmount;
      if (margin < 0) marginStatus = "Onhoudbaar tempo";
      else if (margin < threshold) marginStatus = "Krap tempo";
      else marginStatus = "Stabiel tempo";
    }

    const aiActionsForMode = isBusinessVariant ? aiActionsBusiness : aiActionsPersonal;
    const incomeApplyCheck = canApplyIncomeSuggestion({
      mode: isBusinessVariant ? "business" : "personal",
      actions: aiActionsForMode,
      currentIncome: incomeItemsSource,
    });

    const fixedApplyCheck = canApplyFixedCostsSuggestions({
      mode: isBusinessVariant ? "business" : "personal",
      actions: aiActionsForMode,
      currentFixedCosts: fixedManualSource,
    });

    const handleApplyIncomeSuggestion = () => {
      if (!incomeApplyCheck.ok || !aiActionsForMode?.income) return;
      const patch = buildIncomePatchFromActions(aiActionsForMode);
      if (!patch) return;
      setIncomeItemsFn([patch]);
    };

    const handleApplyFixedSuggestions = () => {
      if (!fixedApplyCheck.ok || !aiActionsForMode) return;
      const items = buildFixedCostsPatchesFromActions(aiActionsForMode);
      if (!items.length) return;
      setFixedManualFn(items);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold text-slate-50">{pageTitle}</h2>
          <p className="text-sm text-slate-200">{pageIntro}</p>
        </div>
        {!isBusinessVariant && (
          <div className="space-y-2">
            {incomeApplyCheck.ok && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>AI-suggestie voor inkomen beschikbaar.</p>
                  <button
                    type="button"
                    onClick={handleApplyIncomeSuggestion}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                  >
                    Neem suggestie over
                  </button>
                </div>
              </div>
            )}
            {fixedApplyCheck.ok && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>AI-suggesties voor vaste lasten beschikbaar.</p>
                  <button
                    type="button"
                    onClick={handleApplyFixedSuggestions}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                  >
                    Neem suggesties over
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {isBusinessVariant && (
          <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
            <p className="text-xs">
              Cashflow-tip: reserveer voor btw/loonheffing als onderdeel van je vaste lasten; AI kan facturen/aanmaningen herkennen via Inbox.
            </p>
          </div>
        )}
        <IncomeList
          items={incomeItemsSource}
          onItemsChange={setIncomeItemsFn}
          onSumChange={(sum) => setNetIncomeFn((prev) => (prev === sum ? prev : sum))}
          heading={incomeHeading}
          subheading={incomeSubheading}
          emptyLabel={isBusinessVariant ? "Nog geen inkomstenstroom toegevoegd voor je bedrijf." : undefined}
          totalLabel={isBusinessVariant ? "Totaal omzet" : undefined}
        />
        {incomeHelp && <p className="text-xs text-slate-200">{incomeHelp}</p>}
        <FixedCostsList
          items={fixedManualSource}
          onItemsChange={setFixedManualFn}
          onSumChange={(sum) => setManualFixedFn((prev) => (prev === sum ? prev : sum))}
          heading={fixedHeading}
          subheading={fixedSubheading}
          emptyLabel={isBusinessVariant ? "Nog geen vaste bedrijfskosten toegevoegd." : undefined}
          totalLabel={isBusinessVariant ? "Som van vaste bedrijfskosten" : undefined}
        />
        {fixedHelp && <p className="text-xs text-slate-200">{fixedHelp}</p>}
        <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-slate-100 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-50">{freeLabel}</p>
            <span className="rounded-full border border-white/20 px-3 py-0.5 text-[11px] text-slate-100">
              {incomeSourceLabel} / {fixedSourceLabel}
            </span>
          </div>
          <p className="text-xl font-bold text-white">€{freeAmount.toFixed(0)}</p>
          <p className="text-xs text-slate-200">{marginStatus}</p>
          <p className="text-xs text-slate-300">
            Inkomsten en vaste lasten komen uit de tabellen hierboven. De som van vaste lasten gebruikt de wizard zodra je daar items bevestigt, anders de handmatige lijst.
          </p>
        </div>
      </div>
    );
  };

// TAB RITME DATA-BINDING:

  // Ontvangt: selectedMonth (persist), quickSummary (netFree, status), netIncome/fixedCosts
  // Schrijft: setSelectedMonth (persist)
  // Gebruikt totals: netIncome, fixedCosts, netFree
  // TAB FOCUS DATA-BINDING:
  // Ontvangt: monthFocus (persist), setMonthFocus, selectedMonth
  // Schrijft: monthFocus (persist)
  // Gebruikt totals: geen
  const renderFocus = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const goalsSource = isBusinessVariant ? goalsBusiness : goals;
    const addFn = isBusinessVariant ? addGoalBusiness : addGoal;
    const updateFn = isBusinessVariant ? updateGoalBusiness : updateGoal;
    const deleteFn = isBusinessVariant ? deleteGoalBusiness : deleteGoal;
    const bucketsSource = activeBuckets;
    const aiActionsForMode = isBusinessVariant ? aiActionsBusiness : aiActionsPersonal;

    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-200">Stel je doelen scherp en zie hoe ver je staat richting buffer, schuldafbouw of andere focuspunten.</p>
        <StepFocus
          financialSnapshot={isBusinessVariant ? undefined : financialSnapshot}
          goals={goalsSource}
          onAddGoal={addFn}
          onUpdateGoal={updateFn}
          onDeleteGoal={deleteFn}
          buckets={bucketsSource}
          readOnly={false}
          variant={variant}
          mode={isBusinessVariant ? "business" : "personal"}
          actions={aiActionsForMode}
        />
      </div>
    );
  };

  // TAB ACTIE DATA-BINDING:
  // Ontvangt: monthFocus (persist), debtsSummary/assetsSummary via ActionZone callbacks
  // Schrijft: setDebtsSummary, setAssetsSummary, setAflosMode (lokale state in App)
  // Gebruikt totals: debtsSummary, assetsSummary, aflosMode
  const renderAction = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const mapBucketsForNetFree = (sourceBuckets: SpendBucket[], netFreeValue: number): SpendBucket[] => {
      return sourceBuckets.map((b) => {
        const shareOfFree = netFreeValue > 0 ? Math.min(b.monthlyAvg / netFreeValue, 5) : undefined;
        return { ...b, shareOfFree };
      });
    };

    const personalNetFree = netIncome - fixedCosts;
    const businessNetFree = netIncomeBusiness - fixedCostsBusiness;

    const bucketsForVariant = isBusinessVariant
      ? mapBucketsForNetFree(bucketsBusiness, businessNetFree)
      : mapBucketsForNetFree(bucketsPersonal, personalNetFree);

    const businessSnapshotForView: FinancialSnapshot = {
      totalIncome: { value: netIncomeBusiness ?? 0, source: "manual" },
      fixedCostsTotal: { value: fixedCostsBusiness ?? 0, source: "manual" },
      netFree: businessNetFree ?? 0,
      totalDebt: debtsSummaryBusiness.totalDebt ?? 0,
      assetsTotal: assetsSummaryBusiness.totalAssets ?? 0,
      monthlyPressure: debtsSummaryBusiness.totalMinPayment ?? 0,
      runwayMonths:
        fixedCostsBusiness > 0 && assetsSummaryBusiness.totalAssets > 0
          ? Math.floor(assetsSummaryBusiness.totalAssets / fixedCostsBusiness)
          : null,
      intent: undefined,
      focus: null,
      optimizeCosts: undefined,
    };

    return (
      <StepVooruitblik
        financialSnapshot={isBusinessVariant ? businessSnapshotForView : financialSnapshot}
        spendBuckets={bucketsForVariant}
        monthFocus={monthFocus}
        variant={variant}
        mode={isBusinessVariant ? "business" : "personal"}
        readOnly={false}
        aiAnalysisDone={isBusinessVariant ? true : aiAnalysisDone}
      />
    );
  };

  const renderRekeningen = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const accountsSource = isBusinessVariant ? accountsBusiness : accounts;
    const saveFn = isBusinessVariant ? addOrUpdateAccountBusiness : addOrUpdateAccount;
    const deleteFn = isBusinessVariant ? deleteAccountBusiness : deleteAccount;

    return <StepRekeningen accounts={accountsSource} onSaveAccount={saveFn} onDeleteAccount={deleteFn} />;
  };

  const renderVermogen = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const assetsSource = isBusinessVariant ? assetsBusiness : assets;
    const setAssetsFn = isBusinessVariant ? setAssetsBusiness : setAssets;
    const summary = isBusinessVariant ? assetsSummaryBusiness : assetsSummary;
    const setSummaryFn = isBusinessVariant ? setAssetsSummaryBusiness : setAssetsSummary;

    return (
      <StepVermogen
        financialSnapshot={isBusinessVariant ? undefined : financialSnapshot}
        assets={assetsSource}
        onAssetsChange={setAssetsFn}
        onAssetSummary={setSummaryFn}
        variant={variant}
        readOnly={false}
        mode={isBusinessVariant ? "business" : "personal"}
      />
    );
  };


  const renderSchulden = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const debtsSource = isBusinessVariant ? debtsBusiness : debts;
    const setDebtsFn = isBusinessVariant ? setDebtsBusiness : setDebts;
    const summary = isBusinessVariant ? debtsSummaryBusiness : debtsSummary;
    const setSummaryFn = isBusinessVariant ? setDebtsSummaryBusiness : setDebtsSummary;
    const aiActionsForMode = isBusinessVariant ? aiActionsBusiness : aiActionsPersonal;

    return (
      <StepSchulden
        financialSnapshot={isBusinessVariant ? undefined : financialSnapshot}
        debts={debtsSource}
        onDebtsChange={setDebtsFn}
        debtSummary={summary}
        onDebtSummary={setSummaryFn}
        variant={variant}
        readOnly={false}
        mode={isBusinessVariant ? "business" : "personal"}
        actions={aiActionsForMode}
      />
    );
  };


  const renderAfschriften = (variant: "personal" | "business" = "personal") => {
    const isBusinessVariant = variant === "business";
    const accountsSource = isBusinessVariant ? accountsBusiness : accounts;
    const statementsSource = isBusinessVariant ? statementsBusiness : statements;
    const transactionsSource = isBusinessVariant ? transactionsBusiness : transactions;
    const addStatementFn = isBusinessVariant ? addStatementMetaBusiness : addStatementMeta;
    const deleteStatementFn = isBusinessVariant ? deleteStatementBusiness : deleteStatement;
    const upsertTxFn = isBusinessVariant ? updateTransactionBusiness : updateTransaction;
    const deleteTxFn = isBusinessVariant ? deleteTransactionBusiness : deleteTransaction;
    const aiDone = isBusinessVariant ? aiAnalysisDoneBusiness : aiAnalysisDone;
    const aiDoneAt = isBusinessVariant ? aiAnalysisDoneAtBusiness : aiAnalysisDoneAt;
    const aiRaw = isBusinessVariant ? aiAnalysisRawBusiness : aiAnalysisRaw;
    const onComplete = isBusinessVariant ? handleAiAnalysisCompleteBusiness : handleAiAnalysisComplete;
    const fixedLabels = isBusinessVariant
      ? [
          ...fixedCostManualItemsBusiness.map((i) => i.description ?? i.name ?? "").filter(Boolean),
          ...fixedCostItemsBusiness.map((i) => i.descriptionPattern ?? i.customLabel ?? "").filter(Boolean),
        ]
      : [
          ...fixedCostManualItems.map((i) => i.description ?? i.name ?? "").filter(Boolean),
          ...fixedCostItems.map((i) => i.descriptionPattern ?? i.customLabel ?? "").filter(Boolean),
        ];
    const debtLabels = (isBusinessVariant ? debtsBusiness : debts).map((d) => d.naam).filter(Boolean);
    const excludeLabels = [...debtLabels, "schuld", "schulden", "lening", "lease"];

    return (
      <StepAfschriften
        variant={isBusinessVariant ? "business" : "personal"}
        storagePrefix={isBusinessVariant ? "moneylith.business" : "moneylith.personal"}
        accounts={accountsSource}
        statements={statementsSource}
        transactions={transactionsSource}
        onAddStatement={addStatementFn}
        onDeleteStatement={deleteStatementFn}
        onUpsertTransaction={upsertTxFn}
        onDeleteTransaction={deleteTxFn}
        aiAnalysisDone={aiDone}
        aiAnalysisDoneAt={aiDoneAt}
        aiAnalysisRaw={aiRaw}
        onAiAnalysisComplete={onComplete}
        onAiActionsChange={handleAiActionsChange}
        fixedCostLabels={fixedLabels}
        excludeLabels={excludeLabels}
      />
    );
  };

  const renderBackup = () => <StepBackup />;
  const renderInbox = (variant: "personal" | "business" = "personal") => {
    if (variant === "business") {
      return (
        <StepInbox
          mode="business"
          items={inboxItemsBusiness}
          onItemsChange={setInboxItemsBusiness}
          onApplySuggestions={applyInboxSuggestionsBusiness}
        />
      );
    }
    return <StepInbox items={inboxItems} onItemsChange={setInboxItems} onApplySuggestions={applyInboxSuggestions} />;
  };

  const renderContent = () => {
    const normalizedStep = normalizeStep(currentStep);
    const isBusinessView = mode === "zakelijk";
    if (normalizedStep === "intent") return renderIntent("personal");
    if (normalizedStep === "strategie") return renderIntent("business");
    if (normalizedStep === "fundament") return renderFundament("personal");
    if (normalizedStep === "verdienmodel") return renderFundament("business");
    if (normalizedStep === "cashflow") return renderFundament("business", "cashflow");
    if (normalizedStep === "schulden") return renderSchulden("personal");
    if (normalizedStep === "verplichtingen") return renderSchulden("business");
    if (normalizedStep === "rekeningen") return renderRekeningen("personal");
    if (normalizedStep === "biz-rekeningen") return renderRekeningen("business");
    if (normalizedStep === "inbox") return renderInbox("personal");
    if (normalizedStep === "biz-inbox") return renderInbox("business");
    if (normalizedStep === "afschriften") return renderAfschriften("personal");
    if (normalizedStep === "biz-afschriften") return renderAfschriften("business");
    if (normalizedStep === "vermogen") return renderVermogen("personal");
    if (normalizedStep === "kapitaal") return renderVermogen("business");
    if (normalizedStep === "focus") return renderFocus(isBusinessView ? "business" : "personal");
    if (normalizedStep === "doelen") return renderFocus(isBusinessView ? "business" : "personal");
    if (normalizedStep === "action") return renderAction("personal");
    if (normalizedStep === "vooruitblik") return renderAction(isBusinessView ? "business" : "personal");
    if (normalizedStep === "backup") return renderBackup();
    return null;
  };

  // Snapshot-first displays (fallback naar bestaande berekeningen zolang niet herbedraad)
  const snapshot = financialSnapshot ?? null;
  const isBusiness = mode === "zakelijk";
  const totalIncomeDisplay = snapshot?.totalIncome?.value ?? (activeNetIncome ?? 0);
  const fixedCostsDisplay = snapshot?.fixedCostsTotal?.value ?? (activeFixedCosts ?? 0);
  const netFreeDisplay = snapshot?.netFree ?? activeNetIncome - activeFixedCosts ?? quickSummary.free ?? 0;
  const totalDebtDisplay = snapshot?.totalDebt ?? activeDebtsSummary.totalDebt ?? 0;
  const assetsTotalDisplay = snapshot?.assetsTotal ?? activeAssetsSummary.totalAssets ?? 0;
  const monthlyPressureDisplay = snapshot?.monthlyPressure ?? activeDebtsSummary.totalMinPayment ?? 0;
  const runwayMonthsDisplay =
    snapshot?.runwayMonths ??
    (activeFixedCosts > 0 && activeAssetsSummary.totalAssets > 0
      ? Math.floor(activeAssetsSummary.totalAssets / activeFixedCosts)
      : null);
  const focusDisplay = snapshot?.focus ? focusLabelMap[snapshot.focus ?? null] : quickSummary.focus;
  const fundamentFilled = activeIncomeItems.length > 0 && activeFixedCostManualItems.length > 0;
  const schuldenFilled = activeDebtsSummary.totalDebt > 0 && activeDebtsSummary.totalMinPayment > 0;
  const vermogenFilled = (activeAssetsSummary.totalAssets ?? 0) > 0;
  const activePayAccountIds = activeAccounts.filter((a) => a.active && a.type === "betaalrekening").map((a) => a.id);
  const rekeningenFilled = activePayAccountIds.length > 0;
  const afschriftenFilled = activeStatements.some((s) => activePayAccountIds.includes(s.accountId));
  const ritmeFilled = false;
  const doelenFilled = activeGoals.length > 0;
  const vooruitblikFilled =
    totalDebtDisplay > 0 ||
    assetsTotalDisplay > 0 ||
    netFreeDisplay !== 0;
  const getStepStatus = (key: StepKey) => {
    const normalized = normalizeStep(key);
    const active = currentStep === key;
    let filled = false;
    switch (normalized) {
      case "strategie":
        filled = intentValid;
        break;
      case "verdienmodel":
        filled = fundamentFilled;
        break;
      case "cashflow":
        filled = fundamentFilled || rekeningenFilled || afschriftenFilled;
        break;
      case "verplichtingen":
        filled = schuldenFilled;
        break;
      case "kapitaal":
        filled = vermogenFilled;
        break;
      case "risico":
        filled = vooruitblikFilled || ritmeFilled;
        break;
      case "doelen":
        filled = doelenFilled;
        break;
    case "vooruitblik":
      filled = vooruitblikFilled;
      break;
      case "intent":
        filled = intentValid;
        break;
      case "fundament":
        filled = fundamentFilled;
        break;
      case "schulden":
        filled = schuldenFilled;
        break;
      case "vermogen":
        filled = vermogenFilled;
        break;
      case "rekeningen":
        filled = rekeningenFilled;
        break;
      case "inbox":
        filled = activeInboxItems.length > 0;
        break;
      case "afschriften":
        filled = afschriftenFilled;
        break;
      case "ritme":
        filled = ritmeFilled;
        break;
      case "focus":
        filled = doelenFilled;
        break;
      case "action":
        filled = vooruitblikFilled;
        break;
      case "backup":
        filled = false;
        break;
      default:
        filled = false;
        break;
    }
    const label = active ? "Actief" : normalized === "inbox" ? "Optioneel" : filled ? "Ingevuld" : "Nog te doen";
    return { active, filled, label };
  };
  const helpCopy: Record<string, string> = {
    intent: "Bepaal je richting: kies strategie, waar de druk zit, tijdpad en hoe AI je mag aanspreken.",
    fundament: "Vul inkomen en vaste lasten in; dit bepaalt je vrije ruimte en betrouwbaarheid van AI-adviezen.",
    schulden: "Voer schulden/verplichtingen in, maanddruk en afschrijfdag. Analyseer later voor strategieën.",
    vermogen: "Voeg vermogen/buffers toe om runway en financiële veerkracht te zien.",
    focus: "Stel doelen/focuspunten voor de komende periode en koppel ze aan je cashflow.",
    rekeningen: "Voeg betaal- en spaarrekeningen toe; actieve rekeningen worden gebruikt voor afschriften.",
    afschriften: "Upload bankafschriften (CSV/XLSX/PDF). AI haalt patronen/potjes uit je uitgaven.",
    inbox: "Bewaar documenten/briefjes die je nog wilt verwerken; houd je financiële inbox bij.",
    action: "Simuleer wat er gebeurt als alles zo blijft; vooruitblik op je koers.",
    backup: "Exporteer of importeer je data lokaal (geen cloud).",
    verplichtingen: "Zakelijke verplichtingen en regelingen; houd de maandlasten en looptijden bij.",
    "biz-afschriften": "Upload zakelijke afschriften; AI haalt patronen uit je zakelijke uitgaven.",
    "biz-rekeningen": "Beheer je zakelijke rekeningen; actieve rekeningen tellen mee voor uploads/analyse.",
    "biz-inbox": "Zakelijke documenten en taken om nog te verwerken.",
    "biz-strategie": "Zakelijke strategie: fase, risico's en doelen.",
    "biz-cashflow": "Inkomend/uitgaand geld, runway en cashflow voor je bedrijf.",
    "biz-kapitaal": "Zakelijk kapitaal/buffer en reserves; inzicht in financiële veerkracht.",
    "biz-vooruitblik": "Scenario als je niets verandert; zicht op risico’s en kansen.",
  };

  return (
    <main
      className={`min-h-screen text-slate-50 ${
        isBusiness
          ? "bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900"
          : "bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950"
      }`}
    >
      <div className="grid min-h-screen grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_320px]">
        <aside
          className={`px-4 py-6 backdrop-blur ${
            isBusiness ? "border-r border-blue-400/20 bg-blue-950/40" : "border-r border-white/10 bg-white/10"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Pad</h2>
            <button
              type="button"
              onClick={() => {
                setHelpMode((prev) => !prev);
              }}
              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-white/40 hover:text-white"
              aria-label="Open hulp tips"
            >
              {helpMode ? "Hulp uit" : "Hulp"}
            </button>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("persoonlijk")}
              className={`flex-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                mode === "persoonlijk"
                  ? "bg-white text-slate-900 border-white"
                  : "bg-white/10 text-slate-200 border-white/20 hover:bg-white/20"
              }`}
            >
              Persoonlijk
            </button>
            <button
              type="button"
              onClick={() => setMode("zakelijk")}
              className={`flex-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                mode === "zakelijk"
                  ? "bg-white text-slate-900 border-white"
                  : "bg-white/10 text-slate-200 border-white/20 hover:bg-white/20"
              }`}
            >
              Zakelijk
            </button>
          </div>
          <div className="space-y-2">
            {activeTabs.map((step) => {
              const unlocked =
                unlockedSteps.includes(step.key) || unlockedSteps.includes(normalizeStep(step.key));
              const isBackup = normalizeStep(step.key) === "backup";
              const { active, label } = getStepStatus(step.key);
              const activeClass = active
                ? isBusiness
                  ? isBackup
                    ? "bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-200 text-slate-950 border border-emerald-200 shadow-md"
                    : "bg-gradient-to-r from-blue-500 via-blue-400 to-amber-300 text-slate-950 border border-amber-200 shadow-md"
                  : isBackup
                  ? "bg-emerald-400/90 text-slate-950 border border-emerald-200 shadow-md"
                  : "bg-amber-500/90 text-slate-950 border border-amber-300 shadow-md"
                : "";
              const inactiveClass = unlocked
                ? isBackup
                  ? "bg-emerald-900/40 text-emerald-100 border border-emerald-400/50 hover:bg-emerald-800/60 hover:border-emerald-200"
                  : isBusiness
                  ? "bg-blue-950/50 text-blue-100 border border-amber-300/40 hover:bg-blue-900/60 hover:border-amber-200"
                  : "bg-amber-900/30 text-amber-100 border border-amber-700 hover:border-amber-500"
                : "cursor-not-allowed bg-white/5 text-slate-500 border border-white/10";
              return (
                <button
                  key={step.key}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => handleStepClick(step.key)}
                  onMouseEnter={(e) => {
                    if (!helpMode) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const norm = normalizeStep(step.key);
                    setHelpTooltip({
                      label: step.label,
                      desc: helpCopy[norm] || step.desc,
                      x: rect.right + 8,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHelpTooltip(null)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${activeClass || inactiveClass}`}
                >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{step.label}</span>
            <span className="text-[10px]">{unlocked ? label : "Nog te doen"}</span>
          </div>
          <p className={`text-[11px] ${active ? "text-slate-900" : "text-slate-400"}`}>{step.desc}</p>
        </button>
      );
    })}
  </div>
</aside>

        <section className="px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Moneylith / Finance OS</p>
              <h1 className="text-2xl font-semibold text-white">Finance Planner</h1>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs ${
                isBusiness ? "bg-blue-500/20 text-amber-100" : "bg-amber-500/20 text-amber-100"
              }`}
            >
              Stap: {activeTabs.find((s) => s.key === currentStep)?.label}
            </div>
          </div>
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-xs ${
              isBusiness
                ? "border-blue-400/40 bg-blue-950/40 text-blue-50"
                : "border-amber-300/50 bg-amber-500/10 text-amber-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              {isBusiness ? (
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Zakelijke modus</p>
                  <p>Tabs richten zich op cashflow, verplichtingen en zakelijk kapitaal. Persoonlijke data blijft apart.</p>
                  <p className="text-[11px] text-slate-200">
                    Verschillen: vaste lasten/inkomen komen uit je zakelijke stromen; strategie en vooruitblik rekenen alleen je zakelijke cijfers.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Persoonlijke modus</p>
                  <p>Focus op privé-inkomen, vaste lasten, schulden, vermogen en doelen. Zakelijke data blijft gescheiden.</p>
                  <p className="text-[11px] text-slate-200">
                    Tip: schakel naar Zakelijk voor bedrijfsfinanciën; beide contexten delen geen data, maar de stappen werken hetzelfde.
                  </p>
                </div>
              )}
              <button
                type="button"
                className={`text-[11px] underline ${isBusiness ? "text-blue-100" : "text-amber-100"}`}
                onClick={() => setHelpMode(false)}
              >
                Verberg
              </button>
            </div>
          </div>
          <div className="space-y-4">{renderContent()}</div>
        </section>

        <aside className="border-l border-white/10 bg-white/10 px-4 py-6 backdrop-blur lg:sticky lg:top-4 lg:h-fit">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">AI gids</h2>
      <AiAssistantCard
        mode={mode === "zakelijk" ? "business" : "personal"}
        actions={mode === "zakelijk" ? aiActionsBusiness : aiActionsPersonal}
        onActionsChange={handleAiActionsChange}
        selectedMonth={selectedMonth}
        currentStep={currentStep}
        selectedFocus={quickSummary.focus}
        userIntent={userIntent}
        debtsTotal={debtsSummary.totalDebt}
        debtsMinPayment={debtsSummary.totalMinPayment}
        debtsCount={debtsSummary.debtCount}
        debtClearMonths={debtClearMonths}
        debtClearMonthsAggressive={debtClearMonthsAggressive}
            debtClearMonthsBuffered={debtClearMonthsBuffered}
            aflosMode={aflosMode}
            bufferMonthlyReserve={bufferMonthlyReserve}
            bufferTargetMonths={bufferTargetMonths}
            assetsTotal={assetsSummary.totalAssets}
            assetsCount={assetsSummary.assetsCount}
            assetMonthlyContribution={assetMonthlyContribution}
            assetTarget={assetTarget}
            assetTargetMonths={assetTargetMonths}
        fixedCostPressure={fixedCostPressure}
        runwayMonths={runwayMonths}
        fixedCosts={fixedCosts}
        financialSnapshot={financialSnapshot}
        allowProactiveSavingsAdvice={financialSnapshot?.optimizeCosts ?? userIntent.optimizeCosts ?? false}
        observation={observation}
      />
    </aside>
  </div>
      {helpTooltip && helpMode && (
        <div
          className="pointer-events-none fixed z-[99] max-w-xs rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-lg"
          style={{ top: helpTooltip.y, left: helpTooltip.x }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{helpTooltip.label}</div>
          <div className="text-amber-900">{helpTooltip.desc}</div>
        </div>
      )}

      {showOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur">
          <div className="card-shell w-full max-w-3xl p-6 text-slate-900">
            <h3 className="text-lg font-semibold text-slate-900">Totaaloverzicht</h3>
            <p className="text-sm text-slate-700">
              Maand {selectedMonth}  Focus: {focusDisplay || "nog niet gekozen"}
            </p>

            <div className="mt-4 grid gap-3 text-sm text-slate-800 md:grid-cols-2">
              <div className="rounded-xl border border-white/30 bg-white/85 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Fundament</p>
                <p>
                  Inkomen: EUR {totalIncomeDisplay.toFixed(0)}{" "}
                  {snapshot?.totalIncome ? `(bron: ${snapshot.totalIncome.source})` : ""}
                </p>
                <p>
                  Vaste lasten: EUR {fixedCostsDisplay.toFixed(0)}{" "}
                  {snapshot?.fixedCostsTotal ? `(bron: ${snapshot.fixedCostsTotal.source})` : ""}
                </p>
                <p>Vrij te besteden: EUR {netFreeDisplay.toFixed(0)}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/85 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Schulden</p>
                <p>Totaal: EUR {totalDebtDisplay.toFixed(0)}</p>
                <p>Min. maandlast: EUR {monthlyPressureDisplay.toFixed(0)}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/85 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Vermogen</p>
                <p>Totaal: EUR {assetsTotalDisplay.toFixed(0)}</p>
                <p>Runway: {runwayMonthsDisplay !== null ? `${runwayMonthsDisplay} maanden` : "Nog niet berekend"}</p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/85 p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">Koers</p>
                <p>Status: {quickSummary.status}</p>
                <p>Pad: {monthFocus ? `${focusDisplay}  vooruitblik` : "Nog geen pad gekozen"}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:shadow-md"
                onClick={() => setShowOverview(false)}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {isFixedCostsWizardOpen && (
        <FixedCostsWizard
          items={mergedFixedCostItems}
          onChange={setFixedCostItems}
          onClose={() => setIsFixedCostsWizardOpen(false)}
        />
      )}

      {!introSeen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur">
          <div className="card-shell max-w-3xl w-full p-8 text-slate-900">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <img src={LogoFull} alt="Moneylith logo" className="h-24 w-auto drop-shadow-xl" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Welkom bij Moneylith</h2>
                  <p className="text-sm text-slate-600">
                    Local-first financieel kompas: breng je inkomsten, vaste lasten, schulden en patronen in kaart. AI helpt alleen met analyse; jouw data blijft lokaal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIntroSeen(true)}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-amber-400"
              >
                Start
              </button>
            </div>
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-base font-semibold text-slate-900">Wat je hier doet</h3>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Leg je intentie vast en check je fundament (inkomen & vaste lasten).</li>
                  <li>Voer schulden/verplichtingen in en zie direct de maanddruk.</li>
                  <li>Upload afschriften om patronen/potjes te vinden (geen cloud, alles lokaal).</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                <h3 className="text-base font-semibold text-slate-900">Belangrijk om te weten</h3>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li>Local-first: geen server-side opslag; exporteer/backup zelf.</li>
                  <li>AI analyseert maar beslist niets voor je; je invoer blijft leidend.</li>
                  <li>Schakel hulpmodus in voor uitleg per tabblad (vraagteken-cursor).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-6 border-t border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 flex flex-wrap gap-3 justify-center">
        <a href="/privacy" className="hover:text-white underline-offset-4 hover:underline">
          Privacy
        </a>
        <span className="text-slate-500">•</span>
        <a href="/disclaimer" className="hover:text-white underline-offset-4 hover:underline">
          Disclaimer
        </a>
        <span className="text-slate-500">•</span>
        <a href="/terms" className="hover:text-white underline-offset-4 hover:underline">
          Voorwaarden
        </a>
        <span className="text-slate-500">•</span>
        <a href="/cookies" className="hover:text-white underline-offset-4 hover:underline">
          Cookies
        </a>
        <span className="text-slate-500">•</span>
        <a href="/status" className="hover:text-white underline-offset-4 hover:underline">
          Status
        </a>
      </footer>
      <CookieBanner />
      <AnalyticsGate />
    </main>
  );
};

export default App;
