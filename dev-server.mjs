import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  listInstitutions,
  createAgreement,
  createRequisition,
  getRequisition,
  getTransactions,
  getBalances,
  deleteRequisition,
} from "./src/integrations/bank/gocardless/connector.js";
import { mapBankTxToMoneylithTx } from "./src/integrations/bank/normalize.js";

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const MODEL = "gpt-4.1-mini";

// In-memory store voor banklinks (tijdelijk)
const bankStore = {
  requisitions: new Map(), // id -> { agreement_id, institution_id, accounts: [], status }
};

function getRedirectUrl() {
  return process.env.GC_REDIRECT_URL || "http://localhost:3000/api/bank/callback";
}

function saveRequisition(rec) {
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

app.post("/api/moneylith/analyse", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const { system, user } = req.body || {};

  if (!system || !user) {
    return res.status(400).json({ error: "Missing system/user payload" });
  }

  if (!apiKey) {
    const fallback =
      "AI offline: gebruik mock analyse.\n" +
      "- Inkomsten: geen analyse\n" +
      "- Vaste lasten: geen analyse\n" +
      "- Schulden/Doelen: geen analyse";
    return res.status(200).json({ content: fallback });
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
    return res.status(200).json({ content });
  } catch (error) {
    console.error("Moneylith AI error", error);
    const fallback =
      "AI call mislukte; gebruik mock analyse.\n" +
      "- Controleer je OPENAI_API_KEY\n" +
      "- Probeer later opnieuw";
    return res.status(200).json({ content: fallback });
  }
});

// ===== Bank routes (minimal ingest adapter) =====
app.post("/api/bank/connect", async (req, res) => {
  try {
    const { institutionId } = req.body || {};
    if (!institutionId) return res.status(400).json({ error: "institutionId ontbreekt" });
    const agreement = await createAgreement(institutionId);
    const requisition = await createRequisition(
      institutionId,
      agreement.id,
      getRedirectUrl(),
      `moneylith-${Date.now()}`,
    );
    saveRequisition(requisition);
    res.json({ link: requisition.link, requisitionId: requisition.id, agreementId: agreement.id });
  } catch (err) {
    console.error("bank/connect error", err);
    res.status(500).json({ error: err.message || "connect failed" });
  }
});

// robust callback: parse whatever is present, then fetch requisition and store
app.get("/api/bank/callback", async (req, res) => {
  try {
    const { requisition_id, id, ref, reference } = req.query || {};
    const candidate = requisition_id || id || ref || reference;
    let reqId = candidate;
    // fallback: try from store by reference match
    if (!reqId && reference) {
      const found = Array.from(bankStore.requisitions.values()).find((r) => r.reference === reference);
      reqId = found?.id;
    }
    if (!reqId) return res.status(400).send("Missing requisition id/reference");
    const reqData = await getRequisition(reqId);
    saveRequisition(reqData);
    return res.redirect("/?bank=connected");
  } catch (err) {
    console.error("bank/callback error", err);
    return res.redirect("/?bank=error");
  }
});

app.post("/api/bank/institutions", async (_req, res) => {
  try {
    const data = await listInstitutions("NL");
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message || "institutions failed" });
  }
});

app.get("/api/bank/accounts", async (_req, res) => {
  const list = Array.from(bankStore.requisitions.values()).map((r) => ({
    requisition_id: r.id,
    agreement_id: r.agreement_id,
    institution_id: r.institution_id,
    accounts: r.accounts,
    status: r.status,
    last_sync: r.last_sync,
    last_error: r.last_error,
  }));
  res.json(list);
});

app.post("/api/bank/sync", async (req, res) => {
  try {
    const { accountId, requisitionId, dateFrom } = req.body || {};
    const targetReq = requisitionId
      ? bankStore.requisitions.get(requisitionId)
      : Array.from(bankStore.requisitions.values()).find((r) => (accountId ? r.accounts.includes(accountId) : true));
    if (!targetReq) return res.status(400).json({ error: "Geen koppeling gevonden" });
    const ids = accountId ? [accountId] : targetReq.accounts;
    const results = [];
    for (const accId of ids) {
      try {
        const txRes = await getTransactions(accId, dateFrom);
        const balances = await getBalances(accId);
        const booked = txRes?.transactions?.booked || [];
        const pending = txRes?.transactions?.pending || [];
        const mappedBooked = booked.map((t) => mapBankTxToMoneylithTx(accId, t, "booked"));
        const mappedPending = pending.map((t) => mapBankTxToMoneylithTx(accId, t, "pending"));
        results.push({
          accountId: accId,
          balances,
          transactions: [...mappedBooked, ...mappedPending],
        });
        targetReq.last_sync = new Date().toISOString();
        targetReq.last_error = null;
      } catch (err) {
        targetReq.last_error = err.message || "sync failed";
        console.error("sync error", err);
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message || "sync failed" });
  }
});

