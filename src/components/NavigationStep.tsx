import type { ButtonHTMLAttributes } from "react";

/** Shared navigation semantics and layout for personal and business steps. */
export function NavigationStep({
  label,
  status,
  description,
  active,
  backup = false,
  className = "",
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  status: string;
  description: string;
  active: boolean;
  backup?: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "step" : undefined}
      {...button}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? backup
            ? "bg-emerald-400/90 text-slate-950 border border-emerald-200 shadow-md"
            : "bg-amber-500/90 text-slate-950 border border-amber-300 shadow-md"
          : button.disabled
            ? "cursor-not-allowed bg-white/5 text-slate-500 border border-white/10"
            : backup
              ? "bg-emerald-900/40 text-emerald-100 border border-emerald-400/50 hover:bg-emerald-800/60 hover:border-emerald-200"
              : "bg-amber-900/30 text-amber-100 border border-amber-700 hover:border-amber-500"
      } ${className}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="step-status text-[10px]">{status}</span>
      </span>
      <span
        className={`step-description block text-[11px] ${["Fundament", "Doelen", "Vooruitblik"].includes(label) ? "lg:min-h-10" : ""} ${active ? "text-slate-900" : "text-slate-400"}`}
      >
        {description}
      </span>
    </button>
  );
}
