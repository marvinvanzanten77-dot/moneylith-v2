import { useMemo, useState, useCallback } from "react";
import { useEffect } from "react";
import type { AccountStatementMeta, MoneylithAccount, MoneylithTransaction } from "../../types";
import { useAiOrchestrator } from "../../hooks/useAiOrchestrator";
import type { TabKey } from "../../hooks/useAiOrchestrator";
import { appendAiMessage } from "../../logic/aiMessageBus";
import type { AiActions } from "../../logic/extractActions";
import { TurnstileWidget } from "../TurnstileWidget";
import { formatCurrency } from "../../utils/format";
import { PotjeDetailView } from "../PotjeDetailView";
import { extractTextFromPdfFile } from "../../utils/documentExtract";

export type AiBucketItem = { id: string; label: string; monthlyAvg: number; count?: number };

interface StepAfschriftenProps {
  accounts: MoneylithAccount[];
  statements: AccountStatementMeta[];
  transactions: MoneylithTransaction[];
  onAddStatement: (meta: AccountStatementMeta) => void;
  onDeleteStatement: (id: string) => void;
  onUpsertTransaction: (tx: MoneylithTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  aiAnalysisDone?: boolean;
  aiAnalysisDoneAt?: string | null;
  aiAnalysisRaw?: string | null;
  onAiAnalysisComplete?: (payload: { raw: string; at: string }) => void;
  onAiActionsChange?: (actions: AiActions | null) => void;
  onBucketsRefresh?: () => void;
  fixedCostLabels?: string[];
  variant?: "personal" | "business";
  storagePrefix?: string;
  excludeLabels?: string[];
  onboardingMode?: "bank" | "manual" | null;
  aiBuckets?: AiBucketItem[];
  onAiBucketsChange?: (next: AiBucketItem[]) => void;
  fuelOverrides?: Record<string, "fuel" | "shop">;
  onFuelOverridesChange?: (next: Record<string, "fuel" | "shop">) => void;
}

export function StepAfschriften({
  accounts,
  statements,
  transactions: _transactions,
  onAddStatement,
  onDeleteStatement,
  onUpsertTransaction: _onUpsertTransaction,
  onDeleteTransaction: _onDeleteTransaction,
  aiAnalysisDone = false,
  aiAnalysisDoneAt = null,
  aiAnalysisRaw = null,
  onAiAnalysisComplete,
  onAiActionsChange,
  onBucketsRefresh,
  fixedCostLabels = [],
  variant = "personal",
  storagePrefix,
  excludeLabels = [],
  onboardingMode = null,
  aiBuckets = [],
  onAiBucketsChange,
  fuelOverrides = {},
  onFuelOverridesChange,
}: StepAfschriftenProps) {
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [filePayloads, setFilePayloads] = useState<{ name: string; content: string; note?: string }[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(aiAnalysisDone ? "AI-analyse uitgevoerd" : null);
  const [pendingTx, setPendingTx] = useState<MoneylithTransaction[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const turnstileOptional =
    import.meta.env.VITE_TURNSTILE_OPTIONAL !== "false" || !import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const { runAi } = useAiOrchestrator({
    mode: variant === "business" ? "business" : "personal",
    appendMessage: appendAiMessage,
    setLoading: setAiLoading,
    setLastActions: onAiActionsChange,
  });

  const setAiBuckets = useCallback((next: AiBucketItem[]) => onAiBucketsChange?.(next), [onAiBucketsChange]);
  const setFuelOverrides = useCallback(
    (
      next:
        | Record<string, "fuel" | "shop">
        | ((prev: Record<string, "fuel" | "shop">) => Record<string, "fuel" | "shop">),
    ) => onFuelOverridesChange?.(typeof next === "function" ? next(fuelOverrides) : next),
    [fuelOverrides, onFuelOverridesChange],
  );

  const parseBucketsFromText = useCallback(
    (raw: string) => {
      const blocklist = [...fixedCostLabels, ...excludeLabels].map((f) => f.toLowerCase()).filter(Boolean);
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsed: { id: string; label: string; monthlyAvg: number; count?: number }[] = [];
      lines.forEach((l, idx) => {
        const m = l.match(/^[-*\d.\)]*\s*([^:]+):\s*€?\s*([\d.,]+)/i);
        if (!m) return;
        const label = m[1].trim();
        const num = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(num)) return;
        const lower = label.toLowerCase();
        const isBlocked = blocklist.some((f) => f && lower.includes(f));
        if (isBlocked) return;
        parsed.push({
          id: `ai-bucket-${idx}-${label.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
          label,
          monthlyAvg: Math.round(num),
        });
      });
      const max = Math.min(9, Math.max(6, parsed.length));
      return parsed.slice(0, max);
    },
    [excludeLabels, fixedCostLabels]
  );

  const detectBankLabel = useCallback(
    (name?: string, content?: string) => {
      const haystack = `${name || fileName} ${content || ""}`.toLowerCase();
      const accountName = accounts.find((a) => a.id === accountId)?.name || "";
      if (haystack.includes("bunq")) return "bunq";
      if (haystack.includes("rabobank") || haystack.includes("rabo")) return "rabo";
      if (haystack.includes("ing")) return "ing";
      if (haystack.includes("abn")) return "abn";
      if (haystack.includes("sns")) return "sns";
      if (haystack.includes("asnbank") || haystack.includes("asn")) return "asn";
      if (accountName) {
        const first = accountName.split(/\s+/)[0].toLowerCase();
        if (first.length) return first;
      }
      return "bank";
    },
    [accountId, accounts, fileName]
  );

  useEffect(() => {
    if (aiAnalysisDone) {
      setAiStatus("AI-analyse uitgevoerd");
    }
  }, [aiAnalysisDone]);

  const parseTransactionsFromCsv = useCallback(
    (content?: string): MoneylithTransaction[] => {
      const source = content ?? "";
      if (!source || !accountId) return [];
      const lines = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const delimiter = lines[0].includes(";") && lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
    const parseLine = (line: string) => line.split(delimiter).map((s) => s.trim());
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = headers.some((h) => h.includes("datum") || h.includes("amount") || h.includes("omschrijving"));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const dateIdx = headers.findIndex((h) => h.includes("datum") || h.includes("date"));
    const descIdx = headers.findIndex((h) => h.includes("omschr") || h.includes("descr") || h.includes("tegenpartij"));
    const amountIdx = headers.findIndex((h) => h.includes("bedrag") || h.includes("amount") || h.includes("waarde"));

    const toNumber = (val: string) => {
      const normalized = val.replace(/[€\s]/g, "").replace(",", ".").replace("\u00a0", "");
      const num = parseFloat(normalized);
      return Number.isFinite(num) ? num : 0;
    };
    const toDate = (val: string) => {
      const parsed = new Date(val);
      if (Number.isNaN(parsed.getTime())) return new Date();
      return parsed;
    };

      return dataLines
      .map((line, idx) => {
        const cells = parseLine(line);
        const get = (i: number | undefined, fallbackIdx?: number) => {
          if (typeof i === "number" && i >= 0 && i < cells.length) return cells[i];
          if (typeof fallbackIdx === "number" && fallbackIdx >= 0 && fallbackIdx < cells.length) return cells[fallbackIdx];
          return "";
        };
        const desc = get(descIdx >= 0 ? descIdx : 0);
        const amt = toNumber(get(amountIdx >= 0 ? amountIdx : 1));
        const dt = toDate(get(dateIdx >= 0 ? dateIdx : 2));
        if (!desc && amt === 0) return null;
        return {
          id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
          accountId,
          date: dt.toISOString().slice(0, 10),
          amount: amt,
          description: desc || "Transactie",
          counterparty: undefined,
          category: null,
        } as MoneylithTransaction;
      })
        .filter(Boolean) as MoneylithTransaction[];
    },
    [accountId]
  );

  const statementsByAccount = useMemo(() => {
    const map = new Map<string, AccountStatementMeta[]>();
    statements.forEach((s) => {
      if (!map.has(s.accountId)) map.set(s.accountId, []);
      map.get(s.accountId)!.push(s);
    });
    return map;
  }, [statements]);

  const FUEL_KEYWORDS = ["diesel", "euro95", "euro 95", "e10", "litr", "liter", "l.", "v-power", "ultimate", "fuel", "tanken", "benzine"];
  const SHOP_KEYWORDS = ["shop", "kiosk", "broodje", "koffie", "snack", "sigaret", "tabak", "red bull", "monster", "water", "chocolade"];
  const TANK_MERCHANTS = ["shell", "esso", "bp", "tinq", "q8", "total", "texaco", "argos", "gulf", "avia", "ok nederland"];
  const TANK_SHOP_THRESHOLD = 20;

  type AugTx = MoneylithTransaction & {
    merchantKey: string;
    derivedCategory?: string;
    isTankCandidate?: boolean;
  };

  const classifyTankTx = (tx: MoneylithTransaction): { category?: string; merchantKey: string; isTankCandidate: boolean } => {
    const merchant = (tx.counterparty || tx.description || "").toLowerCase();
    const merchantKey = merchant.trim() || "onbekend";
    const desc = (tx.description || "").toLowerCase();
    const amountAbs = Math.abs(tx.amount || 0);

    const override = fuelOverrides[merchantKey];
    if (override === "fuel") return { category: "Brandstof", merchantKey, isTankCandidate: true };
    if (override === "shop") return { category: "Tankstation Shop/Overig", merchantKey, isTankCandidate: true };

    const hasFuel = FUEL_KEYWORDS.some((k) => desc.includes(k));
    const hasShop = SHOP_KEYWORDS.some((k) => desc.includes(k));
    const merchantIsTank = TANK_MERCHANTS.some((m) => merchant.includes(m));
    const isTankCandidate = merchantIsTank || hasFuel || hasShop;

    if (hasFuel) return { category: "Brandstof", merchantKey, isTankCandidate };
    if (hasShop) return { category: "Tankstation Shop/Overig", merchantKey, isTankCandidate };
    if (merchantIsTank) {
      if (amountAbs < TANK_SHOP_THRESHOLD) {
        return { category: "Tankstation Shop/Overig", merchantKey, isTankCandidate };
      }
      return { category: "Brandstof", merchantKey, isTankCandidate };
    }
    return { category: undefined, merchantKey, isTankCandidate };
  };

  const { buckets, bucketTxMap } = useMemo(() => {
    const now = Date.now();
    const cutoffMs = now - 90 * 24 * 60 * 60 * 1000;
    let minDate = Number.MAX_SAFE_INTEGER;
    let maxDate = 0;
    const spendTxs: AugTx[] = (_transactions || [])
      .filter((t) => {
        if (t.amount >= 0) return false;
        const ts = Date.parse(t.date);
        if (Number.isFinite(ts)) {
          minDate = Math.min(minDate, ts);
          maxDate = Math.max(maxDate, ts);
          return ts >= cutoffMs;
        }
        return true;
      })
      .map((t) => {
        const cls = classifyTankTx(t);
        return { ...t, derivedCategory: cls.category, merchantKey: cls.merchantKey, isTankCandidate: cls.isTankCandidate };
      });

    const blocklist = [...fixedCostLabels, ...excludeLabels].map((f) => f.toLowerCase()).filter(Boolean);
    const map = new Map<string, { total: number; count: number; txs: AugTx[] }>();
    spendTxs.forEach((t) => {
      const key = (t.derivedCategory || t.category || t.description || "onbekend").toLowerCase().slice(0, 60);
      const isBlocked = blocklist.some((f) => f && key.includes(f));
      if (isBlocked) return;
      const entry = map.get(key) ?? { total: 0, count: 0, txs: [] };
      entry.total += Math.abs(t.amount);
      entry.count += 1;
      entry.txs.push(t);
      map.set(key, entry);
    });

    const spanDays =
      minDate !== Number.MAX_SAFE_INTEGER && maxDate > 0
        ? Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)))
        : 30;
    const months = Math.max(1, Math.round(spanDays / 30));

    const txMap: Record<string, AugTx[]> = {};
    const computed = Array.from(map.entries())
      .map(([label, info]) => {
        const id = `bucket-${label}`;
        txMap[id] = info.txs;
        return {
          id,
          label: label || "potje",
          monthlyAvg: Math.round(info.total / months),
          count: info.count,
          transactions: info.txs,
        };
      })
      .filter((b) => b.monthlyAvg > 0)
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg);
    const max = Math.min(9, Math.max(6, computed.length));
    const trimmed = computed.slice(0, max);

    if (aiBuckets.length) {
      const norm = (s: string) => s.toLowerCase().trim();
      const aiWithTx = aiBuckets.map((b) => {
        const matchKey = Object.keys(txMap).find((k) => norm(k).includes(norm(b.label)) || norm(b.label).includes(norm(k)));
        const txs = matchKey ? txMap[matchKey] : [];
        return { ...b, transactions: txs, count: txs.length };
      });
      return { buckets: aiWithTx, bucketTxMap: txMap };
    }

    if (trimmed.length) return { buckets: trimmed, bucketTxMap: txMap };

    return {
      buckets: Array.from({ length: 6 }).map((_, idx) => ({
        id: `ph-${idx}`,
        label: "",
        monthlyAvg: 0,
        count: 0,
        transactions: [],
      })),
      bucketTxMap: {},
    };
  }, [_transactions, aiBuckets, classifyTankTx, excludeLabels, fixedCostLabels, fuelOverrides]);

  const runAiBuckets = useCallback(async (token?: string) => {
    const spendTxs = (_transactions ?? []).filter((t) => t.amount < 0);
    if (!spendTxs.length || !token) return;
    const sample = spendTxs.slice(0, 120).map((t) => {
      const amt = Math.abs(t.amount).toFixed(2);
      return `${t.date} | ${t.description || "onbekend"} | €${amt}`;
    });
    const system = "Moneylith - categoriseer variabele uitgaven in max 6 potjes. Vermijd vaste lasten (huur, hypotheek, energie, zorgverzekering).";
    const user = [
      "Je krijgt een lijst uitgaven (negatieve bedragen). Groepeer in maximaal 6 categorieën en geef per categorie een maandgemiddelde (EUR, afgerond).",
      "Formaat per regel: <label>: €<bedrag>",
      "Gebruik alleen variabele uitgaven; sla vaste lasten over.",
      "Data:",
      sample.join("\n"),
    ].join("\n\n");
    try {
      const result = await runAi({ tab: "ai-analyse" as TabKey, system, user, turnstileToken: token });
      if (!result) return;
      const lines = result.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsed: { id: string; label: string; monthlyAvg: number; count?: number }[] = [];
      const blocklist = [...fixedCostLabels, ...excludeLabels].map((f) => f.toLowerCase()).filter(Boolean);
      lines.forEach((l, idx) => {
        const m = l.match(/^[-*\d.\)]*\s*([^:]+):\s*€?\s*([\d.,]+)/i);
        if (!m) return;
        const label = m[1].trim();
        const num = parseFloat(m[2].replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(num)) return;
        const lower = label.toLowerCase();
        const isBlocked = blocklist.some((f) => f && lower.includes(f));
        if (isBlocked) return;
        parsed.push({
          id: `ai-bucket-${idx}-${label.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
          label,
          monthlyAvg: Math.round(num),
        });
      });
      if (parsed.length) {
        const max = Math.min(9, Math.max(6, parsed.length));
        setAiBuckets(parsed.slice(0, max));
      }
    } catch (err) {
      console.error("AI bucket analyse mislukt", err);
    }
  }, [_transactions, excludeLabels, fixedCostLabels, runAi, setAiBuckets]);

  const handleSubmit = () => {
    if (!accountId || filePayloads.length === 0) return;
    const payloads = [...filePayloads];
    payloads.forEach((payload) => {
      const extMatch = payload.name.match(/(\.[a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : ".csv";
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const bankLabel = detectBankLabel(payload.name, payload.content);
      const safeMonth = String(month).padStart(2, "0");
      const generatedName = `${bankLabel}-${year}-${safeMonth}${ext}`;
      const meta: AccountStatementMeta = {
        id,
        accountId,
        month,
        year,
        fileName: generatedName || payload.name || fileName || undefined,
        uploadedAt: new Date().toISOString(),
      };
      onAddStatement(meta);
    });
    if (pendingTx.length > 0 && _onUpsertTransaction) {
      pendingTx.forEach((tx) => _onUpsertTransaction(tx));
      setPendingTx([]);
    }
    // Bewaar filePayloads zodat AI analyse direct de inhoud kan gebruiken voor patronen
  };

  const handleFileList = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []);
      setPendingTx([]);
      setFilePayloads([]);
      setFileName("");
      setFileNote(null);
      setUploadSummary(null);
      if (!list.length) return;

      const MAX_CHARS = 200_000;
      const payloads: { name: string; content: string; note?: string }[] = [];
      const allTx: MoneylithTransaction[] = [];

      const loadOne = async (file: File) => {
        const lower = file.name.toLowerCase();
        const isCsvLike = lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt");
        const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
        const isPdf = lower.endsWith(".pdf");

        const handleText = (raw: string, notePrefix?: string) => {
          let text = raw ?? "";
          if (!text) {
            payloads.push({ name: file.name, content: "", note: "Inhoud kon niet worden gelezen uit dit bestand." });
            return;
          }
          if (text.length > MAX_CHARS) {
            payloads.push({
              name: file.name,
              content: text.slice(0, MAX_CHARS),
              note: `${notePrefix ? `${notePrefix}. ` : ""}Bestand is groot (${text.length} tekens); alleen de eerste ${MAX_CHARS} tekens worden geanalyseerd.`,
            });
          } else {
            payloads.push({ name: file.name, content: text, note: notePrefix });
          }
          const parsed = parseTransactionsFromCsv(text);
          if (parsed.length > 0) {
            allTx.push(...parsed);
          }
        };

        try {
          if (isXlsx) {
            const data = await file.arrayBuffer();
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
            handleText(csv, "Geconverteerd uit Excel");
            return;
          }

          if (isCsvLike) {
            const text = await file.text();
            handleText(text);
            return;
          }

        if (isPdf) {
          const result = await extractTextFromPdfFile(file, { maxPages: 6 });
          handleText(result.text, result.note ?? "PDF-tekstextractie/OCR uitgevoerd");
          return;
        }

          payloads.push({ name: file.name, content: "", note: "Bestandstype wordt nog niet ondersteund voor analyse." });
        } catch (err) {
          console.error(err);
          payloads.push({ name: file.name, content: "", note: "Lezen van het bestand is mislukt." });
        }
      };

      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await loadOne(f);
      }

      setFilePayloads(payloads);
      if (payloads.length === 1) {
        setFileName(payloads[0].name);
        setFileNote(payloads[0].note ?? null);
      } else {
        setFileName(`${payloads.length} bestanden geselecteerd`);
        const notes = payloads.map((p) => p.note).filter(Boolean);
        setFileNote(notes.length ? notes.join("; ") : null);
      }
      if (allTx.length > 0) setPendingTx(allTx);
      const okCount = payloads.filter((p) => p.content && p.content.length > 0).length;
      const failCount = payloads.length - okCount;
      setUploadSummary(
        `${payloads.length} bestand(en) geladen, ${allTx.length} transacties herkend.` +
          (failCount > 0 ? ` ${failCount} bestand(en) konden niet worden gelezen.` : ""),
      );
    },
    [parseTransactionsFromCsv]
  );

