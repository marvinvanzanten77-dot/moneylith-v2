export type AiCadence = "monthly" | "weekly" | "yearly" | "unknown";

export type AiActions = Partial<{
  income: { label?: string; amount: number; cadence: AiCadence; confidence: number };
  fixedCosts: Array<{ name: string; amount: number; cadence: AiCadence; confidence: number }>;
  debts: Array<{ name: string; amount: number; confidence: number }>;
  goals: Array<{ name: string; target: number; deadline?: string; confidence: number }>;
  notes: string[];
}>;

export function extractActionsFromContent(content: string): { cleanedContent: string; actions: AiActions | null } {
  if (!content) return { cleanedContent: "", actions: null };

  const start = content.indexOf("<ACTIONS_JSON>");
  const end = content.indexOf("</ACTIONS_JSON>");

  if (start === -1 || end === -1 || end < start) {
    return { cleanedContent: content, actions: null };
  }

  const jsonPart = content.slice(start + "<ACTIONS_JSON>".length, end).trim();
  let actions: AiActions | null = null;

  try {
    actions = JSON.parse(jsonPart) as AiActions;
  } catch (err) {
    actions = null;
  }

  const cleanedContent = `${content.slice(0, start)}${content.slice(end + "</ACTIONS_JSON>".length)}`.trim();

  return { cleanedContent: cleanedContent.length > 0 ? cleanedContent : content, actions };
}
