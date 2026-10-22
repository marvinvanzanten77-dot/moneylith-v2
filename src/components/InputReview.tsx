import { Button, ReviewPanel } from "./WorkspaceUI";
import type { InputSection } from "../logic/inputReadiness";
import { formatCurrency } from "../utils/format";

export function InputReview({
  section,
  onReview,
  showTotal = true,
}: {
  section: InputSection;
  showTotal?: boolean;
  onReview: (signature: string | null) => void;
}) {
  return (
    <ReviewPanel>
      <p className="font-semibold">
        {section.label}:{" "}
        {section.ready
          ? showTotal
            ? formatCurrency(section.total)
            : "Gecontroleerd"
          : section.hasRows
            ? "Nog te controleren"
            : "Nog niet ingevuld"}
      </p>
      {!section.valid && (
        <p role="status">
          Vul bij elke regel een naam en een geldig bedrag in.{" "}
          {section.key === "debts" &&
            "Controleer ook de maandelijkse aflossing. "}
          Vul 0 in als het bedrag echt nul is.
        </p>
      )}
      <p className="mt-2">
        {section.hasRows
          ? `Bevestig dat je alle ${section.label.toLowerCase()} hebt ingevuld en gecontroleerd${showTotal && section.valid ? ` en dat het totaal van ${formatCurrency(section.total)} klopt` : ""}.`
          : `Bevestig alleen € 0 als je geen ${section.label.toLowerCase()} hebt.`}
      </p>
      <Button type="button" aria-pressed={section.ready} className="mt-3 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" disabled={!section.valid} onClick={() => onReview(section.ready ? null : section.signature)}>
        {section.ready ? "Controle ongedaan maken" : section.hasRows ? "Hele overzicht gecontroleerd" : "Bevestigen: geen posten (€ 0)"}
      </Button>
      {!section.valid && <p className="mt-2 text-sm">Je kunt complete regels afzonderlijk controleren. Het hele overzicht kun je bevestigen zodra alle verplichte bedragen zijn ingevuld.</p>}
      <p className="mt-2 text-xs text-slate-400">
        Na een wijziging vragen we je dit opnieuw te controleren.
      </p>
    </ReviewPanel>
  );
}
