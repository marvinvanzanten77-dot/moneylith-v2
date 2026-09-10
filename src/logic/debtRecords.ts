import type { SchuldItem as StoredDebt } from "../types";
import type { SchuldItem as CardDebt } from "../components/SchuldenkaartCard";

/** The form uses saldo; older imports use openBedrag. Preserve all record fields. */
export function toDebtCardItems(debts: StoredDebt[]): CardDebt[] {
  return debts.map(debt => ({
    ...debt,
    saldo: debt.saldo ?? debt.openBedrag,
    minimaleMaandlast: debt.minimaleMaandlast ?? debt.minBetaling,
    gebruikerOpmerking: debt.gebruikerOpmerking ?? debt.notitie ??
      ("opmerking" in debt && typeof debt.opmerking === "string" ? debt.opmerking : undefined),
  }));
}

export function fromDebtCardItems(debts: CardDebt[]): StoredDebt[] {
  return debts.map(debt => ({ ...debt, openBedrag: debt.saldo, minBetaling: debt.minimaleMaandlast }));
}
