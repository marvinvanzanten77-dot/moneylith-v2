import { useState } from "react";
import { GoalWorkspace, type GoalView } from "../GoalWorkspace";
import { formatCurrency } from "../../utils/format";
import { parseDateNlToIso } from "../../utils/date";
import { projectGoal } from "../../logic/goals";
import type {
  FinancialSnapshot,
  FutureIncomeItem,
  MoneylithBucket,
  MoneylithGoal,
} from "../../types";
import type { AiActions } from "../../logic/extractActions";
import {
  buildGoalsPatchesFromActions,
  canApplyGoalsSuggestions,
} from "../../logic/applyGoalsSuggestions";
type StepFocusProps = {
  financialSnapshot?: FinancialSnapshot | null;
  goals?: MoneylithGoal[];
  onAddGoal?: (goal: Omit<MoneylithGoal, "id">) => void;
  onUpdateGoal?: (id: string, patch: Partial<MoneylithGoal>) => void;
  onDeleteGoal?: (id: string) => void;
  buckets?: MoneylithBucket[];
  futureIncomes?: FutureIncomeItem[];
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: "personal" | "business";
  actions?: AiActions | null;
};

export function StepFocus({
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  buckets = [],
  futureIncomes = [],
  mode = "personal",
  actions = null,
  readOnly = false,
}: StepFocusProps) {
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const types = [
    { value: "savings", label: "Sparen" },
    { value: "debt_payoff", label: "Schuld aflossen" },
    { value: "buffer", label: "Buffer opbouwen" },
    { value: "project", label: "Project / investering" },
  ];
  const view: GoalView[] = goals.map((g) => ({
    id: g.id,
    label: g.label,
    kind: g.type,
    target: g.targetAmount,
    current: g.currentAmount,
    monthly: g.monthlyContribution,
    date: g.deadline ?? null,
    isActive: g.isActive,
    priority: priorities[g.id] ?? 0,
    linkedBucketIds: g.linkedBucketIds,
  }));
  const apply = canApplyGoalsSuggestions({
    mode,
    actions,
    currentGoals: goals,
  });
  return (
    <GoalWorkspace
      goals={view}
      types={types}
      readOnly={readOnly}
      examples={[
        { label: "Buffer 3 maanden vaste lasten", kind: "buffer" },
        { label: "Vakantie", kind: "project" },
        { label: "Kleine schuld aflossen", kind: "debt_payoff" },
      ]}
      onSave={(g, id) => {
        const patch = {
          label: g.label,
          type: g.kind as MoneylithGoal["type"],
          targetAmount: g.target!,
          currentAmount: g.current!,
          monthlyContribution: g.monthly!,
          deadline: g.date ?? undefined,
          isActive: g.isActive,
          linkedBucketIds: g.linkedBucketIds ?? [],
        };
        if (id) {
          onUpdateGoal?.(id, patch);
          setPriorities((p) => ({ ...p, [id]: g.priority ?? 0 }));
        } else onAddGoal?.(patch);
      }}
      onDelete={(id) => onDeleteGoal?.(id)}
      beforeList={
        apply.ok && !readOnly && actions ? (
          <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
            <p>AI-suggesties voor doelen beschikbaar.</p>
            <button
              type="button"
              onClick={() =>
                buildGoalsPatchesFromActions(actions).forEach((g) =>
                  onAddGoal?.(g),
                )
              }
            >
              Neem AI-suggesties over
            </button>
          </div>
        ) : undefined
      }
      summary={(g) => {
        const original = goals.find((o) => o.id === g.id)!;
        const p = projectGoal(original);
        return (
          <>
            <span>Huidige stand: {formatCurrency(original.currentAmount)}</span>
            <span>
              Inleg p/m: {formatCurrency(original.monthlyContribution)}
            </span>
            <span>Deadline: {original.deadline ?? "Niet gekozen"}</span>
            <span>Resterend: {formatCurrency(p.remaining)}</span>
            <span>Tempo: {formatCurrency(p.pressurePerMonth)} per maand</span>
            <span>Bereikt in: {p.monthsToTarget ?? "onbekend"} maanden</span>
          </>
        );
      }}
      additional={(draft, change) => {
        const date = draft.date ? parseDateNlToIso(draft.date) : null;
        const once = date
          ? futureIncomes
              .filter(
                (i) =>
                  i.datum <= date &&
                  i.datum >= new Date().toISOString().slice(0, 10),
              )
              .reduce((s, i) => s + i.bedrag, 0)
          : 0;
        const months = date
          ? (Number(date.slice(0, 4)) - new Date().getFullYear()) * 12 +
            Number(date.slice(5, 7)) -
            new Date().getMonth()
          : 0;
        const target = Number(draft.target.replace(",", ".")),
          current = Number(draft.current.replace(",", "."));
        const required =
          draft.target.trim() &&
          draft.current.trim() &&
          Number.isFinite(target) &&
          Number.isFinite(current) &&
          months > 0
            ? Math.max(0, target - current - once) / months
            : null;
        const linked = buckets.filter((b) =>
          draft.linkedBucketIds?.includes(b.id),
        );
        return (
          <div className="text-xs text-slate-300">
            {date && months <= 0 && (
              <p className="text-red-300">Deadline ligt in het verleden.</p>
            )}
            {required !== null && (
              <p className="text-amber-200">
                Nodig: {formatCurrency(required)} per maand voor ~{months}{" "}
                maand(en).
              </p>
            )}
            <p>Koppel aan potjes (optioneel):</p>
            {!buckets.length && (
              <p className="text-slate-400">Nog geen potjes beschikbaar.</p>
            )}
            {buckets.map((b) => (
              <label key={b.id} className="flex gap-2">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={draft.linkedBucketIds?.includes(b.id) ?? false}
                  onChange={() =>
                    change({
                      ...draft,
                      linkedBucketIds: draft.linkedBucketIds?.includes(b.id)
                        ? draft.linkedBucketIds.filter((id) => id !== b.id)
                        : [...(draft.linkedBucketIds ?? []), b.id],
                    })
                  }
                />
                {b.label} · {formatCurrency(b.monthlyAvg)}
              </label>
            ))}
            {linked.length > 0 && (
              <p>
                Huidige gekoppelde stroom totaal:{" "}
                {formatCurrency(linked.reduce((s, b) => s + b.monthlyAvg, 0))}
              </p>
            )}
            {once > 0 && (
              <p>
                Ingevoerde toekomstige inkomsten vóór de deadline:{" "}
                {formatCurrency(once)}.
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
