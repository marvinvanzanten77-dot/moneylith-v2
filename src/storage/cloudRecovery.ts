import type { CloudState } from './cloudState';

/** A committed device-local backup; never uploaded or stored alongside the active snapshot. */
export function saveCloudRecovery(previous: CloudState, legacy: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('moneylith-cloud-recovery', 1);
    let finished = false;
    const fail = () => { finished = true; reject(new Error('Herstelopslag niet beschikbaar.')); };
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onerror = fail;
    request.onblocked = fail;
    request.onsuccess = () => {
      const db = request.result;
      if (finished) { db.close(); return; }
      try {
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        store.put({ state: previous, savedAt: new Date().toISOString() }, 'latest');
        if (legacy !== null) store.put(legacy, 'legacy');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); fail(); };
        tx.onerror = () => { /* transaction abort handles rejection */ };
      } catch { db.close(); fail(); }
    };
  });
}

/** Export a recovery without replacing the active administration. */
export function readCloudRecovery():Promise<{state:CloudState;savedAt:string}|null>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('moneylith-cloud-recovery',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
  request.onerror=()=>reject(Error('Herstelkopie niet bereikbaar.'));
  request.onblocked=()=>reject(Error('Sluit andere Moneylith-tabbladen en probeer opnieuw.'));
  request.onsuccess=()=>{const db=request.result;const tx=db.transaction('snapshots','readonly');const get=tx.objectStore('snapshots').get('latest');get.onsuccess=()=>resolve(get.result??null);get.onerror=()=>reject(Error('Herstelkopie niet bereikbaar.'));tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(Error('Lezen van herstelkopie afgebroken.'));};};
 });
}
