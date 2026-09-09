export const businessTabs = [
  ["intent", "Intentie", "Bedrijfsdoelen en richting"],
  ["foundation", "Fundament", "Omzet, kosten en winstindicatie"],
  ["debts", "Schulden", "Leningen, regelingen en open facturen"],
  ["assets", "Vermogen", "Geldmiddelen, reserves en bedrijfsmiddelen"],
  ["goals", "Doelen", "Groei, buffer, investeren en aflossen"],
  ["accounts", "Rekeningen", "Zakelijke betaal- en spaarrekeningen"],
  ["patterns", "Patronen", "Ontvangsten en betalingen"],
  ["inbox", "Inbox", "Facturen, bonnetjes en documenten"],
  ["forecast", "Vooruitblik", "Kasstroom en scenario’s"],
  ["backup", "Backup", "Alleen deze administratie"],
  ["settings", "Instellingen", "Bedrijf, aannames en opslag"],
] as const;
export type BusinessTab = (typeof businessTabs)[number][0];
export const assumptions = [
  "Dit model is voor een Nederlandse zzp’er/eenmanszaak met normale btw. KOR, verlegde btw, buitenlandse valuta en gemengd privégebruik zijn niet automatisch verwerkt.",
  "Omzet en kosten volgen de factuurdatum. Betalingen veranderen alleen de geldstand. Een onbetaalde factuur kan dus al omzet zijn, maar is nog geen beschikbaar geld.",
  "Privéonttrekkingen en aflossingen zijn geen bedrijfskosten. Ontvangen leningen en privéstortingen zijn geen omzet. Rente voert u afzonderlijk als kostenfactuur in.",
  "Investeringsfacturen tellen niet direct als kosten. Boekwaarden en afschrijvingen worden niet automatisch berekend. De winstindicatie is vóór afschrijving en fiscale correcties.",
  "Btw-aftrek geldt alleen als u dit bij de inkoop bevestigt. Niet-aftrekbare btw op kosten telt mee in de kosten; niet-aftrekbare btw op investeringen niet in deze winstindicatie.",
  "Reserves zijn geoormerkt geld, geen extra betaling. Belastingreserves zijn instelbare schattingen, geen aangifteberekening. De getoonde btw- en belastingreserves betreffen de gekozen maand, geen nog onbekende oude fiscale schulden.",
  "Beginsaldi gelden vóór de mutaties op de begindatum. Neem daarin geen betalingen op die u ook apart boekt. Elke betaling wordt één keer ingevoerd en zo nodig gekoppeld aan de bestaande factuur of lening.",
];
export const forecastAssumptions = [
  "Het maandplan betreft nieuw werk ná de gekozen maand. Nieuwe omzet en kosten worden volledig in dezelfde maand betaald. Het plan is een scenario, geen toezegging van klanten.",
  "Reeds uitgereikte open facturen worden éénmalig in hun vervalmaand betaald; achterstallige posten in de eerste prognosemaand. Voer die niet nogmaals als extra maandelijkse omzet of kosten in.",
  "Aflossingen stoppen bij een hoofdsom van nul. Rente zit alleen in het kostenplan; er is geen automatische renteberekening. Doelen maken geen automatische betalingen aan.",
  "Btw en geschatte inkomstenbelasting blijven in het scenario gereserveerd op de bank; beschikbare ruimte trekt deze reserves af. Een verwachte btw-teruggaaf wordt niet als ontvangen geld geteld.",
];
