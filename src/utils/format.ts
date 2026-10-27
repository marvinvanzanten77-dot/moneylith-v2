const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | null | undefined, withCents = false) => {
  if (value == null || !Number.isFinite(value)) return "Nog onbekend";
  const safe = value;
  const formatter =
    withCents && euroFormatter.resolvedOptions().minimumFractionDigits !== 2
      ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
      : euroFormatter;
  return formatter.format(safe);
};

