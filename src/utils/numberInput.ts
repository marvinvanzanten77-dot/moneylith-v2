export const numberInputValue = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : "";

export const parseNumberInput = (raw: string) => (raw.trim() === "" ? 0 : Number(raw));
