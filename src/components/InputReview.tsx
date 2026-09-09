import type { InputSection } from "../logic/inputReadiness";
import { formatCurrency } from "../utils/format";

export function InputReview({ section, onReview }: {
  section: InputSection;
  onReview: (signature: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
      <p className="font-semibold">{section.label}: {section.ready ? formatCurrency(section.total) : section.hasRows ? "Nog te controleren" : "Nog niet ingevuld"}</p>
      {!section.valid && <p role="status">Vul bij elke regel een naam en een geldig bedrag in. {section.key === "debts" && "Controleer ook de maandelijkse aflossing. "}Vul 0 in als het bedrag echt nul is.</p>}
      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={section.ready}
          disabled={!section.valid}
          onChange={(event) => onReview(event.target.checked ? section.signature : null)}
        />
        <span>{section.hasRows
          ? `Ik heb ${section.label.toLowerCase()} gecontroleerd: het overzicht is compleet en het totaal van ${section.valid ? formatCurrency(section.total) : "—"} klopt.`
          : `Ik bevestig dat ik geen ${section.label.toLowerCase()} heb (€ 0).`}</span>
      </label>
      <p className="mt-2 text-xs text-slate-400">Na een wijziging vragen we je dit opnieuw te controleren.</p>
    </div>
  );
}
