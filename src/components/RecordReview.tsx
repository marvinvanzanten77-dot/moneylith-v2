import type { IncomeItem, FixedCostManualItem } from "../types";
import { recordReview } from "../logic/inputReadiness";
import { Button, primaryButtonClass } from "./WorkspaceUI";
export function RecordReview({item, disabled, onReview}: {item:IncomeItem | FixedCostManualItem; disabled?:boolean; onReview:(signature:string | undefined)=>void}) {
  const review=recordReview(item);
  return <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
    <Button type="button" aria-pressed={review.ready} variant="primary" className={primaryButtonClass + " max-w-full whitespace-normal disabled:cursor-not-allowed disabled:opacity-50"} disabled={disabled || !review.valid} onClick={()=>onReview(review.ready ? undefined : review.signature)}>{review.ready ? "Controle van deze regel ongedaan maken" : "Deze regel gecontroleerd"}</Button>
    <p className="text-xs text-slate-600">{review.ready ? "Deze regel is gecontroleerd. Bij een wijziging controleer je de regel opnieuw." : review.valid ? "Controleer deze regel los van de andere posten. Bevestig onderaan apart of het hele overzicht compleet is." : "Vul eerst een naam en bedrag in. Een onbekend bedrag kun je nog niet bevestigen; vul alleen 0 in als het echt nul is."}</p>
  </div>;
}
