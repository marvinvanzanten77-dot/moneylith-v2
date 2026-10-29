import {useEffect,useRef,type ReactNode} from 'react';
import {Icon,categoryIcon,type IconName} from './Icon';
import {formatCurrency} from '../utils/format';
export const euro=(cents:number|null|undefined)=>cents==null?'Nog onbekend':formatCurrency(cents/100,true);
export const day=(date:string|null)=>date?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):'Datum kiezen';
export function Emblem({label,icon}:{label?:string;icon?:IconName}){const name=icon??categoryIcon(label??'');return <span className={'nw-emblem ml-'+name}><Icon name={name}/></span>;}
export function Progress({value,max,label}:{value:number|null;max:number|null;label:string}){return <div className="nw-progress" role="img" aria-label={label}><span style={{width:value===null||max===null||max<=0?'0%':`${Math.min(100,Math.max(0,value/max*100))}%`}}/></div>;}
export function EmptyState({title,children}:{title:string;children?:ReactNode}){return <div className="nw-empty"><Emblem icon="leaf"/><h2>{title}</h2>{children}</div>;}
export function Sheet({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);return <dialog ref={ref} className="nw-sheet" aria-labelledby="nw-sheet-title" onClose={()=>{if(!ref.current?.open)onClose();}}><header><h2 id="nw-sheet-title">{title}</h2><button className="ml-icon-button" aria-label="Sluiten" onClick={onClose} autoFocus><Icon name="close"/></button></header><div className="nw-sheet-body">{children}</div></dialog>;}
export function Action({children,onClick,secondary=false}:{children:ReactNode;onClick:()=>void;secondary?:boolean}){return <button className={secondary?'nw-secondary':'nw-primary'} onClick={onClick}>{children}</button>;}
