export const numberInputValue = (value: number | null | undefined) =>
  Number.isFinite(value) && value !== 0 ? value : "";

export const parseNumberInput = (raw: string) => (raw.trim() === "" ? 0 : Number(raw));
