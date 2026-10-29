import {packCloudRequest,unpackCloudResponse,cloudEncoding} from './cloudTransport';
import {mergeCloudVersions} from './mergeCloud';
import { collectCloudState, restoreCloudState, validateCloudState, type CloudState } from "./cloudState";
const metaKey = "moneylith.cloud.sync.v1";
type Meta = { email: string; revision: string | null; hash: string; savedAt?:string };
let session: Meta | null = null;
let saving = false;
let baseState: CloudState = {};
let loadedAt:string|null=null;
export const cloudHeaders = { "Content-Type": "application/json", "X-Moneylith-Cloud": "1" };
export async function cloudRequest(action: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/cloud?action=${action}`, {
    method, headers: {...cloudHeaders,...(action==='snapshot'&&typeof DecompressionStream!=='undefined'?{'X-Moneylith-Encoding':cloudEncoding}:{})}, body: body === undefined ? undefined : action==='snapshot'?await packCloudRequest(body):JSON.stringify(body),
    signal: AbortSignal.timeout(action==='bunq'?120000:20000),
  });
  const data = await unpackCloudResponse(await response.json());
  if (!response.ok || !data.ok) throw Error(data.error || "Accountopslag is niet bereikbaar.");
  return data;
}
async function fingerprint(state: CloudState) {
  const sorted = Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(sorted)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
function remember(meta: Meta) {
  try{const prior=JSON.parse(localStorage.getItem(metaKey)??'null');if(!meta.savedAt&&prior?.email===meta.email)meta={...meta,savedAt:prior.savedAt};}catch{/* invalid metadata does not change financial data */}
  localStorage.setItem(metaKey, JSON.stringify(meta));
  session = meta;
}
export async function startCloudSync() {
  session = null;
  baseState = {};
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
    baseState = remote.state;
    if (remoteHash === hash) {
      remember({ email: auth.email, revision: remote.revision, hash });
      return true;
    }
    if (remoteHash !== hash) {
      const localChanged = Object.keys(local).length > 0 &&
        (!previous || previous.email !== auth.email || previous.hash !== hash);
      if (localChanged && (!previous || previous.revision !== remote.revision))
        throw Error("Dit apparaat en de cloud bevatten verschillende wijzigingen. Kies bij je profiel ‘Mijn cloudadministratie laden’; je lokale versie wordt eerst bewaard. Er is niets overschreven.");
      if (!localChanged) {
        await restoreCloudState(localStorage, remote.state);
        loadedAt=new Date().toISOString();
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
    let result;
    try { result = await cloudRequest("snapshot", "PUT", { state, revision: current.revision }); }
    catch(e){
      // A scheduled bank update may have advanced the remote revision. Reconcile safely, then retry next tick.
      if(e instanceof Error && /ander apparaat/.test(e.message)){
        saving=false;
        await refreshCloudChanges();
        return false;
      }
      throw e;
    }
    if (session !== current) return false;
    baseState = state;
    remember({ ...current, revision: result.revision, hash, savedAt:new Date().toISOString() });
    window.dispatchEvent(new Event("moneylith:cloud-saved"));
    return true;
  } finally { saving = false; }
}
export async function loadCloudVersion() {
  const auth = await cloudRequest("session");
  if (!auth.authenticated) throw Error("Log eerst in.");
  const remote = await cloudRequest("snapshot");
  if (!validateCloudState(remote.state)) throw Error("Er is nog geen cloudadministratie.");
  await restoreCloudState(localStorage, remote.state);
  // Explicitly loading the account resumes sync after a previous local-only choice.
  localStorage.setItem("moneylith.storage.mode", '"cloud"');
  loadedAt=new Date().toISOString();
  remember({ email: auth.email, revision: remote.revision, hash: await fingerprint(remote.state) });
  window.location.reload();
}
export function stopCloudSync() { session = null; }

/** Flush an active account before a user-requested app reload; local-only data stays local. */
export async function prepareCloudReload() {
  if(localStorage.getItem('moneylith.storage.mode')==='"local"')return;
  const deadline = Date.now() + 25000;
  while (saving) {
    if (Date.now() > deadline) throw Error("Opslaan is nog bezig. Wacht even en probeer opnieuw.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  for(let attempt=0;session&&attempt<3;attempt++){
    await saveCloudChanges();
    if(!session||await fingerprint(collectCloudState(localStorage))===session.hash)return;
  }
  if(session)throw Error('Opslaan is nog niet afgerond. Probeer het opnieuw; lokale gegevens zijn behouden.');
}

export async function refreshCloudChanges(){
  if(!session||saving||localStorage.getItem('moneylith.storage.mode')==='"local"')return false;
  saving=true;
  const current=session;
  try{
    const remote=await cloudRequest('snapshot');
    if(session!==current||remote.revision===current.revision)return false;
    if(!validateCloudState(remote.state))throw Error('Ongeldige cloudadministratie. Lokale gegevens zijn behouden.');
    const remoteHash=await fingerprint(remote.state);
    // Read after the network request, so edits made while fetching are included.
    const local=collectCloudState(localStorage);
    const merged=mergeCloudVersions(baseState,local,remote.state);
    await restoreCloudState(localStorage,merged);
    loadedAt=new Date().toISOString();
    baseState=remote.state;
    remember({...current,revision:remote.revision,hash:remoteHash});
    window.dispatchEvent(new Event('moneylith:cloud-restored'));
    return true;
  }finally{saving=false;}
}
export async function runBankScan(){
  if(localStorage.getItem('moneylith.storage.mode')==='"local"')throw Error('Kies accountopslag bij Instellingen om je bankgegevens op al je apparaten bij te werken.');
  await prepareCloudReload();
  if(!session)throw Error('Log in met je Moneylith-account en kies accountopslag.');
  // This operation can include several provider calls; use its own bounded timeout.
  const response=await fetch('/api/cloud?action=bank-scan',{method:'POST',headers:cloudHeaders,body:'{}',signal:AbortSignal.timeout(120000)});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'Bankcontrole mislukt. Eerdere gegevens blijven behouden.');
  await prepareCloudReload();
  await refreshCloudChanges();
  await prepareCloudReload();
  window.dispatchEvent(new Event('moneylith:cloud-saved'));
  return data.scan as import('../bank/processSync').BankScan;
}

/** Derive pending status from the same snapshot used for saving, never from a timer alone. */
export async function cloudSyncStatus(){
 const current=session;
 return {connected:!!current,saving,lastSavedAt:current?.savedAt??null,loadedAt,pending:current?await fingerprint(collectCloudState(localStorage))!==current.hash:false};
}
