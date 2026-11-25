import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  authorizeSchema,
  base,
  verifiedOwner,
  resource,
  scope,
  secret,
  client,
  seal,
  unseal,
  createGrant,
  claim,
  exchange,
  metadata,
  revoke,
  readGrant,
} from "../server/mcp/auth.js";
import { getCloudSessionEmail } from "../server/utils/cloudAuth.js";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function html(res: VercelResponse, body: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  return res
    .status(200)
    .send(
      `<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width"><title>Moneylith · ChatGPT koppelen</title><style>body{font:18px system-ui;background:#f6f4ef;color:#18332a;max-width:600px;margin:8vh auto;padding:24px}button,a{font:inherit}button{background:#38634d;color:white;border:0;border-radius:12px;padding:14px;margin:8px 0}p{line-height:1.6}</style><h1>Moneylith · ChatGPT koppelen</h1>${body}</html>`,
    );
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    secret();
  } catch {
    return res.status(503).json({ error: "MCP not configured" });
  }
  const action = req.query.action;
  try {
    if (
      req.method === "GET" &&
      (action === "resource" || action === "metadata")
    )
      return res.json(
        metadata(action === "resource" ? "resource" : "authorization"),
      );
    if (req.method === "GET" && action === "authorize") {
      const input = authorizeSchema.parse(req.query);
      await client(input.client_id, input.redirect_uri);
      const email = getCloudSessionEmail(req);
      if (!email || !(await verifiedOwner(email)))
        return html(
          res,
          '<p>Log eerst in op je privé-Moneylith en keer daarna terug naar dit venster.</p><p><a href="/prive" target="_blank" rel="noopener">Open privé-Moneylith</a></p><p>Vernieuw vervolgens deze pagina.</p>',
        );
      const consent = await seal({ email, input }, "consent", 600);
      return html(
        res,
        `<p>Verbonden als <strong>${esc(email)}</strong>.</p><p>ChatGPT mag je saldi, transacties, inkomsten, vaste lasten, schulden, doelen, planning en berekende vooruitblik lezen. Het kan niets wijzigen, geen bankscan starten en geen betalingen uitvoeren.</p><form method="post" action="/api/mcp-oauth?action=consent"><input type="hidden" name="consent" value="${esc(consent)}"><button>Leestoegang toestaan</button></form><p><a href="/prive">Annuleren</a> · <a href="/api/mcp-oauth?action=access">Koppelingen beheren</a></p>`,
      );
    }
    if (req.method === "GET" && action === "access") {
      const email = getCloudSessionEmail(req);
      if (!email)
        return html(
          res,
          '<p><a href="/prive">Log in op privé-Moneylith</a> om toegang te beheren.</p>',
        );
      const nonce = await seal({ email }, "revoke-all", 600);
      return html(
        res,
        `<p>Hier kun je alle ChatGPT-koppelingen voor je Moneylith-account intrekken.</p><form method="post" action="/api/mcp-oauth?action=revoke-all"><input type="hidden" name="consent" value="${esc(nonce)}"><button>Alle koppelingen intrekken</button></form>`,
      );
    }
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw) > 16000) return res.status(413).end();
    const input: Record<string, string> =
      typeof req.body === "string"
        ? Object.fromEntries(new URLSearchParams(req.body))
        : (req.body ?? {});
    if (action === "token") {
      try {
        return res.json(await exchange(input));
      } catch {
        return res.status(400).json({ error: "invalid_grant" });
      }
    }
    if (action === "revoke") {
      try {
        let p;
        try {
          p = await unseal(input.token, "refresh");
        } catch {
          p = await unseal(input.token, "access");
        }
        const g = await readGrant(z.uuid().parse(p.sid));
        if (g.client === input.client_id) await revoke(g.id);
      } catch {
        /* RFC 7009: invalid tokens also return success. */
      }
      return res.status(200).end();
    }
    if (action === "consent" || action === "revoke-all") {
      if (req.headers.origin !== base) return res.status(403).end();
      const p = await unseal(
        input.consent,
        action === "consent" ? "consent" : "revoke-all",
      );
      const email = getCloudSessionEmail(req);
      if (!email || email !== p.email || !(await verifiedOwner(email)))
        return res.status(403).end();
      if (!(await claim(z.uuid().parse(p.jti), 600)))
        return res.status(400).end();
      if (action === "revoke-all") {
        const { cloudCommand } = await import("../server/utils/cloudStore.js");
        const ids = await cloudCommand(["SMEMBERS", "ml:mcp:owner:" + email]);
        if (Array.isArray(ids)) for (const id of ids) await revoke(String(id));
        await cloudCommand(["DEL", "ml:mcp:owner:" + email]);
        return html(res, "<p>Alle koppelingen zijn ingetrokken.</p>");
      }
      const a = authorizeSchema.parse(p.input);
      await client(a.client_id, a.redirect_uri);
      const g = await createGrant(email, a.client_id);
      const { cloudCommand } = await import("../server/utils/cloudStore.js");
      await cloudCommand(["SADD", "ml:mcp:owner:" + email, g.id]);
      await cloudCommand(["EXPIRE", "ml:mcp:owner:" + email, 31 * 86400]);
      const code = await seal(
        {
          sid: g.id,
          client_id: g.client,
          redirect_uri: a.redirect_uri,
          resource,
          code_challenge: a.code_challenge,
        },
        "code",
        120,
      );
      const url = new URL(a.redirect_uri);
      url.searchParams.set("code", code);
      url.searchParams.set("state", a.state);
      url.searchParams.set("iss", base);
      return res.redirect(302, url.href);
    }
    return res.status(404).end();
  } catch {
    return res.status(400).json({ error: "invalid_request" });
  }
}
