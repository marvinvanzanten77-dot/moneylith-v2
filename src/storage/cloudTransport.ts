/** Lossless wire format only: storage, revision checks and financial values stay unchanged. */
export const cloudWireLimit = 4_200_000;
export const cloudDecodedLimit = 16_000_000;
export const cloudEncoding = 'gzip-base64-v1';
export type PackedCloud = {encoding:typeof cloudEncoding;payload:string};
export async function packCloudRequest(body:unknown):Promise<string>{
 const raw=JSON.stringify(body);
 if(new TextEncoder().encode(raw).length>cloudDecodedLimit)throw Error('Administratie is te groot om veilig te synchroniseren. Lokale gegevens zijn behouden.');
 let result=raw;
 if(raw.length>128_000&&typeof CompressionStream!=='undefined'){
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  result=JSON.stringify({encoding:cloudEncoding,payload:btoa(binary)});
 }
 if(new TextEncoder().encode(result).length>cloudWireLimit)throw Error('Deze administratie kan niet in één keer worden verstuurd. Werk de app of browser bij; je lokale gegevens zijn behouden.');
 return result;
}
export async function unpackCloudResponse(data:any){
 if(data?.encoding!==cloudEncoding)return data;
 if(typeof data.payload!=='string'||data.payload.length>cloudWireLimit)throw Error('Ongeldige cloudgegevens. Lokale gegevens zijn behouden.');
 const binary=atob(data.payload),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>cloudDecodedLimit)throw Error('Cloudgegevens overschrijden de veilige laadlimiet.');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(joined));
}