  const loadDemoFile = () => {
    const demoCsv = [
      "Datum,Omschrijving,Bedrag",
      "2025-11-02,Boodschappen Jumbo,-42.15",
      "2025-11-05,Brandstof Shell,-65.80",
      "2025-11-10,Online diensten,-12.99",
      "2025-11-15,Restitutie energie,+45.00",
      "2025-11-18,Lunch werk,-9.50",
    ].join("\n");
    const payload = { name: "demo-afschrift.csv", content: demoCsv, note: "Voorbeeldbestand" };
    setFilePayloads([payload]);
    setFileName(payload.name);
    setFileNote(payload.note ?? null);
    const parsed = parseTransactionsFromCsv(demoCsv);
    setPendingTx(parsed);
    setUploadSummary(`Demo-bestand geladen, ${parsed.length} transacties herkend.`);
  };

  const activeAccountOptions = accounts.filter((a) => a.active && a.type === "betaalrekening");
  const hasUploads = statements.length > 0;

  const runAiAnalysis = async () => {
    if (!hasUploads) return;
    if (!turnstileOptional && !turnstileToken) {
      setAiError("Verificatie mislukt, probeer opnieuw.");
      return;
    }
    setAiError(null);
    setAiStatus("AI-analyse wordt uitgevoerd...");
    const system = "Moneylith analyse van bankafschriften";
    const combinedText = filePayloads
      .map((p) => p.content.slice(0, 3000))
      .join("\n---\n")
      .slice(0, 10000);
    const fixedList =
      fixedCostLabels && fixedCostLabels.length
        ? `Vaste lasten (uitsluiten uit potjes): ${fixedCostLabels.join(", ")}`
        : "";
    const user = [
      "Analyseer mijn geuploade afschrift(en) en geef een korte samenvatting.",
      `Bestand(en): ${fileName || "onbekend"}`,
      fileNote ? `Opmerking: ${fileNote}` : "",
      "Maak daarnaast een lijst van variabele uitgavenpotjes (max 6). Per regel: <label>: €<bedrag/maand> (afronden), laat vaste lasten zoals huur/hypotheek/energie/zorgverzekering achterwege.",
      fixedList,
      "Inhoud (eerste deel):",
      combinedText || "[Geen inhoud beschikbaar]",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const result = await runAi({
        tab: "ai-analyse" as TabKey,
        system,
        user,
        turnstileToken: turnstileOptional ? undefined : turnstileToken,
      });
      if (!result) {
        setAiError("AI-analyse is mislukt. Probeer het later opnieuw.");
        setAiStatus("AI-analyse mislukt");
        return;
      }
      setAiStatus("AI-analyse uitgevoerd");
      const at = new Date().toISOString();
      onAiAnalysisComplete?.({ raw: result, at });
      onBucketsRefresh?.();
      await runAiBuckets(turnstileOptional ? undefined : turnstileToken);
      setTurnstileToken(null);
      setTurnstileNonce((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setAiError("AI-analyse is mislukt. Probeer het later opnieuw.");
      setAiStatus("AI-analyse mislukt");
    }
  };

  useEffect(() => {
    if (!aiAnalysisRaw) return;
    const parsed = parseBucketsFromText(aiAnalysisRaw);
    if (parsed.length) {
      setAiBuckets(parsed);
    }
  }, [aiAnalysisRaw, parseBucketsFromText, setAiBuckets]);

  // Reset potjes als er geen uploads of analyse zijn (bijv. na F7 clear)
  useEffect(() => {
    const hasUploads = statements.length > 0;
    if (!hasUploads && !aiAnalysisDone && aiBuckets.length > 0) {
      setAiBuckets([]);
    }
  }, [aiAnalysisDone, aiBuckets.length, setAiBuckets, statements.length]);

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Patronen</h1>
        <p className="text-sm text-slate-400">
          Upload hier je bankafschriften (bij voorkeur van de laatste 3 maanden). Dit wordt lokaal gebruikt voor
          uitgavenpatronen.
        </p>
        <p className="text-sm text-slate-400">
          Zonder recente afschriften kan je ritme en analyse niet betrouwbaar worden berekend.
        </p>
        <p className="text-xs text-slate-500">Tip: begin met de laatste 3 maanden. Voeg elke maand een nieuw afschrift toe.</p>
        <p className="text-xs text-slate-500">Afschriften laten zien wat je echt doet met geld - niet wat je van plan was.</p>
        <p className="text-[11px] text-slate-500">
          Stap 1: Afschriften toevoegen · Stap 2: Analyseer met AI · AI overschrijft je eigen data niet, maar vult potjes aan.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-full bg-slate-800 px-2 py-0.5">Uploads: {statements.length}</span>
          {aiAnalysisDoneAt && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5">
              Laatste analyse: {new Date(aiAnalysisDoneAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 flex flex-col gap-4">
          {activeAccountOptions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              Zonder actieve betaalrekening kun je geen afschriften koppelen. Ga naar <strong>Rekeningen</strong> en voeg een
              betaalrekening toe (zet deze op actief).
            </div>
          ) : (
            activeAccountOptions.map((acc) => {
              const list = statementsByAccount.get(acc.id) ?? [];
              return (
                <div key={acc.id} className="card-shell p-5 text-slate-900">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{acc.name}</h2>
                      <p className="text-xs text-slate-500 capitalize">{acc.type}</p>
                    </div>
                    <span className="text-[11px] text-slate-500">{list.length} afschrift(en)</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">Nog geen afschriften geüpload voor deze rekening.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {list.map((s) => (
                        <li
                          key={s.id}
                          className="group relative flex items-center justify-between rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <div className="flex flex-col">
                            <span>
                              {s.month}/{s.year} - {s.fileName ?? "bestand"}
                            </span>
                            <span className="text-slate-400">{new Date(s.uploadedAt).toLocaleDateString()}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteStatement(s.id)}
                            className="ml-2 hidden rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-red-100 hover:text-red-600 group-hover:inline-flex"
                            title="Verwijder dit afschrift"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}

          <div className="card-shell p-5 text-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Potjes uit afschriften</h2>
                  <p className="text-xs text-slate-500">Max 9 categorieën, automatisch gegroepeerd.</p>
                </div>
              <span className="text-[11px] text-slate-500">{buckets.length} potje(n)</span>
            </div>
            {buckets.length === 0 ? (
              <p className="text-sm text-slate-500">Nog geen potjes afgeleid. Upload afschriften om patronen te zien.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(() => {
                  const maxAvg = Math.max(...buckets.map((b) => b.monthlyAvg || 0), 1);
                  return buckets.map((b, idx) => {
                    const txs = (bucketTxMap[b.id] ?? (b as any).transactions) || [];
                    const hasTx = txs.length > 0;
                    const fill = Math.min(100, Math.round(((b.monthlyAvg || 0) / maxAvg) * 100));
                    const accent =
                      ["from-fuchsia-500/20 to-blue-500/15", "from-amber-400/25 to-orange-500/20", "from-emerald-400/20 to-cyan-400/15", "from-sky-400/20 to-indigo-500/15", "from-pink-400/20 to-rose-500/15", "from-lime-400/25 to-green-500/15"][idx % 6];
                    return (
                      <div
                        key={b.id}
                        className={`relative overflow-hidden rounded-xl border border-white/60 bg-white/85 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-xl ${accent}`}
                        title="AI vult potjes aan; jouw eigen data blijft staan."
                      >
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/30 via-transparent to-white/10" />
                        <div className="flex items-start justify-between relative">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 capitalize">{b.label}</p>
                            <p className="text-[11px] text-slate-600">{b.count ?? 0} transacties</p>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-semibold">#{idx + 1}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-700">
                          <span>Gemiddeld per maand</span>
                          <span className="font-semibold text-slate-900">
                            {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(b.monthlyAvg)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-900/70 to-slate-900/50 transition-all"
                            style={{ width: `${fill}%` }}
                          />
                        </div>
                        {hasTx && (
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedBucketId(b.id)}
                              className="rounded-md border border-slate-300 bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow hover:bg-white"
                            >
                              Bekijk transacties
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-1 space-y-4">
          {onboardingMode === "bank" ? (
            // Bank mode: only show Bank analyse button
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Bank Analyse</h2>
                <p className="text-xs text-slate-400">
                  Klik onderaan om je banktransacties te analyseren en patronen automatisch in te vullen.
                </p>
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Patronen herkennen</span>
                  <button
                    type="button"
                    onClick={runAiAnalysis}
                    disabled={!hasUploads || aiLoading}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50 hover:bg-amber-400"
                  >
                    {aiLoading ? "Analyseren..." : "Analyseer transacties"}
                  </button>
                </div>
                <TurnstileWidget
                  key={`afschriften-turnstile-${turnstileNonce}`}
                  onVerify={(token) => setTurnstileToken(token)}
                  theme="dark"
                />
                {aiError && <p className="text-red-400">{aiError}</p>}
                {aiStatus && <p className="text-slate-300">{aiStatus}</p>}
                {!aiStatus && !aiError && <p className="text-slate-400">Wacht op analyse.</p>}
              </div>
            </div>
          ) : (
            // Manual mode: show file upload
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Afschrift toevoegen</h2>
                <p className="text-xs text-slate-400">
                  Selecteer rekening, maand en jaar en voeg een bestand toe (CSV/XLSX - PDF wordt beperkt ondersteund).
                </p>
              </div>
              <label className="text-xs text-slate-300">
                Rekening*
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50"
                >
                  <option value="">-- kies rekening --</option>
                  {activeAccountOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                <button
                  type="button"
                  className="rounded-md border border-slate-600 px-2 py-1 hover:border-amber-400 hover:text-amber-200"
                  onClick={loadDemoFile}
                >
                  Gebruik demo-afschrift
                </button>
                {uploadSummary && <span className="text-slate-300">{uploadSummary}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <label>
                  Maand*
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50"
                  />
                </label>
                <label>
                  Jaar*
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50"
                  />
                </label>
              </div>
              <label className="text-xs text-slate-300">
                Bestand
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.pdf,.txt"
                  multiple
                  onChange={async (e) => {
                    await handleFileList(e.target.files);
                  }}
                  className="mt-1 w-full text-xs text-slate-200"
                />
              </label>
              <button
                type="button"
                className="mt-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60"
                onClick={handleSubmit}
                disabled={!accountId}
              >
                Afschrift toevoegen
              </button>

              <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span>AI-analyse</span>
                  <button
                    type="button"
                    onClick={runAiAnalysis}
                    disabled={!hasUploads || aiLoading}
                    className="rounded-lg bg-purple-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {aiLoading ? "Analyseren..." : "Analyseer met AI"}
                  </button>
                </div>
                <TurnstileWidget
                  key={`afschriften-turnstile-${turnstileNonce}`}
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""}
                  onVerify={(token) => setTurnstileToken(token)}
                  theme="dark"
                />
                {aiError && <p className="text-red-400">{aiError}</p>}
                {aiStatus && <p className="text-slate-300">{aiStatus}</p>}
                {!aiStatus && !aiError && <p className="text-slate-400">Wacht op analyse.</p>}
                {fileName && (
                  <p className="text-[11px] text-slate-500">
                    Bestand geladen: {fileName} (
                    {filePayloads.some((p) => p.content && p.content.length > 0)
                      ? "inhoud beschikbaar"
                      : "inhoud onbekend of niet leesbaar"})
                  </p>
                )}
                {fileNote && (
                  <p className="text-[11px] text-slate-500">
                    {fileNote}
                  </p>
                )}
                {aiAnalysisDoneAt && (
                  <p className="text-[11px] text-slate-500">Laatste analyse: {new Date(aiAnalysisDoneAt).toLocaleString()}</p>
                )}
                <p className="text-[11px] text-slate-400">Volledig AI-antwoord en aanvullende chat zie je in de AI-gids rechts.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBucketId && (
        <PotjeDetailView
          label={buckets.find((b) => b.id === selectedBucketId)?.label ?? "Potje"}
          transactions={(bucketTxMap[selectedBucketId] as any) || []}
          onClose={() => setSelectedBucketId(null)}
          onOverride={(merchantKey, kind) => {
            setFuelOverrides((prev) => ({ ...prev, [merchantKey]: kind }));
          }}
        />
      )}
    </div>
  );
}
