# Moneylith: samenhangcontrole, 26 oktober 2026

## Uitgangspunt

Main `94b7be3`. De lokale VS Code-instelling is geen onderdeel van deze wijziging.
Geen AGENTS.md gevonden in de repository of bovenliggende werkmappen.

Bestaande architectuur die behouden is:

- `processBankSync` en `mergeLunchflow`: gedeelde bankverwerking, stabiele IDs, behouden handmatige verrijkingen, gedeeltelijke fouten en laatste salarisontvangst.
- `periodReconciliation`: salarisperioden 23ste–22ste, betaalde bedragen, expliciete aflossingen en herkenning van terugboekingen.
- `personalInput` / `remainingPayments` / projectie-engine: geldstromen in gehele centen, betaalde verplichtingen niet opnieuw aftrekken, scenario’s zonder mutatie, 7/30/90 dagen.
- `buildChatRequest`: actieve administratie, serverberekende projectie en aparte feiten/aannames/onbekenden. Verkoop, btw, zakelijke kasstroom en privégegevens blijven gescheiden.
- `debtPayments`: alleen expliciete referenties of bevestigingen boeken schuld af, zonder extra kasmutatie; geen automatische extra aflossing.
- Bestaande ApplicationLayout, compacte mobiele interface, ModeBanner, formulieren en AI-chat.
- Beveiligde cloudroute, versleutelde opslag, revision-CAS, verliesloze overdrachtcompressie, lokale IndexedDB-herstelkopie, drie dagelijkse bankcontroles en gedeelde meldingsstatus.

## Gevonden inconsistenties en herstel

| Onderdeel | Bevinding | Wijziging |
| --- | --- | --- |
| Budgetten en Patronen | Kalendermaand liep anders dan Fundament en Vooruitblik. | Actieve persoonlijke potjes, budgetverbruik, coach en meldingen gebruiken dezelfde salarisperiode. Kalenderanalyse blijft intern beschikbaar voor bestaande historische analyses. |
| Wisselende budgetten | Sommige schermen lazen `bedrag` in plaats van het betreffende maandbedrag. | Periodebudget wordt via `costForMonth` opgelost; onbekend blijft onbekend, expliciete nul geldig. |
| Fundament | Een bewaarde inschatting bleef in de lopende periode achter op wijzigingen. | Lopende periode gebruikt actuele invoer; eerdere perioden houden hun opgeslagen inschatting naast werkelijk betaald. |
| Betalingen | Losse koppelbediening, geen keuze voor factuurperiode of herstelhistorie. | Eén controlevenster in Fundament voor een bestaande last/schuld, gecombineerde verdeling en expliciete salarisperiode; boekingsdatum blijft intact. |
| Aankoopindeling | Correctie gold standaard voor een hele groep. | Expliciete keuze: alleen deze betaling of ook toekomstige vergelijkbare aankopen. Individuele keuze heeft voorrang. Correctiehistorie ondersteunt terugdraaien. |
| Verdeling en potjes | Een handmatig toegewezen vaste last kon ook volledig als aankoop blijven verschijnen. | Potjes gebruiken alleen het nog niet toegewezen bedrag uit dezelfde betalingsadministratie. |
| Herstel aflossingen | Geen herstelgegevens voor nieuwe handmatige/automatische verwerkingen. | Nieuwe verwerkingen bewaren relevante voor/na-gegevens. Terugdraaien bewaart historie en voorkomt automatische herverwerking. Latere schuldwijzigingen worden niet overschreven. |
| Budgettempo | Zeven verstreken dagen waren voldoende zonder rekeningdekking te controleren. | Minimaal drie betalingen, zeven dagen en historie vanaf periodebegin op iedere actieve persoonlijke bankrekening; meetbasis en onzekerheid worden genoemd. |
| Uitlegbaarheid | Bedragen hadden weinig directe onderbouwing. | Gedeelde uitklapbare uitleg bij banksaldo, mobiel Vandaag, Fundament, schulden en Vooruitblik; bedragen komen uit bestaande berekeningen. |
| Meldingen | Alleen uitgavenvergelijking, geen signaal uit dezelfde projectie. | Alleen bij complete rekenbasis een signaal over negatieve ruimte binnen 30 dagen, zonder tijdelijke scenario’s of ongeboekte extra inkomsten. Bestaande stabiele meldingsidentiteit blijft behouden. |
| Opslag | Hook kon gewijzigde UI tonen na mislukte lokale opslag. | Eerst opslaan; bij fout blijft eerdere UI-waarde staan en verschijnt een foutmelding. |
| Cloudstatus | Wachtrij en geladen cloudversie waren onvoldoende zichtbaar. | Status afgeleid van de daadwerkelijk gesynchroniseerde snapshot; laatste opslag/geladen tijd, fout en opnieuw proberen; herstelkopie downloaden zonder huidige administratie te vervangen. |
| Bankstatus | Geslaagde of gedeeltelijke scan verdween na verlaten scherm. | Gedeelde opgeslagen scanstatus op desktop en mobiel, met laatste volledig geslaagde controle en duidelijke beperking van provideractualiteit. |

