import { useEffect, useMemo, useRef, useState } from "react";
import { useAiOrchestrator, type TabKey } from "../hooks/useAiOrchestrator";
import { analyseObservation } from "../logic/analysis";
import { buildMoneylithPrompt } from "../logic/aiPrompt";
import { useObserver } from "../hooks/useObserver";
import { appendAiMessage, getAiMessages, subscribeToAiMessages } from "../logic/aiMessageBus";
import type { AiActions } from "../logic/extractActions";

interface AiAssistantCardProps {
  mode?: "personal" | "business";
  actions?: AiActions | null;
  onActionsChange?: (actions: AiActions | null) => void;
  [key: string]: unknown;
}

export function AiAssistantCard({ mode = "personal", actions, onActionsChange }: AiAssistantCardProps) {
  const observation = useObserver(mode);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAiActions, setLastAiActions] = useState<AiActions | null>(actions ?? null);
  const [chatInput, setChatInput] = useState("");

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
      try {
        localStorage.setItem("moneylith.personal.aiAnalysisRaw", raw);
      } catch {
        // ignore
      }
    },
  });

  useEffect(() => {
    setLastAiActions(actions ?? null);
  }, [mode, actions]);

  useEffect(() => {
    if (onActionsChange) onActionsChange(lastAiActions);
  }, [lastAiActions, onActionsChange]);

  const analysis = useMemo(() => (observation ? analyseObservation(observation, mode) : null), [mode, observation]);
  const rawContext = useMemo(() => {
    const src = mode === "business" ? observation.business : observation.personal;
    return {
      incomes: src.income,
      fixed: src.fixedCostManualItems,
      debts: src.debts,
      assets: src.assets as any,
      buckets: src.buckets,
      transactions: src.transactions,
      netFree: src.totals.netFree,
    };
  }, [mode, observation]);
  const aiPayload = useMemo(() => (analysis ? buildMoneylithPrompt(analysis, rawContext) : null), [analysis, rawContext]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll naar onder bij nieuwe messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSend = async () => {
    if (!aiPayload || !chatInput.trim()) return;
    const question = chatInput.trim();
    setChatInput("");
    try {
      const result = await runAi({
        tab: "ai-analyse" as TabKey,
        system: aiPayload.system,
        user: `${aiPayload.user}\n\nVraag: ${question}`,
        displayUserMessage: question,
      });
      if (result) {
        setAiError(null);
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
            try {
              localStorage.removeItem("moneylith.personal.aiMessages");
            } catch {
              /* ignore */
            }
            setMessages([]);
          }}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline"
        >
          reset
        </button>
      </div>

      <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        {messages.length === 0 && <p className="text-slate-500 text-xs">Nog geen AI-gesprek gestart.</p>}
        {messages.map((m, idx) => (
          <div key={idx} className="text-xs whitespace-pre-line">
            <span className="mr-2 text-slate-400">{m.role === "user" ? "Jij" : "AI"}</span>
            <span>{m.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-3 flex gap-2">
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
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
          disabled={!aiPayload || aiLoading}
        />
        <button
          type="button"
          onClick={handleChatSend}
          disabled={!aiPayload || aiLoading || !chatInput.trim()}
          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
        >
          {aiLoading ? "Bezig..." : "Stel vraag"}
        </button>
      </div>
      {aiError && <p className="mt-2 text-[11px] text-red-400">{aiError}</p>}
    </div>
  );
}
