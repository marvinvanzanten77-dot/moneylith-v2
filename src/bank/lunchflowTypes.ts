export type LunchAccount = {
  iban?: string;
  id: string;
  label: string;
  institution: string;
  currency?: string;
  status: string;
  upstream: string;
};
export type LunchTransaction = {
  counterpartyIban?: string;
  paymentSubType?: string;
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  merchant?: string;
};
export type LunchErrorCode =
  | "configuration"
  | "invalid_key"
  | "forbidden"
  | "rate_limit"
  | "network"
  | "format"
  | "reconnect"
  | "provider"
  | "currency"
  | "local_only";
export type LunchFailure = {
  code: LunchErrorCode;
  message: string;
  httpStatus?: number;
};
export type Result<T> =
  { ok: true; value: T } | { ok: false; error: LunchFailure };
export type LunchSnapshot = {
  account: LunchAccount;
  balance: Result<{ amount: number; currency: string }>;
  transactions: Result<LunchTransaction[]>;
  fetchedAt: string;
};
export type LunchSync = { results: LunchSnapshot[] };
export const maskedAccount = (id: string) => `••••${id.slice(-2)}`;

export type LunchDiagnostic = {
  accountCount: number;
  testedAt: string;
  checks: Array<{
    label: string;
    status: string;
    balance: { ok: true } | { ok: false; error: LunchFailure };
    transactions:
      { ok: true; count: number } | { ok: false; error: LunchFailure };
  }>;
};
