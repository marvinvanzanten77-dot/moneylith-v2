import "dotenv/config";
import { mergeLunchflow } from "../src/bank/lunchflowMerge";
import type { LunchSnapshot } from "../src/bank/lunchflowTypes";
import { LunchClient, safeFailure } from "../server/lunchflow/client";
const client = new LunchClient(process.env.LUNCHFLOW_API_KEY ?? "");
try {
  const accounts = await client.accounts();
  console.log(
    JSON.stringify({ endpoint: "accounts", ok: true, count: accounts.length }),
  );
  const snapshots: LunchSnapshot[] = [];
  for (const account of accounts) {
    const result = await client.snapshot(account);
    snapshots.push(result);
    console.log(
      JSON.stringify({
        account: account.label,
        status: account.status,
        balance: result.balance.ok
          ? { ok: true }
          : { ok: false, ...result.balance.error },
        transactions: result.transactions.ok
          ? { ok: true, count: result.transactions.value.length }
          : { ok: false, ...result.transactions.error },
      }),
    );
    if (!result.balance.ok || !result.transactions.ok) process.exitCode = 1;
  }
  const mappings = accounts.map((a) => ({ providerId: a.id, targetId: "new" }));
  const first = mergeLunchflow([], [], snapshots, mappings);
  if (first.transactions[0])
    Object.assign(first.transactions[0], {
      category: "verification-category",
      notes: "verification-note",
      description: "verification-edit",
    });
  const before = JSON.stringify(first.transactions);
  const second = mergeLunchflow(
    first.accounts,
    first.transactions,
    snapshots,
    mappings,
  );
  const passed =
    before === JSON.stringify(second.transactions) &&
    second.reports.every((r) => r.added === 0);
  console.log(
    JSON.stringify({
      verification: "real-data-double-import-in-memory",
      ok: passed,
      accounts: second.accounts.length,
      transactions: second.transactions.length,
      manualEnrichmentsPreserved: passed,
      persisted: false,
    }),
  );
  if (!passed) process.exitCode = 1;
} catch (e) {
  console.log(JSON.stringify({ ok: false, ...safeFailure(e) }));
  process.exitCode = 1;
}
