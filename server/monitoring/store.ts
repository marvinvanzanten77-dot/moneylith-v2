import crypto from 'node:crypto';
import {cloudCommand,getCloudSnapshot} from '../utils/cloudStore.js';
import {decryptCloudPayload,encryptCloudPayload} from '../utils/cloudAuth.js';
import {validateCloudState} from '../../src/storage/cloudState.js';
import {emptyMonitoring,evaluateMonitoring,reconcileNotices,updateMonitoring,amsterdamDate,type MonitoringState} from '../../src/monitoring/engine.js';
const key=(email:string)=>`ml:monitoring:v1:${email.toLowerCase()}`;
export async function getMonitoring(email:string){
  const raw=await cloudCommand(['GET',key(email)]);
  if(raw===null)return {revision:'',state:emptyMonitoring()};
  if(typeof raw!=='string')throw Error('Ongeldige meldingopslag.');
  const envelope=JSON.parse(raw);
  const state=JSON.parse(decryptCloudPayload(envelope.encrypted)) as MonitoringState;
  if(state.version!==1||!Array.isArray(state.notices)||!state.preferences)throw Error('Ongeldige meldingopslag.');
  return {revision:envelope.revision as string,state};
}
export async function monitorAccount(email:string,action?:unknown,now=new Date()){
  for(let attempt=0;attempt<4;attempt++){
    const record=await getMonitoring(email);
    const snapshot=await getCloudSnapshot(email);
    const source=snapshot?JSON.parse(decryptCloudPayload(snapshot.encrypted)):{};
    if(!validateCloudState(source))throw Error('Ongeldige administratie.');
    let state=record.state;
    if(action!==undefined)state=updateMonitoring(state,action,now.toISOString());
    if(state.sourceRevision!==(snapshot?.revision??null)||!state.checkedAt||amsterdamDate(new Date(state.checkedAt))!==amsterdamDate(now)||now.getTime()-Date.parse(state.checkedAt)>3600000){
      const result=evaluateMonitoring(source,state.preferences,now);
      state={...state,notices:reconcileNotices(state.notices,result.signals,now.toISOString()),sourceRevision:snapshot?.revision??null,sourceFetchedAt:result.fetchedAt,checkedAt:now.toISOString(),status:result.status};
    }
    if(JSON.stringify(state)===JSON.stringify(record.state))return state;
    const envelope=JSON.stringify({revision:crypto.randomUUID(),encrypted:encryptCloudPayload(JSON.stringify(state))});
    const saved=await cloudCommand(['EVAL',"local old = redis.call('GET', KEYS[1]); local version = ''; if old then version = cjson.decode(old).revision end; if version ~= ARGV[1] then return 0 end; redis.call('SET', KEYS[1], ARGV[2]); return 1",1,key(email),record.revision,envelope]);
    if(saved===1)return state;
  }
  throw Error('Meldingen zijn op een ander apparaat gewijzigd. Probeer opnieuw.');
}
