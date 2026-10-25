import type {FixedCostManualItem} from '../types';
export const workCostPresets=['ChatGPT','Grok / grok.ai','Vercel','GitHub','Supabase','Mage.space','Suno','TikTok Promo'];
const identity=(name:string)=>{const n=name.toLowerCase().replace(/[^a-z0-9]/g,'');return ['grok','grokai','grokgrokai'].includes(n)?'grok':n;};
export function addWorkCost(items:FixedCostManualItem[],name:string,month:string,id:string,kind:'subscription'|'credits'='subscription'){
 const existing=name.trim()?items.find(i=>identity(i.naam)===identity(name)):undefined;
 if(existing)return {items:items.map(i=>i.id===existing.id?{...i,costGroup:'work-tools' as const}:i),id:existing.id};
 return {items:[...items,{id,naam:name,bedrag:0,amountEntered:false,dagVanMaand:0,paymentRoute:'card' as const,costGroup:'work-tools' as const,costKind:kind,monthlyVariable:true,monthlyAmounts:{[month]:null}}],id};
}
