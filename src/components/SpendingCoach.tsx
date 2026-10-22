import { useEffect, useRef, useState } from "react";
import { ChatRequestGuard } from "../ai/conversation";
import type { SpendingRow } from "../bank/spending";
import { Button, SurfaceCard } from "./WorkspaceUI";
import { TurnstileWidget } from "./TurnstileWidget";
export function SpendingCoach({ rows, month, available, purpose = "spending-coach", scope = "personal" }: { rows: SpendingRow[]; month: string; available: boolean; purpose?: "spending-coach" | "income-ideas"; scope?: "personal" | "business-real" }) {
  const incomeIdeas = purpose === "income-ideas";
  const [content, setContent] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const guard = useRef(new ChatRequestGuard());
  const optional = import.meta.env?.VITE_TURNSTILE_OPTIONAL !== "false" || !import.meta.env?.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => () => guard.current.cancel(), []);
  const ask = async () => {
    if (loading || !available) return;
    if (!optional && !token) { setError("Rond eerst de verificatie af."); return; }
    const request = guard.current.start(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/moneylith/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify({ scope, purpose, context: incomeIdeas ? {month} : { month, rows }, turnstileToken: token ?? undefined }) });
      const result = await response.json();
      if (!response.ok || result.scope !== scope || typeof result.content !== "string" || !result.content.trim()) throw Error(result.error || "De AI is nu niet bereikbaar. Je gegevens blijven beschikbaar.");
      if (request.current()) setContent(result.content);
    } catch(e) { if (request.current()) setError(e instanceof Error ? e.message : "De AI is nu niet bereikbaar. Probeer het later opnieuw."); }
    finally { if (request.current()) { setLoading(false); setToken(null); } }
  };
  const latestAsk = useRef(ask);
  latestAsk.current = ask;
  useEffect(() => {
    if (!available || !optional) return;
    const timer = setTimeout(() => void latestAsk.current(), 400);
    return () => { clearTimeout(timer); guard.current.cancel(); };
  }, [available, optional]);
  return <SurfaceCard role="region" aria-label={incomeIdeas ? "AI-ideeën voor extra inkomsten" : "AI-bespaartips"} className="space-y-3 border border-purple-200">
    <p className="text-xs font-semibold uppercase tracking-widest text-purple-700">Een kleine stap vooruit</p>
    <h3 className="text-lg font-semibold">{incomeIdeas ? "Een volgende stap naar extra inkomsten" : "Ruimte voor wat jij belangrijk vindt"}</h3>
    <p className="text-sm text-slate-600">{incomeIdeas ? "De AI helpt je op weg naar zzp-opdrachten, bijvoorbeeld websites en apps maken voor mensen. Kies een stap die past bij jouw tijd en mogelijkheden." : "Je hoeft niet alles te veranderen. De AI denkt met je mee over kleine keuzes bij jouw uitgavenpotjes, zonder oordeel."}</p>
    {content && <div className="whitespace-pre-line rounded-xl bg-purple-50 p-4 text-sm leading-relaxed text-slate-800" role="status">{content}</div>}
    {error && <p role="alert" className="text-sm text-amber-900">{error}</p>}
    {!optional && <TurnstileWidget siteKey={import.meta.env?.VITE_TURNSTILE_SITE_KEY ?? ""} onVerify={setToken} theme="light" />}
    <Button disabled={!available || loading} onClick={() => void ask()}>{loading ? "De AI denkt met je mee…" : content ? "Nieuwe ideeën vragen" : incomeIdeas ? "Help mij een opdracht te vinden" : "Bekijk mijn bespaartips"}</Button>
    {!available && <p className="text-xs text-slate-600">Zodra er ingedeelde aankopen zijn, kan de AI gericht met je meedenken.</p>}
    <p className="text-xs text-slate-500">{incomeIdeas ? "Dit zijn ideeën, geen toegezegde opdrachten of inkomsten. Vul een mogelijk nettobedrag zelf in bij Best case." : "Kies wat bij jou past. Dit zijn ideeën om te proberen, geen bewezen besparingen."}</p>
  </SurfaceCard>;
}
