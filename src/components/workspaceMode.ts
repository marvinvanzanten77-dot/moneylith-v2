export type WorkspaceMode = "personal" | "real";
/** Legacy demo preferences/links select the existing own administration, never its records. */
export function resolveWorkspaceMode(hash: string, saved: string | null): WorkspaceMode {
  if (hash === "#persoonlijk") return "personal";
  if (hash === "#zakelijk" || hash === "#zakelijk-demo") return "real";
  return saved === "real" || saved === "demo" ? "real" : "personal";
}
