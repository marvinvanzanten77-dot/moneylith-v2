import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  authorizeSchema,
  callback,
  createGrant,
  digest,
  exchange,
  metadata,
  principal,
  resource,
  revoke,
  scope,
  seal,
  tokens,
} from "../server/mcp/auth";
import { readTool } from "../server/mcp/reads";
import handler from "../api/mcp";
import { encryptCloudPayload } from "../server/utils/cloudAuth";
const state = {
  "moneylith.personal.accounts": JSON.stringify([
    {
      id: "a",
      name: "Eigen rekening",
      active: true,
      type: "checking",
      currency: "EUR",
      bankProvider: "bunq",
      bankBalance: 100,
      bankBalanceFetchedAt: "2026-11-25T10:00:00Z",
      iban: "NL91ABNA0417164300",
    },
    {
      id: "b",
      name: "Zakelijk geheim",
      active: true,
      currency: "EUR",
      bankBalance: 999,
    },
  ]),
  "moneylith.personal.bankRules.v1": JSON.stringify({
    version: 1,
    accountRoles: { a: "personal", b: "business" },
    rules: [],
  }),
  "moneylith.personal.transactions": JSON.stringify([
    {
      id: "t1",
      accountId: "a",
      date: "2026-11-24",
      amount: -10,
      currency: "EUR",
      description: "Betaling NL91ABNA0417164300",
      provider: "bunq",
    },
    {
      id: "t2",
      accountId: "a",
      date: "2026-11-23",
      amount: -20,
      currency: "EUR",
      description: "Boodschappen",
      provider: "bunq",
    },
  ]),
  "moneylith.personal.debts": "[]",
  "moneylith.personal.fixedCosts": "[]",
  "moneylith.business.debts": '[{"naam":"PRIVE-NIET-LEZEN-ZAKELIJK"}]',
};
test("MCP filters fields, paginates, separates personal/business and never mutates source", () => {
  const original = JSON.stringify(state);
  const result = readTool("get_accounts", {}, state, "2026-11-25");
  assert(!JSON.stringify(result).includes("NL91ABNA0417164300"));
  assert(!JSON.stringify(result).includes("Zakelijk geheim"));
  assert(
    !JSON.stringify(readTool("get_debts", {}, state)).includes(
      "PRIVE-NIET-LEZEN",
    ),
  );
  const page = readTool("list_transactions", { limit: 1 }, state, "2026-11-25")
    .result as any;
  assert.equal(page.next_offset, 1);
  assert.equal(page.items[0].amountCents, -1000);
  assert(!JSON.stringify(page).includes("NL91ABNA0417164300"));
  assert.throws(() => readTool("list_transactions", { limit: 101 }, state));
  assert.throws(() =>
    readTool("get_debts", { email: "someone@example.com" }, state),
  );
  assert.equal(JSON.stringify(state), original);
});
test("OAuth resource, callback and PKCE schema reject unsafe inputs", () => {
  assert.throws(() =>
    callback("https://evil.example/connector_platform_oauth_redirect"),
  );
  assert.throws(() =>
    callback(
      "https://chatgpt.com/connector_platform_oauth_redirect?redirect=evil",
    ),
  );
  assert.throws(() =>
    authorizeSchema.parse({
      response_type: "code",
      client_id: "moneylith-chatgpt",
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      resource: "wrong",
      scope,
      state: "abcdefgh",
      code_challenge: "a".repeat(43),
      code_challenge_method: "plain",
    }),
  );
});
test("OAuth + real MCP SDK: scoped access, PKCE, replay, revocation and fail closed", async () => {
  const env = { ...process.env },
    originalFetch = globalThis.fetch,
    db = new Map<string, string>();
  process.env.LUNCHFLOW_PRIVATE_ENABLED = "true";
  process.env.LUNCHFLOW_API_KEY = "test";
  process.env.LUNCHFLOW_OWNER_EMAIL = "owner@example.com";
  process.env.LUNCHFLOW_OWNER_CODE_HASH = "a".repeat(64);
  process.env.LUNCHFLOW_SESSION_SECRET = "b".repeat(64);
  delete process.env.VERCEL_ENV;
  process.env.MONEYLITH_MCP_ENABLED = "true";
  process.env.MONEYLITH_MCP_SECRET = randomBytes(48).toString("hex");
  process.env.CLOUD_ENCRYPTION_KEY = randomBytes(48).toString("hex");
  process.env.KV_REST_API_URL = "https://test-kv.invalid";
  process.env.KV_REST_API_TOKEN = "test";
  db.set(
    "ml:cloud:user:owner@example.com",
    JSON.stringify({
      email: "owner@example.com",
      bankOwnerVerified: true,
      hash: "x",
      salt: "x",
      createdAt: "today",
    }),
  );
  db.set(
    "ml:cloud:snapshot:owner@example.com",
    JSON.stringify({
      revision: "test-revision",
      encrypted: encryptCloudPayload(JSON.stringify(state)),
    }),
  );
  globalThis.fetch = async (input, init) => {
    if (String(input) !== "https://test-kv.invalid")
      return originalFetch(input, init);
    const a = JSON.parse(String(init?.body));
    let result: unknown = null;
    if (a[0] === "GET") result = db.get(a[1]) ?? null;
    else if (a[0] === "SET") {
      if (a.includes("NX") && db.has(a[1])) result = null;
      else {
        db.set(a[1], a[2]);
        result = "OK";
      }
    } else if (a[0] === "DEL") {
      db.delete(a[1]);
      result = 1;
    } else if (a[0] === "EVAL") result = 1;
    else throw Error("Unexpected storage operation");
    return Response.json({ result });
  };
  const app = express();
  app.use(express.json());
  app.all("/api/mcp", (req, res) => void handler(req as any, res as any));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  const url = new URL(`http://127.0.0.1:${address.port}/api/mcp`);
  let client: Client | undefined;
  try {
    assert.equal(metadata("resource").resource, resource);
    const anon = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(anon.status, 401);
    assert(
      anon.headers
        .get("www-authenticate")
        ?.includes("oauth-protected-resource"),
    );
    const grant = await createGrant("owner@example.com", "moneylith-chatgpt");
    const verifier = randomBytes(32).toString("base64url");
    const code = await seal(
      {
        sid: grant.id,
        client_id: grant.client,
        redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
        resource,
        code_challenge: digest(verifier),
      },
      "code",
      120,
    );
    const request = {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: grant.client,
      resource,
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
    };
    await assert.rejects(
      exchange({ ...request, code_verifier: "z".repeat(43) }),
    );
    await assert.rejects(
      exchange({ ...request, resource: "https://other.example/api/mcp" }),
    );
    const issued = await exchange(request);
    await assert.rejects(exchange(request));
    assert.equal(
      (await principal(issued.access_token)).email,
      "owner@example.com",
    );
    const wrong = await seal(
      { sid: grant.id, client_id: grant.client, scope: "connect:read" },
      "access",
      900,
    );
    await assert.rejects(principal(wrong));
    client = new Client({ name: "integration-test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers: { Authorization: "Bearer " + issued.access_token },
        },
      }),
    );
    assert.equal((await client.listTools()).tools.length, 8);
    const accounts = await client.callTool({
      name: "get_accounts",
      arguments: {},
    });
    assert(!accounts.isError);
    assert(!JSON.stringify(accounts).includes("NL91ABNA0417164300"));
    assert(JSON.stringify(accounts).includes("10000"));
    const renewed = await exchange({
      grant_type: "refresh_token",
      refresh_token: issued.refresh_token,
      client_id: grant.client,
      resource,
    });
    assert(await principal(renewed.access_token));
    await assert.rejects(
      exchange({
        grant_type: "refresh_token",
        refresh_token: issued.refresh_token,
        client_id: grant.client,
        resource,
      }),
    );
    await assert.rejects(principal(renewed.access_token));
    const second = await createGrant("owner@example.com", grant.client);
    const t = await tokens(second);
    await revoke(second.id);
    await assert.rejects(principal(t.access_token));
    process.env.MONEYLITH_MCP_ENABLED = "false";
    const disabled = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(disabled.status, 503);
  } finally {
    await client?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env))
      if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
