export type SnapshotAiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts?: number;
};

export type MoneylithSnapshotDomain = {
  accounts?: unknown[];
  transactions?: unknown[];
  income?: unknown;
  fixedCosts?: unknown;
  debts?: unknown;
  assets?: unknown;
  goals?: unknown;
  statements?: unknown;
  inbox?: unknown;
  aiBuckets?: unknown;
  fuelOverrides?: unknown;
};

export type MoneylithSnapshot = {
  meta: {
    selectedMonth?: string;
    monthFocus?: string | null;
    bank: { connected: boolean; lastSyncAt?: string };
  };
  personal: MoneylithSnapshotDomain;
  business: MoneylithSnapshotDomain;
  ai: {
    messages: SnapshotAiMessage[];
    analysisRaw?: unknown;
    analysisRawBusiness?: unknown;
  };
};

export type BuildInput = {
  meta?: Partial<MoneylithSnapshot["meta"]>;
  personal?: MoneylithSnapshotDomain;
  business?: MoneylithSnapshotDomain;
  ai?: {
    messages?: Array<{ id?: string; role?: "user" | "assistant" | "system"; content?: string; ts?: number }>;
    analysisRaw?: unknown;
    analysisRawBusiness?: unknown;
  };
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asString = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

const normalizeDomain = (domain?: MoneylithSnapshotDomain): MoneylithSnapshotDomain => ({
  accounts: asArray(domain?.accounts),
  transactions: asArray(domain?.transactions),
  income: domain?.income ?? [],
  fixedCosts: domain?.fixedCosts ?? [],
  debts: asArray(domain?.debts),
  assets: asArray(domain?.assets),
  goals: asArray(domain?.goals),
  statements: asArray(domain?.statements),
  inbox: asArray(domain?.inbox),
  aiBuckets: asArray(domain?.aiBuckets),
  fuelOverrides: asObject(domain?.fuelOverrides),
});

const normalizeMessages = (
  messages?: Array<{ id?: string; role?: "user" | "assistant" | "system"; content?: string; ts?: number }>,
): SnapshotAiMessage[] => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m, idx) => {
      const role: SnapshotAiMessage["role"] = m?.role === "assistant" || m?.role === "system" ? m.role : "user";
      return {
        id: asString(m?.id) ?? `msg-${idx}`,
        role,
        content: typeof m?.content === "string" ? m.content : "",
        ts: typeof m?.ts === "number" ? m.ts : undefined,
      };
    })
    .filter((m) => m.content.length > 0);
};

export function buildMoneylithSnapshot(input: BuildInput): MoneylithSnapshot {
  return {
    meta: {
      selectedMonth: asString(input.meta?.selectedMonth),
      monthFocus: (input.meta?.monthFocus as string | null | undefined) ?? null,
      bank: {
        connected: Boolean(input.meta?.bank?.connected),
        lastSyncAt: asString(input.meta?.bank?.lastSyncAt),
      },
    },
    personal: normalizeDomain(input.personal),
    business: normalizeDomain(input.business),
    ai: {
      messages: normalizeMessages(input.ai?.messages),
      analysisRaw: input.ai?.analysisRaw,
      analysisRawBusiness: input.ai?.analysisRawBusiness,
    },
  };
}
