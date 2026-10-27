import type {Notice} from './engine';
/** Similar cause in the same period; amounts are not summed across overlapping signals. */
export function groupNotices(notices:Notice[]) {
 const groups=new Map<string,{key:string;label:string;notices:Notice[]}>();
 for(const notice of notices){
  const key=[notice.month,notice.kind,notice.label].join(':');
  const group=groups.get(key)??{key,label:notice.label+' · '+notice.month,notices:[]};
  group.notices.push(notice);groups.set(key,group);
 }
 return [...groups.values()];
}
