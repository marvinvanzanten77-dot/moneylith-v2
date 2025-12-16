import type { UserIntent } from "../../types";

type StepIntentProps = {
  value: UserIntent;
  onChange: (value: UserIntent) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
};

const strategyOptionsPersonal: { value: NonNullable<UserIntent["primaryGoal"]>; label: string }[] = [
  { value: "schulden_verminderen", label: "Schulden verminderen" },
  { value: "buffer_opbouwen", label: "Buffer opbouwen" },
  { value: "inkomen_verhogen", label: "Inkomen verhogen" },
  { value: "stabiliseren", label: "Stabiliseren" },
  { value: "vermogen_groeien", label: "Vermogen laten groeien" },
];

const strategyOptionsBusiness: { value: NonNullable<UserIntent["primaryGoal"]>; label: string }[] = [
  { value: "vermogen_groeien", label: "Groei / opschalen" },
  { value: "stabiliseren", label: "Stabiliseren" },
  { value: "inkomen_verhogen", label: "Omschakelen" },
  { value: "schulden_verminderen", label: "Afbouwen" },
  { value: "buffer_opbouwen", label: "Nog onduidelijk" },
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
        { value: "ondersteunend", label: "Zacht en ondersteunend" },
        { value: "spiegelend", label: "Neutraal en feitelijk" },
        { value: "confronterend", label: "Direct en confronterend" },
      ]
    : [
        { value: "spiegelend", label: "Spiegelend" },
        { value: "confronterend", label: "Confronterend" },
        { value: "ondersteunend", label: "Ondersteunend" },
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
        </label>
      </div>
    </div>
  );
}

export default StepIntent;

