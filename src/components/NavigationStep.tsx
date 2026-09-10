import type { ButtonHTMLAttributes } from "react";

/** Shared navigation semantics and layout for personal and business steps. */
export function NavigationStep({
  label,
  status,
  description,
  active,
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  status: string;
  description: string;
  active: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "step" : undefined}
      {...button}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="step-status text-[10px]">{status}</span>
      </span>
      <span
        className={`step-description block text-[11px] ${active ? "text-slate-900" : "text-slate-400"}`}
      >
        {description}
      </span>
    </button>
  );
}
