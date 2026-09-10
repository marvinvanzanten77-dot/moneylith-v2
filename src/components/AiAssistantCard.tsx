import { GuideCard } from "./ApplicationLayout";
import { useEffect, useRef, useState } from "react";
import { TurnstileWidget } from "./TurnstileWidget";
import type { MoneylithSnapshot } from "../core/moneylithSnapshot";
import { businessChatData, type ChatScope, type ChatMessage } from "../ai/context";
import { ChatRequestGuard, loadChat, saveChat } from "../ai/conversation";
import type { BusinessData } from "../business/model";
interface Props {
  scope?: ChatScope;
  businessData?: BusinessData;
  appSnapshot?: MoneylithSnapshot;
  userIntent?: unknown;
  readiness?: unknown;
}
export function AiAssistantCard(props: Props) {
  const scope = props.scope ?? "personal";
  return <ScopedAssistant key={scope} {...props} scope={scope} />;
}
function ScopedAssistant({ scope, businessData, appSnapshot, userIntent, readiness }: Props & { scope: ChatScope }) {
  const [messages, setMessages] = useState(() => loadChat(scope));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileOptional = import.meta.env.VITE_TURNSTILE_OPTIONAL !== "false" || !import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const guard = useRef(new ChatRequestGuard());
  useEffect(() => () => guard.current.cancel(), []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const conversation = messagesEndRef.current?.parentElement;
    conversation?.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [messages]);
  const handleChatSend = async () => {
    if (aiLoading || !chatInput.trim()) return;
    if (!turnstileOptional && !turnstileToken) { setAiError("Verificatie mislukt, probeer opnieuw."); return; }
    const request = guard.current.start();
    const question = chatInput.trim();
    const next: ChatMessage[] = [...messages, { role: "user" as const, content: question }].slice(-24);
    setMessages(next); saveChat(scope, next);
    setChatInput(""); setAiLoading(true); setAiError(null);
    try {
      const context = scope === "personal"
        ? { month: appSnapshot?.meta.selectedMonth, intent: userIntent, readiness, data: appSnapshot?.personal ?? {} }
        : businessChatData(businessData);
      const response = await fetch("/api/moneylith/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify({ scope, context, question, history: messages.slice(-24), turnstileToken: turnstileToken ?? undefined }),
      });
      const result = await response.json() as { content?: string; error?: string; scope?: ChatScope };
      if (!response.ok || result.error) throw new Error(result.error || "AI-service niet bereikbaar. Probeer het later opnieuw.");
      if (result.scope !== scope || !result.content?.trim()) throw new Error("Geen geldig AI-antwoord ontvangen. Probeer opnieuw.");
      if (!request.current()) return;
      const completed: ChatMessage[] = [...next, { role: "assistant" as const, content: result.content }].slice(-24);
      saveChat(scope, completed); setMessages(completed);
    } catch (error) {
      if (request.current()) setAiError(error instanceof Error ? error.message : "AI-service niet bereikbaar. Probeer opnieuw.");
    } finally {
      if (request.current()) { setAiLoading(false); setTurnstileToken(null); }
    }
  };
  return (
    <GuideCard>
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
            guard.current.cancel();
            saveChat(scope, []);
            setMessages([]);
            setAiLoading(false);
            setAiError(null);
            setChatInput("");
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
            onVerify={setTurnstileToken}
            theme="dark"
          />
          <input
            type="text"
            aria-label="Vraag aan de AI"
            maxLength={6000}
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
            disabled={aiLoading}
          />
        </div>
        <button
          type="button"
          onClick={handleChatSend}
          disabled={aiLoading || !chatInput.trim() || (!turnstileOptional && !turnstileToken)}
          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
        >
          {aiLoading ? "Bezig..." : "Stel vraag"}
        </button>
      </div>
      {aiError && <p role="alert" className="mt-2 text-[11px] text-red-400">{aiError}</p>}
    </GuideCard>
  );
}
