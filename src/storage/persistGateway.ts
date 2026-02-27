const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

export const persistGateway = {
  get(key: string): string | null {
    if (!hasWindow()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    if (!hasWindow()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  },
  remove(key: string): void {
    if (!hasWindow()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
  setMany(record: Record<string, unknown>): void {
    Object.entries(record).forEach(([key, value]) => {
      this.set(key, value);
    });
  },
  removeMany(keys: string[]): void {
    keys.forEach((key) => this.remove(key));
  },
};

