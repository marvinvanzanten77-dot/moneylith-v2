import { GoalWorkspace } from "../components/GoalWorkspace";
import { GoalSummary } from "./InsightPanels";
import type { BusinessData, Goal } from "./model";
export function BusinessGoals({
  data,
  onSave,
  onDelete,
}: {
  data: BusinessData;
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const eur = (v: number | null) => (v === null ? null : v / 100);
  const cents = (v: number | null) => (v === null ? null : Math.round(v * 100));
  return (
    <GoalWorkspace
      business
      goals={data.goals.map((g) => ({
        ...g,
        target: eur(g.target),
        current: eur(g.current),
        monthly: eur(g.monthly),
        isActive: g.isActive ?? true,
      }))}
      types={[
        { value: "buffer", label: "Bedrijfsbuffer" },
        { value: "investment", label: "Investering" },
        { value: "repay", label: "Zakelijke schuld aflossen" },
        { value: "revenue", label: "Maandomzet" },
      ]}
      examples={[
        { label: "Bedrijfsbuffer opbouwen", kind: "buffer" },
        { label: "Investering voorbereiden", kind: "investment" },
        { label: "Zakelijke schuld aflossen", kind: "repay" },
        { label: "Maandomzet verhogen", kind: "revenue" },
      ]}
      onSave={(value, id) =>
        onSave({
          ...data.goals.find((g) => g.id === id),
          ...value,
          id: id ?? crypto.randomUUID(),
          kind: value.kind as Goal["kind"],
          target: cents(value.target),
          current: cents(value.current),
          monthly: cents(value.monthly),
        })
      }
      onDelete={onDelete}
      summary={(g) => (
        <GoalSummary
          goal={data.goals.find((item) => item.id === g.id)!}
          data={data}
        />
      )}
    />
  );
}
