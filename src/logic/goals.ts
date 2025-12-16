import { MoneylithGoal } from "../types";

export type GoalProjection = {
  goalId: string;
  remaining: number;
  monthsToTarget: number | null;
  pressurePerMonth: number;
};

export function projectGoal(goal: MoneylithGoal): GoalProjection {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  let monthsToTarget: number | null = null;
  if (goal.monthlyContribution > 0) {
    monthsToTarget = Math.ceil(remaining / goal.monthlyContribution);
  }

  let pressurePerMonth = goal.monthlyContribution;

  if (goal.deadline) {
    const now = new Date();
    const end = new Date(goal.deadline);

    const monthsLeft =
      (end.getFullYear() - now.getFullYear()) * 12 +
      (end.getMonth() - now.getMonth());

    if (monthsLeft > 0) {
      pressurePerMonth = remaining / monthsLeft;
    }
  }

  return {
    goalId: goal.id,
    remaining,
    monthsToTarget,
    pressurePerMonth,
  };
}
