import { useLocalStorage } from "../hooks/useLocalStorage";

export function UserProfileCard() {
  const [name, setName] = useLocalStorage<string>("user-name", "");
  const [email, setEmail] = useLocalStorage<string>("user-email", "");

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Gebruiker</h2>
      <p className="text-xs text-slate-500">Sla je naam/e-mail lokaal op. Er is geen account of backend.</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Naam</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">E-mail</label>
          <input
            type="email"
            className="mt-1 block w-full rounded-md border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
