import type { UserIntent } from "../../types";

type StepIntentProps = {
  value: UserIntent;
  onChange: (value: UserIntent) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
};

const strategyOptionsPersonal: { value: NonNullable<UserIntent["primaryGoal"]>; label: string; hint: string }[] = [
  { value: "schulden_verminderen", label: "Schulden verminderen", hint: "Focus op aflossen en maanddruk omlaag." },
  { value: "buffer_opbouwen", label: "Buffer opbouwen", hint: "Spaar eerst een noodbuffer voor stabiliteit." },
  { value: "inkomen_verhogen", label: "Inkomen verhogen", hint: "Zoek extra inkomsten of optimaliseer je tarief." },
  { value: "stabiliseren", label: "Stabiliseren", hint: "Eerst rust en overzicht: kosten strak, geen nieuwe risico's." },
  { value: "vermogen_groeien", label: "Vermogen laten groeien", hint: "Na basis op orde: gericht investeren/spaarplan." },
];

const strategyOptionsBusiness: { value: NonNullable<UserIntent["primaryGoal"]>; label: string; hint: string }[] = [
  { value: "vermogen_groeien", label: "Groei / opschalen", hint: "Investeren in groei en omzet; meer risico mogelijk." },
  { value: "stabiliseren", label: "Stabiliseren", hint: "Cashflow gladstrijken, reserves aanvullen, geen nieuwe risico's." },
  { value: "inkomen_verhogen", label: "Omschakelen", hint: "Businessmodel of prijsstelling aanpassen voor meer omzet." },
  { value: "schulden_verminderen", label: "Afbouwen", hint: "Leningen/regelingen versneld aflossen, rente omlaag." },
  { value: "buffer_opbouwen", label: "Nog onduidelijk", hint: "Zakelijke buffer en runway opbouwen voor veiligheid." },
];

const pressureOptionsPersonal: { value: UserIntent["mainPressure"][number]; label: string }[] = [
  { value: "schulden", label: "Schulden" },
  { value: "vaste_lasten", label: "Vaste lasten" },
  { value: "inkomen_onzeker", label: "Onzeker inkomen" },
  { value: "geen_buffer", label: "Geen buffer" },
];

const pressureOptionsBusiness: { value: UserIntent["mainPressure"][number]; label: string }[] = [
  { value: "schulden", label: "Schulden / financiering" },
  { value: "vaste_lasten", label: "Vaste lasten & overhead" },
  { value: "inkomen_onzeker", label: "Onzekere omzet" },
  { value: "geen_buffer", label: "Geen zakelijke buffer" },
];

