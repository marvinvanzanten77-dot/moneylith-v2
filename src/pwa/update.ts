/** Wait for the existing worker registration to finish updating; never unregister it. */
export async function updateWorker(registration: ServiceWorkerRegistration) {
  await registration.update();
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === 'activated') return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer); worker.removeEventListener('statechange', check);
      error ? reject(error) : resolve();
    };
    const check = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('Bijwerken is niet gelukt. Probeer het opnieuw.'));
    };
    const timer = setTimeout(() => finish(new Error('Bijwerken duurt te lang. Probeer het opnieuw.')), 15000);
    worker.addEventListener('statechange', check);
    check();
  });
}
export function updateUrl(href: string, version: string) {
  const url = new URL(href);
  url.searchParams.set('appUpdate', version);
  return url.href;
}
export async function latestVersion(request: typeof fetch = fetch) {
  const response = await request('/app-version.json', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('De nieuwste versie is niet bereikbaar. Probeer het later opnieuw.');
  const data = await response.json();
  if (typeof data.version !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(data.version))
    throw Error('De appversie kon niet worden gecontroleerd. Probeer het opnieuw.');
  return data.version as string;
}
