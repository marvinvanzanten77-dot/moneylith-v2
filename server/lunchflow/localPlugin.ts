import { testConnection } from "./diagnostic.js";
import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import { LunchClient, safeFailure } from "./client";
export function allowLocal(
  req: Pick<IncomingMessage, "headers" | "method"> & {
    socket: { remoteAddress?: string };
  },
  deployed = !!process.env.VERCEL || process.env.NODE_ENV === "production",
) {
  if (
    deployed ||
    req.method !== "POST" ||
    req.headers["x-moneylith-local"] !== "1"
  )
    return false;
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress ?? "",
    )
  )
    return false;
  const host = req.headers.host ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) return false;
  return (
    req.headers.origin === `http://${host}` &&
    !req.headers["x-forwarded-host"] &&
    !req.headers["x-forwarded-for"]
  );
}
export function lunchflowLocal(key: string): Plugin {
  const client = new LunchClient(key);
  let busy = false;
  return {
    name: "moneylith-lunchflow-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/lunchflow", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const send = (status: number, data: unknown) => {
          res.statusCode = status;
          res.end(JSON.stringify(data));
        };
        if (!allowLocal(req))
          return send(403, {
            error: {
              code: "local_only",
              message:
                "Deze persoonlijke koppeling is uitsluitend lokaal beschikbaar.",
            },
          });
        if (busy)
          return send(429, {
            error: {
              code: "rate_limit",
              message: "Er loopt al een verzoek. Wacht tot dat klaar is.",
            },
          });
        busy = true;
        try {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 8192) {
              send(400, {
                error: { code: "format", message: "Verzoek te groot." },
              });
              return;
            }
          }
          let body: { action?: string; ids?: unknown };
          try {
            body = JSON.parse(raw);
          } catch {
            send(400, {
              error: { code: "format", message: "Ongeldig verzoek." },
            });
            return;
          }
          if (
            body?.action !== "accounts" &&
            body?.action !== "sync" &&
            body?.action !== "test"
          )
            return send(400, {
              error: { code: "format", message: "Onbekende actie." },
            });
          if (body.action === "test")
            return send(200, { diagnostic: await testConnection(client) });
          const accounts = await client.accounts();
          if (body.action === "accounts") return send(200, { accounts });
          if (
            !Array.isArray(body.ids) ||
            body.ids.length === 0 ||
            body.ids.length > 20 ||
            body.ids.some(
              (id) =>
                typeof id !== "string" || !accounts.some((a) => a.id === id),
            ) ||
            new Set(body.ids).size !== body.ids.length
          )
            return send(400, {
              error: {
                code: "format",
                message: "Selecteer geldige, unieke rekeningen.",
              },
            });
          const results = [];
          for (const account of accounts.filter((a) =>
            (body.ids as string[]).includes(a.id),
          ))
            results.push(await client.snapshot(account));
          send(200, { results });
        } catch (e) {
          send(502, { error: safeFailure(e) });
        } finally {
          busy = false;
        }
      });
    },
  };
}
