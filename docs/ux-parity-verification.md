# Gedeelde bediening Persoonlijk en Zakelijk

Uitgangspunt: main `001cd04d848421a2ed9670227f6653b84705b81a` (opnieuw vergeleken met origin/main). Geen opslagreset, demo-import of wijziging van de persoonlijke/zakelijke chatsleutels.

## Implementatie per tabblad

| Tabblad | Gedeelde bediening / herstel | Zakelijk inhoudelijk verschil |
| --- | --- | --- |
| Intentie | `IntentQuestions`: strategie, meerdere drukfactoren, 3 maanden/1 jaar/5 jaar en drie AI-stijlen. Direct bewaren. | Zakelijke opties; bedrijfsnaam en oude vrije teksten als aanvullende invoer, zonder afgeleide selecties. Server valideert keuzes en verwerkt ze in de AI-instructies. |
| Fundament | `ExpandableRecord`, dezelfde invoerstijlen en `InputReview`; eerst uitleg en invoer, dan bevestiging en resultaten. Facturen worden in de lijst bewerkt. | Omzetfacturen, kosten, investeringen en btw blijven afzonderlijk; facturen vereisen een geldige complete regel bij opslaan. Maandplanning blijft een aanname. |
| Schulden | Uitklapbare invoer, toevoegen, opslaan, annuleren en controle vóór resultaten. | Hoofdsom, aflossing, leningbetalingen en leveranciersfacturen blijven gescheiden; rente blijft een kostenpost. |
| Vermogen | Dezelfde uitklapbare regels en invoervelden; bedrijfsmiddelen invoeren en controleren vóór resultaten. | Boekwaarde is geen banksaldo. Reserveringen behouden hun eigen aannames en controle. |
| Doelen | `GoalWorkspace`: actieve doelen, prioriteit, uitklappen, bewerken, annuleren, leegmaken, voorbeelden en optionele deadline. | Zakelijke bedragen mogen onbekend blijven. Omzetdoelen volgen gecontroleerde omzet; aflosdoelen tonen hoofdsom en geplande aflossing. Voorbeelden vullen uitsluitend naam en type. |
| Rekeningen | `AccountsWorkspace` en `AccountTile`: dezelfde lijst/formulier-indeling en kaartstijl. Direct invulbaar formulier, bewerken en verwijderen. | Beginsaldo en begindatum zijn nodig voor een boekbare zakelijke rekening; gekoppelde betalingen verhinderen onveilig verwijderen. Geen zakelijke IBAN-sync of primaire-bankfunctie gesuggereerd. |
| Bank | Dezelfde navigatiepositie en moduswissel; bestaande niet-beschikbare status en handmatige vervolgstap gecontroleerd. | Zakelijke bankkoppeling blijft niet beschikbaar. |
| Patronen | Ontvangsten en betalingen binnen de lijst toevoegen/bewerken, zonder apart venster. | Analyse blijft gebaseerd op gecontroleerde zakelijke facturen en betalingen. Koppelingen verschillen per soort betaling. |
| Inbox | Facturen met dezelfde uitklapbare regel en dezelfde opslag-/annuleerbediening als Fundament. | Handmatige factuurregistratie; geen zakelijke PDF-opslag/OCR geïntroduceerd. Betalingen worden afzonderlijk gekoppeld. |
| Vooruitblik | Scenario direct bewerken, opslaan en terugzetten; bekende invoercontroles blijven intact. | Zakelijke kasstroom, btw-/belastingbetalingen, aflossingen en reserveringen blijven behouden. |
| Backup | Dezelfde `BackupCard`: export, wachtwoordversleuteling, versies en bestand herstellen. | Zakelijke adapter exporteert/herstelt uitsluitend de volledige eigen administratie; gekoppelde onderdelen worden niet los geëxporteerd. Eigen versiesleutel; chats worden niet vervangen. Herstel maakt controles ongeldig. |
| Instellingen | Dezelfde `StepSettings` en `NavigationHint`: opslagkeuze, hulpmodus, bannerbediening, intro en Backup. | Cloudopslag is voor Zakelijk uitgeschakeld en als niet beschikbaar benoemd. Zakelijke reserveringen en rekenafspraken blijven aanvullend beschikbaar. |

