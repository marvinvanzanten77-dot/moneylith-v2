import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewSeed} from './personal-review-fixture.ts';
const root=fileURLToPath(new URL('../dist',import.meta.url));
const seed=JSON.stringify(reviewSeed);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5187');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"connect-src 'self'; form-action 'none'");
 if(url.pathname==='/api/cloud'&&url.searchParams.get('action')==='session'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,authenticated:true,email:'review@example.invalid'}));return;}
 if(url.pathname.startsWith('/api/')||req.method!=='GET'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Lokale review: bank, cloud en AI zijn uitgeschakeld.'}));return;}
 const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname).replace(/^\/prive(?=\/)/,''));
 if(!candidate.startsWith(root+'/')&&candidate!==root){res.writeHead(403);res.end();return;}
 const file=fs.existsSync(candidate)&&fs.statSync(candidate).isFile()?candidate:path.join(root,'personal.html');
 const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream');
 if(ext!=='.html'){res.end(fs.readFileSync(file));return;}
 const injection=`<script>if(!localStorage.getItem('review.seeded')&&!Object.keys(localStorage).some(k=>k.startsWith('moneylith.personal.'))){const seed=${seed};for(const [k,v] of Object.entries(seed))localStorage.setItem(k,k==='moneylith.workspace.v1'?v:JSON.stringify(v));localStorage.setItem('review.seeded','true');sessionStorage.setItem('moneylith.navigation.entered','true');sessionStorage.setItem('moneylith.navigation.step.v1','overview');}</script><div style="padding:8px;background:#fde68a;color:#111827;text-align:center;font:14px system-ui">LOKALE REVIEW · Fictieve gegevens · Bank, cloud en AI uitgeschakeld</div>`;
 res.end(fs.readFileSync(file,'utf8').replace('<body>','<body>'+injection));
}).listen(5187,'127.0.0.1',()=>console.log('Review ready: http://127.0.0.1:5187'));
