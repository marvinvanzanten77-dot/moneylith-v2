import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {parse} from 'dotenv';
import {bunqLocal} from './server/bunq/localPlugin';
import {randomUUID} from "node:crypto";
import { lunchflowLocal } from "./server/lunchflow/localPlugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/prive/" : "/",
  plugins: [
    react(),
    {name:'local-ocr-core',
      configureServer(server){server.middlewares.use((req,res,next)=>{
        const match=req.url?.split('?')[0].match(/^\/assets\/ocr\/(tesseract-core(?:-[a-z]+)*\.wasm\.js)$/);
        if(!match)return next();
        const path='node_modules/tesseract.js-core/'+match[1];
        if(!existsSync(path))return next();
        res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path));
      });},
      generateBundle(){for(const file of readdirSync('node_modules/tesseract.js-core').filter(f=>f.endsWith('.wasm.js')))this.emitFile({type:'asset',fileName:'assets/ocr/'+file,source:readFileSync('node_modules/tesseract.js-core/'+file)});}
    },
    {name: "personal-entrypoint", enforce: "post", generateBundle(_options, bundle){
      const entry = bundle["index.html"];
      if(entry){ entry.fileName = "personal.html"; bundle["personal.html"] = entry; delete bundle["index.html"]; }
    }},
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
