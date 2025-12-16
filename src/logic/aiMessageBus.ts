export type AiMessage = { role: "user" | "assistant"; content: string };

type Listener = (messages: AiMessage[]) => void;

const messages: AiMessage[] = [];
const listeners = new Set<Listener>();

const STORAGE_KEY = "moneylith.ai.messages";

const safeLoad = (): AiMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    ) as AiMessage[];
  } catch {
    return [];
  }
};

const safePersist = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
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
  messages.push(msg);
  notify();
}

export function clearAiMessages() {
  messages.length = 0;
  notify();
}

export function getAiMessages(): AiMessage[] {
  return [...messages];
}

export function subscribeToAiMessages(fn: Listener): () => void {
  listeners.add(fn);
  fn([...messages]);
  return () => listeners.delete(fn);
}
