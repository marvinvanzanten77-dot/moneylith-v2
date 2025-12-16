import { SchuldenkaartCard } from "../SchuldenkaartCard";

type StepSchuldenProps = {
  onDebtSummary: (s: { totalDebt: number; totalMinPayment: number; debtCount: number }) => void;
};

// PERSISTENCY-AUDIT:
// ? SchuldenkaartCard gebruikt eigen localStorage en stuurt samenvatting terug via prop
export function StepSchulden({ onDebtSummary }: StepSchuldenProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Schulden inventarisatie</h2>
      <p className="text-sm text-slate-500">Hier breng je al je schulden in kaart. De som wordt gebruikt in overzicht en AI.</p>
      <SchuldenkaartCard onSummaryChange={onDebtSummary} />
    </div>
  );
}
