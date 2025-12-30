import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "../../utils/format";
import type { MoneylithAccount } from "../../types";

interface StepRekeningenProps {
  accounts: MoneylithAccount[];
  onSaveAccount: (account: MoneylithAccount) => void;
  onDeleteAccount?: (id: string) => void;
}

export function StepRekeningen({ accounts, onSaveAccount, onDeleteAccount }: StepRekeningenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<MoneylithAccount["type"]>("betaalrekening");
  const [iban, setIban] = useState("");
  const [startBalance, setStartBalance] = useState<number | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [ibanError, setIbanError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const accountToEdit = useMemo(() => accounts.find((a) => a.id === editingId), [accounts, editingId]);
  const hasActivePayAccount = useMemo(
    () => accounts.some((a) => a.type === "betaalrekening" && a.active),
    [accounts],
  );

  useEffect(() => {
    if (!accountToEdit) return;
    setName(accountToEdit.name);
    setType(accountToEdit.type);
    setIban(accountToEdit.iban ?? "");
    setStartBalance(accountToEdit.startBalance);
    setActive(accountToEdit.active);
    setDescription(accountToEdit.description ?? "");
    setIsPrimary(accountToEdit.isPrimary ?? false);
    setIbanError(null);
    setAmountError(null);
  }, [accountToEdit]);

  const validateIban = (value: string) => {
    if (!value) return null;
    const compact = value.replace(/\s+/g, "").toUpperCase();
    const pattern = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,}$/;
    return pattern.test(compact) ? null : "Geen geldige IBAN-notatie.";
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const ibanValidation = validateIban(iban.trim());
    setIbanError(ibanValidation);
    const numericAmount = typeof startBalance === "number" && Number.isFinite(startBalance) ? startBalance : undefined;
    setAmountError(null);
    if (ibanValidation) return;
    const id = editingId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    onSaveAccount({
      id,
      name: name.trim(),
      type,
      iban: iban.trim() || undefined,
      startBalance: numericAmount,
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
        {!hasActivePayAccount && (
          <div className="rounded-lg border border-amber-300 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
            Minimaal één <strong>actieve betaalrekening</strong> is nodig om afschriften, ritme en analyse te gebruiken. Markeer er
            minstens één als actief (en bij voorkeur primair).
          </div>
        )}
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
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900 ${
                  ibanError ? "border-red-400" : "border-slate-300"
                }`}
                placeholder="NL..."
              />
              {ibanError && <p className="text-[11px] text-red-600">{ibanError}</p>}
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
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={startBalance ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.,-]/g, "");
                  const normalized = raw.replace(",", ".");
                  const num = normalized === "" ? undefined : Number(normalized);
                  if (normalized && Number.isNaN(num)) {
                    setAmountError("Alleen getallen toegestaan.");
                  } else {
                    setAmountError(null);
                  }
                  setStartBalance(num);
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-500 caret-slate-900 ${
                  amountError ? "border-red-400" : "border-slate-300"
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-700">
                Dit is het saldo bij de start van je planning. Dit beinvloedt je beginvermogen en buffer. Spaarrekeningen met
                startsaldo tellen als vermogen; voer dit niet dubbel in bij "Vermogen".
              </p>
              {amountError && <p className="text-[11px] text-red-600">{amountError}</p>}
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