app.post("/api/bank/disconnect", async (req, res) => {
  const { requisitionId } = req.body || {};
  if (!requisitionId) return res.status(400).json({ error: "requisitionId ontbreekt" });
  bankStore.requisitions.delete(requisitionId);
  await deleteRequisition(requisitionId).catch(() => {});
  res.json({ ok: true });
});

// ===== Mock bank routes (for preview/dev) =====
const mockStore = {
  requisition: null,
  accounts: [],
  syncCount: 0,
};

const mockTxSeed = [
  { d: "2025-12-01", a: -42.15, desc: "Boodschappen Jumbo" },
  { d: "2025-12-03", a: -65.8, desc: "Brandstof Shell" },
  { d: "2025-12-05", a: -12.99, desc: "Online diensten" },
  { d: "2025-12-08", a: 1450, desc: "Salaris" },
  { d: "2025-12-12", a: -120, desc: "Zorgverzekering" },
  { d: "2025-12-15", a: -80, desc: "Sportclub" },
  { d: "2025-12-18", a: -30, desc: "Eten buiten de deur" },
];

function mockGenerateTx(count, offset = 0) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const base = mockTxSeed[i % mockTxSeed.length];
    const date = new Date(base.d);
    date.setDate(date.getDate() + Math.floor(i / mockTxSeed.length) + offset);
    out.push({
      transactionId: `mock-${offset}-${i}`,
      bookingDate: date.toISOString().slice(0, 10),
      transactionAmount: { amount: base.a.toFixed(2), currency: "EUR" },
      remittanceInformationUnstructured: base.desc,
      status: "booked",
    });
  }
  return out;
}

app.post("/api/mock-bank/institutions", (_req, res) => {
  res.json([
    { id: "MOCKBANK", name: "Mock Bank NL" },
  ]);
});

app.post("/api/mock-bank/connect", (_req, res) => {
  const reqId = `mock-req-${Date.now()}`;
  mockStore.requisition = {
    id: reqId,
    status: "LN",
    accounts: [],
    agreement_id: "mock-agreement",
    institution_id: "MOCKBANK",
  };
  const redirect = "/api/mock-bank/callback?mock=1&requisitionId=" + reqId;
  res.json({ link: redirect, requisitionId: reqId, agreementId: "mock-agreement" });
});

app.get("/api/mock-bank/callback", (req, res) => {
  const reqId = req.query.requisitionId || req.query.id || mockStore.requisition?.id || `mock-req-${Date.now()}`;
  mockStore.requisition = {
    id: reqId,
    status: "LN",
    accounts: ["mock-acc-1", "mock-acc-2"],
    agreement_id: "mock-agreement",
    institution_id: "MOCKBANK",
  };
  mockStore.accounts = [
    { id: "mock-acc-1", name: "Mock Betaal", iban: "NL00MOCK0000001" },
    { id: "mock-acc-2", name: "Mock Spaar", iban: "NL00MOCK0000002" },
  ];
  mockStore.syncCount = 0;
  if (req.query.mock) {
    return res.redirect("/?bank=mock-connected");
  }
  return res.json({ ok: true, requisitionId: reqId });
});

app.get("/api/mock-bank/accounts", (_req, res) => {
  if (!mockStore.requisition) return res.json([]);
  res.json([
    {
      requisition_id: mockStore.requisition.id,
      agreement_id: mockStore.requisition.agreement_id,
      institution_id: mockStore.requisition.institution_id,
      accounts: mockStore.accounts.map((a) => a.id),
      status: mockStore.requisition.status,
      last_sync: null,
      last_error: null,
    },
  ]);
});

app.post("/api/mock-bank/sync", (req, res) => {
  if (!mockStore.requisition) return res.status(400).json({ error: "Geen koppeling" });
  mockStore.syncCount += 1;
  const txCount = mockStore.syncCount === 1 ? 120 : mockStore.syncCount === 2 ? 7 : 0;
  const txs = mockGenerateTx(txCount, mockStore.syncCount * 10);
  const mapped = txs.map((t) => ({
    accountId: req.body?.accountId || mockStore.accounts[0]?.id || "mock-acc-1",
    transactionId: t.transactionId,
    bookingDate: t.bookingDate,
    transactionAmount: t.transactionAmount,
    remittanceInformationUnstructured: t.remittanceInformationUnstructured,
  }));
  const response = [{
    accountId: req.body?.accountId || mockStore.accounts[0]?.id || "mock-acc-1",
    balances: { current: 1200, available: 1000 },
    transactions: mapped.map((t) => ({
      transactionId: t.transactionId,
      bookingDate: t.bookingDate,
      transactionAmount: t.transactionAmount,
      remittanceInformationUnstructured: t.remittanceInformationUnstructured,
      status: "booked",
    })),
  }];
  return res.json(response);
});

app.post("/api/mock-bank/disconnect", (_req, res) => {
  mockStore.requisition = null;
  mockStore.accounts = [];
  mockStore.syncCount = 0;
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Dev API server listening on http://localhost:${PORT}`);
});
