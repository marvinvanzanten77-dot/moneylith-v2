import type { ReactNode } from "react";
export function AccountsWorkspace({
  list,
  form,
}: {
  list: ReactNode;
  form: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 flex flex-col gap-4">{list}</div>
      <div className="xl:col-span-1">
        <div className="rounded-2xl border border-amber-400 bg-amber-100 p-5 flex flex-col gap-3 text-sm text-slate-900 [&_.biz-form-grid]:grid-cols-1">
          {form}
        </div>
      </div>
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
