import {prepareCloudReload} from '../storage/cloudSync';
import { useEffect, useRef, useState } from "react";
import { SurfaceCard, Button, Select } from "./WorkspaceUI";
import type { MoneylithAccount } from "../types";
import type {
  LunchAccount,
  LunchSnapshot,
  LunchDiagnostic,
} from "../bank/lunchflowTypes";
import type { LunchMapping, mergeLunchflow } from "../bank/lunchflowMerge";
type Report = ReturnType<typeof mergeLunchflow>["reports"];
export function LunchflowCard({
  accounts,
  onApply,
  remoteAccess,
}: {
  accounts: MoneylithAccount[];
  remoteAccess?: { endpoint: string; onExpired: () => void; accountAccess?: boolean };
  onApply: (snapshots: LunchSnapshot[], mappings: LunchMapping[]) => Report;
}) {
  const [remote, setRemote] = useState<LunchAccount[]>([]),
    [selection, setSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reports, setReports] = useState<Report>([]),
    [loaded, setLoaded] = useState(false);
  const [diagnostic, setDiagnostic] = useState<LunchDiagnostic | null>(null);
  const controller = useRef<AbortController | null>(null),
    apply = useRef(onApply);
  apply.current = onApply;
  useEffect(() => () => controller.current?.abort(), []);
  const isLocal =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  const available = isLocal || Boolean(remoteAccess);
  async function request(action: "accounts" | "sync" | "test") {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setReports([]);
    setDiagnostic(null);
    try {
      const ids = remote.filter((a) => selection[a.id]).map((a) => a.id);
      const response = await fetch(remoteAccess?.endpoint ?? "/api/lunchflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(remoteAccess
            ? { "X-Moneylith-Private": "1" }
            : { "X-Moneylith-Local": "1" }),
        },
        body: JSON.stringify({ action, ids }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (response.status === 401 && remoteAccess) {
        remoteAccess.onExpired();
        return;
      }
      if (!response.ok)
        throw Error(
          data?.error?.message ||
            "Lunch Flow-verzoek mislukt. Bestaande gegevens zijn behouden.",
        );
      if (abort.signal.aborted) return;
      if (action === "test") {
        setDiagnostic(data.diagnostic);
        return;
      }
      if (action === "accounts") {
        setRemote(data.accounts);
        setLoaded(true);
        setSelection(
          Object.fromEntries(
            (data.accounts as LunchAccount[]).map((a) => [
              a.id,
              accounts.find(
                (m) =>
                  m.bankProvider === "lunchflow" && m.bankAccountId === a.id,
              )?.id ?? "",
            ]),
          ),
        );
      } else {
        const result = apply.current(
          data.results,
          ids.map((providerId) => ({
            providerId,
            targetId: selection[providerId],
          })),
        );
        if(remoteAccess?.accountAccess) await prepareCloudReload();
        setReports(result);
        setSelection((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([id, target]) => [
              id,
              target === "new" &&
              result.find(
                (r) => r.label === remote.find((a) => a.id === id)?.label,
              )?.ok
                ? `lunchflow:account:${id}`
                : target,
            ]),
          ),
        );
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Verzoek mislukt.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <SurfaceCard className="space-y-3" data-lunchflow>
      <h3 className="text-lg font-semibold">
        Lunch Flow — persoonlijke koppeling
      </h3>
      <p className="text-sm text-slate-600">
        Haal je reeds gekoppelde rekeningen op. Dit leest de gegevens die Lunch
        Flow beschikbaar heeft; het garandeert geen nieuwe verversing bij ING.
        Alleen geboekte transacties worden geïmporteerd.
      </p>
      {!available ? (
        <p className="text-sm">
          Deze proef is uitsluitend lokaal beschikbaar. Je persoonlijke sleutel
          en bankgegevens worden niet via deze website aangeboden.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Kies per rekening een bestaande Moneylith-rekening of maak
            uitdrukkelijk een nieuwe aan. Import vindt alleen plaats in
            Persoonlijk. Bestaande startsaldi, categorieën en notities blijven
            behouden.
          </p>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void request("test")}
          >
            {busy ? "Bezig…" : "Verbinding testen"}
          </Button>
          <p className="text-xs text-slate-600">
            De verbindingstest controleert rekeningen, saldi en transacties. Er
            wordt niets in je administratie opgeslagen.
          </p>
          <Button disabled={busy} onClick={() => void request("accounts")}>
            {busy ? "Bezig…" : "Rekeningen ophalen"}
          </Button>
          {loaded && remote.length === 0 ? (
            <p>Geen rekeningen beschikbaar voor deze API-sleutel.</p>
          ) : null}
          {remote.map((a) => {
            const linked = accounts.find(
              (m) => m.bankProvider === "lunchflow" && m.bankAccountId === a.id,
            );
            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-300 p-3 space-y-2"
              >
                <p className="font-semibold">
                  {a.label}{" "}
                  <span className="font-normal text-sm">
                    {a.status === "ACTIVE"
                      ? "Actief"
                      : "Controleer koppeling in Lunch Flow"}
                    {a.currency ? ` · ${a.currency}` : ""}
                  </span>
                </p>
                <label className="block text-sm">
                  Koppelen aan
                  <Select
                    aria-label={`Koppelen aan ${a.label}`}
                    disabled={busy || a.status !== "ACTIVE"}
                    value={selection[a.id] ?? ""}
                    onChange={(e) =>
                      setSelection((prev) => ({
                        ...prev,
                        [a.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Niet synchroniseren</option>
                    {accounts
                      .filter((m) =>
                        linked
                          ? m.id === linked.id
                          : !m.bankAccountId && m.source !== "bank",
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (bestaand)
                        </option>
                      ))}
                    {!linked ? (
                      <option value="new">
                        Nieuwe Moneylith-rekening aanmaken
                      </option>
                    ) : null}
                  </Select>
                </label>
                {linked?.bankLastSync ? (
                  <p className="text-xs">
                    Laatste geslaagde synchronisatie:{" "}
                    {new Date(linked.bankLastSync).toLocaleString("nl-NL")}
                  </p>
                ) : null}
                {!linked && selection[a.id] === "new" && accounts.length > 0 ? (
                  <p className="text-xs">
                    Je hebt al rekeningen in Moneylith. Controleer of deze
                    rekening daar niet al tussen staat om dubbelen te voorkomen.
                  </p>
                ) : null}
              </div>
            );
          })}
          <Button
            variant="primary"
            disabled={busy || !remote.some((a) => selection[a.id])}
            onClick={() => void request("sync")}
          >
            {busy ? "Synchroniseren…" : "Synchroniseren"}
          </Button>
        </>
      )}
      {diagnostic ? (
        <div
          role="status"
          className="space-y-2 text-sm"
          data-lunchflow-diagnostic
        >
          <p className="font-semibold">
            {diagnostic.checks.length > 0 &&
            diagnostic.checks.every((c) => c.balance.ok && c.transactions.ok)
              ? "Verbindingstest geslaagd."
              : "Verbindingstest uitgevoerd; controleer de resultaten."}
          </p>
          <p>
            Rekeningenlijst geslaagd: {diagnostic.accountCount} rekening(en).
            Niets opgeslagen.
          </p>
          {diagnostic.checks.map((c, i) => (
            <p key={i}>
              {c.label}: saldo{" "}
              {c.balance.ok ? "geslaagd" : c.balance.error.message}; transacties{" "}
              {c.transactions.ok
                ? `geslaagd (${c.transactions.count})`
                : c.transactions.error.message}
              .
            </p>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {reports.length > 0 ? (
        <div role="status" className="space-y-2 text-sm">
          <p className="font-semibold">
            {reports.every((r) => r.ok)
              ? "Synchronisatie geslaagd."
              : reports.some((r) => r.ok)
                ? "Synchronisatie gedeeltelijk geslaagd."
                : "Synchronisatie niet geslaagd; eerdere gegevens behouden."}
          </p>
          {reports.map((r) => (
            <p key={r.label}>
              {r.label}: {r.message}
              {r.ok ? ` ${r.added} toegevoegd, ${r.updated} bijgewerkt.` : ""}
            </p>
          ))}
        </div>
      ) : null}
      {accounts
        .filter((a) => a.bankProvider === "lunchflow")
        .map((a) => (
          <p key={a.id} className="text-xs">
            {a.name}: laatste geslaagde synchronisatie{" "}
            {a.bankLastSync
              ? new Date(a.bankLastSync).toLocaleString("nl-NL")
              : "nog niet uitgevoerd"}
            .
          </p>
        ))}
    </SurfaceCard>
  );
}