## Controledekking

Nieuwe ketentests in `tests/coherence.test.tsx`:

- budgetverbruik over maandgrens, potjes en resterende projectie;
- variabel budget, onbekend en expliciete nul;
- gecombineerde schuld/vaste-lastbetaling, restbedrag en herhaalde verwerking;
- late factuur in eerdere salarisperiode;
- terugdraaien en bescherming van latere schuldwijzigingen;
- terugboeking en uitsluiting zakelijke rekening;
- één aankoop versus toekomstige indeling, inclusief terugdraaien;
- automatische aflossing met herstelhistorie en bescherming tegen herverwerking;
- categorieherstel na een nieuwe banksynchronisatie, met behoud van eerdere handmatige indeling.

Bestaande regressies blijven actief voor bankimport, salaris na inhoudingen, rekeningen, doelen, bedrijfsfinanciën, btw, schuldschema’s, scenario verwijderen/resetten, AI-contextscheiding, meldingsdeduplicatie, cloudconflicten, grote overdrachten en app-update/serviceworker.

Native Node ESM-tests omvatten nu de extra gedeelde projectie-afhankelijkheden van de servermonitoring. TypeScript-instellingen zijn niet versoepeld.

Browsercontrole gebruikt uitsluitend fictieve financiële gegevens en een gesimuleerde cloudroute. Productie-assets kunnen zo worden getest zonder testbetalingen, schulden of abonnementen in het echte account te schrijven. De bediening wordt gecontroleerd op 1440px en 390px, inclusief herladen, twee geïsoleerde browsersessies en herstel na netwerkfout.

## Grenzen

- Bankhistorie kan onvolledig zijn. De aanwezigheid van oude transacties bewijst niet dat iedere tussenliggende transactie is opgehaald; tempo blijft een indicatie.
- Bunq en contant zijn niet inhoudelijk zichtbaar via de ING-bankkoppeling. Een top-up of opname bewijst geen abonnementbetaling.
- Oude aflossingen van vóór de herstelhistorie kunnen niet veilig automatisch naar een vroegere schuldstand worden teruggezet. Nieuwe verwerkingen wel; latere wijzigingen blokkeren onveilig herstel.
- Een correctie koppelt aan een bestaande last of schuld. Niet iedere persoonlijke factuur heeft een afzonderlijk factuurmodel; de gekozen salarisperiode legt hier vast op welke verplichting de betaling betrekking heeft.
- Meerdere verschillende facturen op dezelfde last binnen één betaling moeten als aparte maandposten worden geregistreerd; dezelfde doel-ID tweemaal in één verdeling wordt geweigerd.
- Alleen nieuw ontvangen bankdata en eigen bevestigingen bewijzen betalingen. Een kalenderdatum of gelijkende organisatienaam doet dat niet.
- Browserchecks op telefoonformaat zijn geen fysieke iOS/Android-pushtest. Acceptatie door een pushdienst is geen aflevergarantie.
- Geen instellingen, accounts, bankproviders of beveiligingsgrenzen vervangen. Geen echte financiële waarden gewijzigd voor tests.

## Uitgevoerde controles vóór publicatie

- Volledige regressiesuite: 253 geslaagd, geen overgeslagen tests.
- Strenge TypeScript-controle en productiebuild: geslaagd, instellingen ongewijzigd. Bestaande bundelgroottewaarschuwing blijft bestaan.
- Geïsoleerde browsercontrole met fictieve gegevens: alle tien persoonlijke en alle tien zakelijke tabbladen, modusisolatie, gecombineerde betaling bevestigen/terugdraaien, invoer en herladen, cloudopslag naar tweede apparaat, herstel na netwerkfout, behoud van de vorige invoer bij storage-quota-fout.
- Desktop 1440×960 en mobiel 390×960: geen horizontale overflow of JavaScript-paginafouten; cloud- en herstelbediening op beide formaten beschikbaar.
- De browserproef simuleert cloud en AI-fouten; dit bewijst geen echte AI-antwoorden of aflevering van pushmeldingen. Live verificatie en deploymentstatus worden afzonderlijk bij de oplevering gerapporteerd.
