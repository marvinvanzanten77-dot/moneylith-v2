import {BankScanButton} from '../pwa/BankScanButton';
import { useEffect, useState, useRef, type ComponentProps } from "react";
import { LunchflowCard } from "./LunchflowCard";
import { SurfaceCard, Input, Button } from "./WorkspaceUI";
const endpoint = "/api/bank/sync?provider=lunchflow";
export function LunchflowAccess(props: ComponentProps<typeof LunchflowCard>) {
  const live =
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    window.location.hostname === "www.moneylith.nl";
  const statusRequest = useRef<AbortController | null>(null);
  const [authenticated, setAuthenticated] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [accountAccess, setAccountAccess] = useState(false);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState("");
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    statusRequest.current = controller;
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Moneylith-Private": "1",
      },
      body: JSON.stringify({ action: "status" }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (controller.signal.aborted) return;
        if (r.ok) {
          setAuthenticated(data.authenticated === true);
          setAccountAccess(data.accountAccess === true);
        }
        else
          setError(
            data.error?.message || "Testtoegang is nog niet beschikbaar.",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Testtoegang kon niet worden gecontroleerd.");
      });
    return () => controller.abort();
  }, [live]);
  async function authenticate(action: "login" | "logout") {
    statusRequest.current?.abort();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Moneylith-Private": "1",
        },
        body: JSON.stringify({
          action,
          email,
          code: action === "login" ? code : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error?.message || "Testtoegang mislukt.");
      setAuthenticated(data.authenticated === true);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verzoek mislukt.");
    } finally {
      setBusy(false);
    }
  }
  if (!live) return <LunchflowCard {...props} />;
  return (
    <div className="space-y-4" data-lunchflow-access>
      {!authenticated ? (
        <SurfaceCard className="space-y-3">
          <h3 className="text-lg font-semibold">
            Lunch Flow — persoonlijke live-test
          </h3>
          <p className="text-sm">
            Log in op je Moneylith-account via Instellingen voor toegang tot je bankkoppeling en opslag op meerdere apparaten.
            De oorspronkelijke testtoegang blijft beschikbaar voor de eenmalige activering: log in met je
            e-mailadres en je aparte persoonlijke testcode. Dit is niet je
            gewone Moneylith-wachtwoord of je Lunch Flow API-sleutel.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void authenticate("login");
            }}
          >
            <label className="block text-sm">
              E-mailadres
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <label className="block text-sm">
              Persoonlijke testcode
              <Input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Controleren…" : "Persoonlijke test openen"}
            </Button>
          </form>
        </SurfaceCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
            <p>{accountAccess ? "Bankkoppeling verbonden met je Moneylith-account." : "Persoonlijke testtoegang actief (maximaal één uur). Activeer je Moneylith-account bij Instellingen voor opslag op meerdere apparaten."}</p>
            {!accountAccess && <Button disabled={busy} onClick={() => void authenticate("logout")}>
              Testtoegang sluiten
            </Button>}
          </div>
          {accountAccess&&<BankScanButton/>}
          <LunchflowCard
            {...props}
            remoteAccess={{
              endpoint,
              accountAccess,
              onExpired: () => {
                setAuthenticated(false);
                setError("Je testtoegang is verlopen. Log opnieuw in.");
              },
            }}
          />
        </>
      )}
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
