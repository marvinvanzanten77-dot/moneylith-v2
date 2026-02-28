import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearCloudSession,
  decryptCloudPayload,
  encryptCloudPayload,
  getCloudSessionEmail,
  hashPassword,
  setCloudSession,
  verifyPassword,
} from "../server/utils/cloudAuth.js";
import { getCloudSnapshot, getCloudUser, setCloudSnapshot, setCloudUser } from "../server/utils/cloudStore.js";

const readBody = (req: VercelRequest) => {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
};

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

const validateCredentials = (email: string, password: string) => {
  if (!email || !email.includes("@")) return "Gebruik een geldig e-mailadres.";
  if (!password || password.length < 8) return "Wachtwoord moet minimaal 8 tekens zijn.";
  return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "").toLowerCase();

  try {
    if (req.method === "GET" && action === "session") {
      const email = getCloudSessionEmail(req);
      res.status(200).json({ ok: true, authenticated: Boolean(email), email: email || null });
      return;
    }

    if (req.method === "POST" && action === "register") {
      const body = readBody(req) as { email?: string; password?: string };
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const validationError = validateCredentials(email, password);
      if (validationError) {
        res.status(400).json({ ok: false, error: validationError });
        return;
      }

      const existing = await getCloudUser(email);
      if (existing) {
        res.status(409).json({ ok: false, error: "Account bestaat al." });
        return;
      }

      const { salt, hash } = hashPassword(password);
      await setCloudUser(email, { email, salt, hash, createdAt: new Date().toISOString() });
      setCloudSession(res, email);
      res.status(200).json({ ok: true, email });
      return;
    }

    if (req.method === "POST" && action === "login") {
      const body = readBody(req) as { email?: string; password?: string };
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const validationError = validateCredentials(email, password);
      if (validationError) {
        res.status(400).json({ ok: false, error: validationError });
        return;
      }

      const existing = await getCloudUser(email);
      if (!existing || !verifyPassword(password, existing.salt, existing.hash)) {
        res.status(401).json({ ok: false, error: "Inloggegevens ongeldig." });
        return;
      }
      setCloudSession(res, email);
      res.status(200).json({ ok: true, email });
      return;
    }

    if (req.method === "POST" && action === "logout") {
      clearCloudSession(res);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "GET" && action === "snapshot") {
      const email = getCloudSessionEmail(req);
      if (!email) {
        res.status(401).json({ ok: false, error: "Niet ingelogd." });
        return;
      }
      const encrypted = await getCloudSnapshot(email);
      if (!encrypted) {
        res.status(404).json({ ok: false, error: "Geen cloud snapshot gevonden." });
        return;
      }
      const plain = decryptCloudPayload(encrypted);
      const state = JSON.parse(plain);
      res.status(200).json({ ok: true, state });
      return;
    }

    if ((req.method === "PUT" || req.method === "POST") && action === "snapshot") {
      const email = getCloudSessionEmail(req);
      if (!email) {
        res.status(401).json({ ok: false, error: "Niet ingelogd." });
        return;
      }
      const body = readBody(req) as { state?: unknown };
      if (body.state === undefined) {
        res.status(400).json({ ok: false, error: "Lege state." });
        return;
      }
      const encrypted = encryptCloudPayload(JSON.stringify(body.state));
      await setCloudSnapshot(email, encrypted);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: "Unsupported action/method." });
  } catch (err) {
    console.error("[cloud] failure", { action, message: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ ok: false, error: "Cloud actie mislukt." });
  }
}

