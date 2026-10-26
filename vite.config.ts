import {readFileSync,existsSync} from 'node:fs';
import {parse} from 'dotenv';
import {bunqLocal} from './server/bunq/localPlugin';
import {randomUUID} from "node:crypto";
import { lunchflowLocal } from "./server/lunchflow/localPlugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {name: 'moneylith-app-version', generateBundle(){
      this.emitFile({type: 'asset', fileName: 'app-version.json', source: JSON.stringify({version: randomUUID()})});
    }},
    ...(command === "serve"
      ? [
          bunqLocal(existsSync('.env.bunq.local')?parse(readFileSync('.env.bunq.local')).BUNQ_API_KEY||'':''),
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
