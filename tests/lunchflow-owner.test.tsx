import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ownerConfig,
  hashCode,
  validOwnerCredentials,
  createOwnerSession,
  validOwnerSession,
  ownerCookie,
} from "../server/lunchflow/ownerAuth";
import handler from "../server/lunchflow/privateHandler";
import { testConnection } from "../server/lunchflow/diagnostic";
import { LunchClient } from "../server/lunchflow/client";
const code = crypto.randomBytes(32).toString("base64url");
const env = {
  LUNCHFLOW_PRIVATE_ENABLED: "true",
  LUNCHFLOW_API_KEY: "test-api-key",
  LUNCHFLOW_OWNER_EMAIL: "owner@example.test",
  LUNCHFLOW_OWNER_CODE_HASH: hashCode(code),
  LUNCHFLOW_SESSION_SECRET: "a".repeat(64),
};
const config = ownerConfig(env)!;
const cookie = (token: string) => ({
  headers: { cookie: ownerCookie + "=" + encodeURIComponent(token) },
});
test("owner configuration fails closed without any required secret, activation, or on previews", () => {
  assert.ok(config);
  for (const key of Object.keys(env))
    assert.equal(ownerConfig({ ...env, [key]: "" }), null);
  assert.equal(ownerConfig({ ...env, VERCEL_ENV: "preview" }), null);
  assert.equal(ownerConfig({ ...env, LUNCHFLOW_SESSION_SECRET: "weak" }), null);
  assert.equal(
    ownerConfig({ ...env, LUNCHFLOW_OWNER_CODE_HASH: "weak" }),
    null,
  );
});
test("owner email alone and existing cloud sessions do not grant bank access", () => {
  assert.equal(validOwnerCredentials(config.email, code, config), true);
  assert.equal(
    validOwnerCredentials("other@example.test", code, config),
    false,
  );
  assert.equal(
    validOwnerCredentials(config.email, "a".repeat(43), config),
    false,
  );
  assert.equal(
    validOwnerSession(
      { headers: { cookie: "ml_cloud_session=anything" } },
      config,
    ),
    false,
  );
});
test("signed owner sessions expire, reject tampering, malformed and duplicate cookies and rotate with credentials", () => {
  const now = Date.now(),
    token = createOwnerSession(config, now);
  assert.equal(validOwnerSession(cookie(token), config, now), true);
  assert.equal(validOwnerSession(cookie(token), config, now + 3600000), false);
  assert.equal(validOwnerSession(cookie(token), config, now - 1), false);
  assert.equal(validOwnerSession(cookie(token + "x"), config, now), false);
  assert.equal(
    validOwnerSession(
      cookie(token),
      { ...config, email: "other@example.test" },
      now,
    ),
    false,
  );
  assert.equal(
    validOwnerSession(
      cookie(token),
      { ...config, secret: "b".repeat(64) },
      now,
    ),
    false,
  );
  assert.equal(
    validOwnerSession(
      cookie(token),
      { ...config, codeHash: "b".repeat(64) },
      now,
    ),
    false,
  );
  assert.equal(
    validOwnerSession(
      { headers: { cookie: ownerCookie + "=%invalid" } },
      config,
    ),
    false,
  );
  assert.equal(
    validOwnerSession(
      {
        headers: {
          cookie: ownerCookie + "=" + token + "; " + ownerCookie + "=" + token,
        },
      },
      config,
    ),
    false,
  );
});
let requestId = 0;
function request(body: unknown, overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {
      origin: "https://www.moneylith.nl",
      "x-moneylith-private": "1",
      "x-forwarded-for": `test-${requestId++}`,
    },
    body,
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as any;
}
function response() {
  const r = {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, unknown>,
    status(n: number) {
      r.statusCode = n;
      return r;
    },
    json(body: unknown) {
      r.body = body;
      return r;
    },
    setHeader(k: string, v: unknown) {
      r.headers[k] = v;
      return r;
    },
    getHeader(k: string) {
      return r.headers[k];
    },
  };
  return r;
}
async function withEnv(fn: () => Promise<void>) {
  const old = { ...process.env };
  Object.assign(process.env, env);
  delete process.env.VERCEL_ENV;
  try {
    await fn();
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
}
test("private route protects every bank action before any upstream request; CSRF and malformed requests fail closed", async () =>
  withEnv(async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error("must not fetch");
    };
    try {
      for (const action of ["accounts", "test", "sync"]) {
        const r = response();
        await handler(request({ action, ids: ["1"] }), r as any);
        assert.equal(r.statusCode, 401);
        assert.match(String(r.headers["Cache-Control"]), /no-store/);
      }
      for (const headers of [
        { origin: "https://evil.example", "x-moneylith-private": "1" },
        { origin: "https://www.moneylith.nl" },
        {},
      ]) {
        const r = response();
        await handler(
          request({ action: "login", email: config.email, code }, { headers }),
          r as any,
        );
        assert.equal(r.statusCode, 403);
      }
      const get = response();
      await handler(request({}, { method: "GET" }), get as any);
      assert.equal(get.statusCode, 405);
      const malformed = response();
      await handler(request(null), malformed as any);
      assert.equal(malformed.statusCode, 400);
      const wrong = response();
      await handler(
        request({ action: "login", email: "other@example.test", code }),
        wrong as any,
      );
      assert.equal(wrong.statusCode, 401);
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
    }
  }));
