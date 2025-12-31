import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  listInstitutions,
  createAgreement,
  createRequisition,
  getRequisition,
  getTransactions,
  getBalances,
  deleteRequisition,
} from "../../src/integrations/bank/gocardless/connector.js";
import { getAccessToken } from "../../src/integrations/bank/gocardless/auth.js";
import { mapBankTxToMoneylithTx } from "../../src/integrations/bank/normalize.js";

type RequisitionEntry = {
  id: string;
  agreement_id?: string;
  institution_id?: string;
  accounts: string[];
  status?: string;
  link?: string;
  reference?: string;
  last_sync?: string | null;
  last_error?: string | null;
};

const isProd = process.env.VERCEL_ENV === "production";
const provider = isProd ? "real" : process.env.BANK_PROVIDER || "mock";

// Minimal in-memory store (per lambda instance)
const bankStore: { requisitions: Map<string, RequisitionEntry> } = {
  requisitions: new Map(),
};

const getRedirectUrl = () => process.env.GC_REDIRECT_URL || "http://localhost:3000/api/bank/callback";

function saveRequisition(rec: any) {
  if (!rec?.id) return;
  bankStore.requisitions.set(rec.id, {
    id: rec.id,
    agreement_id: rec.agreement,
    institution_id: rec.institution_id,
    accounts: rec.accounts || [],
    status: rec.status,
    link: rec.link,
    reference: rec.reference,
    last_sync: null,
    last_error: null,
  });
}

function json(res: VercelResponse, status: number, body: any) {
  res.status(status).json(body);
}

async function handleInstitutions(res: VercelResponse) {
  try {
    if (provider !== "real") return json(res, 400, { error: "Mock provider: gebruik /api/mock-bank in preview" });
    const data = await listInstitutions("NL");
    json(res, 200, data || []);
  } catch (err: any) {
    json(res, 500, { error: err.message || "institutions failed" });
  }
}

async function handleConnect(req: VercelRequest, res: VercelResponse) {
  try {
    const { institutionId } = req.body || {};
    if (!institutionId) return json(res, 400, { error: "institutionId ontbreekt" });
    const agreement = await createAgreement(institutionId);
    const requisition = await createRequisition(
      institutionId,
      agreement.id,
      getRedirectUrl(),
      `moneylith-${Date.now()}`,
    );
    saveRequisition(requisition);
    json(res, 200, { link: requisition.link, requisitionId: requisition.id, agreementId: agreement.id });
  } catch (err: any) {
    json(res, 500, { error: err.message || "connect failed" });
  }
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  try {
    const { requisition_id, id, ref, reference } = (req.query || {}) as Record<string, string>;
    const candidate = requisition_id || id || ref || reference;
    let reqId = candidate;
    if (!reqId && reference) {
      const found = Array.from(bankStore.requisitions.values()).find((r) => r.reference === reference);
      reqId = found?.id;
    }
    if (!reqId) return res.redirect("/?bank=error");
    const reqData = await getRequisition(reqId);
    saveRequisition(reqData);
    return res.redirect("/?bank=connected");
  } catch (err) {
    return res.redirect("/?bank=error");
  }
}

async function handleAccounts(res: VercelResponse) {
  const list = Array.from(bankStore.requisitions.values()).map((r) => ({
    requisition_id: r.id,
    agreement_id: r.agreement_id,
    institution_id: r.institution_id,
    accounts: r.accounts,
    status: r.status,
    last_sync: r.last_sync,
    last_error: r.last_error,
  }));
  json(res, 200, list);
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
  try {
    const { accountId, requisitionId, dateFrom } = req.body || {};
    const targetReq = requisitionId
      ? bankStore.requisitions.get(requisitionId)
      : Array.from(bankStore.requisitions.values()).find((r) => (accountId ? r.accounts.includes(accountId) : true));
    if (!targetReq) return json(res, 400, { error: "Geen koppeling gevonden" });
    const ids = accountId ? [accountId] : targetReq.accounts;
    const results = [];
    for (const accId of ids) {
      try {
        const txRes = await getTransactions(accId, dateFrom);
        const balances = await getBalances(accId);
        const booked = txRes?.transactions?.booked || [];
        const pending = txRes?.transactions?.pending || [];
        const mappedBooked = booked.map((t: any) => mapBankTxToMoneylithTx(accId, t, "booked"));
        const mappedPending = pending.map((t: any) => mapBankTxToMoneylithTx(accId, t, "pending"));
        results.push({
          accountId: accId,
          balances,
          transactions: [...mappedBooked, ...mappedPending],
        });
        targetReq.last_sync = new Date().toISOString();
        targetReq.last_error = null;
      } catch (err: any) {
        targetReq.last_error = err.message || "sync failed";
      }
    }
    json(res, 200, results);
  } catch (err: any) {
    json(res, 500, { error: err.message || "sync failed" });
  }
}

async function handleDisconnect(req: VercelRequest, res: VercelResponse) {
  const { requisitionId } = req.body || {};
  if (!requisitionId) return json(res, 400, { error: "requisitionId ontbreekt" });
  bankStore.requisitions.delete(requisitionId);
  await deleteRequisition(requisitionId).catch(() => {});
  json(res, 200, { ok: true });
}

async function handleHealth(res: VercelResponse) {
  const id = process.env.GC_SECRET_ID || "";
  const key = process.env.GC_SECRET_KEY || "";
  if (!id || !key) {
    return json(res, 200, {
      ok: false,
      reason: "missing_credentials",
      idLen: id.length,
      keyLen: key.length,
    });
  }
  try {
    const token = await getAccessToken();
    return json(res, 200, { ok: !!token, reason: token ? "ok" : "no_token" });
  } catch (err: any) {
    return json(res, 500, { ok: false, reason: err.message || "token_failed" });
  }
}

async function handleRuntimeCheck(res: VercelResponse) {
  const envLengths = {
    GC_SECRET_ID_len: (process.env.GC_SECRET_ID || "").length,
    GC_SECRET_KEY_len: (process.env.GC_SECRET_KEY || "").length,
    GC_REDIRECT_URL_len: (process.env.GC_REDIRECT_URL || "").length,
    GC_USER_LANGUAGE_len: (process.env.GC_USER_LANGUAGE || "").length,
  };
  json(res, 200, {
    vercel: process.env.VERCEL || null,
    vercel_env: process.env.VERCEL_ENV || null,
    node_env: process.env.NODE_ENV || null,
    provider_seen_by_server: provider,
    env_lengths: envLengths,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = (req.query.slug as string[] | undefined) || [];
  const action = slug[0] || "";

  if (provider !== "real" && action !== "runtime-check") {
    // In production we force real; if provider isn't real we return a guard.
    if (isProd) return json(res, 400, { error: "Bank provider staat op mock; zet BANK_PROVIDER=real" });
  }

  if (action === "institutions" && req.method === "POST") return handleInstitutions(res);
  if (action === "connect" && req.method === "POST") return handleConnect(req, res);
  if (action === "callback" && req.method === "GET") return handleCallback(req, res);
  if (action === "accounts" && req.method === "GET") return handleAccounts(res);
  if (action === "sync" && req.method === "POST") return handleSync(req, res);
  if (action === "disconnect" && req.method === "POST") return handleDisconnect(req, res);
  if (action === "health" && req.method === "GET") return handleHealth(res);
  if (action === "runtime-check" && req.method === "GET") return handleRuntimeCheck(res);

  res.status(404).json({ error: "Not found" });
}
