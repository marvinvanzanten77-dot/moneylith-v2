export type MonthId = string; // "2025-12", "2026-01", etc.

export interface MonthLimit {
  month: MonthId;
  limit: number;
}

export interface PotjeDef {
  id: string; // bv "snacks"
  label: string; // vrij veld, kan leeg of generiek
  description?: string;
  limits: MonthLimit[]; // maand -> limiet in euro
  categoryKey: string; // verwijzing naar algemene categorie
  customName?: string; // optioneel eigen naam/thema
}

export interface SchuldenPlanItem {
  id: string;
  month: MonthId; // "2025-12" etc.
  labelMaand: string; // "dec 2025" etc.
  focusSchuld: string;
  doelBedrag: number;
  beschrijving: string;
  debtId?: string;
}

export interface FixedCostManualItem {
  costGroup?: "work-tools";
  costKind?: "subscription" | "credits";
  bankPaymentFrom?: string; // Explicit earliest booking date for the currently expected bill; earlier salary periods remain historical.
  monthlyVariable?: boolean;
  monthlyAmounts?: Record<string, number | null>; // Explicit amounts per YYYY-MM; absent is unknown.
  reviewedInput?: string;
  paymentRoute?: "bank" | "card" | "cash" | "third-party" | "withheld";
  amountRange?: { min: number; max: number };
  budgetCategory?: string;
  budgetSince?: string; // YYYY-MM; budgets never rewrite earlier months.
  budgetEvidence?: { months: string[]; average: number };

  bankEvidence?: import("./bank/financialImport").BankEvidence;
  amountEntered?: boolean;
  id: string;
  naam: string;
  bedrag: number;
  dagVanMaand: number; // 1-31
  opmerking?: string;
}

export type SchuldItem = {
  bankRepayment?: import("./bank/debtPayments").RepaymentRule;
  id: string;
  naam: string;
  crediteur?: string;
  openBedrag: number;
  minBetaling?: number;
  saldo?: number;
  minimaleMaandlast?: number;
  prioriteit?: number;
  notitie?: string;
  gebruikerOpmerking?: string;
  aiOpmerking?: string;
  firstPaymentDate?: string; // First remaining payment, YYYY-MM-DD
  remainingPayments?: number;
  afschrijfDag?: number; // 0-31 (0 = geen vaste dag)
};

// Canonical moneylith transaction/bucket types
export type MoneylithTransaction = {
  id: string;
  accountId: string;
  date: string; // ISO 'YYYY-MM-DD'
  amount: number; // + = inkomen, - = uitgave
  description: string;
  counterparty?: string;
  category?: string | null;
  external_id?: string;
  currency?: string;
  provider?: "lunchflow" | "bunq";
  providerAccountId?: string;
  providerTransactionId?: string;
  bankRuleId?: string;
  bankRuleLabel?: string;
  bankPatternCategory?: string;
  bankPatternKind?: import("./bank/patterns").PatternKind;
  notes?: string;
  providerData?: { counterpartyIban?: string; paymentSubType?: string; description: string; counterparty?: string; amount: number; date: string };
  source?: "bank" | "csv" | "manual" | "inbox";
};

// Backward compatibility alias
export type Transaction = MoneylithTransaction;

export type MoneylithBucketType = "income" | "fixed" | "variable" | "other";

export type MoneylithBucket = {
  id: string;
  label: string;
  type: MoneylithBucketType;
  monthlyAvg: number;
  lastAmount: number;
  recurring: boolean;
  sampleTransactions: string[];
  userLocked?: boolean;
};

export type SnapshotSource = "manual" | "transactions" | "buckets";

export type SnapshotField = {
  value: number;
  source: SnapshotSource;
};

export type FixedCostItem = {
  id: string;
  descriptionPattern: string;
  averageAmount: number;
  estimatedMonthlyAmount: number;
  frequency: "monthly" | "weekly" | "yearly" | "unknown";
  sampleCount: number;
  lastDate: string;
  isFixed: boolean;
  isIgnored: boolean;
  customLabel?: string;
  customMonthlyAmount?: number;
};

export type IncomeItem = {
  reviewedInput?: string;
  followLatestBank?: boolean;
  payrollDeductions?: Record<string, number | null>; // Informational only: already deducted from received income.

  bankEvidence?: import("./bank/financialImport").BankEvidence;
  dagVanMaand?: number; // Optional expected receipt day; absent remains unknown.
  amountEntered?: boolean;
  id: string;
  naam: string;
  bedrag: number;
  opmerking?: string;
};

export type FutureIncomeItem = {
  id: string;
  naam: string;
  bedrag: number;
  datum: string; // ISO date (YYYY-MM-DD)
  opmerking?: string;
};

export type UserIntent = {
  optimizeCosts?: boolean;
  primaryGoal:
    | "schulden_verminderen"
    | "buffer_opbouwen"
    | "inkomen_verhogen"
    | "stabiliseren"
    | "vermogen_groeien"
    | null;
  mainPressure: ("schulden" | "vaste_lasten" | "inkomen_onzeker" | "geen_buffer")[]; // multi-select
  timeHorizon: "3_maanden" | "1_jaar" | "5_jaar" | null;
  aiStyle: "spiegelend" | "confronterend" | "ondersteunend" | null;
};

export type MonthFocus = "schulden_afbouwen" | "vermogen_opbouwen" | "overleven" | "experiment" | null;

export type FinancialSnapshot = {
  totalIncome: SnapshotField;
  fixedCostsTotal: SnapshotField;
  netFree: number;
  totalDebt: number;
  assetsTotal: number;
  monthlyPressure: number;
  runwayMonths: number | null;
  intent?: UserIntent | null;
  focus?: MonthFocus | null;
  assetTarget?: number | null;
  assetMonthlyContribution?: number | null;
  assetTargetMonths?: number | null;
};

export type AccountType = "betaalrekening" | "spaarrekening" | "contant";

export interface MoneylithAccount {
  id: string;
  name: string;
  type: AccountType;
  iban?: string;
  description?: string;
  isPrimary?: boolean;
  startBalance?: number;
  currency?: string;
  bankProvider?: "lunchflow" | "bunq";
  bankAccountId?: string;
  bankBalance?: number;
  bankBalanceFetchedAt?: string;
  bankLastSync?: string;
  active: boolean;
  source?: "bank" | "manual";
}

export interface AccountStatementMeta {
  id: string;
  accountId: string;
  month: number; // 1-12
  year: number;  // 4-cijferig
  fileName?: string;
  uploadedAt: string; // ISO
}

export type GoalType = "debt_payoff" | "savings" | "buffer" | "project";

export type MoneylithGoal = {
  id: string;
  label: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO 'YYYY-MM-DD'
  monthlyContribution: number;
  linkedBucketIds?: string[];
  isActive: boolean;
};

// Parallel domein-structuren voor personal en business (fase 2A voorbereiding)
export type FinanceMode = "personal" | "business";

export type FinanceDomainState = {
  income: IncomeItem[];
  fixedCostManualItems: FixedCostManualItem[];
  fixedCostItems: FixedCostItem[];
  debts: SchuldItem[];
  assets: any[]; // AssetItem staat lokaal in App.tsx; hier generiek houden voor compatibiliteit
  goals: MoneylithGoal[];
  transactions: MoneylithTransaction[];
  buckets: MoneylithBucket[];
  statements: AccountStatementMeta[];
  accounts: MoneylithAccount[];
  snapshot: FinancialSnapshot | null;
};

export type FinanceRootState = {
  personal: FinanceDomainState;
  business: FinanceDomainState;
};
