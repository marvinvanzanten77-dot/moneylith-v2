import {useEffect,useRef, type ReactNode } from "react";
export function AccountsWorkspace({
  list,
  form,
  editingKey,
}: {
  list: ReactNode;
  form: ReactNode;
  editingKey?: string|null;
}) {
  const editor=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(editingKey&&editor.current){editor.current.open=true;editor.current.scrollIntoView({block:"nearest"});}},[editingKey]);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 flex flex-col gap-4">{list}</div>
      <details ref={editor} className="xl:col-span-1"><summary className="cursor-pointer py-3 font-semibold">Rekening toevoegen of bewerken</summary>
        <div className="rounded-2xl border border-amber-400 bg-amber-100 p-5 flex flex-col gap-3 text-sm text-slate-900 [&_.biz-form-grid]:grid-cols-1">
          {form}
        </div>
      </details>
    </div>
  );
}
export function AccountTile({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-400 bg-amber-100 p-4 text-sm text-slate-900">
      {children}
    </div>
  );
}
