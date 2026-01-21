/**
 * Bank Integration Helper Functions
 * Auto-populate financial data from TrueLayer transactions
 */

import type { SchuldItem, IncomeItem, FixedCostManualItem, MoneylithBucket } from "../types";

export type BankAnalysisResult = {
  suggestedDebts: SchuldItem[];
  suggestedIncomes: IncomeItem[];
  suggestedFixedCosts: FixedCostManualItem[];
  suggestedBuckets: MoneylithBucket[];
  rawAnalysis: string;
};

/**
 * Analyze bank transactions and extract financial data
 * Called after successful bank connection in bank-mode onboarding
 */
export async function analyzeBankTransactions(
  transactions: Array<{ date: string; description: string; amount: number }>,
  accessToken: string
): Promise<BankAnalysisResult> {
  // Prepare transaction summary for AI
  const txSummary = transactions
    .slice(-90) // Last 90 days
    .map((tx) => `${tx.date}: ${tx.description} (${tx.amount > 0 ? "+" : ""}${tx.amount})`)
    .join("\n");

  const systemPrompt = `Je bent een financieel assistent die banktransacties analyseert.
Herken uit transacties:
1. SCHULDEN: terugkerende negatieve bedragen (aflossingen, rente)
2. INKOMSTEN: inkomende bedragen (salaris, bonussen)
3. VASTE LASTEN: maandelijkse terugkerende lasten (huur, verzekeringen, abonnementen)
4. POTJES: uitgaven categorieën (boodschappen, vervoer, entertainment, etc.)

Geef output in JSON format:
{
  "debts": [{"name": "...", "monthlyPayment": X, "description": "..."}],
  "incomes": [{"label": "...", "bedrag": X, "frequency": "maandelijks"}],
  "fixedCosts": [{"name": "...", "bedrag": X, "description": "..."}],
  "buckets": [{"label": "...", "monthlyAvg": X, "category": "..."}]
}`;

  const userPrompt = `Analyseer deze 90 dagen transacties en herken schulden, inkomsten, vaste lasten en uitgaven-categorieën:

${txSummary}

Geef JSON terug.`;

  try {
    const response = await fetch("/api/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        user: userPrompt,
        tab: "bank-analysis",
      }),
    });

    const rawAnalysis = await response.text();
    if (!response.ok) {
      console.error("AI analysis failed:", rawAnalysis);
      return {
        suggestedDebts: [],
        suggestedIncomes: [],
        suggestedFixedCosts: [],
        suggestedBuckets: [],
        rawAnalysis: "",
      };
    }

    // Parse JSON from response
    const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        suggestedDebts: [],
        suggestedIncomes: [],
        suggestedFixedCosts: [],
        suggestedBuckets: [],
        rawAnalysis,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert AI suggestions to app data structures
    const suggestedDebts: SchuldItem[] = (parsed.debts || []).map(
      (d: any, idx: number) => ({
        id: `bank-debt-${idx}`,
        naam: d.name,
        crediteur: d.creditor || "Onbekend",
        minimaleMaandlast: d.monthlyPayment || 0,
        openBedrag: (d.monthlyPayment || 0) * 12, // rough estimate
        notitie: d.description,
      })
    );

    const suggestedIncomes: IncomeItem[] = (parsed.incomes || []).map(
      (i: any, idx: number) => ({
        id: `bank-income-${idx}`,
        label: i.label,
        bedrag: i.bedrag || 0,
        type: i.frequency === "maandelijks" ? "maandelijks" : "eenmalig",
      })
    );

    const suggestedFixedCosts: FixedCostManualItem[] = (parsed.fixedCosts || []).map(
      (f: any, idx: number) => ({
        id: `bank-fixed-${idx}`,
        naam: f.name,
        bedrag: f.bedrag || 0,
        dagVanMaand: 1,
        opmerking: f.description,
      })
    );

    const suggestedBuckets: MoneylithBucket[] = (parsed.buckets || []).map(
      (b: any, idx: number) => ({
        id: `bank-bucket-${idx}`,
        label: b.label,
        type: "variable" as const,
        monthlyAvg: b.monthlyAvg || 0,
        lastAmount: b.monthlyAvg || 0,
        recurring: false,
        sampleTransactions: [],
        userLocked: false,
      })
    );

    return {
      suggestedDebts,
      suggestedIncomes,
      suggestedFixedCosts,
      suggestedBuckets,
      rawAnalysis,
    };
  } catch (error) {
    console.error("Bank analysis error:", error);
    return {
      suggestedDebts: [],
      suggestedIncomes: [],
      suggestedFixedCosts: [],
      suggestedBuckets: [],
      rawAnalysis: "",
    };
  }
}

/**
 * Fetch transactions from TrueLayer for all accounts
 */
export async function fetchBankTransactions(
  accountIds: string[],
  accessToken: string
): Promise<Array<{ date: string; description: string; amount: number; accountId: string }>> {
  try {
    const allTransactions: Array<{ date: string; description: string; amount: number; accountId: string }> = [];

    // Fetch transactions for each account
    for (const accountId of accountIds) {
      const res = await fetch("/api/truelayer/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, account_id: accountId }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const txs = data.results || [];
      allTransactions.push(
        ...txs.map((tx: any) => ({
          date: tx.timestamp?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          description: tx.description || "",
          amount: tx.amount || 0,
          accountId,
        }))
      );
    }

    return allTransactions;
  } catch (error) {
    console.error("Fetch transactions error:", error);
    return [];
  }
}
