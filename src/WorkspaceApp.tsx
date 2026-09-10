import { useEffect, useState } from "react";
import PersonalApp from "./App";

import BusinessWorkspace from "./business/BusinessWorkspace";
type Mode = "personal" | "demo" | "real";
const modeKey = "moneylith.workspace.v1";
const lastBusinessKey = "moneylith.business.lastWorkspace.v1";
const hashes: Record<Mode, string> = {
  personal: "#persoonlijk",
  demo: "#zakelijk-demo",
  real: "#zakelijk",
};
function initialMode(): Mode {
  const requested = (Object.keys(hashes) as Mode[]).find(
    (key) => hashes[key] === window.location.hash,
  );
  if (requested) return requested;
  try {
    const saved = localStorage.getItem(modeKey);
    return saved === "demo" || saved === "real" ? saved : "personal";
  } catch {
    return "personal";
  }
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
    // Remember direct hash links as well as button navigation, without touching user records.
    try {
      localStorage.setItem(modeKey, mode);
      if (mode !== "personal") localStorage.setItem(lastBusinessKey, mode);
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
      setMode(initialMode());
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const openBusiness = () => {
    let next: Mode = "demo";
    try {
      if (localStorage.getItem(lastBusinessKey) === "real") next = "real";
    } catch {
      /* Default is the isolated demo. */
    }
    select(next);
  };
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
      workspace={mode}
      onWorkspace={select}
      onPersonal={() => select("personal")}
    />
  );
}
