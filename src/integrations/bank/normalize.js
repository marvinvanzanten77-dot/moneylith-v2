import crypto from "crypto";

/**
 * Create stable external id if provider transactionId missing
 */
function buildFallbackId(tx) {
  const hash = crypto.createHash("sha256");
  const parts = [
    tx.accountId || "",
    tx.bookingDate || tx.valueDate || "",
    String(tx.transactionAmount?.amount ?? ""),
    String(tx.transactionAmount?.currency ?? ""),
    tx.remittanceInformationUnstructured || "",
    tx.creditorName || "",
    tx.debtorName || "",
    tx.creditorAccount || "",
    tx.debtorAccount || "",
    tx.status || "",
  ];
  hash.update(parts.join("|"));
  return hash.digest("hex").slice(0, 32);
}

export function mapBankTxToMoneylithTx(accountId, bankTx, status = "booked") {
  const amountNum = Number(bankTx.transactionAmount?.amount ?? 0);
  const tx = {
    id: `${accountId}-${bankTx.transactionId || buildFallbackId({ ...bankTx, accountId, status })}`,
    accountId: accountId,
    date: bankTx.bookingDate || bankTx.valueDate || new Date().toISOString().slice(0, 10),
    amount: amountNum,
    description: bankTx.remittanceInformationUnstructured || "Transactie",
    counterparty: bankTx.creditorName || bankTx.debtorName || bankTx.creditorAccount || bankTx.debtorAccount || undefined,
    category: null,
    external_id: bankTx.transactionId || buildFallbackId({ ...bankTx, accountId, status }),
    status,
  };
  return tx;
}
