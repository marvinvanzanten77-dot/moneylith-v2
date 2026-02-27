import { useEffect, useMemo, useRef, useState } from "react";
import { useAiOrchestrator, type TabKey } from "../hooks/useAiOrchestrator";
import { analyseObservation } from "../logic/analysis";
import { buildMoneylithPrompt } from "../logic/aiPrompt";
import { useObserver } from "../hooks/useObserver";
import { appendAiMessage, clearAiMessages, getAiMessages, subscribeToAiMessages } from "../logic/aiMessageBus";
import type { AiActions } from "../logic/extractActions";
import { TurnstileWidget } from "./TurnstileWidget";
import type { MoneylithSnapshot } from "../core/moneylithSnapshot";

interface AiAssistantCardProps {
  mode?: "personal" | "business";
  actions?: AiActions | null;
  onActionsChange?: (actions: AiActions | null) => void;
  onSetAiAnalysisRaw?: (raw: string) => void;
  appSnapshot?: MoneylithSnapshot;
  [key: string]: unknown;
}

export function AiAssistantCard({ mode = "personal", actions, onActionsChange, onSetAiAnalysisRaw, appSnapshot }: AiAssistantCardProps) {
  const observation = useObserver(mode, appSnapshot);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAiActions, setLastAiActions] = useState<AiActions | null>(actions ?? null);
  const [chatInput, setChatInput] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileOptional =
    import.meta.env.VITE_TURNSTILE_OPTIONAL !== "false" || !import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const [messages, setMessages] = useState(getAiMessages());

  useEffect(() => {
    const unsubscribe = subscribeToAiMessages((next) => setMessages(next));
    return unsubscribe;
  }, []);

  const { runAi } = useAiOrchestrator({
    mode,
    appendMessage: appendAiMessage,
    setLoading: setAiLoading,
    setLastActions: setLastAiActions,
    onRawContent: (raw) => {
      onSetAiAnalysisRaw?.(raw);
    },
  });

  useEffect(() => {
    const next = actions ?? null;
    // Alleen bij daadwerkelijke wijziging om render-loops te voorkomen
    if (JSON.stringify(next) !== JSON.stringify(lastAiActions)) {
      setLastAiActions(next);
    }
  }, [mode, actions, lastAiActions]);

  useEffect(() => {
    if (!onActionsChange) return;
    onActionsChange(lastAiActions);
    // onActionsChange is stabiel in App; afhankelijkheid bewust beperkt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAiActions]);

  const analysis = useMemo(() => (observation ? analyseObservation(observation, mode) : null), [mode, observation]);
  const toRawContext = (src: ReturnType<typeof useObserver>["personal"]) => ({
    incomes: src.income,
    fixed: src.fixedCostManualItems,
    debts: src.debts,
    assets: src.assets as any,
    buckets: src.buckets,
    futureIncomes: src.futureIncome,
    transactions: src.transactions,
    netFree: src.totals.netFree,
  });

  const primaryRaw = useMemo(
    () => toRawContext(mode === "business" ? observation.business : observation.personal),
    [mode, observation],
  );
  const secondaryRaw = useMemo(
    () => toRawContext(mode === "business" ? observation.personal : observation.business),
    [mode, observation],
  );

  const aiPayload = useMemo(() => {
    const extras = secondaryRaw
      ? [{ label: mode === "business" ? "persoonlijke context (alleen ter info)" : "zakelijke context (alleen ter info)", raw: secondaryRaw }]
      : undefined;
    return analysis ? buildMoneylithPrompt(analysis, primaryRaw, extras, appSnapshot) : null;
  }, [analysis, appSnapshot, primaryRaw, secondaryRaw, mode]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll naar onder bij nieuwe messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSend = async () => {
    if (!aiPayload || !chatInput.trim()) {
      setAiError("Geen vraag ingevuld.");
      return;
    }
    if (!turnstileOptional && !turnstileToken) {
      setAiError("Verificatie mislukt, probeer opnieuw.");
      return;
    }
    const question = chatInput.trim();
    setChatInput("");
    try {
      const result = await runAi({
        tab: "ai-analyse" as TabKey,
        system: aiPayload.system,
        user: `${aiPayload.user}\n\nVraag: ${question}`,
        displayUserMessage: question,
        turnstileToken: turnstileOptional ? undefined : turnstileToken,
        snapshot: appSnapshot,
      });
      if (result) {
        setAiError(null);
        setTurnstileToken(null); // force nieuwe token next time
      } else {
        setAiError("AI kon nu je vraag niet verwerken. Probeer het later opnieuw.");
      }
    } catch (err) {
      console.error(err);
      setAiError("AI kon nu je vraag niet verwerken. Probeer het later opnieuw.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI assistent</h2>
          <p className="text-xs text-slate-400">
            Stel een vraag of laat de assistent je huidige gegevens analyseren.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            appendAiMessage({ role: "system", content: "[Chat reset]" });
            clearAiMessages();
            setMessages([]);
          }}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline"
        >
          reset
        </button>
      </div>

      <div className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        {messages.length === 0 && <p className="text-slate-500 text-xs">Nog geen AI-gesprek gestart.</p>}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-lg border px-3 py-2 text-xs whitespace-pre-line ${
              m.role === "user"
                ? "ml-auto border-amber-400/40 bg-amber-500/10 text-amber-50"
                : "mr-auto border-slate-700 bg-slate-900/70 text-slate-100"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span>{m.role === "user" ? "Jij" : "AI"}</span>
              <span>{m.role === "user" ? "Vraag" : "Antwoord"}</span>
            </div>
            <div className="text-[12px] leading-relaxed">{m.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex-1 space-y-2">
          <TurnstileWidget
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""}
            onVerify={(token) => setTurnstileToken(token)}
            theme="dark"
          />
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Stel een vraag aan de AI..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                e.preventDefault();
                void handleChatSend();
              }
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
            disabled={!aiPayload || aiLoading}
          />
        </div>
        <button
          type="button"
          onClick={handleChatSend}
          disabled={!aiPayload || aiLoading || !chatInput.trim() || (!turnstileOptional && !turnstileToken)}
          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
        >
          {aiLoading ? "Bezig..." : "Stel vraag"}
        </button>
      </div>
      {aiError && <p className="mt-2 text-[11px] text-red-400">{aiError}</p>}
    </div>
  );
}
