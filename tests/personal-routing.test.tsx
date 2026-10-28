import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
test('public home and assets resolve to Public while private workspace uses its own build', () => {
  const destination = (source: string) => config.rewrites.find((r: {source: string}) => r.source === source)?.destination;
  assert.equal(destination('/'), 'https://moneylith-public.vercel.app/');
  assert.equal(destination('/assets/:path*'), 'https://moneylith-public.vercel.app/assets/:path*');
  assert.equal(destination('/prive/assets/:path*'), '/assets/:path*');
  assert.equal(destination('/prive'), '/index.html');
  assert(!config.rewrites.some((r: {source: string, destination: string}) => r.source.startsWith('/api') && r.destination.startsWith('https:')));
});
test('installed app identity and push registration survive while opening the private path', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/prive?app=1');
  const worker = readFileSync('public/sw.js', 'utf8');
  assert(worker.includes("openWindow('/prive?app=1&view=notifications#persoonlijk')"));
  assert(readFileSync('src/pwa/register.ts','utf8').includes("register('/sw.js',{scope:'/'"));
  assert(config.redirects.some((r: {source: string,destination: string}) => r.source === '/' && r.destination === '/prive?app=1'));
});
