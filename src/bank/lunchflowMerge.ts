import type { MoneylithAccount, MoneylithTransaction } from "../types";
import type { LunchSnapshot } from "./lunchflowTypes";
export type LunchMapping = { providerId: string; targetId: string }; // targetId "new" explicitly creates an account.
export function mergeLunchflow(
  accounts: MoneylithAccount[],
  transactions: MoneylithTransaction[],
  snapshots: LunchSnapshot[],
  mappings: LunchMapping[],
) {
  const nextAccounts = accounts.map((a) => ({ ...a })),
    nextTransactions = transactions.map((t) => ({ ...t }));
  const targets = new Set<string>(),
    providers = new Set<string>();
  const reports: Array<{
    label: string;
    ok: boolean;
    message: string;
    added: number;
    updated: number;
  }> = [];
  for (const mapping of mappings) {
    const snapshot = snapshots.find((s) => s.account.id === mapping.providerId);
    if (!snapshot || providers.has(mapping.providerId))
      throw Error("Ongeldige of dubbele rekeningselectie.");
    providers.add(mapping.providerId);
    const linked = nextAccounts.find(
      (a) =>
        a.bankProvider === "lunchflow" &&
        a.bankAccountId === mapping.providerId,
    );
    const targetId =
      mapping.targetId === "new"
        ? `lunchflow:account:${mapping.providerId}`
        : mapping.targetId;
    if (targets.has(targetId) || (linked && linked.id !== targetId))
      throw Error("Een rekening is al gekoppeld. Kies de bestaande koppeling.");
    targets.add(targetId);
    const index = nextAccounts.findIndex((a) => a.id === targetId),
      existing = nextAccounts[index];
    if (mapping.targetId !== "new" && !existing)
      throw Error("De gekozen Moneylith-rekening bestaat niet meer.");
    if (
      existing?.bankAccountId &&
      (existing.bankProvider !== "lunchflow" ||
        existing.bankAccountId !== mapping.providerId)
    )
      throw Error(
        "Deze Moneylith-rekening is al aan een andere bankrekening gekoppeld.",
      );
    if (existing?.source === "bank" && !existing.bankProvider)
      throw Error("Deze rekening is al gekoppeld via een andere provider.");
    const { balance, transactions: txs } = snapshot;
    const errors = [
      !balance.ok ? balance.error.message : "",
      !txs.ok ? txs.error.message : "",
    ].filter(Boolean);
    if (!balance.ok || !txs.ok) {
      reports.push({
        label: snapshot.account.label,
        ok: false,
        message: errors.join(" "),
        added: 0,
        updated: 0,
      });
      continue;
    }
    // Existing financial models use EUR; never silently mix foreign currencies into euro totals.
    if (
      balance.value.currency !== "EUR" ||
      (snapshot.account.currency && snapshot.account.currency !== "EUR") ||
      txs.value.some((t) => t.currency !== "EUR")
    ) {
      reports.push({
        label: snapshot.account.label,
        ok: false,
        message:
          "Deze rekening bevat een andere valuta dan EUR. Import gestopt; omrekening wordt niet ondersteund.",
        added: 0,
        updated: 0,
      });
      continue;
    }
    const account: MoneylithAccount = {
      ...(existing ?? {
        id: targetId,
        name: snapshot.account.label,
        type: "betaalrekening" as const,
        active: true,
        source: "bank" as const,
      }),
      bankProvider: "lunchflow",
      bankAccountId: mapping.providerId,
      currency: "EUR",
      bankBalance: balance.value.amount,
      bankBalanceFetchedAt: snapshot.fetchedAt,
      bankLastSync: snapshot.fetchedAt,
    };
    if (index < 0) nextAccounts.push(account);
    else nextAccounts[index] = account;
    const byId = new Map(nextTransactions.map((t, i) => [t.id, i]));
    let added = 0,
      updated = 0;
    for (const tx of txs.value) {
      const stableId = `lunchflow:${mapping.providerId}:${tx.id}`;
      const i = byId.get(stableId),
        old = i === undefined ? undefined : nextTransactions[i];
      // Preserve user-edited descriptions/counterparties; keep provider originals separately.
      const description =
        old && old.description !== old.providerData?.description
          ? old.description
          : tx.description;
      const counterparty =
        old && old.counterparty !== old.providerData?.counterparty
          ? old.counterparty
          : tx.merchant;
      const mapped: MoneylithTransaction = {
        ...old,
        id: stableId,
        external_id: stableId,
        accountId: targetId,
        provider: "lunchflow",
        providerAccountId: mapping.providerId,
        providerTransactionId: tx.id,
        source: "bank",
        currency: tx.currency,
        date:
          old?.providerData && old.date !== old.providerData.date
            ? old.date
            : tx.date,
        amount:
          old?.providerData && old.amount !== old.providerData.amount
            ? old.amount
            : tx.amount,
        description,
        counterparty,
        providerData: {
          description: tx.description,
          counterparty: tx.merchant,
          amount: tx.amount,
          date: tx.date,
        },
      };
      if (i === undefined) {
        byId.set(stableId, nextTransactions.length);
        nextTransactions.push(mapped);
        added++;
      } else {
        if (JSON.stringify(mapped) !== JSON.stringify(old)) updated++;
        nextTransactions[i] = mapped;
      }
    }
    reports.push({
      label: snapshot.account.label,
      ok: true,
      message: "Saldo en geboekte transacties opgehaald.",
      added,
      updated,
    });
  }
  return { accounts: nextAccounts, transactions: nextTransactions, reports };
}

// Write to the existing personal stores. Roll back if either write fails; do not report a successful sync on quota errors.
export function persistLunchflow(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  result: ReturnType<typeof mergeLunchflow>,
  financial?: { income: import("../types").IncomeItem[]; fixedCosts: import("../types").FixedCostManualItem[]; seen: string[]; rules?: import("./classificationRules").BankRuleSettings; decisions?: import("./patterns").PatternDecisions },
  debtPayments?: Pick<ReturnType<typeof import("./debtPayments").reconcileDebtPayments>, "debts" | "ledger">,
) {
  const keys = [
    "moneylith.personal.accounts",
    "moneylith.personal.transactions",
  ];
  const values: unknown[] = [result.accounts, result.transactions];
  if (financial) {
    keys.push("moneylith.personal.income", "moneylith.personal.fixedCosts", "moneylith.personal.bankImportSeen");
    values.push(financial.income, financial.fixedCosts, financial.seen);
    if (financial.rules) { keys.push("moneylith.personal.bankRules.v1"); values.push(financial.rules); }
    if (financial.decisions) {
      keys.push("moneylith.personal.bankPatterns.v1"); values.push(financial.decisions);
    }
  }
  if(debtPayments){keys.push("moneylith.personal.debts","moneylith.personal.debtPayments.v1");values.push(debtPayments.debts,debtPayments.ledger);}
  const previous = keys.map((key) => storage.getItem(key));
  try {
    keys.forEach((key, i) => storage.setItem(key, JSON.stringify(values[i])));
  } catch {
    keys.forEach((key, i) => {
      try {
        if (previous[i] === null) storage.removeItem(key);
        else storage.setItem(key, previous[i]!);
      } catch {
        /* browser storage may be unavailable */
      }
    });
    throw Error(
      "Opslaan mislukt. Controleer beschikbare browseropslag; synchronisatie is niet voltooid.",
    );
  }
}
