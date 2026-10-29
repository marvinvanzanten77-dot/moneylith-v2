import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {join,dirname,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
test('agent loads as native production ESM, without tsx extension resolution',()=>{
 const root=process.cwd(),out=mkdtempSync(join(tmpdir(),'ml-agent-runtime-')),seen=new Set<string>();
 try{
  writeFileSync(join(out,'package.json'),'{"type":"module"}');symlinkSync(join(root,'node_modules'),join(out,'node_modules'),'dir');
  function compile(file:string){
   if(seen.has(file))return;seen.add(file);
   const text=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
   const dest=join(out,relative(root,file)).replace(/\.tsx?$/,'.js');mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,text);
   for(const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
    assert.ok(match[1].endsWith('.js'),`Native ESM requires extension: ${relative(root,file)} → ${match[1]}`);
    const base=resolve(dirname(file),match[1]);const source=[base.replace(/\.js$/,'.ts'),base.replace(/\.js$/,'.tsx'),base].find(existsSync);assert.ok(source);compile(source);
   }
  }
  compile(join(root,'server/agent/service.ts'));
  const result=execFileSync(process.execPath,['--input-type=module','-e',"const m=await import('./server/agent/service.js'); if(!m.agentContext({}).returnedPayments) throw Error('Missing derived index'); console.log('ok')"],{cwd:out,encoding:'utf8'});
  assert.equal(result.trim(),'ok');
 }finally{rmSync(out,{recursive:true,force:true});}
});
