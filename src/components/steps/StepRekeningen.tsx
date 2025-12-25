import { useEffect, useMemo, useState } from "react";
import type { MoneylithAccount } from "../../types";

interface StepRekeningenProps {
  accounts: MoneylithAccount[];
  onSaveAccount: (account: MoneylithAccount) => void;
  onDeleteAccount?: (id: string) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

export function StepRekeningen({ accounts, onSaveAccount, onDeleteAccount }: StepRekeningenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<MoneylithAccount["type"]>("betaalrekening");
  const [iban, setIban] = useState("");
  const [startBalance, setStartBalance] = useState<number | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const accountToEdit = useMemo(() => accounts.find((a) => a.id === editingId), [accounts, editingId]);

  useEffect(() => {
    if (!accountToEdit) return;
    setName(accountToEdit.name);
    setType(accountToEdit.type);
    setIban(accountToEdit.iban ?? "");
    setStartBalance(accountToEdit.startBalance);
    setActive(accountToEdit.active);
    setDescription(accountToEdit.description ?? "");
    setIsPrimary(accountToEdit.isPrimary ?? false);
  }, [accountToEdit]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const id = editingId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    onSaveAccount({
      id,
      name: name.trim(),
      type,
      iban: iban.trim() || undefined,
      startBalance,
      active,
      description: description.trim() || undefined,
      isPrimary,
    });
    setEditingId(null);
    setName("");
    setIban("");
    setStartBalance(undefined);
    setActive(true);
    setDescription("");
    setIsPrimary(false);
    setType("betaalrekening");
  };

  const handleEdit = (acc: MoneylithAccount) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setIban(acc.iban ?? "");
    setStartBalance(acc.startBalance);
    setActive(acc.active);
    setDescription(acc.description ?? "");
    setIsPrimary(Boolean(acc.isPrimary));
  };

  const handleDelete = (id: string) => {
    if (!onDeleteAccount) return;
    const ok = window.confirm("Weet je zeker dat je deze rekening wilt verwijderen?");
    if (!ok) return;
    onDeleteAccount(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold text-white">Rekeningen</h1>
        <p className="text-sm text-white">
          Voeg hier je betaal- en spaarrekeningen toe. Deze gebruik ik om afschriften en uitgavenpatronen aan te koppelen.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="card-shell p-5 text-slate-900">
            <div className="mb-3 flex items-center justify-between text-slate-900">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Je rekeningen</h2>
                <p className="text-sm text-slate-600">Overzicht van al je rekeningen.</p>
              </div>
              <span className="text-xs text-slate-600">Totaal: {accounts.length} stuks</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-2xl border border-amber-400 bg-amber-100 p-4 text-sm text-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{acc.name}</h3>
                        <p className="text-xs text-slate-800 capitalize">{acc.type}</p>
                        {acc.iban ? <p className="text-[11px] text-slate-700">IBAN: {acc.iban}</p> : null}
                        {acc.description ? <p className="text-[11px] text-slate-800 mt-1">{acc.description}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {acc.isPrimary ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-300 text-amber-900 border border-amber-500/60">
                            Primair
                          </span>
                        ) : null}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            acc.active
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {acc.active ? "Actief" : "Inactief"}
                        </span>
                      </div>
                    </div>
                    {typeof acc.startBalance === "number" ? (
                      <p className="mt-2 text-xs text-slate-800">Startsaldo: {formatCurrency(acc.startBalance)}</p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold text-slate-800">
                      <button type="button" className="underline text-slate-900" onClick={() => handleEdit(acc)}>
                        Bewerken
                      </button>
                      {onDeleteAccount ? (
                        <button type="button" className="text-red-700 underline" onClick={() => handleDelete(acc.id)}>
                          Verwijderen
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-amber-400 bg-amber-100 p-6 text-sm text-slate-900">
                  Voeg minimaal een betaalrekening toe om afschriften, ritme en analyse te kunnen gebruiken.
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-slate-600">
              Wat hier ontbreekt, blijft onzichtbaar voor je hele financiele planning.
            </p>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="rounded-2xl border border-amber-400 bg-amber-100 p-5 flex flex-col gap-3 text-sm text-slate-900">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nieuwe/aanpassen</h2>
              <p className="text-xs text-slate-800">Vul de gegevens in en sla op.</p>
            </div>
            <label className="text-xs text-slate-800">
              Naam*
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900"
                placeholder="Naam van de rekening"
              />
            </label>
            <label className="text-xs text-slate-800">
              Type*
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MoneylithAccount["type"])}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="betaalrekening">Betaalrekening</option>
                <option value="spaarrekening">Spaarrekening</option>
                <option value="contant">Contant</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-700">
                {type === "betaalrekening"
                  ? "Deze rekening wordt gebruikt voor afschriften, ritme en uitgavenanalyse."
                  : type === "spaarrekening"
                  ? "Deze rekening telt mee als vermogen en buffer, niet voor uitgavenanalyse."
                  : "Contant gebruik je voor losse uitgaven, zonder afschriften."}
              </p>
            </label>
            <label className="text-xs text-slate-800">
              IBAN (optioneel)
              <input
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900"
                placeholder="NL..."
              />
            </label>
            <label className="text-xs text-slate-800">
              Beschrijving (optioneel)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900"
                placeholder="Bijv. zakelijke spaarrekening"
              />
            </label>
            <label className="text-xs text-slate-800">
              Startsaldo (optioneel)
              <input
                type="number"
                value={startBalance ?? ""}
                onChange={(e) => setStartBalance(e.target.value === "" ? undefined : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900"
              />
              <p className="mt-1 text-[11px] text-slate-700">
                Dit is het saldo bij de start van je planning. Dit beinvloedt je beginvermogen en buffer. Spaarrekeningen met
                startsaldo tellen als vermogen; voer dit niet dubbel in bij "Vermogen".
              </p>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-800">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Actief
            </label>
            <p className="text-[11px] text-slate-700">
              Alleen actieve rekeningen worden gebruikt in afschriften, ritme en analyse.
            </p>
            <label className="inline-flex items-center gap-2 text-xs text-slate-800">
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> Primair
            </label>
            <p className="text-[11px] text-slate-700">
              De primaire rekening is alleen de standaardselectie; alle actieve rekeningen tellen mee in analyse en afschriften.
            </p>
            <button
              type="button"
              className="mt-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              onClick={handleSubmit}
            >
              {editingId ? "Rekening bijwerken" : "Rekening opslaan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