Bestaande `ApplicationLayout`, `ModeBanner`, `NavigationStep` en `AiAssistantCard` blijven de gedeelde applicatiebasis. Geen aparte zakelijke chat of lokale vervangingsgids.

## Gegevens en validatie

- `BusinessData.intent` is optioneel voor bestaande opslag. Oude intentieteksten blijven ongewijzigd. Nieuwe selecties worden alleen door gebruikershandelingen vastgelegd.
- Bestaande doelen met numerieke bedragen en ISO-deadlines blijven geldig. Nieuwe zakelijke doelbedragen/deadlines kunnen `null` zijn; expliciete nul blijft nul.
- AI-context gebruikt een serverzijdige allowlist. Strategie, drukfactoren, termijn en stijl komen uit de actieve zakelijke administratie. Onbekende/ongecontroleerde financiële totalen blijven afgeschermd.
- Wijzigingen aan financiële bronregels maken hun eerdere exacte controlebevestigingen ongeldig. Een intentiewijziging verandert financiële bevestigingen niet.
- Persoonlijke losse inkomsten en lasten bewaren direct. Zakelijke gekoppelde records bewaren als gevalideerde complete regel, zodat een onvolledige factuur of betaling geen boekingsfeit wordt.
- Bij gedeelde backupversleuteling wordt dezelfde geselecteerde inhoud versleuteld als bij gewone export. Een leeg wachtwoord veroorzaakt een foutmelding in plaats van stil een onversleuteld bestand te downloaden.

## Lokale controles

Geïsoleerde browsersessies met herkenbare fictieve testrecords; geen gebruikersadministratie gewist.

- Alle twaalf tabbladen in beide modi op 1440×1000 en 390×844: actieve navigatie, moduswissel, kolom-/modusknopgeometrie en horizontale pagina-overloop gecontroleerd. Screenshots van overeenkomstige tabbladen visueel nagekeken.
- Intentie: keuzes, meerdere drukfactoren, wijzigen en herladen; bestaande vrije teksten en gescheiden chats behouden.
- Doelen: voorbeeld zonder opslag/bedragen/deadline, onbekend versus expliciete nul, ongeldige datum afwijzen, bewerken, annuleren, deadline verwijderen, deactiveren, opslaan/herladen en mobiel toevoegen/verwijderen.
- Zakelijke factuur met expliciete nul toevoegen; bedrag wijzigen; oude controle vervalt; ontvangen betaling koppelen; lening, bedrijfsmiddel, rekening en maandplanning opslaan; gegevens blijven na herladen behouden.
- Vooruitblik ontsluit pas bij gecontroleerde gegevens; scenario aanpassen/opslaan/terugzetten behoudt echte brongegevens.
- Mobiele zakelijke rekening toevoegen, wijzigen en verwijderen; persoonlijk inkomen toevoegen, wijzigen, verwijderen en herladen; persoonlijke rekening toevoegen/herladen.
- Gedeelde backup: echte browsercryptografie, versleuteld bestand exporteren en teruglezen, intentie/doelen/facturen behouden, chats behouden en controlebevestigingen wissen. Desktop en mobiel gecontroleerd.
- AI-verzoek in browser: zakelijke keuzes meegestuurd, geen persoonlijke geschiedenis. Gecontroleerd vertraagd antwoord na moduswissel en chatreset wordt niet weergegeven of opgeslagen. Een gesimuleerde 502 toont de eerlijke foutstatus. Deze lokale controles zijn geen bewijs van een actieve AI-provider; daarvoor volgt een echte productieaanroep.
- Gerichte regressies staan in `tests/guided-business.test.tsx`; bestaande financiële, opslag-, navigatie- en AI-regressies blijven onderdeel van de volledige suite. Strenge TypeScript-instellingen zijn niet versoepeld.

De commit, Vercel-deployment en echte productieaanroepen worden na publicatie afzonderlijk gerapporteerd. Bankautorisatie, zakelijke OCR en nieuwe cloudfunctionaliteit behoren niet tot deze wijziging.
