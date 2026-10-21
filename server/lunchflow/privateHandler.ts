import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LunchClient, safeFailure } from "./client.js";
import { testConnection } from "./diagnostic.js";
import {
  ownerConfig,
  validOwnerCredentials,
  validOwnerSession,
  createOwnerSession,
  writeOwnerCookie,
} from "./ownerAuth.js";
import { rateLimit } from "../utils/rateLimit.js";
import { getCloudSessionEmail } from "../utils/cloudAuth.js";
import { getCloudUser, hasCloudStore } from "../utils/cloudStore.js";
export default async function privateLunchflow(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const failure = (status: number, message: string) =>
    res.status(status).json({ error: { message } });
  if (req.method !== "POST") return failure(405, "Gebruik een POST-verzoek.");
  if (
    req.headers.origin !== "https://www.moneylith.nl" ||
    req.headers["x-moneylith-private"] !== "1"
  )
    return failure(403, "Verzoek niet toegestaan.");
  if (!rateLimit(req, res, { limit: 30, windowMs: 60000 })) return;
  const config = ownerConfig();
  if (!config)
    return failure(
      503,
      "De persoonlijke live-test is nog niet geconfigureerd.",
    );
  let body: Record<string, unknown>;
  try {
    if (Number(req.headers["content-length"]) > 8192)
      return failure(413, "Verzoek te groot.");
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!raw || raw.length > 8192) return failure(400, "Ongeldig verzoek.");
    body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== "object")
      return failure(400, "Ongeldig verzoek.");
  } catch {
    return failure(400, "Ongeldig verzoek.");
  }
  if (body.action === "login") {
    if (!validOwnerCredentials(body.email, body.code, config))
      return failure(401, "E-mailadres of persoonlijke testcode is ongeldig.");
    writeOwnerCookie(res, createOwnerSession(config));
    return res.status(200).json({ authenticated: true });
  }
  if (body.action === "logout") {
    writeOwnerCookie(res, "");
    return res.status(200).json({ authenticated: false });
  }
  let accountAccess = false;
  try {
    if (hasCloudStore() && getCloudSessionEmail(req) === config.email)
      accountAccess = (await getCloudUser(config.email))?.bankOwnerVerified === true;
  } catch {
    return failure(503, "Accountcontrole is tijdelijk niet bereikbaar.");
  }
  const authenticated = accountAccess || validOwnerSession(req, config);
  if (body.action === "status") return res.status(200).json({ authenticated, ...(accountAccess ? { accountAccess: true } : {}) });
  if (!authenticated)
    return failure(401, "Log opnieuw in met je persoonlijke testtoegang.");
  const client = new LunchClient(config.apiKey);
  try {
    if (body.action === "test")
      return res.status(200).json({ diagnostic: await testConnection(client) });
    if (body.action !== "accounts" && body.action !== "sync")
      return failure(400, "Onbekende actie.");
    const accounts = await client.accounts();
    if (body.action === "accounts") return res.status(200).json({ accounts });
    const ids = body.ids;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 20 ||
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) => typeof id !== "string" || !accounts.some((a) => a.id === id),
      )
    )
      return failure(400, "Selecteer geldige, unieke rekeningen.");
    const results = [];
    for (const a of accounts.filter((a) => ids.includes(a.id)))
      results.push(await client.snapshot(a));
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(502).json({ error: safeFailure(e) });
  }
}
