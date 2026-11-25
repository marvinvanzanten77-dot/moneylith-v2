import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { cloudCommand, getCloudUser } from "../utils/cloudStore.js";
import { ownerConfig } from "../lunchflow/ownerAuth.js";
export async function verifiedOwner(email: string) {
  return (
    ownerConfig()?.email === email &&
    (await getCloudUser(email))?.bankOwnerVerified === true
  );
}
export const scope = "moneylith:read";
export const base = "https://www.moneylith.nl";
export const resource = base + "/api/mcp";
export function secret() {
  if (
    process.env.MONEYLITH_MCP_ENABLED !== "true" ||
    !process.env.MONEYLITH_MCP_SECRET ||
    process.env.MONEYLITH_MCP_SECRET.length < 64
  )
    throw Error("MCP not configured");
  return new TextEncoder().encode(process.env.MONEYLITH_MCP_SECRET);
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("base64url");
export async function seal(
  data: Record<string, unknown>,
  purpose: string,
  seconds: number,
) {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256", typ: purpose })
    .setIssuer(base)
    .setAudience(purpose === "access" ? resource : base + "/mcp/" + purpose)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${seconds}s`)
    .sign(secret());
}
export async function unseal(token: string, purpose: string) {
  const p = await jwtVerify(token, secret(), {
    issuer: base,
    audience: purpose === "access" ? resource : base + "/mcp/" + purpose,
    algorithms: ["HS256"],
    requiredClaims: ["exp", "iat", "jti"],
  });
  if (p.protectedHeader.typ !== purpose) throw Error("Wrong purpose");
  return p.payload;
}
export type Grant = {
  id: string;
  email: string;
  client: string;
  expires: number;
};
export async function readGrant(id: string) {
  z.uuid().parse(id);
  const raw = await cloudCommand(["GET", "ml:mcp:grant:" + id]);
  if (typeof raw !== "string") throw Error("Grant expired/revoked");
  const g = JSON.parse(raw) as Grant;
  if (
    g.id !== id ||
    g.expires <= Date.now() / 1000 ||
    !(await verifiedOwner(g.email))
  )
    throw Error("Invalid grant");
  return g;
}
export async function revoke(id: string) {
  z.uuid().parse(id);
  await cloudCommand(["DEL", "ml:mcp:grant:" + id]);
}
export async function createGrant(email: string, client: string) {
  if (!(await verifiedOwner(email))) throw Error("Owner required");
  const g: Grant = {
    id: randomUUID(),
    email,
    client,
    expires: Math.floor(Date.now() / 1000) + 30 * 86400,
  };
  await cloudCommand([
    "SET",
    "ml:mcp:grant:" + g.id,
    JSON.stringify(g),
    "EX",
    30 * 86400,
  ]);
  return g;
}
export async function claim(jti: string, ttl: number) {
  z.uuid().parse(jti);
  return (
    (await cloudCommand([
      "SET",
      "ml:mcp:used:" + jti,
      "1",
      "NX",
      "EX",
      ttl,
    ])) === "OK"
  );
}
export async function tokens(g: Grant) {
  return {
    access_token: await seal(
      { sid: g.id, client_id: g.client, scope },
      "access",
      900,
    ),
    refresh_token: await seal(
      { sid: g.id, client_id: g.client },
      "refresh",
      Math.max(1, g.expires - Math.floor(Date.now() / 1000)),
    ),
    token_type: "Bearer",
    expires_in: 900,
    scope,
  };
}
export async function principal(token: string) {
  const p = await unseal(token, "access");
  const g = await readGrant(z.uuid().parse(p.sid));
  if (p.client_id !== g.client || p.scope !== scope) throw Error("Forbidden");
  return g;
}
export function callback(value: string) {
  const u = new URL(value);
  if (
    u.origin !== "https://chatgpt.com" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !(
      u.pathname === "/connector_platform_oauth_redirect" ||
      /^\/connector\/oauth\/[\w-]+$/.test(u.pathname)
    )
  )
    throw Error("Invalid callback");
  return u.href;
}
export async function client(id: string, redirect: string) {
  callback(redirect);
  if (id === "moneylith-chatgpt") return;
  if (!/^https:\/\/chatgpt\.com\/oauth\/(?:[\w-]+\/)?client\.json$/.test(id))
    throw Error("Invalid client");
  const r = await fetch(id, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw Error("Client unavailable");
  const text = await r.text();
  if (text.length > 64000) throw Error("Client too large");
  const c = JSON.parse(text);
  if (
    c.client_id !== id ||
    !Array.isArray(c.redirect_uris) ||
    !c.redirect_uris.includes(redirect) ||
    !(
      c.token_endpoint_auth_method === "none" ||
      c.token_endpoint_auth_methods_supported?.includes("none")
    )
  )
    throw Error("Invalid client metadata");
}
export const authorizeSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().max(240),
  redirect_uri: z.string().transform(callback),
  resource: z.literal(resource),
  scope: z.literal(scope),
  state: z.string().min(8).max(2048),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
});
export async function exchange(input: Record<string, string>) {
  if (input.resource !== resource) throw Error("Wrong resource");
  const type =
    input.grant_type === "authorization_code"
      ? "code"
      : input.grant_type === "refresh_token"
        ? "refresh"
        : null;
  if (!type) throw Error("Invalid grant");
  const p = await unseal(
    type === "code" ? input.code : input.refresh_token,
    type,
  );
  const g = await readGrant(z.uuid().parse(p.sid));
  if (
    p.client_id !== input.client_id ||
    g.client !== input.client_id ||
    (input.scope && input.scope !== scope)
  )
    throw Error("Wrong client/scope");
  if (type === "code") {
    z.string()
      .regex(/^[A-Za-z0-9._~-]{43,128}$/)
      .parse(input.code_verifier);
    if (
      p.redirect_uri !== input.redirect_uri ||
      p.resource !== resource ||
      digest(input.code_verifier) !== p.code_challenge
    )
      throw Error("Wrong PKCE");
  }
  if (
    !(await claim(
      z.uuid().parse(p.jti),
      Math.max(1, g.expires - Math.floor(Date.now() / 1000)),
    ))
  ) {
    if (type === "refresh") await revoke(g.id);
    throw Error("Replayed token");
  }
  return tokens(g);
}
export function metadata(kind: string) {
  secret();
  return kind === "resource"
    ? {
        resource,
        authorization_servers: [base],
        scopes_supported: [scope],
        bearer_methods_supported: ["header"],
        resource_name: "Moneylith Privé",
      }
    : {
        issuer: base,
        authorization_endpoint: base + "/api/mcp-oauth?action=authorize",
        token_endpoint: base + "/api/mcp-oauth?action=token",
        revocation_endpoint: base + "/api/mcp-oauth?action=revoke",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: [scope],
        authorization_response_iss_parameter_supported: true,
        client_id_metadata_document_supported: true,
      };
}
