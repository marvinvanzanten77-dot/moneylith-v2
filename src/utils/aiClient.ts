type AiPayload = {
  prompt: string;
  state?: unknown;
};

export async function requestAiAnswer({ prompt, state }: AiPayload): Promise<string> {
  const resp = await fetch("/api/ai-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, state }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "AI-service niet beschikbaar");
  }

  const data = (await resp.json()) as { answer?: string };
  return data.answer ?? "Geen antwoord ontvangen.";
}
