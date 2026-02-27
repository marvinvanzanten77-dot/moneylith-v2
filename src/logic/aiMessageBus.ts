export type AiMessage = { id?: string; role: "user" | "assistant" | "system"; content: string; ts?: number };
import { persistGateway } from "../storage/persistGateway";

type Listener = (messages: AiMessage[]) => void;

const messages: AiMessage[] = [];
const listeners = new Set<Listener>();

const STORAGE_KEY = "moneylith.ai.messages";

const safeLoad = (): AiMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = persistGateway.get(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) => m && (m.role === "user" || m.role === "assistant" || m.role === "system") && typeof m.content === "string",
    ) as AiMessage[];
  } catch {
    return [];
  }
};

const safePersist = () => {
  if (typeof window === "undefined") return;
  try {
    persistGateway.set(STORAGE_KEY, messages);
  } catch {
    // ignore
  }
};

// initial hydrate
messages.push(...safeLoad());

function notify() {
  const snapshot = [...messages];
  listeners.forEach((fn) => fn(snapshot));
  safePersist();
}

export function appendAiMessage(msg: AiMessage) {
  messages.push({
    id: msg.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `msg-${Date.now()}`),
    ts: msg.ts ?? Date.now(),
    ...msg,
  });
  notify();
}

export function clearAiMessages() {
  messages.length = 0;
  notify();
}

export function getAiMessages(): AiMessage[] {
  return [...messages];
}

export function getMessages(): AiMessage[] {
  return getAiMessages();
}

export function subscribeToAiMessages(fn: Listener): () => void {
  listeners.add(fn);
  fn([...messages]);
  return () => listeners.delete(fn);
}
