import { useEffect, useState, type ReactNode } from 'react';
import { cloudRequest } from '../storage/cloudSync';

/** Never mount the saved administration before the server confirms the owner session. */
export function PersonalAccess({ children }: { children: ReactNode }) {
  const local = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const [allowed, setAllowed] = useState(local);
  const [checking, setChecking] = useState(!local);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (local) return;
    let active = true;
    const check = async () => {
      try {
        const session = await cloudRequest('session');
        if (active) { setAllowed(session.authenticated === true); setError(''); }
      } catch {
        if (active) { setAllowed(false); setError('Je toegang kon niet worden gecontroleerd. Probeer opnieuw.'); }
      } finally { if (active) setChecking(false); }
    };
    void check();
    window.addEventListener('focus', check);
    return () => { active = false; window.removeEventListener('focus', check); };
  }, [local]);
  if (checking) return <p className="p-8 text-slate-100" role="status">Persoonlijke toegang controleren…</p>;
  if (allowed) return <>{children}</>;
  return <main className="ml-access"><form className="ml-access-form" onSubmit={e => {
    e.preventDefault(); setBusy(true); setError('');
    void cloudRequest('login', 'POST', { email, password }).then(() => {
      setPassword(''); window.location.reload();
    }).catch(() => setError('Inloggen mislukt. Gebruik je bestaande persoonlijke Moneylith-account.')).finally(() => setBusy(false));
  }}>
    <h1 className="text-2xl font-semibold">Moneylith Privé</h1>
    <p>Deze administratie is uitsluitend toegankelijk met je bestaande persoonlijke Moneylith-account. Een publiek account geeft hier geen toegang.</p>
    <label className="block">E-mailadres<input className="mt-1 block w-full rounded-lg p-3 text-slate-900" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="block">Wachtwoord<input className="mt-1 block w-full rounded-lg p-3 text-slate-900" type="password" autoComplete="current-password" required minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button disabled={busy} className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Even wachten…' : 'Persoonlijk inloggen'}</button>
    {error && <p role="alert">{error}</p>}
    <a className="block underline" href="/">Naar de publieke Moneylith</a>
  </form></main>;
}
