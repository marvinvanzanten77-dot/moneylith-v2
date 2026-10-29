import { registerAppWorker } from "./pwa/register";
import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { PersonalAccess } from "./components/PersonalAccess";
const App = lazy(() => import("./redesign/PersonalShell"));
import "./redesign/foundation.css";
import { CloudSyncBoundary } from "./components/CloudSyncBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PersonalAccess><CloudSyncBoundary><Suspense fallback={<p>Je persoonlijke administratie laden…</p>}><App /></Suspense></CloudSyncBoundary></PersonalAccess>
  </React.StrictMode>
);

registerAppWorker();
