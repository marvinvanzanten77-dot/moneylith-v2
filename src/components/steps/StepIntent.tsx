import type { UserIntent } from "../../types";
import { IntentQuestions } from "../IntentQuestions";
const strategyOptionsPersonal: {
  value: NonNullable<UserIntent["primaryGoal"]>;
  label: string;
  hint: string;
}[] = [
  {
    value: "schulden_verminderen",
    label: "Schulden verminderen",
    hint: "Focus op aflossen en maanddruk omlaag.",
  },
  {
    value: "buffer_opbouwen",
    label: "Buffer opbouwen",
    hint: "Spaar eerst een noodbuffer voor stabiliteit.",
  },
  {
    value: "inkomen_verhogen",
    label: "Inkomen verhogen",
    hint: "Zoek extra inkomsten of optimaliseer je tarief.",
  },
  {
    value: "stabiliseren",
    label: "Stabiliseren",
    hint: "Eerst rust en overzicht: kosten strak, geen nieuwe risico's.",
  },
  {
    value: "vermogen_groeien",
    label: "Vermogen laten groeien",
    hint: "Na basis op orde: gericht investeren/spaarplan.",
  },
];

const pressureOptionsPersonal: {
  value: UserIntent["mainPressure"][number];
  label: string;
}[] = [
  { value: "schulden", label: "Schulden" },
  { value: "vaste_lasten", label: "Vaste lasten" },
  { value: "inkomen_onzeker", label: "Onzeker inkomen" },
  { value: "geen_buffer", label: "Geen buffer" },
];

export function StepIntent({
  value,
  onChange,
  readOnly = false,
}: {
  value: UserIntent;
  onChange: (value: UserIntent) => void;
  variant?: "personal" | "business";
  readOnly?: boolean;
}) {
  return (
    <IntentQuestions
      value={value}
      onChange={(next) => onChange({ ...value, ...next })}
      strategies={strategyOptionsPersonal}
      pressures={pressureOptionsPersonal}
      readOnly={readOnly}
    />
  );
}
export default StepIntent;
