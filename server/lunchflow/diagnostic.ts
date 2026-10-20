import type { LunchClient } from "./client.js";
import type { LunchDiagnostic } from "../../src/bank/lunchflowTypes";
export async function testConnection(
  client: LunchClient,
): Promise<LunchDiagnostic> {
  const accounts = await client.accounts();
  const checks: LunchDiagnostic["checks"] = [];
  for (const account of accounts) {
    const s = await client.snapshot(account);
    checks.push({
      label: account.label,
      status: account.status,
      balance: s.balance.ok
        ? { ok: true }
        : { ok: false, error: s.balance.error },
      transactions: s.transactions.ok
        ? { ok: true, count: s.transactions.value.length }
        : { ok: false, error: s.transactions.error },
    });
  }
  return {
    accountCount: accounts.length,
    checks,
    testedAt: new Date().toISOString(),
  };
}
