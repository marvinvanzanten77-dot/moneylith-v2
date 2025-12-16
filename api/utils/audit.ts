type AuditRecord = {
  ts: string;
  route: string;
  status: "success" | "fail";
  latencyMs: number;
  rateLimited: boolean;
  turnstile: boolean;
  tokens?: { prompt?: number; completion?: number };
};

export function auditLog(rec: AuditRecord) {
  const line = JSON.stringify(rec);
  // Alleen naar console; geen gevoelige data wordt gelogd
  console.log(line);
}
