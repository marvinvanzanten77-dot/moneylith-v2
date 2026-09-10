export type NavigationHintValue = {
  label: string;
  desc: string;
  x: number;
  y: number;
};
export function NavigationHint({ hint }: { hint: NavigationHintValue | null }) {
  if (!hint) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[99] max-w-xs rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-lg"
      style={{
        top: hint.y,
        left: Math.max(8, Math.min(hint.x, window.innerWidth - 320)),
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        {hint.label}
      </div>
      <div className="text-amber-900">{hint.desc}</div>
    </div>
  );
}
