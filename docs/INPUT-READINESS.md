# Ontbrekende invoer versus nulbedragen

Basis: `moneylith-v2/main`, commit `fc0735de82559248f0701889ccc94d42fbeab658`, de op 9 september 2026 via Vercel geverifieerde productieversie voor www.moneylith.nl. Werkbranch: `fix/input-readiness`.

## Gedrag

- Fundament toont geen vrije ruimte of financieel oordeel zolang inkomen en vaste lasten niet compleet en gecontroleerd zijn.
- Vooruitblik toont welke onderdelen nog ontbreken. Berekeningen, scenario's en risicoteksten verschijnen pas na controle van inkomen, vaste lasten, schulden en vermogen.
- Een lege lijst is onbekend. Via de expliciete bevestiging 'Ik heb geen … (€ 0)' kan de gebruiker aangeven dat de werkelijke waarde nul is.
- Nieuwe handmatige regels beginnen met een leeg bedrag. `amountEntered` onderscheidt een bewust getypte nul van een nog leeg of weer leeggemaakt veld. Historische nulwaarden zonder deze informatie vereisen opnieuw invoeren/controleren; positieve bestaande bedragen blijven beschikbaar.
- Een bevestiging geldt voor precies de gecontroleerde gegevens. Wijzigen, toevoegen of verwijderen maakt haar ongeldig, ook als het betrokken scherm niet openstaat. Bevestigingen zijn gescheiden voor persoonlijk en zakelijk en worden lokaal opgeslagen onder nieuwe, versiegebonden sleutels.
- De navigatie gebruikt dezelfde gereedheidscontrole; een bevestigde nul telt als ingevuld.
- Een echte nulmarge zonder doelen heet 'Inkomen en vaste lasten zijn in evenwicht'. Een werkelijk tekort en ongedekte doelbetalingen blijven zichtbaar zodra de invoer is bevestigd.

## Implementatie

`src/logic/inputReadiness.ts` bevat de validatie, identiteit van de beoordeelde invoer en conclusievoorwaarden. `InputReview` levert de expliciete bevestiging. `App.tsx` gebruikt de actuele records voor beide schermen in plaats van totalen die pas door callbacks van eerder geopende tabbladen worden gevuld. Vooruitblik controleert gereedheid vóór het uitvoeren van de simulatie. De bestaande bronkeuze voor gedetecteerde versus handmatige vaste lasten blijft zichtbaar; een expliciet nulbedrag in een geselecteerde gedetecteerde lijst wordt niet door een fallback vervangen.

De wijziging blijft binnen de bestaande React/localStorage-architectuur van v2. Zij importeert niet de afzonderlijke SQLite-refactor uit de andere repository `MONEYLITH`.

## Verificatie

- `npm ci`: geslaagd op Node 20.20.0, nadat ruimte voor de installatie is vrijgemaakt. Een eerdere poging strandde op een volle schijf; de geslaagde installatie gebruikt een afzonderlijke tijdelijke npm-cache.
- `npm test`: 13 tests, 13 geslaagd, 0 mislukt. Onder meer lege en gedeeltelijke invoer, bevestigde nul, echte tekorten, wijzigen/verwijderen, herladen van een bevestiging, gewijzigde schuldaflossing, ongeldige bedragen en daadwerkelijke React-rendering van de lege en complete vooruitblik.
- `npm run build`: geslaagd. De bestaande waarschuwingen over grote bundels en verouderde Browserslist-data blijven bestaan.
- `tsc --noEmit`: niet groen. Controle van de oorspronkelijke code leverde 108 foutmeldingen op; de gewijzigde code 85. Vergelijking na normalisatie van paden en regelnummers toont geen nieuwe diagnostische meldingen. Onder de bestaande problemen vallen dubbele transactietypen, oude componentprops en dependencytypes. De Vite-build voert zelf geen volledige typecheck uit.
- De repository had geen lintscript; een volledige lintcontrole wordt niet als geslaagd gerapporteerd.
- Gerichte browsercontrole van de lokale productiebuild, met een geïsoleerde sessie en synthetische gegevens: lege Fundament/Vooruitblik, gedeeltelijke bevestiging, bevestigde nulwaarden, scenario's pas na volledige bevestiging, nul in het invoerveld en het vervallen van bevestiging na een wijziging. Geen bankkoppeling, cloudlogin of AI-aanroep gebruikt.

## Begrenzing

Dit herstelt de invoerstatus en de voorwaarden voor conclusies in Fundament en Vooruitblik. Het is geen volledige audit of herziening van het bestaande prognosemodel. De overige gemelde onboardingteksten, dubbele startstap en uitgeschakelde zakelijke modus vallen buiten deze eerste herstelprioriteit. Persoonlijke gegevens zijn niet aangepast en productie is niet gedeployd.
