import {useEffect,useState} from 'react';
const preference='moneylith.ui.compact';
export function compactRequested(width:number, standalone:boolean, appLink:boolean, saved:string|null){
  if(saved==='full')return false;
  return saved==='compact'||width<768||standalone||appLink;
}
export function useCompactMode(){
  const read=()=>{
    if(typeof window==='undefined')return false;
    let saved:string|null=null;try{saved=localStorage.getItem(preference);}catch{/* Optional UI preference. */}
    return compactRequested(window.innerWidth,window.matchMedia('(display-mode: standalone)').matches,new URLSearchParams(location.search).get('app')==='1',saved);
  };
  const [compact,setCompact]=useState(read);
  useEffect(()=>{const update=()=>setCompact(read());window.addEventListener('resize',update);window.addEventListener('moneylith:layout',update);return()=>{window.removeEventListener('resize',update);window.removeEventListener('moneylith:layout',update);};},[]);
  const select=(value:boolean)=>{try{localStorage.setItem(preference,value?'compact':'full');}catch{/* Current session still works. */}setCompact(value);window.dispatchEvent(new Event('moneylith:layout'));};
  return [compact,select] as const;
}
