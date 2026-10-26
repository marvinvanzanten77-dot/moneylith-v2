import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {BunqClient,type BunqStore,type BunqContext} from './client.js';
export function localBunq(key:string,root=process.cwd()){
 const folder=path.join(root,'.bunq'),file=path.join(folder,'context.json');
 const store:BunqStore={async load(){try{return JSON.parse(await readFile(file,'utf8')) as BunqContext;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}},async save(context){await mkdir(folder,{recursive:true,mode:0o700});await writeFile(file+'.tmp',JSON.stringify(context),{mode:0o600});await rename(file+'.tmp',file);}};
 return new BunqClient(key,store);
}
