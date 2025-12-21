import { useCallback, useEffect, useMemo, useState } from "react";
import { useAiOrchestrator } from "../../hooks/useAiOrchestrator";
import { appendAiMessage } from "../../logic/aiMessageBus";
import { TurnstileWidget } from "../TurnstileWidget";

export type InboxItemStatus = "nieuw" | "geanalyseerd";

export type InboxSuggestion = {
  id: string;
  tab: "fundament" | "schulden" | "vermogen" | "doelen" | "rekeningen" | "afschriften" | "overig";
  kind:
    | "income_add"
    | "fixedcost_add"
    | "debt_add"
    | "asset_add"
    | "goal_add"
    | "account_add"
    | "transaction_add"
    | "invoice_add"
    | "offer_add"
    | "note";
  confidence?: number;
  fields?: Record<string, unknown>;
  summary?: string;
};

export type InboxItem = {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploadedAt: string;
  status: InboxItemStatus;
  note?: string;
  content?: string;
  summary?: string;
  suggestions?: InboxSuggestion[];
  lastAnalysedAt?: string;
};

type StepInboxProps = {
  items: InboxItem[];
  onItemsChange: (items: InboxItem[]) => void;
  onApplySuggestions?: (suggestions: InboxSuggestion[]) => void;
  mode?: "personal" | "business";
};

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function StepInbox({ items, onItemsChange, onApplySuggestions, mode = "personal" }: StepInboxProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const { runAi } = useAiOrchestrator({
    mode,
    appendMessage: appendAiMessage,
    setLoading: () => {},
  });

  const parseSuggestions = (raw: string): { summary?: string; suggestions: InboxSuggestion[] } => {
    const start = raw.indexOf("<INBOX_JSON>");
    const end = raw.indexOf("</INBOX_JSON>");
    if (start === -1 || end === -1 || end < start) {
      return { summary: raw.trim().slice(0, 200), suggestions: [] };
    }
    const jsonPart = raw.slice(start + "<INBOX_JSON>".length, end).trim();
    try {
      const parsed = JSON.parse(jsonPart) as {
        summary?: string;
        suggestions?: Array<InboxSuggestion & { id?: string }>;
      };
      const suggestions =
        parsed.suggestions?.map((s, idx) => ({
          ...s,
          id: s.id ?? `s-${Date.now()}-${idx}`,
        })) ?? [];
      return { summary: parsed.summary, suggestions };
    } catch {
      return { summary: raw.trim().slice(0, 200), suggestions: [] };
    }
  };

  const handleAdd = () => {
    if (!selectedFile) return;
    const next: InboxItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: selectedFile.name,
      size: selectedFile.size,
      mime: selectedFile.type || "bestand",
      uploadedAt: new Date().toISOString(),
      status: "nieuw",
      note: note.trim() || fileNote || undefined,
      content: fileContent || undefined,
    };
    onItemsChange([next, ...items]);
    setSelectedFile(null);
    setNote("");
    setFileContent("");
    setFileNote(null);
  };

  const loadFile = useCallback(
    async (file: File | null) => {
      setSelectedFile(file);
      setFileContent("");
      setFileNote(null);
      if (!file) return;

      const lower = file.name.toLowerCase();
      const isCsvLike =
        lower.endsWith(".csv") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".tsv") ||
        lower.endsWith(".eml");
      const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
      const isPdf = lower.endsWith(".pdf");
      const isImage = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
      const isMsg = lower.endsWith(".msg");
      const isDocx = lower.endsWith(".docx");
      const isDoc = lower.endsWith(".doc");

      const MAX_CHARS = 120_000;
      const handleText = (raw: string, notePrefix?: string) => {
        let text = raw ?? "";
        if (!text) {
          setFileNote("Inhoud kon niet worden gelezen uit dit bestand.");
          return;
        }
        if (text.length > MAX_CHARS) {
          setFileNote(
            `${notePrefix ? `${notePrefix}. ` : ""}Bestand is groot (${text.length} tekens); alleen de eerste ${MAX_CHARS} tekens worden geanalyseerd.`
          );
          text = text.slice(0, MAX_CHARS);
        } else if (notePrefix) {
          setFileNote(notePrefix);
        }
        setFileContent(text);
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

        if (isDocx) {
          const data = await file.arrayBuffer();
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ arrayBuffer: data });
          handleText(result.value || "", "Geconverteerd uit Word");
          return;
        }

        if (isDoc) {
          setFileNote("DOC-bestand wordt beperkt ondersteund. Gebruik bij voorkeur DOCX.");
          const raw = await file.text();
          handleText(raw, "DOC-tekstextractie beperkt");
          return;
        }

        if (isPdf) {
          setFileNote("PDF-tekstextractie wordt uitgevoerd...");
          const data = await file.arrayBuffer();
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
          const { getDocument, GlobalWorkerOptions } = pdfjs as any;
          GlobalWorkerOptions.workerSrc = new URL(
            /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.worker.min.js",
            import.meta.url
          ).toString();
          const doc = await getDocument({ data }).promise;
          const maxPages = Math.min(doc.numPages, 6);
          let text = "";
          for (let i = 1; i <= maxPages; i += 1) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: any) => (item?.str ? String(item.str) : ""))
              .join(" ");
            text += `${pageText}\n`;
          }
          if (doc.numPages > maxPages) {
            text += `\n[PDF beperkt tot ${maxPages} pagina's]`;
          }
          handleText(text, "PDF-tekstextractie uitgevoerd");
          return;
        }

        if (isImage) {
          setFileNote("OCR wordt uitgevoerd...");
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker();
          await worker.loadLanguage("eng+nl");
          await worker.initialize("eng+nl");
          const result = await worker.recognize(file);
          await worker.terminate();
          handleText(result.data.text || "", "OCR via afbeelding");
          return;
        }

        if (isMsg) {
          const raw = await file.text();
          handleText(raw, "Outlook MSG-bestand (tekstextractie beperkt)");
          return;
        }

        if (isCsvLike) {
          const raw = await file.text();
          handleText(raw);
          return;
        }

        setFileNote("Bestandstype wordt nog niet ondersteund voor analyse.");
      } catch (err) {
        console.error(err);
        setFileNote("Lezen van het bestand is mislukt.");
      }
    },
    []
  );

  const handleFileList = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      const list = Array.from(files ?? []);
      if (!list.length) return;
      if (list.length > 1) {
        setFileNote(`Meerdere bestanden geselecteerd; alleen het eerste wordt geladen (${list[0].name}).`);
      }
      await loadFile(list[0]);
    },
    [loadFile]
  );

  const handleDelete = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const handleAnalyse = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!item.content) {
      setError("Geen leesbare inhoud gevonden. Upload een tekstbestand of CSV/XLSX.");
      return;
    }
    if (!turnstileToken) {
      setError("Verificatie mislukt, probeer opnieuw.");
      return;
    }
    setBusyId(id);
    setError(null);
    const system =
      "Moneylith Inbox analyse. Extracteer mogelijke updates voor tabbladen in deze modus. Geef alleen suggesties die jij als AI redelijk zeker kunt afleiden.";
    const user = [
      `Bestand: ${item.name}`,
      item.note ? `Notitie: ${item.note}` : "",
      mode === "business"
        ? "Doel: geef voorstellen die passen bij zakelijke tabs: Strategie/Cashflow, Verplichtingen (facturen/belasting/aanmaning/contract), Kapitaal, Doelen, Rekeningen, Afschriften."
        : "Doel: geef voorstellen die passen bij persoonlijke tabs: Fundament (inkomen/vast), Schulden, Vermogen, Doelen, Rekeningen, Afschriften.",
      "Output: geef een korte samenvatting en daarna een JSON-blok in tags <INBOX_JSON> ... </INBOX_JSON>.",
      "Gebruik geen codeblokken; plaats JSON als platte tekst tussen de tags.",
      "JSON schema:",
      '{ "summary": "...", "suggestions": [',
      '  { "tab": "schulden", "kind": "debt_add", "confidence": 0.74, "fields": { "naam": "", "saldo": 0, "minimaleMaandlast": 0 } },',
      '  { "tab": "fundament", "kind": "fixedcost_add", "confidence": 0.65, "fields": { "naam": "", "bedrag": 0, "dagVanMaand": 1, "opmerking": "" } },',
      '  { "tab": "fundament", "kind": "income_add", "confidence": 0.65, "fields": { "naam": "", "bedrag": 0, "opmerking": "" } },',
      '  { "tab": "vermogen", "kind": "asset_add", "confidence": 0.6, "fields": { "naam": "", "bedrag": 0 } },',
      '  { "tab": "doelen", "kind": "goal_add", "confidence": 0.6, "fields": { "label": "", "type": "buffer", "targetAmount": 0, "currentAmount": 0, "monthlyContribution": 0, "isActive": true } },',
      '  { "tab": "rekeningen", "kind": "account_add", "confidence": 0.6, "fields": { "name": "", "type": "betaalrekening", "iban": "", "active": true } },',
      '  { "tab": "afschriften", "kind": "transaction_add", "confidence": 0.5, "fields": { "date": "YYYY-MM-DD", "description": "", "amount": 0 } }',
      mode === "business"
        ? '  ,{ "tab": "verplichtingen", "kind": "invoice_add", "confidence": 0.7, "fields": { "type": "payable", "creditor": "", "amount": 0, "dueDate": "YYYY-MM-DD", "invoiceNumber": "", "btw": 0 } }'
        : "",
      "] }",
      "Document inhoud:",
      item.content.slice(0, 12000),
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const result = await runAi({
        tab: "inbox",
        system,
        user,
        displayUserMessage: "Analyseer Inbox document",
        turnstileToken,
      });
      if (!result) throw new Error("AI-analyse mislukt");
      const parsed = parseSuggestions(result);
      const next = items.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "geanalyseerd",
              summary: parsed.summary,
              suggestions: parsed.suggestions,
              lastAnalysedAt: new Date().toISOString(),
            }
          : entry
      );
      onItemsChange(next);
      setTurnstileToken(null);
      setTurnstileNonce((prev) => prev + 1);
    } catch (err) {
      setError("AI-analyse mislukt. Probeer het later opnieuw.");
    } finally {
      setBusyId(null);
    }
  };

  const suggestionsByTab = useMemo(() => {
    const all = items.flatMap((item) => item.suggestions ?? []);
    const map = new Map<string, InboxSuggestion[]>();
    all.forEach((s) => {
      const list = map.get(s.tab) ?? [];
      list.push(s);
      map.set(s.tab, list);
    });
    return map;
  }, [items]);

  const allSuggestions = useMemo(
    () => items.flatMap((item) => item.suggestions ?? []),
    [items]
  );

  useEffect(() => {
    const next: Record<string, boolean> = { ...selectedIds };
    let changed = false;
    const validIds = new Set<string>();
    allSuggestions.forEach((s) => {
      validIds.add(s.id);
      if (!(s.id in next)) {
        next[s.id] = true;
        changed = true;
      }
    });
    Object.keys(next).forEach((id) => {
      if (!validIds.has(id)) {
        delete next[id];
        changed = true;
      }
    });
    if (changed) setSelectedIds(next);
  }, [allSuggestions, selectedIds]);

  const selectedSuggestions = useMemo(
    () => allSuggestions.filter((s) => selectedIds[s.id]),
    [allSuggestions, selectedIds]
  );

  return (
    <div className="space-y-6">
      <div className="mb-4 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">Inbox</h1>
        <p className="text-sm text-slate-300">
          Upload brieven en documenten (PDF, Word, Excel, CSV, JPG/PNG, EML/MSG). AI indexeert wat je kunt bijwerken in
          je {mode === "business" ? "zakelijke" : "persoonlijke"} tabs en geeft voorstellen die je zelf bevestigt.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <div className="card-shell p-5 text-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Geuploade documenten</h2>
                <p className="text-xs text-slate-500">
                  {mode === "business"
                    ? "AI kan voorstellen doen voor de zakelijke tabbladen."
                    : "AI kan voorstellen doen voor alle persoonlijke tabbladen."}
                </p>
              </div>
              <span className="text-[11px] text-slate-500">{items.length} bestand(en)</span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-500">Nog geen documenten toegevoegd.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 text-sm text-slate-700"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatBytes(item.size)} | {new Date(item.uploadedAt).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500">Status: {item.status}</p>
                      {item.summary && <p className="text-[11px] text-slate-500">Samenvatting: {item.summary}</p>}
                      {item.note && <p className="text-[11px] text-slate-400">Notitie: {item.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAnalyse(item.id)}
                        disabled={busyId === item.id}
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {busyId === item.id ? "Analyseren..." : "Analyseer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-shell p-5 text-slate-900">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Voorgestelde updates</h2>
            {items.every((item) => (item.suggestions ?? []).length === 0) ? (
              <p className="text-sm text-slate-500">
                Nog geen AI-voorstellen beschikbaar. Analyseer eerst een document.
              </p>
            ) : (
              <div className="space-y-4">
                {onApplySuggestions && allSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      {selectedSuggestions.length} geselecteerd
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          allSuggestions.forEach((s) => {
                            next[s.id] = true;
                          });
                          setSelectedIds(next);
                        }}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Alles selecteren
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds({})}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Selectie wissen
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplySuggestions(selectedSuggestions)}
                        disabled={selectedSuggestions.length === 0}
                        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Pas selectie toe
                      </button>
                    </div>
                  </div>
                )}
                {Array.from(suggestionsByTab.entries()).map(([tab, list]) => (
                  <div key={tab} className="rounded-lg border border-slate-200 bg-white/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 capitalize">{tab}</h3>
                      {onApplySuggestions && (
                        <button
                          type="button"
                          onClick={() =>
                            onApplySuggestions(
                              list.filter((s) => selectedIds[s.id])
                            )
                          }
                          disabled={list.every((s) => !selectedIds[s.id])}
                          className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          Pas selectie in tab toe
                        </button>
                      )}
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {list.map((s) => (
                        <li key={s.id} className="rounded-md border border-slate-100 bg-white p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-900">{s.kind}</p>
                              {s.summary && <p className="text-[11px] text-slate-500">{s.summary}</p>}
                              {s.confidence !== undefined && (
                                <p className="text-[11px] text-slate-500">
                                  Confidence: {Math.round(s.confidence * 100)}%
                                </p>
                              )}
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedIds[s.id])}
                                onChange={(e) =>
                                  setSelectedIds((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.checked,
                                  }))
                                }
                              />
                              Selecteer
                            </label>
                          </div>
                          {s.fields && (
                            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">
                              {JSON.stringify(s.fields, null, 2)}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-50">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Document toevoegen</h2>
              <p className="text-xs text-slate-400">
                Sleep een bestand of kies een bestand om te uploaden. AI doet voorstellen; jij bevestigt.
              </p>
            </div>
            <label className="text-xs text-slate-300">
              Bestand
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.eml,.msg"
                onChange={async (e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setFileContent("");
                  setFileNote(null);
                  if (!file) return;

                  const lower = file.name.toLowerCase();
                  const isCsvLike =
                    lower.endsWith(".csv") ||
                    lower.endsWith(".txt") ||
                    lower.endsWith(".tsv") ||
                    lower.endsWith(".eml");
                  const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
                  const isPdf = lower.endsWith(".pdf");
                  const isImage = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
                  const isMsg = lower.endsWith(".msg");
                  const isDocx = lower.endsWith(".docx");
                  const isDoc = lower.endsWith(".doc");

                  const MAX_CHARS = 120_000;
                  const handleText = (raw: string, notePrefix?: string) => {
                    let text = raw ?? "";
                    if (!text) {
                      setFileNote("Inhoud kon niet worden gelezen uit dit bestand.");
                      return;
                    }
                    if (text.length > MAX_CHARS) {
                      setFileNote(
                        `${notePrefix ? `${notePrefix}. ` : ""}Bestand is groot (${text.length} tekens); alleen de eerste ${MAX_CHARS} tekens worden geanalyseerd.`
                      );
                      text = text.slice(0, MAX_CHARS);
                    } else if (notePrefix) {
                      setFileNote(notePrefix);
                    }
                    setFileContent(text);
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

                    if (isDocx) {
                      const data = await file.arrayBuffer();
                      const mammoth = await import("mammoth");
                      const result = await mammoth.extractRawText({ arrayBuffer: data });
                      handleText(result.value || "", "Geconverteerd uit Word");
                      return;
                    }

                    if (isDoc) {
                      setFileNote("DOC-bestand wordt beperkt ondersteund. Gebruik bij voorkeur DOCX.");
                      const raw = await file.text();
                      handleText(raw, "DOC-tekstextractie beperkt");
                      return;
                    }

                    if (isPdf) {
                      setFileNote("PDF-tekstextractie wordt uitgevoerd...");
                      const data = await file.arrayBuffer();
                      const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
                      const { getDocument, GlobalWorkerOptions } = pdfjs as any;
                      GlobalWorkerOptions.workerSrc = new URL(
                        /* @vite-ignore */ "pdfjs-dist/legacy/build/pdf.worker.min.js",
                        import.meta.url
                      ).toString();
                      const doc = await getDocument({ data }).promise;
                      const maxPages = Math.min(doc.numPages, 6);
                      let text = "";
                      for (let i = 1; i <= maxPages; i += 1) {
                        const page = await doc.getPage(i);
                        const content = await page.getTextContent();
                        const pageText = content.items
                          .map((item: any) => (item?.str ? String(item.str) : ""))
                          .join(" ");
                        text += `${pageText}\n`;
                      }
                      if (doc.numPages > maxPages) {
                        text += `\n[PDF beperkt tot ${maxPages} pagina's]`;
                      }
                      handleText(text, "PDF-tekstextractie uitgevoerd");
                      return;
                    }

                    if (isImage) {
                      setFileNote("OCR wordt uitgevoerd...");
                      const { createWorker } = await import("tesseract.js");
                      const worker = await createWorker();
                      await worker.loadLanguage("eng+nl");
                      await worker.initialize("eng+nl");
                      const result = await worker.recognize(file);
                      await worker.terminate();
                      handleText(result.data.text || "", "OCR via afbeelding");
                      return;
                    }

                    if (isMsg) {
                      const raw = await file.text();
                      handleText(raw, "Outlook MSG-bestand (tekstextractie beperkt)");
                      return;
                    }

                    if (isCsvLike) {
                      const raw = await file.text();
                      handleText(raw);
                      return;
                    }

                    setFileNote("Bestandstype wordt nog niet ondersteund voor analyse.");
                  } catch (err) {
                    console.error(err);
                    setFileNote("Lezen van het bestand is mislukt.");
                  }
                }}
                className="mt-1 w-full text-xs text-slate-200"
              />
            </label>
            <label className="text-xs text-slate-300">
              Notitie (optioneel)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-50"
                placeholder="Bijv. aanmaning of factuur voor schuld"
              />
            </label>
            <div className="pt-2">
              <TurnstileWidget
                key={`inbox-turnstile-${turnstileNonce}`}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""}
                onVerify={(token) => setTurnstileToken(token)}
                theme="dark"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedFile}
              className="rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60"
            >
              Bestand toevoegen
            </button>
            {error && <p className="text-[11px] text-red-300">{error}</p>}
            {selectedFile && (
              <p className="text-[11px] text-slate-400">
                Geselecteerd: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </p>
            )}
            {fileNote && <p className="text-[11px] text-slate-500">{fileNote}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
