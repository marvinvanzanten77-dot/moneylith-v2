/** Display-only normalization; original bank evidence and identity remain unchanged. */
export function bankText(value:string):string {
 return value.replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi,entity=>{
 const names:Record<string,string>={'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
 if(names[entity.toLowerCase()])return names[entity.toLowerCase()];
 const hex=entity.toLowerCase().startsWith('&#x');const n=parseInt(entity.slice(hex?3:2,-1),hex?16:10);
 return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
 }).replace(/\s+/g,' ').trim();
}