test("owner login issues a secure strict HttpOnly host cookie; logout expires it; unauthenticated status contains no owner data", async () =>
  withEnv(async () => {
    const status = response();
    await handler(request({ action: "status" }), status as any);
    assert.deepEqual(status.body, { authenticated: false });
    const login = response();
    await handler(
      request({ action: "login", email: config.email, code }),
      login as any,
    );
    assert.equal(login.statusCode, 200);
    const c = String(login.headers["Set-Cookie"]);
    for (const attr of [
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Path=/",
      "Max-Age=3600",
    ])
      assert.ok(c.includes(attr));
    assert.ok(!c.includes("Domain="));
    assert.equal(
      validOwnerSession({ headers: { cookie: c.split(";")[0] } }, config),
      true,
    );
    const logout = response();
    await handler(request({ action: "logout" }), logout as any);
    assert.match(String(logout.headers["Set-Cookie"]), /Max-Age=0/);
  }));
test("diagnostic exposes only masked identification and statuses/counts, never balances or transaction contents", async () => {
  const client = new LunchClient("secret", async (url) => {
    const u = String(url);
    return new Response(
      JSON.stringify(
        u.endsWith("/accounts")
          ? {
              accounts: [
                {
                  id: 123456,
                  name: "PRIVATE IBAN",
                  institution_name: "ING",
                  provider: "gocardless",
                  status: "ACTIVE",
                },
              ],
              total: 1,
            }
          : u.endsWith("/balance")
            ? { balance: { amount: 1234.56, currency: "EUR" } }
            : {
                transactions: [
                  {
                    id: "sensitive-id",
                    accountId: 123456,
                    amount: -12.34,
                    currency: "EUR",
                    date: "2026-10-01",
                    description: "SENSITIVE transaction",
                  },
                ],
                total: 1,
              },
      ),
    );
  });
  const d = await testConnection(client);
  assert.equal(d.accountCount, 1);
  assert.deepEqual(d.checks[0].transactions, { ok: true, count: 1 });
  const serialized = JSON.stringify(d);
  for (const value of [
    "123456",
    "1234.56",
    "12.34",
    "sensitive-id",
    "SENSITIVE",
    "PRIVATE IBAN",
    "secret",
  ])
    assert.ok(!serialized.includes(value));
});
test("authorized test action succeeds and does not return bank records", async () =>
  withEnv(async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ accounts: [], total: 0 }));
    try {
      const req = request({ action: "test" });
      req.headers.cookie = cookie(createOwnerSession(config)).headers.cookie;
      const r = response();
      await handler(req, r as any);
      assert.equal(r.statusCode, 200);
      assert.equal(r.body.diagnostic.accountCount, 0);
      assert.equal(r.body.accounts, undefined);
    } finally {
      globalThis.fetch = original;
    }
  }));
