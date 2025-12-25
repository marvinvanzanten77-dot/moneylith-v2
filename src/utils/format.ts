const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | null | undefined, withCents = false) => {
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  const formatter =
    withCents && euroFormatter.resolvedOptions().minimumFractionDigits !== 2
      ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
      : euroFormatter;
  return formatter.format(safe);
};

