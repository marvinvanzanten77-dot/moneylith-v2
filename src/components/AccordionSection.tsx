import type { ReactNode } from "react";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledReason?: string;
  children: ReactNode;
}

export function AccordionSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  disabled = false,
  disabledReason,
  children,
}: AccordionSectionProps) {
  return (
    <div
      className={`card-shell overflow-hidden p-0 transition duration-200 ${
        isOpen ? "shadow-2xl ring-1 ring-white/40" : "shadow-md opacity-90"
      }`}
    >
      <button
        type="button"
        onClick={() => (!disabled ? onToggle() : null)}
        aria-expanded={isOpen}
        disabled={disabled}
        className={`flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 ${
          isOpen ? "bg-white/20 text-slate-900" : "bg-white/10 text-slate-800 hover:bg-white/16"
        }`}
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-600">{subtitle}</p> : null}
          {disabled && disabledReason ? <p className="text-[11px] text-slate-500">{disabledReason}</p> : null}
        </div>
        <span
          className={`mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/80 text-slate-700 shadow-sm transition-all duration-200 ${
            isOpen ? "rotate-180 shadow-md scale-105" : "rotate-0 scale-100"
          }`}
          aria-hidden
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.18l3.71-3.95a.75.75 0 111.08 1.04l-4.25 4.52a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden border-t border-white/30 bg-white/75 px-5 pb-5 pt-2 text-slate-900">
          {isOpen && !disabled ? children : null}
        </div>
      </div>
    </div>
  );
}
