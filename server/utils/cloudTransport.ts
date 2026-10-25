import {gzipSync,gunzipSync} from 'node:zlib';
import {cloudEncoding,cloudDecodedLimit,cloudWireLimit} from '../../src/storage/cloudTransport.js';
export class CloudTransportError extends Error {}
export function unpackCloudRequest(body:Record<string,unknown>):Record<string,unknown>{
 if(body.encoding===undefined)return body;
 try{
  if(body.encoding!==cloudEncoding||typeof body.payload!=='string'||body.payload.length>cloudWireLimit||body.payload.length%4!==0||/[^A-Za-z0-9+/=]/.test(body.payload))throw Error();
  const bytes=Buffer.from(body.payload,'base64');if(bytes.toString('base64')!==body.payload)throw Error();
  const raw=gunzipSync(bytes,{maxOutputLength:cloudDecodedLimit});
  const decoded=JSON.parse(raw.toString('utf8'));
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded)||decoded.encoding!==undefined)throw Error();
  return decoded;
 }catch{throw new CloudTransportError('Ongeldige of te grote gecomprimeerde administratie. Lokale gegevens zijn behouden.');}
}
export function packCloudResponse(body:unknown){
 const raw=JSON.stringify(body);
 if(Buffer.byteLength(raw)>cloudDecodedLimit)throw new CloudTransportError('Cloudgegevens overschrijden de veilige laadlimiet.');
 const packed={encoding:cloudEncoding,payload:gzipSync(raw).toString('base64')};
 if(Buffer.byteLength(JSON.stringify(packed))>cloudWireLimit)throw new CloudTransportError('Cloudgegevens zijn te groot voor één overdracht.');
 return packed;
}