export function StepIntent({ value, onChange, variant = "personal", readOnly = false }: StepIntentProps) {
  const isBusiness = variant === "business";
  const isReadOnly = readOnly === true;

  const strategyOptions = isBusiness ? strategyOptionsBusiness : strategyOptionsPersonal;
  const pressureOptions = isBusiness ? pressureOptionsBusiness : pressureOptionsPersonal;

  const title = isBusiness ? "Zakelijke strategie" : "Startpunt";
  const subtitle = isBusiness
    ? "In welke stand staat je bedrijf de komende periode?"
    : "Dit is het vertrekpunt van je financiële koers. Eén keer invullen, later altijd aan te passen.";
  const strategyQuestion = isBusiness
    ? "Wat is je primaire zakelijke strategie voor de komende periode?"
    : "Wat is je primaire financiële strategie voor de komende periode?";
  const strategyPlaceholder = isBusiness ? "- kies een strategie -" : "- kies -";
  const pressureQuestion = isBusiness
    ? "Waar zit op dit moment de meeste druk in je bedrijf? (meerdere mogelijk)"
    : "Waar zit op dit moment de meeste druk? (meerdere mogelijk)";
  const horizonQuestion = isBusiness
    ? "Binnen welke termijn moet dit zakelijk voelbaar anders zijn?"
    : "Binnen welke tijd moet dit financieel voelbaar veranderd zijn?";
  const aiToneQuestion = isBusiness
    ? "Hoe wil je dat de AI met je praat over je bedrijf?"
    : "Hoe wil je dat de AI met je praat?";

  const horizonOptions = isBusiness
    ? [
        { value: "3_maanden", label: "Binnen 3 maanden" },
        { value: "1_jaar", label: "Binnen 6 maanden" },
        { value: "5_jaar", label: "Binnen 12 maanden" },
        { value: "5_jaar", label: "Langer dan 12 maanden" },
        { value: "", label: "Geen idee / eerst overzicht" },
      ]
    : [
        { value: "3_maanden", label: "3 maanden" },
        { value: "1_jaar", label: "1 jaar" },
        { value: "5_jaar", label: "5 jaar" },
      ];

  const aiToneOptions = isBusiness
    ? [
        { value: "ondersteunend", label: "Zacht en ondersteunend", example: "Ik help je stap voor stap, pragmatisch." },
        { value: "spiegelend", label: "Neutraal en feitelijk", example: "Ik vat samen en leg keuzes objectief voor." },
        { value: "confronterend", label: "Direct en confronterend", example: "Ik benoem scherp waar het wringt en wat je moet snijden." },
      ]
    : [
        { value: "spiegelend", label: "Spiegelend", example: "Ik leg terug wat je invult en stel verdiepende vragen." },
        { value: "confronterend", label: "Confronterend", example: "Ik ben direct en benoem risico's zonder omwegen." },
        { value: "ondersteunend", label: "Ondersteunend", example: "Ik blijf vriendelijk en help je stap voor stap." },
      ];

  const togglePressure = (key: UserIntent["mainPressure"][number]) => {
    if (isReadOnly) return;
    const current = value.mainPressure ?? [];
    const exists = current.includes(key);
    const next = exists ? current.filter((k) => k !== key) : [...current, key];
    onChange({ ...value, mainPressure: next });
  };

  return (
    <div className="space-y-6 card-shell p-5 text-slate-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>

      <div className="space-y-4">
        <label className="block text-sm font-semibold text-slate-800">
          {strategyQuestion}
          <select
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={value.primaryGoal ?? ""}
            onChange={(e) => {
              if (isReadOnly) return;
              onChange({ ...value, primaryGoal: (e.target.value || null) as UserIntent["primaryGoal"] });
            }}
            disabled={isReadOnly}
          >
            <option value="">{strategyPlaceholder}</option>
            {strategyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {value.primaryGoal && (
            <p className="mt-1 text-xs text-slate-500">
              {strategyOptions.find((o) => o.value === value.primaryGoal)?.hint ?? ""}
            </p>
          )}
        </label>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">{pressureQuestion}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {pressureOptions.map((opt) => (
              <label
                key={`${opt.label}-${opt.value}`}
                className="flex items-center gap-2 rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-800"
              >
                <input
                  type="checkbox"
                  checked={value.mainPressure?.includes(opt.value) ?? false}
                  onChange={() => togglePressure(opt.value)}
                  disabled={isReadOnly}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-800">
          {horizonQuestion}
          <select
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={value.timeHorizon ?? ""}
            onChange={(e) => {
              if (isReadOnly) return;
              onChange({ ...value, timeHorizon: (e.target.value || null) as UserIntent["timeHorizon"] });
            }}
            disabled={isReadOnly}
          >
            <option value="">- kies -</option>
            {horizonOptions.map((opt) => (
              <option key={`${opt.label}-${opt.value}`} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-800">
          {aiToneQuestion}
          <select
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            value={value.aiStyle ?? ""}
            onChange={(e) => {
              if (isReadOnly) return;
              onChange({ ...value, aiStyle: (e.target.value || null) as UserIntent["aiStyle"] });
            }}
            disabled={isReadOnly}
          >
            <option value="">- kies -</option>
            {aiToneOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {value.aiStyle && (
            <p className="mt-1 text-xs text-slate-500">
              Voorbeeld: {aiToneOptions.find((o) => o.value === value.aiStyle)?.example ?? ""}
            </p>
          )}
        </label>

        <div className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Controleer je invoer</p>
          <ul className="mt-1 space-y-1">
            <li>
              Strategie:{" "}
              <span className="font-semibold">
                {strategyOptions.find((o) => o.value === value.primaryGoal)?.label ?? "nog niet gekozen"}
              </span>
            </li>
            <li>
              Drukpunten:{" "}
              <span className="font-semibold">
                {value.mainPressure && value.mainPressure.length
                  ? value.mainPressure
                      .map((p) => pressureOptions.find((o) => o.value === p)?.label ?? p)
                      .join(", ")
                  : "geen selectie"}
              </span>
            </li>
            <li>
              Horizon:{" "}
              <span className="font-semibold">
                {horizonOptions.find((o) => o.value === value.timeHorizon)?.label ?? "nog niet gekozen"}
              </span>
            </li>
            <li>
              AI-stijl:{" "}
              <span className="font-semibold">
                {aiToneOptions.find((o) => o.value === value.aiStyle)?.label ?? "nog niet gekozen"}
              </span>
            </li>
          </ul>
          <p className="mt-1 text-[11px] text-slate-500">Klopt dit voor nu? Je kunt later altijd terug om het aan te passen.</p>
        </div>
      </div>
    </div>
  );
}

export default StepIntent;
