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
