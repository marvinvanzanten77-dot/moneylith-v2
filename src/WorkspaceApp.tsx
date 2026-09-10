import { useEffect, useState } from "react";
import PersonalApp from "./App";

import BusinessWorkspace from "./business/BusinessWorkspace";
import { resolveWorkspaceMode, type WorkspaceMode as Mode } from "./components/workspaceMode";
const modeKey = "moneylith.workspace.v1";
const hashes: Record<Mode, string> = { personal: "#persoonlijk", real: "#zakelijk" };
function initialMode(): Mode {
  let saved: string | null = null;
  try { saved = localStorage.getItem(modeKey); } catch { /* Navigation works without storage. */ }
  return resolveWorkspaceMode(window.location.hash, saved);
}

export default function WorkspaceApp() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [enteredWorkspace, setEnteredWorkspace] = useState(() => {
    try {
      return (
        initialMode() !== "personal" ||
        sessionStorage.getItem("moneylith.navigation.entered") === "true"
      );
    } catch {
      return initialMode() !== "personal";
    }
  });
  useEffect(() => {
    try {
      if (enteredWorkspace)
        sessionStorage.setItem("moneylith.navigation.entered", "true");
    } catch {
      /* UI state is optional. */
    }
  }, [enteredWorkspace]);
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    if (window.location.hash === "#zakelijk-demo")
      history.replaceState(null, "", window.location.pathname + window.location.search + "#zakelijk");
    // Remember direct hash links as well as button navigation, without touching user records.
    try {
      localStorage.setItem(modeKey, mode);
    } catch {
      /* The business workspace reports any data-storage error. */
    }
  }, [mode]);
  const select = (next: Mode) => {
    setEnteredWorkspace(true);
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + hashes[next],
    );
    window.scrollTo({ top: 0, behavior: "instant" });
    setMode(next);
  };
  useEffect(() => {
    const changed = () => {
      setEnteredWorkspace(true);
      const next = initialMode();
      if (window.location.hash === "#zakelijk-demo")
        history.replaceState(null, "", window.location.pathname + window.location.search + "#zakelijk");
      setMode(next);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const openBusiness = () => select("real");
  if (window.location.pathname !== "/" || mode === "personal")
    return (
      <PersonalApp
        onOpenBusiness={openBusiness}
        skipOnboarding={enteredWorkspace}
      />
    );
  return (
    <BusinessWorkspace
      key={mode}
      onPersonal={() => select("personal")}
    />
  );
}
