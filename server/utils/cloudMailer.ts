type RegistrationOutcome = "success" | "failed";

type RegistrationMailInput = {
  to: string;
  outcome: RegistrationOutcome;
  reason?: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const buildSubject = (outcome: RegistrationOutcome) =>
  outcome === "success"
    ? "Moneylith: registratie geslaagd"
    : "Moneylith: registratie niet gelukt";

const buildText = (outcome: RegistrationOutcome, reason?: string) => {
  if (outcome === "success") {
    return [
      "Je registratie bij Moneylith is geslaagd.",
      "",
      "Je kunt nu inloggen en cloud-opslag gebruiken naast local-first.",
      "",
      "Groet,",
      "Moneylith",
    ].join("\n");
  }
  return [
    "Je registratie bij Moneylith is niet gelukt.",
    reason ? `Reden: ${reason}` : "Reden: onbekend.",
    "",
    "Controleer je gegevens en probeer opnieuw.",
    "",
    "Groet,",
    "Moneylith",
  ].join("\n");
};

const buildHtml = (outcome: RegistrationOutcome, reason?: string) => {
  if (outcome === "success") {
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 12px">Registratie geslaagd</h2>
        <p>Je registratie bij <strong>Moneylith</strong> is geslaagd.</p>
        <p>Je kunt nu inloggen en cloud-opslag gebruiken naast local-first.</p>
        <p style="margin-top:20px">Groet,<br/>Moneylith</p>
      </div>
    `;
  }
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Registratie niet gelukt</h2>
      <p>Je registratie bij <strong>Moneylith</strong> is niet gelukt.</p>
      <p>${reason ? `Reden: ${reason}` : "Reden: onbekend."}</p>
      <p>Controleer je gegevens en probeer opnieuw.</p>
      <p style="margin-top:20px">Groet,<br/>Moneylith</p>
    </div>
  `;
};

export async function sendCloudRegistrationEmail(input: RegistrationMailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MONEYLITH_MAIL_FROM || process.env.MAIL_FROM || "";
  const to = normalizeEmail(input.to);

  if (!apiKey || !from || !to.includes("@")) {
    console.log("[cloud.mail] skipped", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      to,
      outcome: input.outcome,
    });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: buildSubject(input.outcome),
        html: buildHtml(input.outcome, input.reason),
        text: buildText(input.outcome, input.reason),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn("[cloud.mail] send failed", { status: response.status, body });
    } else {
      console.log("[cloud.mail] sent", { to, outcome: input.outcome });
    }
  } catch (error) {
    console.warn("[cloud.mail] exception", { message: error instanceof Error ? error.message : String(error) });
  }
}
