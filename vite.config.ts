import { lunchflowLocal } from "./server/lunchflow/localPlugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "serve"
      ? [
          lunchflowLocal(
            loadEnv("", process.cwd(), "LUNCHFLOW_").LUNCHFLOW_API_KEY || "",
          ),
        ]
      : []),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
}));
