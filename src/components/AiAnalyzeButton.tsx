import React, { useMemo, useState } from "react";
import { useObserver } from "../hooks/useObserver";
import { analyseObservation } from "../logic/analysis";
import { buildMoneylithPrompt } from "../logic/aiPrompt";
import { useAiOrchestrator, type TabKey } from "../hooks/useAiOrchestrator";
import { appendAiMessage } from "../logic/aiMessageBus";

type Props = {
  mode?: "personal" | "business";
  tab: TabKey;
  label?: string;
  className?: string;
  onSuccess?: () => void;
};

export function AiAnalyzeButton({ mode = "personal", tab, label = "Analyseer", className, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const observation = useObserver(mode);
  const analysis = useMemo(() => analyseObservation(observation, mode), [observation, mode]);
  const rawContext = useMemo(() => {
    const src = mode === "business" ? observation.business : observation.personal;
    return {
      incomes: src.income,
      fixed: src.fixedCostManualItems,
      debts: src.debts,
      assets: src.assets as any,
      buckets: src.buckets,
      transactions: src.transactions,
      netFree: src.totals.netFree,
    };
  }, [mode, observation]);
  const aiPayload = useMemo(() => (analysis ? buildMoneylithPrompt(analysis, rawContext) : null), [analysis, rawContext]);
  const { runAi } = useAiOrchestrator({
    mode,
    appendMessage: appendAiMessage,
    setLoading,
    onRawContent: (raw) => {
      try {
        localStorage.setItem("moneylith.personal.aiAnalysisRaw", raw);
      } catch {
        // ignore
      }
    },
  });

  const handleClick = async () => {
    if (!aiPayload) return;
    await runAi({
      tab,
      system: aiPayload.system,
      user: aiPayload.user,
    });
    onSuccess?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!aiPayload || loading}
      style={{ width: "auto", minWidth: "120px" }}
      className={
        className ??
        "inline-flex min-w-[120px] items-center justify-center rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-fuchsia-400 disabled:opacity-60"
      }
    >
      {loading ? "Analyseren..." : label}
    </button>
  );
}
