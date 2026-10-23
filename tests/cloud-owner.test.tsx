import test from "node:test";
import assert from "node:assert/strict";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../api/cloud";
import bank from "../server/lunchflow/privateHandler";
import { hashCode } from "../server/lunchflow/ownerAuth";
import { getCloudSessionEmail, encryptCloudPayload, decryptCloudPayload } from "../server/utils/cloudAuth";
import { cloudKey, collectCloudState, restoreCloudState, validateCloudState } from "../src/storage/cloudState";

const owner = "owner@example.test", code = "test-owner-code-".repeat(4), password = "test-password-123456";
function request(action: string, method = "POST", body: unknown = {}, cookie = "") {
  return {
    method, query: { action }, body,
    headers: { origin: "https://www.moneylith.nl", "x-moneylith-cloud": "1", "x-moneylith-private": "1", cookie, "x-forwarded-for": "127.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as VercelRequest;
}
function response() {
  const headers = new Map<string, unknown>();
  const result = { code: 200, body: {} as any, headers };
  const res = {
    setHeader(k: string, v: unknown) { headers.set(k, v); return this; },
    getHeader(k: string) { return headers.get(k); },
    status(n: number) { result.code = n; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as VercelResponse;
  return { res, result };
}
test("owner account activation, durable storage, conflict protection and bank authorization", async () => {
  const previous = { ...process.env }, originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    LUNCHFLOW_PRIVATE_ENABLED: "true", LUNCHFLOW_API_KEY: "fake-provider",
    LUNCHFLOW_OWNER_EMAIL: owner, LUNCHFLOW_OWNER_CODE_HASH: hashCode(code),
    LUNCHFLOW_SESSION_SECRET: "b".repeat(64), CLOUD_AUTH_SECRET: "c".repeat(64),
    CLOUD_ENCRYPTION_KEY: "d".repeat(64), KV_REST_API_URL: "https://redis.test", KV_REST_API_TOKEN: "fake",
    VERCEL_ENV: "production",
  });
  const redis = new Map<string, string>();
  globalThis.fetch = async (_url, init) => {
    const args = JSON.parse(String(init?.body));
    let result: unknown = null;
    if (args[0] === "GET") result = redis.get(args[1]) ?? null;
    else if (args[0] === "SET") {
      if (!redis.has(args[1])) { redis.set(args[1], args[2]); result = "OK"; }
    } else if (args[0] === "EVAL") {
      if (args[1].includes("INCR")) result = 1;
      else {
        const old = redis.get(args[3]);
        const revision = old ? JSON.parse(old).revision : "";
        result = revision === args[4] ? 1 : 0;
        if (result === 1) redis.set(args[3], args[5]);
      }
    } else throw Error("Unexpected Redis command");
    return new Response(JSON.stringify({ result }));
  };
  const call = async (req: VercelRequest) => { const { res, result } = response(); await handler(req, res); return result; };
  try {
    assert.equal((await call(request("register", "POST", { email: owner, password }))).code, 403);
    assert.equal((await call(request("register", "POST", { email: "other@example.test", password, ownerCode: code }))).code, 401);
    const registered = await call(request("register", "POST", { email: owner, password, ownerCode: code }));
    assert.equal(registered.code, 200);
    const cookie = String(registered.headers.get("Set-Cookie")).split(";")[0];
    assert.equal(getCloudSessionEmail(request("session", "GET", {}, cookie)), owner);
    assert.equal((await call(request("register", "POST", { email: owner, password, ownerCode: code }))).code, 409);
    assert.equal((await call(request("login", "POST", { email: owner, password: "wrong-password-long" }))).code, 401);
    assert.equal((await call(request("login", "POST", { email: owner, password }))).code, 200);
    const state = { "moneylith.personal.income": JSON.stringify([{ id: "income", naam: "Test", bedrag: 100 }]) };
    const saved = await call(request("snapshot", "PUT", { state, revision: null }, cookie));
    assert.equal(saved.code, 200);
    assert.ok(saved.body.revision);
    assert.equal((await call(request("snapshot", "PUT", { state, revision: null }, cookie))).code, 409);
    assert.equal((await call(request("snapshot", "GET"))).code, 401);
    assert.equal((await call(request("snapshot", "PUT", { state: { "secret": "x" }, revision: saved.body.revision }, cookie))).code, 400);
    const loaded = await call(request("snapshot", "GET", {}, cookie));
    assert.deepEqual(loaded.body.state, state);
    assert.equal(loaded.body.revision, saved.body.revision);
    assert.ok(!redis.get(`ml:cloud:snapshot:${owner}`)?.includes("bedrag"));
    const bankResponse = response();
    await bank(request("", "POST", { action: "status" }, cookie), bankResponse.res);
    assert.equal(bankResponse.result.body.accountAccess, true);
    const foreign = request("snapshot", "PUT", { state, revision: saved.body.revision }, cookie);
    foreign.headers.origin = "https://attacker.test";
    assert.equal((await call(foreign)).code, 403);
    delete process.env.CLOUD_AUTH_SECRET;
    assert.equal(getCloudSessionEmail(request("session", "GET", {}, cookie)), null);
    assert.equal((await call(request("session", "GET"))).code, 503);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
test("cloud snapshot allowlist preserves personal, business and chat separation; excludes credentials and demo", async () => {
  for (const key of ["moneylith.business.demo.v1", "moneylith.cloud.sync.v1", "moneylith.personal.access_token", "unrelated"])
    assert.equal(cloudKey(key), false);
  const map = new Map([
    ["moneylith.personal.income", "[]"], ["moneylith.business.real.v1", "{}"],
    ["moneylith.chat.v1.personal", "[]"], ["moneylith.chat.v1.business-real", "[]"],
    ["unrelated", "keep"],
  ]);
  const storage = {
    get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
  const previous = collectCloudState(storage);
  assert.equal(Object.keys(previous).length, 4);
  assert.equal(validateCloudState({ "moneylith.personal.income": "invalid json" }), false);
  let recovery: unknown;
  await restoreCloudState(storage, { "moneylith.personal.income": "[1]" }, async state => { recovery = state; });
  assert.equal(map.get("unrelated"), "keep");
  assert.equal(map.has("moneylith.business.real.v1"), false);
  assert.deepEqual(recovery, previous);
});
test("snapshot encryption requires configuration and authenticates ciphertext", () => {
  const prior = process.env.CLOUD_ENCRYPTION_KEY;
  try {
    delete process.env.CLOUD_ENCRYPTION_KEY;
    assert.throws(() => encryptCloudPayload("private"));
    process.env.CLOUD_ENCRYPTION_KEY = "e".repeat(64);
    const encrypted = encryptCloudPayload("private");
    assert.equal(decryptCloudPayload(encrypted), "private");
    const bytes = Buffer.from(encrypted, "base64url"); bytes[0] ^= 1;
    assert.throws(() => decryptCloudPayload(bytes.toString("base64url")));
  } finally {
    if (prior === undefined) delete process.env.CLOUD_ENCRYPTION_KEY;
    else process.env.CLOUD_ENCRYPTION_KEY = prior;
  }
});
