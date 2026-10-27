import {useEffect,useRef,type ReactNode} from 'react';
export function GuideDialog({children,onClose}:{children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={ref} onClose={onClose} aria-labelledby="personal-guide-title" className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900 p-5 text-white backdrop:bg-black/60"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="personal-guide-title" className="font-semibold">AI-hulp op verzoek</h2><button autoFocus className="rounded-lg border border-white/30 px-3 py-2" onClick={onClose}>Sluiten</button></div>{children}</dialog>;
}
