import type {
  LunchAccount,
  LunchFailure,
  LunchSnapshot,
  LunchTransaction,
  Result,
} from "../../src/bank/lunchflowTypes";
import { maskedAccount } from "../../src/bank/lunchflowTypes";
export class LunchError extends Error {
  constructor(public detail: LunchFailure) {
    super(detail.message);
  }
}
const fail = (
  code: LunchFailure["code"],
  message: string,
  httpStatus?: number,
): never => {
  throw new LunchError({ code, message, httpStatus });
};
export const safeFailure = (e: unknown): LunchFailure =>
  e instanceof LunchError
    ? e.detail
    : {
        code: "network",
        message: "Lunch Flow is niet bereikbaar. Probeer later opnieuw.",
      };
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    return fail("format", "Onverwacht responseformaat van Lunch Flow.");
  return v as Record<string, unknown>;
};
const str = (v: unknown) =>
  typeof v === "string"
    ? v
    : fail("format", "Een verplicht tekstveld ontbreekt.");
const id = (v: unknown) =>
  (typeof v === "string" && v.length > 0) ||
  (typeof v === "number" && Number.isSafeInteger(v))
    ? String(v)
    : fail("format", "Een stabiele identificatie ontbreekt.");
const currency = (v: unknown) =>
  typeof v === "string" && /^[A-Z]{3}$/.test(v)
    ? v
    : fail("format", "Valuta ontbreekt of is ongeldig.");
export function money(v: unknown): number {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    !Number.isSafeInteger(Math.round(v * 100)) ||
    Math.abs(v * 100 - Math.round(v * 100)) > 0.00001
  )
    return fail(
      "format",
      "Ongeldig geldbedrag; gegevens zijn niet geïmporteerd.",
    );
  return Math.round(v * 100) / 100;
}
function list(payload: unknown, key: string): unknown[] {
  const p = obj(payload),
    rows = p[key];
  // No pagination parameters or cursors are documented. Fail closed if a response is incomplete.
  if (
    !Array.isArray(rows) ||
    !Number.isInteger(p.total) ||
    p.total !== rows.length ||
    p.next ||
    p.next_cursor ||
    p.has_more === true
  )
    return fail(
      "format",
      "Onvolledige lijst of onbekende paginering; niets uit dit endpoint geïmporteerd.",
    );
  return rows;
}
export class LunchClient {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
  ) {}
  private async get(path: string) {
    if (!this.key.trim())
      return fail(
        "configuration",
        "Vul LUNCHFLOW_API_KEY in het lokale .env-bestand in en herstart de server.",
      );
    let r: Response;
    try {
      r = await this.request("https://lunchflow.app/api/v1" + path, {
        headers: { "x-api-key": this.key, Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
        redirect: "manual",
      });
    } catch {
      return fail("network", "Netwerkfout of time-out bij Lunch Flow.");
    }
    if ([301, 302, 307, 308].includes(r.status)) {
      const target = new URL("https://www.lunchflow.app/api/v1" + path);
      if (r.headers.get("location") !== target.href)
        return fail("provider", "Onverwachte API-redirect geweigerd.");
      try {
        r = await this.request(target.href, {
          headers: { "x-api-key": this.key, Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
          redirect: "error",
        });
      } catch {
        return fail("network", "Netwerkfout of time-out bij Lunch Flow.");
      }
    }
    if (!r.ok) {
      // Only inspect for reconnection signals; never forward/log upstream response content.
      const body = await r.json().catch(() => ({}));
      const signal = JSON.stringify(body);
      if (/reconnect|reauth|connection_expired|consent_expired/i.test(signal))
        return fail(
          "reconnect",
          "Koppel deze rekening opnieuw in Lunch Flow en probeer daarna opnieuw.",
          r.status,
        );
      if (r.status === 401)
        return fail(
          "invalid_key",
          "Lunch Flow weigert de API-sleutel (401).",
          401,
        );
      if (r.status === 403)
        return fail(
          "forbidden",
          "Lunch Flow geeft geen toegang tot deze gegevens (403).",
          403,
        );
      if (r.status === 429)
        return fail(
          "rate_limit",
          "Lunch Flow heeft het verzoeklimiet bereikt. Wacht en probeer later opnieuw.",
          429,
        );
      return fail(
        "provider",
        "Lunch Flow kan deze gegevens momenteel niet leveren.",
        r.status,
      );
    }
    try {
      return await r.json();
    } catch {
      return fail("format", "Lunch Flow gaf geen geldige JSON terug.");
    }
  }
  async accounts(): Promise<LunchAccount[]> {
    const accounts = list(await this.get("/accounts"), "accounts").map((v) => {
      const a = obj(v),
        accountId = id(a.id);
      const institution = str(a.institution_name);
      return {
        id: accountId,
        label: `${institution} ${maskedAccount(accountId)}`,
        institution,
        currency: a.currency == null ? undefined : currency(a.currency),
        status: str(a.status),
        upstream: str(a.provider),
      };
    });
    if (new Set(accounts.map((a) => a.id)).size !== accounts.length)
      return fail("format", "Dubbele rekeningidentificatie ontvangen.");
    return accounts;
  }
  async balance(accountId: string) {
    const b = obj(
      obj(await this.get(`/accounts/${encodeURIComponent(accountId)}/balance`))
        .balance,
    );
    return { amount: money(b.amount), currency: currency(b.currency) };
  }
  async transactions(accountId: string): Promise<LunchTransaction[]> {
    const transactions = list(
      await this.get(
        `/accounts/${encodeURIComponent(accountId)}/transactions?include_pending=false`,
      ),
      "transactions",
    ).map((v) => {
      const t = obj(v),
        date = str(t.date);
      if (
        id(t.accountId) !== accountId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        t.isPending === true
      )
        return fail(
          "format",
          "Onverwachte rekening, datum of voorlopige transactie.",
        );
      return {
        id: id(t.id),
        accountId,
        amount: money(t.amount),
        currency: currency(t.currency),
        date,
        description: t.description == null ? "" : str(t.description),
        merchant: t.merchant == null ? undefined : str(t.merchant),
      };
    });
    if (new Set(transactions.map((t) => t.id)).size !== transactions.length)
      return fail("format", "Dubbele transactie-identificatie ontvangen.");
    return transactions;
  }
  async snapshot(account: LunchAccount): Promise<LunchSnapshot> {
    const attempt = async <T>(fn: () => Promise<T>): Promise<Result<T>> => {
      try {
        return { ok: true, value: await fn() };
      } catch (e) {
        return { ok: false, error: safeFailure(e) };
      }
    };
    if (account.status !== "ACTIVE") {
      const error: LunchFailure = {
        code: "reconnect",
        message:
          "Deze rekening is niet actief. Controleer de verbinding en koppel zo nodig opnieuw in Lunch Flow.",
      };
      return {
        account,
        balance: { ok: false, error },
        transactions: { ok: false, error },
        fetchedAt: new Date().toISOString(),
      };
    }
    const balance = await attempt(() => this.balance(account.id));
    const transactions = await attempt(() => this.transactions(account.id));
    return {
      account,
      balance,
      transactions,
      fetchedAt: new Date().toISOString(),
    };
  }
}
