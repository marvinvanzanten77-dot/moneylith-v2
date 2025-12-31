// Quick local sanity checks for api/bank handler (no network calls needed for runtime-check/accounts).
// This transpiles api/bank.ts on the fly using TypeScript (dev dependency).
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { transpileModule } from "typescript";
import { pathToFileURL, fileURLToPath } from "url";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      console.log("status:", this.statusCode, "body:", payload);
    },
    redirect(url) {
      this.redirectUrl = url;
      console.log("redirect ->", url);
    },
  };
}

async function loadHandler() {
  const tsSource = readFileSync(new URL("../api/bank.ts", import.meta.url), "utf8");
  const js = transpileModule(tsSource, { compilerOptions: { module: 99 /* ESNext */ } }).outputText;
  const tmpPath = join(fileURLToPath(new URL(".", import.meta.url)), ".tmp-bank-handler.mjs");
  writeFileSync(tmpPath, js, "utf8");
  const mod = await import(pathToFileURL(tmpPath).href);
  return mod.default;
}

async function run() {
  const handler = await loadHandler();

  console.log("GET /api/bank/runtime-check");
  await handler({ method: "GET", url: "/api/bank/runtime-check", query: {} }, mockRes());

  console.log("\nGET /api/bank/accounts");
  await handler({ method: "GET", url: "/api/bank/accounts", query: {} }, mockRes());

  console.log("\nPOST /api/bank/institutions (expected 400 if provider mock)");
  await handler({ method: "POST", url: "/api/bank/institutions", body: {}, query: {} }, mockRes());
}

run().catch((err) => {
  console.error("Test failed", err);
});
