import {syncBankAccount} from '../server/lunchflow/accountSync.js';
import crypto from 'node:crypto';
import type {VercelRequest,VercelResponse} from '@vercel/node';
import {ownerConfig} from '../server/lunchflow/ownerAuth.js';
import {getCloudUser} from '../server/utils/cloudStore.js';
import {monitorAccount} from '../server/monitoring/store.js';
import {dispatchPush} from '../server/push/service.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Cache-Control','private, no-store');
  const secret=process.env.CRON_SECRET;
  const received=Buffer.from(String(req.headers.authorization??'')),expected=Buffer.from(`Bearer ${secret??''}`);
  if(req.method!=='GET'||!secret||secret.length<32||received.length!==expected.length||!crypto.timingSafeEqual(received,expected))return res.status(401).json({ok:false});
  const owner=ownerConfig();
  if(process.env.VERCEL_ENV!=='production'||!owner)return res.status(503).json({ok:false});
  try{
    if(!(await getCloudUser(owner.email))?.bankOwnerVerified)return res.status(403).json({ok:false});
    const now=new Date();
    const scanId=`scheduled:${now.toISOString().slice(0,13)}`;
    const scan=await syncBankAccount(owner.email,owner.apiKey,scanId,now);
    const result=await dispatchPush(owner.email,await monitorAccount(owner.email));
    return res.status(result.failed?503:200).json({ok:!result.failed,...result,bank:{ok:scan.ok,failed:scan.failed,at:scan.at}});
  }catch{return res.status(503).json({ok:false});}
}
