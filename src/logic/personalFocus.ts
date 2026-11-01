import type {CloudState} from '../storage/cloudState.js';
import type {MonthFocus} from '../types.js';
/** Reuse the existing focus preference; never infer consent from debt balances. */
export function personalFocus(state:CloudState){
 let value:unknown;try{value=JSON.parse(state['month-focus']??'null');}catch{value=null;}
 const focus:MonthFocus=['overleven','schulden_afbouwen','vermogen_opbouwen','experiment'].includes(String(value))?value as MonthFocus:null;
 return {focus,stabilizing:focus==='overleven'||focus==='schulden_afbouwen',label:focus==='overleven'?'Eerst stabiliseren':focus==='schulden_afbouwen'?'Schulden aanpakken':focus==='vermogen_opbouwen'?'Ruimte opbouwen':focus==='experiment'?'Mogelijkheden onderzoeken':'Kies je huidige focus'};
}
export function focusPolicy(state:CloudState){
 if(!personalFocus(state).stabilizing)return 'Sluit aan op de gekozen focus. Stel sparen of extra aflossen alleen voor als er aantoonbaar ruimte is; ontbrekende gegevens zijn geen ruimte.';
 return 'De gekozen prioriteit is financieel stabiliseren: rondkomen, bekende betalingsachterstanden en bestaande regelingen overzichtelijk aanpakken. Bescherm noodzakelijke lopende kosten (wonen, energie, zorg, boodschappen en noodzakelijk vervoer). Stel geen nieuwe spaardoelen, verplichte buffers of extra aflossingen voor als standaard volgende stap. Een eventueel positief subtotaal is geen bewijs van vrije ruimte. Noem hoogstens één haalbare volgende stap op basis van bekende feiten. Kijk naar komende betalingen, bevestigde achterstanden, ontbrekende afspraken en passende uitgavenkeuzes; maak geen juridische rangorde van schuldeisers. Vraag welke afspraak of deadline geldt als die ontbreekt. Een openstaande schuld zonder regeling is geen maandlast. Beslag of inhoudingen zitten al in het ontvangen salaris en worden niet nogmaals afgetrokken. Extra inkomsten uit bijvoorbeeld websites of apps bouwen zijn mogelijkheden, nooit gegarandeerd inkomen; schrijf ze niet in de basisbegroting zonder opdracht. Geen automatische betaalregelingen, betalingen, extra aflossingen of wijzigingen van bestaande doelen. Geen oordeel, schaamte of druk; help de gebruiker stap voor stap en erken echte vooruitgang. Op expliciet verzoek mogen doelen wel worden besproken, met behoud van noodzakelijke lasten en zonder betaalbaarheid te verzinnen.';
}
