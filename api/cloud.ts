import { InvalidMonitoringAction } from '../src/monitoring/engine.js';
import { monitorAccount } from '../server/monitoring/store.js';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearCloudSession, decryptCloudPayload, encryptCloudPayload, getCloudSessionEmail, hashPassword, setCloudSession, verifyPassword } from "../server/utils/cloudAuth.js";
import { allowCloudLogin, getCloudSnapshot, getCloudUser, hasCloudStore, setCloudSnapshot, setCloudUser } from "../server/utils/cloudStore.js";
import { ownerConfig, validOwnerCredentials, validOwnerSession, writeOwnerCookie } from "../server/lunchflow/ownerAuth.js";
import { validateCloudState } from "../src/storage/cloudState.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, Origin");
  const fail = (status: number, error: string) => res.status(status).json({ ok: false, error });
  const action = String(req.query.action || "");
  if (req.method !== "GET" && (req.headers.origin !== "https://www.moneylith.nl" || req.headers["x-moneylith-cloud"] !== "1"))
    return fail(403, "Verzoek niet toegestaan.");
  const config = ownerConfig();
  if (!config || !hasCloudStore() || (process.env.CLOUD_AUTH_SECRET?.length ?? 0) < 64 || (process.env.CLOUD_ENCRYPTION_KEY?.length ?? 0) < 64)
    return fail(503, "Accountopslag is nog niet geconfigureerd.");
  try {
    if (req.method === "POST" && action === "logout") {
      clearCloudSession(res); writeOwnerCookie(res, "");
      return res.status(200).json({ ok: true });
    }
    const sessionEmail = getCloudSessionEmail(req);
    const sessionUser = sessionEmail === config.email ? await getCloudUser(sessionEmail) : null;
    const authenticated = sessionUser?.bankOwnerVerified === true;
    if (req.method === "GET" && action === "session")
      return res.status(200).json({ ok: true, authenticated, email: authenticated ? config.email : null });
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
      if (Buffer.byteLength(raw) > 3_500_000) return fail(413, "Administratie is te groot voor cloudopslag.");
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Ongeldige invoer.");
    }
    if (req.method === "POST" && (action === "register" || action === "login")) {
      const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0];
      if (!await allowCloudLogin(ip)) return fail(429, "Te veel inlogpogingen. Probeer over 15 minuten opnieuw.");
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (email !== config.email || password.length < 12 || password.length > 256)
        return fail(401, "Gebruik je eigen e-mailadres en een wachtwoord van 12–256 tekens.");
      const existing = await getCloudUser(email);
      if (action === "register") {
        if (!validOwnerSession(req, config) && !validOwnerCredentials(email, body.ownerCode, config))
          return fail(403, "Open eerst je persoonlijke banktoegang of vul je persoonlijke testcode in om dit account te activeren.");
        if (existing) return fail(409, "Account bestaat al. Log in met je Moneylith-wachtwoord.");
        const { salt, hash } = hashPassword(password);
        if (!await setCloudUser(email, { email, salt, hash, createdAt: new Date().toISOString(), bankOwnerVerified: true }))
          return fail(409, "Account bestaat al. Log in.");
      } else if (!existing?.bankOwnerVerified || !verifyPassword(password, existing.salt, existing.hash)) {
        return fail(401, "Inloggegevens ongeldig. Activeer je account eenmalig als dat nog niet is gebeurd.");
      }
      setCloudSession(res, email);
      return res.status(200).json({ ok: true, email });
    }
    if (!authenticated) return fail(401, "Log in met je Moneylith-account.");
    if (req.method === "POST" && action === "monitoring") {
      if (body.update !== undefined) {
        const update = body.update as Record<string, unknown>;
        if (!update || !["read", "dismiss", "preferences"].includes(String(update.action))) return fail(400, "Ongeldige meldingsactie.");
      }
      const monitoring = await monitorAccount(config.email, body.update);
      return res.status(200).json({ ok: true, monitoring });
    }
    if (req.method === "GET" && action === "snapshot") {
      const snapshot = await getCloudSnapshot(config.email);
      if (!snapshot) return res.status(200).json({ ok: true, state: null, revision: null });
      const state: unknown = JSON.parse(decryptCloudPayload(snapshot.encrypted));
      if (!validateCloudState(state)) return fail(500, "Cloudgegevens zijn ongeldig; lokale gegevens zijn behouden.");
      return res.status(200).json({ ok: true, state, revision: snapshot.revision });
    }
    if (req.method === "PUT" && action === "snapshot") {
      if (!validateCloudState(body.state) || !(body.revision === null || (typeof body.revision === "string" && body.revision.length < 100)))
        return fail(400, "Ongeldige administratie of versienummer.");
      const revision = await setCloudSnapshot(config.email, encryptCloudPayload(JSON.stringify(body.state)), body.revision as string | null);
      if (!revision) return fail(409, "Een ander apparaat heeft wijzigingen opgeslagen. Laad eerst de cloudversie; lokale wijzigingen zijn behouden.");
      return res.status(200).json({ ok: true, revision });
    }
    return fail(405, "Actie niet beschikbaar.");
  } catch (error) {
    if (error instanceof InvalidMonitoringAction) return fail(400, error.message);
    return fail(503, "Accountopslag is tijdelijk niet bereikbaar. Lokale gegevens zijn behouden.");
  }
}
