import test from "node:test";
import assert from "node:assert/strict";
import { LunchClient, safeFailure, money } from "../server/lunchflow/client";
import { allowLocal } from "../server/lunchflow/localPlugin";
import { mergeLunchflow, persistLunchflow } from "../src/bank/lunchflowMerge";
import type { LunchSnapshot } from "../src/bank/lunchflowTypes";
import type { MoneylithAccount, MoneylithTransaction } from "../src/types";
const account = {
  id: "1",
  label: "ING ••••01",
  institution: "ING",
  status: "ACTIVE",
  upstream: "gocardless",
};
const snapshot = (id = "1"): LunchSnapshot => ({
  account: { ...account, id },
  balance: { ok: true, value: { amount: 123.45, currency: "EUR" } },
  transactions: {
    ok: true,
    value: [
      {
        id: "t",
        accountId: id,
        date: "2026-10-01",
        amount: -12.34,
        currency: "EUR",
        description: "Provider text",
        merchant: "Shop",
      },
    ],
  },
  fetchedAt: "2026-10-19T10:00:00.000Z",
});
const mocked =
  (data: unknown, status = 200): typeof fetch =>
  async () =>
    new Response(JSON.stringify(data), { status });
const code = async (fn: () => unknown) => {
  try {
    await fn();
    assert.fail("expected failure");
  } catch (e) {
    return safeFailure(e).code;
  }
};
test("Lunch Flow configuration, auth, access, rate, network and format failures stay distinct and sanitized", async () => {
  assert.equal(
    await code(() => new LunchClient("").accounts()),
    "configuration",
  );
  for (const [status, expected] of [
    [401, "invalid_key"],
    [403, "forbidden"],
    [429, "rate_limit"],
    [503, "provider"],
  ] as const)
    assert.equal(
      await code(() =>
        new LunchClient(
          "secret",
          mocked({ message: "sensitive data" }, status),
        ).accounts(),
      ),
      expected,
    );
  assert.equal(
    await code(() =>
      new LunchClient("key", async () => {
        throw Error("secret data");
      }).accounts(),
    ),
    "network",
  );
  assert.equal(
    await code(() =>
      new LunchClient("key", mocked({ accounts: [], total: 1 })).accounts(),
    ),
    "format",
  );
  assert.equal(
    await code(() =>
      new LunchClient(
        "key",
        mocked({ error: "CONNECTION_EXPIRED" }, 403),
      ).balance("1"),
    ),
    "reconnect",
  );
});
test("documented endpoints and header; account currency may be absent; pending excluded; no invented paging", async () => {
  const calls: string[] = [];
  const client = new LunchClient("test-key", async (url, init) => {
    const path = String(url);
    calls.push(path);
    assert.equal(
      (init?.headers as Record<string, string>)["x-api-key"],
      "test-key",
    );
    if (path.endsWith("/accounts"))
      return new Response(
        JSON.stringify({
          accounts: [
            {
              id: 1,
              name: "private",
              institution_name: "ING",
              provider: "gocardless",
              status: "ACTIVE",
            },
          ],
          total: 1,
        }),
      );
    if (path.endsWith("/balance"))
      return new Response(
        JSON.stringify({ balance: { amount: 0, currency: "EUR" } }),
      );
    return new Response(
      JSON.stringify({
        transactions: [
          {
            id: "x",
            accountId: 1,
            amount: -0.29,
            currency: "EUR",
            date: "2026-10-01",
            description: "test",
            isPending: false,
          },
        ],
        total: 1,
      }),
    );
  });
  const [a] = await client.accounts();
  assert.equal(a.currency, undefined);
  assert.ok(!JSON.stringify(a).includes("private"));
  const s = await client.snapshot(a);
  assert.equal(s.balance.ok, true);
  assert.equal(s.transactions.ok, true);
  assert.match(calls[2], /transactions\?include_pending=false$/);
  assert.equal(money(0.29), 0.29);
  assert.throws(() => money(0.001));
});
test("only documented canonical www redirect is followed, keys never sent to another host", async () => {
  let count = 0;
  const client = new LunchClient("key", async (url) => {
    count++;
    return count === 1
      ? new Response(null, {
          status: 308,
          headers: { location: "https://evil.example/accounts" },
        })
      : new Response("{}");
  });
  assert.equal(await code(() => client.accounts()), "provider");
  assert.equal(count, 1);
});
test("transactions reject incomplete lists, unknown paging, duplicate IDs, wrong accounts, malformed dates and pending rows", async () => {
  const row = {
    id: "t",
    accountId: 1,
    amount: 1,
    currency: "EUR",
    date: "2026-10-01",
    description: "x",
  };
  for (const payload of [
    { transactions: [row], total: 2 },
    { transactions: [row], total: 1, next_cursor: "more" },
    { transactions: [row, row], total: 2 },
    ...[
      { accountId: 2 },
      { date: "2026-02-30" },
      { isPending: true },
      { amount: null },
    ].map((p) => ({ transactions: [{ ...row, ...p }], total: 1 })),
  ]) {
    assert.equal(
      await code(() =>
        new LunchClient("key", mocked(payload)).transactions("1"),
      ),
      "format",
    );
  }
});
test("balance and transactions checked separately, inactive accounts ask for reconnect", async () => {
  const client = new LunchClient("key", async (url) =>
    String(url).endsWith("/balance")
      ? new Response("{}", { status: 503 })
      : new Response(JSON.stringify({ transactions: [], total: 0 })),
  );
  const s = await client.snapshot(account);
  assert.equal(s.balance.ok, false);
  assert.equal(s.transactions.ok, true);
  const inactive = await client.snapshot({ ...account, status: "EXPIRED" });
  assert.equal(inactive.balance.ok, false);
  if (!inactive.balance.ok)
    assert.equal(inactive.balance.error.code, "reconnect");
});
test("local guard rejects deployments, remote clients, foreign origins, rebinding, proxy and missing custom header", () => {
  const req = {
    method: "POST",
    headers: {
      host: "127.0.0.1:5173",
      origin: "http://127.0.0.1:5173",
      "x-moneylith-local": "1",
    },
    socket: { remoteAddress: "127.0.0.1" },
  };
  assert.equal(allowLocal(req, false), true);
  assert.equal(allowLocal(req, true), false);
  assert.equal(
    allowLocal({ ...req, socket: { remoteAddress: "192.168.1.2" } }, false),
    false,
  );
  for (const patch of [
    { origin: "https://evil.example" },
    { host: "evil.example:5173", origin: "http://evil.example:5173" },
    { "x-moneylith-local": undefined },
    { "x-forwarded-for": "127.0.0.1" },
    { origin: undefined },
  ])
    assert.equal(
      allowLocal({ ...req, headers: { ...req.headers, ...patch } }, false),
      false,
    );
});
test("explicit mapping reuses manual account, repeated import is idempotent and preserves user enrichments", () => {
  const accounts: MoneylithAccount[] = [
    {
      id: "manual",
      name: "My bank",
      active: true,
      type: "spaarrekening",
      startBalance: 100,
      description: "My note",
      source: "manual",
    },
  ];
  const unrelated: MoneylithTransaction = {
    id: "manual-tx",
    accountId: "manual",
    date: "2026-10-01",
    amount: 10,
    description: "Keep me",
    source: "manual",
  };
  const originals = JSON.stringify({ accounts, unrelated });
  const mapping = [{ providerId: "1", targetId: "manual" }];
  const first = mergeLunchflow(accounts, [unrelated], [snapshot()], mapping);
  assert.equal(first.accounts.length, 1);
  assert.equal(first.accounts[0].startBalance, 100);
  assert.equal(first.accounts[0].bankBalance, 123.45);
  assert.equal(first.accounts[0].name, "My bank");
  Object.assign(first.transactions[1], {
    category: "Manual category",
    notes: "My note",
    description: "Edited",
    counterparty: "Edited merchant",
    amount: -10,
    date: "2026-10-02",
  });
  const second = mergeLunchflow(
    first.accounts,
    first.transactions,
    [snapshot()],
    mapping,
  );
  assert.equal(second.transactions.length, 2);
  assert.equal(second.reports[0].added, 0);
  assert.equal(second.reports[0].updated, 0);
  assert.deepEqual(second.transactions, first.transactions);
  assert.equal(JSON.stringify({ accounts, unrelated }), originals);
});
test("transaction IDs are namespaced by provider account and no auto matching occurs", () => {
  const result = mergeLunchflow(
    [],
    [],
    [snapshot("1"), snapshot("2")],
    [
      { providerId: "1", targetId: "new" },
      { providerId: "2", targetId: "new" },
    ],
  );
  assert.equal(result.accounts.length, 2);
  assert.equal(new Set(result.transactions.map((t) => t.id)).size, 2);
  assert.throws(() =>
    mergeLunchflow(
      result.accounts,
      result.transactions,
      [snapshot("1")],
      [{ providerId: "1", targetId: "missing" }],
    ),
  );
  assert.throws(() =>
    mergeLunchflow(
      [{ id: "manual", name: "X", type: "betaalrekening", active: true }],
      [],
      [snapshot("1"), snapshot("2")],
      [
        { providerId: "1", targetId: "manual" },
        { providerId: "2", targetId: "manual" },
      ],
    ),
  );
});
test("partial failure leaves failed account and last success untouched while committing successful account", () => {
  const first = mergeLunchflow(
    [],
    [],
    [snapshot("1"), snapshot("2")],
    [
      { providerId: "1", targetId: "new" },
      { providerId: "2", targetId: "new" },
    ],
  );
  const bad = snapshot("2");
  bad.balance = { ok: false, error: { code: "network", message: "retry" } };
  bad.fetchedAt = "2026-10-20T00:00:00Z";
  const good = snapshot("1");
  good.fetchedAt = "2026-10-20T00:00:00Z";
  const second = mergeLunchflow(
    first.accounts,
    first.transactions,
    [good, bad],
    [
      { providerId: "1", targetId: first.accounts[0].id },
      { providerId: "2", targetId: first.accounts[1].id },
    ],
  );
  assert.deepEqual(second.accounts[1], first.accounts[1]);
  assert.equal(second.accounts[0].bankLastSync, good.fetchedAt);
  assert.equal(second.reports[1].ok, false);
});
test("foreign currencies never enter euro financial models", () => {
  const s = snapshot();
  s.balance = { ok: true, value: { amount: 1, currency: "USD" } };
  const result = mergeLunchflow(
    [],
    [],
    [s],
    [{ providerId: "1", targetId: "new" }],
  );
  assert.equal(result.accounts.length, 0);
  assert.equal(result.transactions.length, 0);
  assert.equal(result.reports[0].ok, false);
});
test("persistence uses only personal keys and restores previous data if transaction write fails", () => {
  const map = new Map<string, string>([
    ["moneylith.personal.accounts", "[]"],
    ["moneylith.personal.transactions", "[]"],
    ["moneylith.business.real.v1", "unchanged"],
  ]);
  let fail = true;
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === "moneylith.personal.transactions" && fail) {
        fail = false;
        throw Error("quota");
      }
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
  const result = mergeLunchflow(
    [],
    [],
    [snapshot()],
    [{ providerId: "1", targetId: "new" }],
  );
  assert.throws(() => persistLunchflow(storage, result));
  assert.equal(map.get("moneylith.personal.accounts"), "[]");
  assert.equal(map.get("moneylith.personal.transactions"), "[]");
  persistLunchflow(storage, result);
  assert.equal(map.get("moneylith.business.real.v1"), "unchanged");
  assert.equal(
    JSON.parse(map.get("moneylith.personal.transactions")!).length,
    1,
  );
});
test("projection uses fetched Lunch Flow cash without changing manual opening balance or adding history again", async () => {
  const { personalInput } = await import("../src/projection/adapters");
  const { emptyOptions } = await import("../src/projection/engine");
  const accounts = [
    {
      id: "a",
      active: true,
      startBalance: 999,
      bankProvider: "lunchflow",
      bankBalance: 123.45,
    },
  ];
  const input = personalInput(
    {
      accounts,
      transactions: [{ amount: 5000 }],
      income: [],
      fixedCosts: [],
      debts: [],
    },
    { ...emptyOptions(), confirmOpening: true },
    "2026-10-19",
  );
  assert.equal(input.opening, 12345);
  assert.equal(accounts[0].startBalance, 999);
  const missing = personalInput(
    { accounts: [{ ...accounts[0], bankBalance: undefined }] },
    { ...emptyOptions(), confirmOpening: true },
    "2026-10-19",
  );
  assert.equal(missing.opening, null);
});
