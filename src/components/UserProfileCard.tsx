import { useLocalStorage } from "../hooks/useLocalStorage";

export function UserProfileCard() {
  const [name, setName] = useLocalStorage<string>("user-name", "");
  const [email, setEmail] = useLocalStorage<string>("user-email", "");

  return (
    <div className="mb-6 card-shell p-5 text-slate-900">
      <h2 className="text-lg font-semibold">Jouw gegevens</h2>
      <p className="text-xs text-slate-600">Alleen jij ziet dit; het blijft op dit apparaat.</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Naam</label>
          <input
            type="text"
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">E-mail</label>
          <input
            type="email"
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
