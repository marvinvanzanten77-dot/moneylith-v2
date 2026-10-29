# Nieuwe visuele werkruimte — 28 oktober 2026

Huidige implementatie op `personal/ui-reset`, alleen lokaal op poort 5190.
Publieke code en productie zijn niet gewijzigd. Deze versie bouwt verder op het
goedgekeurde dashboard en de aanvullende samengestelde ontwerpreferentie.

## Gebouwd

- Planning: salarisperiode 23–22, drie compacte bedragen, betalingstijdlijn,
  onderscheid tussen verwachting en herkende betaling. Selectie opent details;
  een tweede gerichte actie opent een nieuw invoerpaneel.
- Uitgaven: uitgavenring met legenda, boodschappen- en tankbudget, resterende
  ruimte, aankopen per potje en één aankoop tegelijk indelen.
- Vooruitblik: 7/30/90 dagen, echte berekende saldolijn en optionele tweede lijn
  voor een eenmalige uitgave of extra maandinkomen. Scenario verwijderen is direct
  beschikbaar. Het scenario is tijdelijk en wijzigt geen werkelijke gegevens.
  Dagelijkse budgetallocaties staan als één periodeverwachting in de momentenlijst.
- Schulden: openstaande bedragen, bestaande maandafspraken en gekoppelde
  aflossingen. Geen verzonnen voortgangsring zonder oorspronkelijke schuldstand.
- Doelen: visuele voortgang, een landschap bij het eerste doel, toevoegen en
  bewerken van doelbedrag, werkelijk opgebouwd bedrag en streefdatum.
- Meldingen: nieuwe compacte weergave voor de bestaande monitoring-API,
  lezen/afhandelen en een eerlijke verbindingsfout met opnieuw-proberen.

De compacte navigatie heeft labels naast de betekenis van de iconen. Desktop
gebruikt een smalle navigatiekolom; mobiel een horizontale navigatie. Detailpanelen
staan rechts op desktop en komen van onderen op mobiel. Alle schermen gebruiken
nieuwe markup en specifieke ontwerpstijlen. Geen oude App-/Step-renderer of
CSS-laag om oude schermen te verbergen.

## Werkende invoer

Inkomen, geplande uitgaven, variabele maandbedragen, betaalwijze, betaaldag,
boodschappen-/tankbudgetten en doelen gebruiken bestaande opslagvelden.
Wijzigingen bewaren overige recordvelden, bankbewijs en andere maanden.
Een verouderd geopend formulier mag een tussentijdse cloudwijziging niet
overschrijven. Mislukte opslag wordt getoond als fout, niet als succes.

Categoriseren corrigeert de geselecteerde aankoop met de bestaande audit- en
beslislogica. Andere transacties worden niet ongevraagd opnieuw ingedeeld.
Er wordt duidelijk aangegeven dat de keuze voor deze aankoop geldt.

De bestaande review-signaturen zijn bereikbaar via Volledigheid controleren.
Bankbevestigd inkomen blijft automatisch gecontroleerd. Een gecontroleerd leeg
overzicht is expliciet nul. Zonder complete basis blijft de totale perioderuimte
onbekend, terwijl afzonderlijke bedragen wel zichtbaar blijven.

## Behouden rekenlaag

`makePeriodPlan`, `reconcilePeriod`, `spendingRows`, `spendingAboveBudgets`,
`spendingSummary`, `costForMonth`, `setCostMonth`, `personalInput` en `project`.
Huidige planning gebruikt laatste invoer; historische inschattingen worden niet
achteraf uit huidige bedragen verzonnen. De bestaande periodevastlegging en
actualisatie van werkabonnementen zijn behouden. Alles blijft onder bestaande
Personal-opslagsleutels; geen nieuw financieel model of algemene opslagreset.

## Nog niet in het nieuwe ontwerp

- Schulden toevoegen/bewerken en handmatige betaalverdelingen corrigeren.
- Volledige bankkoppeling-/rekeninginstellingen, accountbeheer en back-up/import.
- Nieuwe AI-chat, contextuele AI-bespaartips en uitgebreid categorie-regelbeheer.
- Pushvoorkeuren en app-installatie/updatebediening in het nieuwe profielscherm.

Deze functies zijn niet uit de oorspronkelijke broncode of productie verwijderd;
ze zijn nog niet in deze lokale ontwerpversie opgenomen. Geen nepbediening of
fictieve AI-aanbevelingen toegevoegd om die gaten op te vullen.

## Controles

- Gerichte regressies voor betaaldatums, perioden, budgetaggregatie, opgeslagen
  historie, bankmatching, centbedragen, expliciete nul, ontbrekende invoer,
  Personal/Business-isolatie, metadatabehoud, opslagfouten en verouderde formulieren.
- Geïsoleerde Chrome-controles met fictieve invoer op 1536 en 390 px: alle zes
  schermen, geen horizontale overflow/JavaScriptfouten, een uitgave bewerken,
  opslaan/herladen, categoriseren, compleet bevestigen, saldolijn tekenen en
  scenario toevoegen/verwijderen zonder mutatie van echte gegevens.
- Geen echte bank-, cloud-, AI- of pushproductietest in deze lokale ontwerpstap.
  Backend, geheimen, providerconfiguratie en deployment zijn niet gewijzigd.

Bronbestanden: `src/redesign/Workspace.tsx`, `WorkspaceParts.tsx`,
`RecordEditor.tsx`, `workspaceModel.ts`, `workspace.css`, aanpassingen aan
`PersonalShell.tsx` en `useDashboard.ts`. Tests in
`tests/redesign-workspace.test.tsx` naast de bestaande dashboardtests.

Uitkomst: volledige regressiesuite 294/294 geslaagd; strenge TypeScript-controle
 en productiebuild geslaagd. Beide geteste schermbreedtes doorliepen ook de
bewerk-/herlaad-/indelings- en scenarioroute zonder JavaScriptfouten.


## Publicatie privéinterface — 29 oktober 2026

De nieuwe shell wordt aangesloten op de bestaande PersonalAccess en
CloudSyncBoundary op /prive. Het publieke project en de root-proxy blijven
ongewijzigd. Accountlogin, cloud laden (met lokale herstelkopie), opslaan,
uitloggen en bestaande bank-scan zijn via de nieuwe interface bereikbaar.
Handmatig cloud laden hervat ook een eerder gepauzeerde cloudopslag.

De hierboven genoemde ontbrekende nieuwe schermen blijven beperkingen: deze
publicatie maakt niet alle oude beheerfuncties bereikbaar in de nieuwe UI.
De oorspronkelijke broncode, opgeslagen velden, backend en cron blijven behouden.

Releasecontrole: 294 regressietests, strenge typecheck en productiebuild.
Geïsoleerde browsercontrole van de productiebuild met gesimuleerde API op desktop
(1536 px) en mobiel (390 px): toegang afgeschermd voor login, cloudsaldo laden,
bankscan met gewijzigd saldo, gepauzeerde cloudopslag hervatten en geen
cloudschrijfacties tijdens het laden. Deze controle gebruikt fictieve gegevens;
zij is geen test van de echte bankprovider of het wachtwoord van de eigenaar.
