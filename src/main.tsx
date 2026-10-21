import React from "react";
import ReactDOM from "react-dom/client";
import App from "./WorkspaceApp";
import "./index.css";
import { CloudSyncBoundary } from "./components/CloudSyncBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CloudSyncBoundary><App /></CloudSyncBoundary>
  </React.StrictMode>
);
