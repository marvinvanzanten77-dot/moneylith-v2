import { useCallback } from "react";
import { appendAiMessage } from "../logic/aiMessageBus";
import { extractActionsFromContent, type AiActions } from "../logic/extractActions";

export type TabKey =
  | "ai-analyse"
  | "fundament"
  | "inkomen"
  | "vaste-lasten"
  | "schulden"
  | "ritme"
  | "vermogen"
  | "doelen"
  | "potjes"
  | "vooruitblik"
  | "totaal"
  | "inbox";

interface OrchestratorArgs {
  mode: "personal" | "business";
  appendMessage: (msg: { role: "user" | "assistant"; content: string }) => void;
  setLoading: (v: boolean) => void;
  setLastActions?: (actions: AiActions | null) => void;
  onRawContent?: (raw: string) => void;
}

interface RunAiInput {
  tab: TabKey;
  system: string;
  user: string;
  displayUserMessage?: string;
  turnstileToken?: string;
}

async function postAnalyse(body: { system: string; user: string; turnstileToken?: string }) {
  // Only use the known backend route; the old hyphenated path caused 404 noise in Vite dev.
  const endpoints = ["/api/moneylith/analyse"];
  let lastError: Error | null = null;
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await resp.json().catch(() => ({}))) as { content?: string; error?: string };
      if (!resp.ok) {
        return { error: json?.error || `HTTP ${resp.status}` };
      }
      return json;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // probeer volgende endpoint
    }
  }
  if (lastError) throw lastError;
  throw new Error("AI-analyse route niet bereikbaar");
}

export function useAiOrchestrator({ mode, appendMessage, setLoading, setLastActions, onRawContent }: OrchestratorArgs) {
  const runAi = useCallback(
    async ({ tab, system, user, displayUserMessage, turnstileToken }: RunAiInput): Promise<string | null> => {
      setLoading(true);
      const userContent = displayUserMessage ?? `AI analyse voor: ${tab}`;
      appendAiMessage({ role: "user", content: userContent });
      if (appendMessage !== appendAiMessage) {
        appendMessage({ role: "user", content: userContent });
      }
      try {
        const data = await postAnalyse({ system, user, turnstileToken });
        if (data.error) {
          throw new Error(data.error);
        }
        const rawContent = data.content && data.content.trim().length > 0 ? data.content : "Geen content ontvangen.";
        if (onRawContent) onRawContent(rawContent);
        const { cleanedContent, actions } = extractActionsFromContent(rawContent);
        // verwijder eventuele markdown-codeblokken voor leesbaarheid
        const strippedContent = cleanedContent.replace(/```[\s\S]*?```/g, "").trim() || cleanedContent;
        if (setLastActions) setLastActions(actions ?? null);
        appendAiMessage({ role: "assistant", content: strippedContent });
        if (appendMessage !== appendAiMessage) {
          appendMessage({ role: "assistant", content: strippedContent });
        }
        return strippedContent;
      } catch (err: any) {
        const errorMsg = `AI-analyse mislukt: ${err?.message || "onbekende fout"}`;
        appendAiMessage({ role: "assistant", content: errorMsg });
        if (appendMessage !== appendAiMessage) {
          appendMessage({
            role: "assistant",
            content: errorMsg,
          });
        }
        if (setLastActions) setLastActions(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [appendMessage, setLastActions, setLoading]
  );

  void mode; // mode kan later gebruikt worden voor extra routing; nu alleen read-only

  return { runAi };
}

export type RunAi = ReturnType<typeof useAiOrchestrator>["runAi"];
