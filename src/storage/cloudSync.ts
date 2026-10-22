import { collectCloudState, restoreCloudState, validateCloudState, type CloudState } from "./cloudState";
const metaKey = "moneylith.cloud.sync.v1";
type Meta = { email: string; revision: string | null; hash: string };
let session: Meta | null = null;
let saving = false;
export const cloudHeaders = { "Content-Type": "application/json", "X-Moneylith-Cloud": "1" };
export async function cloudRequest(action: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/cloud?action=${action}`, {
    method, headers: cloudHeaders, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw Error(data.error || "Accountopslag is niet bereikbaar.");
  return data;
}
async function fingerprint(state: CloudState) {
  const sorted = Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(sorted)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
function remember(meta: Meta) {
  localStorage.setItem(metaKey, JSON.stringify(meta));
  session = meta;
}
export async function startCloudSync() {
  session = null;
  if (localStorage.getItem("moneylith.storage.mode") === '"local"') return false;
  const auth = await cloudRequest("session");
  if (!auth.authenticated) return false;
  const remote = await cloudRequest("snapshot");
  const local = collectCloudState(localStorage);
  const hash = await fingerprint(local);
  let previous: Meta | null = null;
  try { previous = JSON.parse(localStorage.getItem(metaKey) ?? "null") as Meta | null; } catch { /* no prior sync */ }
  if (remote.state !== null) {
    if (!validateCloudState(remote.state)) throw Error("Ongeldige cloudgegevens.");
    const remoteHash = await fingerprint(remote.state);
    if (remoteHash === hash) {
      remember({ email: auth.email, revision: remote.revision, hash });
      return true;
    }
    if (remoteHash !== hash) {
      const localChanged = Object.keys(local).length > 0 &&
        (!previous || previous.email !== auth.email || previous.hash !== hash);
      if (localChanged && (!previous || previous.revision !== remote.revision))
        throw Error("Dit apparaat en de cloud bevatten verschillende wijzigingen. Kies bij Instellingen ‘Cloudversie laden’; je lokale versie wordt eerst bewaard. Er is niets overschreven.");
      if (!localChanged) {
        restoreCloudState(localStorage, remote.state);
        remember({ email: auth.email, revision: remote.revision, hash: remoteHash });
        return true;
      }
    }
  }
  remember({ email: auth.email, revision: remote.revision, hash: remote.state !== null && previous?.email === auth.email ? previous?.hash ?? "" : "" });
  await saveCloudChanges();
  return true;
}
export async function saveCloudChanges() {
  if (!session) throw Error("Cloudsynchronisatie is niet gestart. Laad eerst de cloudversie of herlaad na inloggen.");
  if (saving) return false;
  const current = session;
  saving = true;
  try {
    const state = collectCloudState(localStorage);
    const hash = await fingerprint(state);
    if (session !== current || hash === current.hash) return false;
    const result = await cloudRequest("snapshot", "PUT", { state, revision: current.revision });
    if (session !== current) return false;
    remember({ ...current, revision: result.revision, hash });
    window.dispatchEvent(new Event("moneylith:cloud-saved"));
    return true;
  } finally { saving = false; }
}
export async function loadCloudVersion() {
  const auth = await cloudRequest("session");
  if (!auth.authenticated) throw Error("Log eerst in.");
  const remote = await cloudRequest("snapshot");
  if (!validateCloudState(remote.state)) throw Error("Er is nog geen cloudadministratie.");
  restoreCloudState(localStorage, remote.state);
  remember({ email: auth.email, revision: remote.revision, hash: await fingerprint(remote.state) });
  window.location.reload();
}
export function stopCloudSync() { session = null; }
