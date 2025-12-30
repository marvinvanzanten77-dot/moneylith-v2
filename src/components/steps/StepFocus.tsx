import { useEffect, useMemo, useRef, useState } from "react";

import { formatCurrency } from "../../utils/format";
import { parseDateNlToIso } from "../../utils/date";
import { projectGoal } from "../../logic/goals";
import type { FinancialSnapshot, MoneylithBucket, MoneylithGoal } from "../../types";
import type { AiActions } from "../../logic/extractActions";
import { buildGoalsPatchesFromActions, canApplyGoalsSuggestions } from "../../logic/applyGoalsSuggestions";

type StepFocusProps = {
  financialSnapshot?: FinancialSnapshot | null;
  goals?: MoneylithGoal[];
  onAddGoal?: (goal: Omit<MoneylithGoal, "id">) => void;
  onUpdateGoal?: (id: string, patch: Partial<MoneylithGoal>) => void;
  onDeleteGoal?: (id: string) => void;
  buckets?: MoneylithBucket[];
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: "personal" | "business";
  actions?: AiActions | null;
};

export function StepFocus({
  financialSnapshot,
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  buckets = [],
  variant = "personal",
  readOnly = false,
  mode = "personal",
  actions = null,
}: StepFocusProps) {
  const snapshot = financialSnapshot ?? null;
  const freePerMonth = snapshot ? snapshot.totalIncome.value - snapshot.fixedCostsTotal.value : 0;
  const isBusiness = variant === "business";
  const isReadOnly = readOnly === true;
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [deadlineValid, setDeadlineValid] = useState(true);
  const [priorityMap, setPriorityMap] = useState<Record<string, number>>({});
  const goalExamples: Array<{ label: string; type: MoneylithGoal["type"]; targetAmount: number }> = [
    { label: "Buffer 3 maanden vaste lasten", type: "buffer", targetAmount: Math.max(500, freePerMonth * 3) },
    { label: "Vakantie", type: "project", targetAmount: 1200 },
    { label: "Kleine schuld aflossen", type: "debt_payoff", targetAmount: 800 },
  ];
  const selectedBuckets = useMemo(
    () => buckets.filter((b) => formState.linkedBucketIds.includes(b.id)),
    [buckets, formState.linkedBucketIds],
  );
  const selectedBucketsTotal = useMemo(
    () => selectedBuckets.reduce((sum, b) => sum + (Number.isFinite(b.monthlyAvg) ? b.monthlyAvg : 0), 0),
    [selectedBuckets],
  );
  const monthlyHint = useMemo(() => {
    const remaining = Math.max(0, formState.targetAmount - formState.currentAmount);
    if (!deadlineInput.trim()) return null;
    const iso = parseDateNlToIso(deadlineInput);
    if (!iso) return null;
    const now = new Date();
    const deadlineDate = new Date(iso);
    const months =
      (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth()) + 1;
    if (!Number.isFinite(months) || months <= 0) return { error: "Deadline ligt in het verleden of is ongeldig." };
    const perMonth = remaining / months;
    return { months, perMonth };
  }, [formState.targetAmount, formState.currentAmount, deadlineInput]);
  const [formState, setFormState] = useState<{
    id?: string;
    label: string;
    type: MoneylithGoal["type"];
    targetAmount: number;
    currentAmount: number;
    monthlyContribution: number;
    deadline?: string;
    linkedBucketIds: string[];
    isActive: boolean;
  }>(() => ({
    label: "",
    type: "savings",
    targetAmount: 0,
    currentAmount: 0,
    monthlyContribution: 0,
    deadline: "",
    linkedBucketIds: [],
    isActive: true,
  }));

  const activeGoals = goals.filter((g) => g.isActive);
  const projections = useMemo(() => new Map(activeGoals.map((g) => [g.id, projectGoal(g)])), [activeGoals]);
  const totalGoalPressure = Array.from(projections.values()).reduce((sum, p) => sum + p.pressurePerMonth, 0);
  const margin = freePerMonth - totalGoalPressure;
  const applyCheck = canApplyGoalsSuggestions({ mode, actions, currentGoals: goals });

  const resetForm = () => {
    setFormState({
      id: undefined,
      label: "",
      type: "savings",
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: "",
      linkedBucketIds: [],
      isActive: true,
    });
  };

  const movePriority = (goalId: string, direction: "up" | "down") => {
    if (isReadOnly) return;
    setPriorityMap((prev) => {
      const current = prev[goalId] ?? 0;
      const delta = direction === "up" ? 1 : -1;
      return { ...prev, [goalId]: current + delta };
    });
  };

  const handleEdit = (goal: MoneylithGoal) => {
    if (isReadOnly) return;
    setFormState({
      id: goal.id,
      label: goal.label,
      type: goal.type,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      monthlyContribution: goal.monthlyContribution,
      deadline: goal.deadline,
      linkedBucketIds: goal.linkedBucketIds ?? [],
      isActive: goal.isActive,
    });
    setDeadlineInput(goal.deadline ?? "");
    setDeadlineValid(true);
  };

  const handleBucketToggle = (id: string) => {
    if (isReadOnly) return;
    setFormState((prev) => {
      const exists = prev.linkedBucketIds.includes(id);
      return {
        ...prev,
        linkedBucketIds: exists ? prev.linkedBucketIds.filter((b) => b !== id) : [...prev.linkedBucketIds, id],
      };
    });
  };

  const handleSubmit = () => {
    if (isReadOnly) return;
    if (!formState.label.trim()) return;
    let deadlineIso: string | undefined = undefined;
    if (deadlineInput.trim()) {
      const parsed = parseDateNlToIso(deadlineInput);
      if (!parsed) {
        setDeadlineValid(false);
        return;
      }
      deadlineIso = parsed;
      setDeadlineValid(true);
    }

    if (formState.id) {
      onUpdateGoal?.(formState.id, {
        label: formState.label,
        type: formState.type,
        targetAmount: formState.targetAmount,
        currentAmount: formState.currentAmount,
        monthlyContribution: formState.monthlyContribution,
        deadline: deadlineIso ?? formState.deadline,
        linkedBucketIds: formState.linkedBucketIds,
        isActive: formState.isActive,
      });
    } else {
      onAddGoal?.({
        label: formState.label,
        type: formState.type,
        targetAmount: formState.targetAmount,
        currentAmount: formState.currentAmount,
        monthlyContribution: formState.monthlyContribution,
        deadline: deadlineIso ?? undefined,
        linkedBucketIds: formState.linkedBucketIds,
        isActive: formState.isActive,
      });
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    if (isReadOnly) return;
    if (confirm("Weet je zeker dat je dit doel wilt verwijderen?")) {
      onDeleteGoal?.(id);
      if (formState.id === id) resetForm();
    }
  };

  const handleApplyAiGoals = () => {
    if (isReadOnly || !applyCheck.ok || !actions) return;
    const patches = buildGoalsPatchesFromActions(actions);
    if (!patches.length) return;
    patches.forEach((patch) => onAddGoal?.(patch));
  };

  const marginLabel = () => {
    if (activeGoals.length === 0) return "Geen doelen ingesteld";
    if (freePerMonth <= 0) return "Onhoudbaar tempo";
    if (margin < 0) return "Onhoudbaar tempo";
    if (margin < 0.2 * freePerMonth) return "Krap tempo";
    return "Stabiel tempo";
  };

  const toggleGoal = (goalId: string, goal: MoneylithGoal) => {
    if (isReadOnly) return;
    setExpandedGoalId((current) => {
      const next = current === goalId ? null : goalId;
      if (next === goalId) {
        handleEdit(goal);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (expandedGoalId && listRef.current && !listRef.current.contains(target)) {
        setExpandedGoalId(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedGoalId(null);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      window.removeEventListener("keydown", handleKey);
    };
  }, [expandedGoalId]);

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">{isBusiness ? "Doelen (zakelijk)" : "Doelen"}</h1>
        <p className="text-sm text-slate-400">
          {activeGoals.length === 0 ? "Zonder doel is er geen brug tussen intentie en gedrag." : "Je focus brengt je intentie naar concreet geldgedrag."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {applyCheck.ok && !isReadOnly && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>AI-suggesties voor doelen beschikbaar.</p>
                <button
                  type="button"
                  onClick={handleApplyAiGoals}
                  className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  Neem AI-suggesties over
                </button>
              </div>
            </div>
          )}

          <div ref={listRef} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">{isBusiness ? "Actieve zakelijke doelen" : "Actieve doelen"}</h2>
                <p className="text-xs text-slate-400">
                  {isBusiness
                    ? "Meerdere doelen kunnen actief zijn; orden ze op prioriteit."
                    : "Zet meerdere doelen aan en bepaal de volgorde met prioriteit."}
                </p>
              </div>
              <span className="text-xs text-slate-400">{activeGoals.length} actief</span>
            </div>

            {goals.length === 0 && <p className="text-sm text-slate-300">Zonder doel ontbreekt richting.</p>}

            {goals.length > 0 && (
              <div className="space-y-3">
                {goals
                  .slice()
                  .sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    const pa = priorityMap[a.id] ?? 0;
                    const pb = priorityMap[b.id] ?? 0;
                    if (pa !== pb) return pb - pa;
                    const da = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
                    const db = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
                    return da - db;
                  })
                  .map((goal) => {
                  const projection = projections.get(goal.id);
                  const progress = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
                  const isExpanded = expandedGoalId === goal.id;
                  return (
                    <div
                      key={goal.id}
                      className={`rounded-xl border bg-slate-900/60 text-sm text-slate-200 shadow-sm transition-all duration-200 ${
                        isExpanded ? "border-amber-400 ring-2 ring-amber-100/30" : "border-slate-800 hover:border-amber-300/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGoal(goal.id, goal)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${
                          isExpanded ? "bg-amber-500/10" : "hover:bg-slate-800/60"
                        }`}
                        disabled={isReadOnly}
                      >
                        <div className="flex flex-col">
                          <div className="text-sm font-semibold text-slate-50">{goal.label}</div>
                          <div className="text-[11px] text-slate-400">
                            {goal.type} · Prioriteit {priorityMap[goal.id] ?? 0}
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>{Math.round(progress * 100)}%</div>
                          <div className="text-[11px]">{goal.isActive ? "Actief" : "Passief"}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                          <span>{formatCurrency(goal.targetAmount)}</span>
                          <span aria-hidden className="text-slate-500">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-amber-200/30 px-3 py-3 text-xs">
                          <div className="grid grid-cols-2 gap-2 text-slate-300">
                            <div>
                              <div className="text-slate-400">Doelwaarde</div>
                              <div className="font-semibold text-slate-50">{formatCurrency(goal.targetAmount)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400">Huidige stand</div>
                              <div className="font-semibold text-slate-50">{formatCurrency(goal.currentAmount)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400">Inleg p/m</div>
                              <div className="font-semibold text-slate-50">{formatCurrency(goal.monthlyContribution)}</div>
                            </div>
                            {goal.deadline && (
                              <div>
                                <div className="text-slate-400">Deadline</div>
                                <div className="font-semibold text-slate-50">{goal.deadline}</div>
                              </div>
                            )}
                          </div>

                          {projection && (
                            <div className="mt-2 text-[11px] text-slate-400">
                              <div>Resterend: {formatCurrency(projection.remaining)}</div>
                              <div>Tempo: {formatCurrency(projection.pressurePerMonth)} per maand</div>
                              <div>Bereikt in: {projection.monthsToTarget ?? "-"} maanden</div>
                            </div>
                          )}

                          {goal.linkedBucketIds && goal.linkedBucketIds.length > 0 && (
                            <div className="mt-2 text-[11px] text-slate-400">Gekoppeld aan: {goal.linkedBucketIds.join(", ")}</div>
                          )}

                          {!isReadOnly && (
                            <div className="mt-3 flex gap-2 text-xs">
                              <button
                                type="button"
                                className="rounded-md border border-amber-200/60 bg-amber-500/10 px-2 py-1 text-amber-50"
                                onClick={() => toggleGoal(goal.id, goal)}
                              >
                                Bewerk in formulier
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-red-400 px-2 py-1 text-red-200"
                                onClick={() => handleDelete(goal.id)}
                              >
                                Verwijderen
                              </button>
                              <div className="flex items-center gap-1 text-slate-300">
                                <button
                                  type="button"
                                  className="rounded-full bg-slate-800 px-2 py-0.5 hover:bg-slate-700"
                                  onClick={() => movePriority(goal.id, "up")}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full bg-slate-800 px-2 py-0.5 hover:bg-slate-700"
                                  onClick={() => movePriority(goal.id, "down")}
                                >
                                  ↓
                                </button>
                              </div>
                              <span className="text-[11px] text-slate-400">Prioriteit: {priorityMap[goal.id] ?? 0}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
          <h3 className="text-lg font-semibold text-slate-50">{isBusiness ? "Zakelijk doel instellen" : "Actief doel instellen"}</h3>
          <div className="grid gap-3">
            <label className="text-xs text-slate-300">
              Doelnaam
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.label}
                onChange={(e) => setFormState((p) => ({ ...p, label: e.target.value }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Doeltype
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.type}
                onChange={(e) => setFormState((p) => ({ ...p, type: e.target.value as MoneylithGoal["type"] }))}
                disabled={isReadOnly}
              >
                <option value="savings">Sparen</option>
                <option value="debt_payoff">Schuld aflossen</option>
                <option value="buffer">Buffer opbouwen</option>
                <option value="project">Project / investering</option>
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Doelwaarde
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.targetAmount}
                onChange={(e) => setFormState((p) => ({ ...p, targetAmount: Number(e.target.value) || 0 }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Huidige stand
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.currentAmount}
                onChange={(e) => setFormState((p) => ({ ...p, currentAmount: Number(e.target.value) || 0 }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Deadline (optioneel, DD-MM-YYYY)
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d{1,2}-\\d{1,2}-\\d{4}"
                className={`mt-1 w-full rounded-lg border bg-slate-900/80 px-3 py-2 text-sm ${
                  deadlineValid ? "border-slate-700" : "border-red-400"
                }`}
                value={deadlineInput}
                onChange={(e) => {
                  setDeadlineInput(e.target.value);
                  setDeadlineValid(!e.target.value || !!parseDateNlToIso(e.target.value));
                }}
                placeholder="bijv. 15-04-2026"
                disabled={isReadOnly}
              />
              {!deadlineValid && (
                <p className="mt-1 text-[11px] text-red-300">Gebruik DD-MM-JJJJ, bijv. 15-04-2026.</p>
              )}
              {monthlyHint?.error && (
                <p className="mt-1 text-[11px] text-red-300">{monthlyHint.error}</p>
              )}
              {monthlyHint && !monthlyHint.error && (
                <p className="mt-1 text-[11px] text-amber-200">
                  Nodig: {formatCurrency(monthlyHint.perMonth)} per maand voor ~{monthlyHint.months} maand(en).
                </p>
              )}
            </label>
            <div className="text-xs text-slate-300">
              <p className="mb-1 text-slate-400">Voorbeelden (klik om te vullen):</p>
              <div className="flex flex-wrap gap-2">
                {goalExamples.map((ex, idx) => (
                  <button
                    key={`${ex.label}-${idx}`}
                    type="button"
                    className="rounded-md border border-amber-200/60 bg-amber-500/10 px-2 py-1 text-amber-50 hover:bg-amber-500/20"
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        label: ex.label,
                        type: ex.type,
                        targetAmount: ex.targetAmount,
                        currentAmount: 0,
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))}
                disabled={isReadOnly}
              />
              <span>{isBusiness ? "Dit is het actieve hoofddoel" : "Actief doel"}</span>
            </div>

            <div className="text-xs text-slate-300">
              <p className="mb-1 text-slate-400">{isBusiness ? "Koppelen aan financiele stromen (optioneel):" : "Koppel aan potjes (optioneel):"}</p>
              <div className="grid max-h-32 grid-cols-1 gap-1 overflow-auto">
                {buckets.map((b) => (
                  <label key={b.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.linkedBucketIds.includes(b.id)}
                      onChange={() => handleBucketToggle(b.id)}
                      disabled={isReadOnly}
                    />
                    <span className="text-slate-200">
                      {b.label} ({b.type})
                    </span>
                  </label>
                ))}
                {buckets.length === 0 && <p className="text-[11px] text-slate-500">Nog geen financiele stromen beschikbaar.</p>}
              </div>
              {selectedBuckets.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-[11px] text-slate-300">
                  <div className="font-semibold text-slate-100">Gekoppeld aan</div>
                  <ul className="mt-1 space-y-1">
                    {selectedBuckets.map((b) => (
                      <li key={b.id} className="flex items-center justify-between">
                        <span>
                          {b.label} <span className="text-slate-500">({b.type})</span>
                        </span>
                        <span className="font-semibold text-amber-100">{formatCurrency(b.monthlyAvg)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-slate-400">
                    Huidige gekoppelde stroom totaal:{" "}
                    <span className="font-semibold text-amber-100">{formatCurrency(selectedBucketsTotal)}</span>
                  </div>
                  <div className="mt-1 text-slate-500">
                    Vooruitgang volgt de gekoppelde potjes/vermogens; aanpassing hier beïnvloedt de doelvoortgang.
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                onClick={handleSubmit}
                disabled={isReadOnly}
              >
                {isBusiness ? "Zakelijk doel activeren" : formState.id ? "Doel bijwerken" : "Actief doel instellen"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                onClick={resetForm}
                disabled={isReadOnly}
              >
                Formulier leegmaken
              </button>
              {formState.id && onDeleteGoal && (
                <button
                  type="button"
                  className="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-200"
                  onClick={() => handleDelete(formState.id!)}
                  disabled={isReadOnly}
                >
                  Verwijder
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

