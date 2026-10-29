import type {ChatMessage} from './context';
export const documentKey='moneylith.personal.agentDocuments.v1';
export type AgentDocument={id:string;name:string;text:string;note:string;createdAt:string};
export function agentHistory(value:unknown):ChatMessage[]{
 if(!Array.isArray(value))return [];
 let size=0;
 return value.filter((m):m is ChatMessage=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-100).reverse().filter(m=>{size+=m.content.length;return size<=100000;}).reverse();
}
export function agentDocuments(value:unknown):AgentDocument[]{
 if(!Array.isArray(value)||value.length>10)throw Error('Bewaar maximaal tien bijlagen; verwijder eerst een oude bijlage.');
 let total=0;const ids=new Set<string>();
 for(const d of value){
  if(!d||typeof d.id!=='string'||d.id.length>100||ids.has(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>200||typeof d.text!=='string'||!d.text.trim()||d.text.length>20000||typeof d.note!=='string'||d.note.length>500||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt)))throw Error('Ongeldige of te grote bijlage. Maximaal 20.000 tekens per document.');
  ids.add(d.id);total+=d.text.length;
 }
 if(total>100000)throw Error('De bijlagen bevatten samen te veel tekst. Verwijder eerst een oude bijlage.');
 return value;
}
export function enterSends(event:{key:string;shiftKey:boolean;nativeEvent:{isComposing?:boolean}}){return event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing;}
/** Keep recent turns plus relevant older context; the full bounded archive remains searchable. */
export function relevantHistory(history:ChatMessage[],question:string){
 const words=question.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)?.filter(w=>!['deze','welke','mijn','voor','over','iets','graag','kunnen','moeten','hebben'].includes(w))??[];
 const recent=history.slice(-16),older=history.slice(0,-16).filter(m=>words.some(w=>m.content.toLowerCase().includes(w))).slice(-8);
 let remaining=24000;
 return [...older,...recent].reverse().filter(m=>{remaining-=m.content.length;return remaining>=0;}).reverse();
}
