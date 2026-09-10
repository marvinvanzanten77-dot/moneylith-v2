export const recordControlClass =
  "rounded-md border border-slate-300 px-2 py-1.5 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100";
import { useId, type ReactNode } from "react";

/** The personal list interaction, shared with linked business records. */
export function ExpandableRecord({
  title,
  summary,
  expanded,
  onToggle,
  disabled = false,
  children,
}: {
  title: ReactNode;
  summary: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const panel = useId();
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all duration-200 ${expanded ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-200"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={panel}
        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${expanded ? "bg-amber-50" : "hover:bg-slate-50"}`}
      >
        <span className="flex-1 text-sm font-semibold text-slate-900">
          {title}
        </span>
        <span className="text-sm font-semibold text-slate-800">{summary}</span>
      </button>
      {expanded && <div id={panel}>{children}</div>}
    </div>
  );
}
