import { useRef, useState } from "react";
import {
  AccountsWorkspace,
  AccountTile,
} from "../components/AccountsWorkspace";
import { SurfaceCard } from "../components/WorkspaceUI";
import { EditDialog, type Field } from "./Editor";
import { type Account, type BusinessData, monthEnd } from "./model";
import { calculateBusiness } from "./finance";
import { formatCurrency } from "../utils/format";
export function BusinessAccounts({
  data,
  fields,
  onSave,
  onDelete,
}: {
  data: BusinessData;
  fields: Field[];
  onSave: (account: Account) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [version, setVersion] = useState(0),
    [error, setError] = useState("");
  const form = useRef<HTMLDivElement>(null);
  const account = data.accounts.find((a) => a.id === editing);
  const result = calculateBusiness(data);
  const reset = () => {
    setEditing(null);
    setVersion((v) => v + 1);
  };
  return (
    <AccountsWorkspace
      list={
        <SurfaceCard className="space-y-3">
          <div className="flex justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Je rekeningen
              </h2>
              <p className="text-sm text-slate-600">
                Overzicht van al je zakelijke rekeningen.
              </p>
            </div>
            <span className="text-xs text-slate-600">
              Totaal: {data.accounts.length} stuks
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {!data.accounts.length && (
              <AccountTile>
                Voeg je zakelijke betaal- en spaarrekeningen toe. Vul zelf het
                beginsaldo en de begindatum in.
              </AccountTile>
            )}
            {data.accounts.map((a) => (
              <AccountTile key={a.id}>
                <h3>{a.label}</h3>
                <p>
                  {a.type === "payment" ? "Betaalrekening" : "Spaarrekening"}
                </p>
                <p className="text-xs">
                  Beginsaldo: {formatCurrency(a.opening / 100)} op {a.date}
                </p>
                <p className="text-xs">
                  Stand t/m {monthEnd(data.month)}:{" "}
                  {result.checks.cash.ready &&
                  result.accounts.find((r) => r.id === a.id)?.balance != null
                    ? formatCurrency(
                        result.accounts.find((r) => r.id === a.id)!.balance! /
                          100,
                      )
                    : "Nog niet gecontroleerd"}
                </p>
                <div className="mt-3 flex gap-3 text-[11px] font-semibold">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setEditing(a.id);
                      requestAnimationFrame(() => {
                        form.current?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        });
                        form.current
                          ?.querySelector("input")
                          ?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    Bewerken
                  </button>
                  <button
                    type="button"
                    className="underline text-red-700"
                    onClick={() => {
                      if (
                        !confirm(
                          "Weet je zeker dat je deze rekening wilt verwijderen?",
                        )
                      )
                        return;
                      try {
                        onDelete(a.id);
                        setError("");
                        if (editing === a.id) reset();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Verwijderen mislukt.",
                        );
                      }
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              </AccountTile>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
        </SurfaceCard>
      }
      form={
        <div ref={form}>
          <p className="text-xs text-slate-800">
            Vul de gegevens in en sla op.
          </p>
          <EditDialog
            key={`${editing ?? "new"}-${version}`}
            inline
            title="Nieuwe/aanpassen"
            button="Rekening opslaan"
            fields={fields}
            value={account ?? { type: "payment", date: "" }}
            onCancel={reset}
            onSave={(patch) => {
              onSave({
                ...account,
                ...patch,
                id: account?.id ?? crypto.randomUUID(),
              } as Account);
              reset();
            }}
          />
        </div>
      }
    />
  );
}
