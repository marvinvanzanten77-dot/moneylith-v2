import type { ChatScope, ChatMessage } from './context';
export const chatKey = (scope: ChatScope) => `moneylith.chat.v1.${scope}`;
export function loadChat(scope: ChatScope): ChatMessage[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(chatKey(scope)) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((m): m is ChatMessage => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-24);
  } catch { return []; }
}
export function saveChat(scope: ChatScope, messages: ChatMessage[]) {
  try { localStorage.setItem(chatKey(scope), JSON.stringify(messages.slice(-24))); } catch { /* Session remains usable without storage. */ }
}
/** A response cannot publish after reset, unmount, or a newer request. */
export class ChatRequestGuard {
  private generation = 0;
  private controller?: AbortController;
  cancel() { this.generation++; this.controller?.abort(); }
  start() {
    this.cancel();
    this.controller = new AbortController();
    const generation = this.generation;
    return { signal: this.controller.signal, current: () => this.generation === generation };
  }
}
