# Moneylith Personal — lokale review

Dit resultaat wordt uitsluitend bijgehouden op de persoonlijke reviewbranch `personal/reliability-review`; productiepublicatie valt buiten deze wijziging. De preview gebruikt uitsluitend fictieve gegevens. Er zijn geen echte bank-, cloud- of AI-aanroepen gedaan voor de browsercontroles.

## Afbakening en uitgangspunt

- Personal: repository `marvinvanzanten77-dot/moneylith-v2`, baseline `59ee5e3fc1a8d9d4e58293116b3a3467aa817d40` (main en origin/main bij start).
- Werkbranch: `personal/reliability-review`, geïsoleerde werkmap `moneylith-personal-review`.
- Productie bij start: Vercel-project `moneylith-v2`, deployment `dpl_CF8p75V3YoxNBqbUgcNdhAaibkA5`, alias `www.moneylith.nl`. `/prive` wordt door dezelfde SPA afgehandeld; het is geen afzonderlijke deployment of beveiligingsgrens.
- Public: afzonderlijke repository/werkmap `moneylith-public`, baseline `7305e06`, afzonderlijk Vercel-project. Die werkmap is ongewijzigd.
- De oorspronkelijke Personal-werkmap is niet aangepast. De al aanwezige wijziging in `.vscode/settings.json` is behouden. Geen configuratiebestanden met sleutels zijn gekopieerd naar de reviewwerkmap.
- Geen migratie, import, banksynchronisatie, wijziging van classificatieregels, betaalverdelingen, persoonlijke bedragen of productieopslag uitgevoerd.

## Audit: bevestigd en niet vastgesteld

| Bevinding | Codeonderzoek en gevolg |
|---|---|
| Banksaldo moet herleidbaar blijven | De bestaande optelling selecteert actieve persoonlijke providerrekeningen en telt in centen. Onbekende of niet-EUR-saldi verhinderen een betrouwbare som. Deze logica is behouden; rekeningen en ophaalmomenten zijn uitklapbaar. De momentopnames uit de audit zijn niet opnieuw uit de echte administratie opgehaald. |
| Fundament en Schulden tonen verschillende vrije ruimte | Bevestigd. Schulden gebruikte de oudere `FinancialSnapshot`-totalen; Planning gebruikt `reconcilePeriod`. Schulden gebruikt nu dezelfde salarisperiodeverwachting en volledigheidscontrole. Bronregels zijn uitklapbaar. |
| Geen reservering wordt nul | Bevestigd in `personalInput`: `reservedNow ?? 0`. Dit is nu `null`. Een betrouwbare besteedbaarheid vereist een expliciete reservering, inclusief bevestigd nul. |
| Alleen betaalde abonnementen verdwijnen uit de toekomst | Bevestigd. `bankObservedOnly` werd alleen in toelichtingen genoemd. Terugkerende onbekende kosten krijgen nu een onbekende projectiegebeurtenis; losse credits worden niet tot abonnement gemaakt. Een opgegeven betaaldag begrenst de relevante horizon. Een verstreken datum zonder betaalbewijs stelt de onzekerheid niet uit. |
| Een positief eindbedrag verbergt een eerder tekort | De oude rekenlaag bevatte al dagelijkse waarden, maar de presentatie legde de nadruk op eindbedragen. Het overzicht toont nu het laagste banksaldo vóór de volgende ontvangst en de ontbrekende gegevens. Bij een onvolledige reeks heet het nadrukkelijk het laagste **bekende deel**; geen volledige voorspelling. |
| Twee huurboekingen zouden dubbel zijn | Niet vastgesteld. Twee boekingen met dezelfde tegenpartij en hetzelfde bedrag bewijzen geen importduplicaat. Boekingsidentiteit, periode, toewijzing en terugboeking blijven leidend. Niets verwijderd. |
| Oudere telefoonbetalingen kunnen toekomstige facturen afvinken | Bestaande expliciete periode-/factuurkoppeling en regressies beschermen dit. Die verwerking is behouden, inclusief handmatige verdelingen en herstel na terugboeking. De specifieke productieboekingen zijn niet opnieuw beoordeeld. |
| Interne ING/bunq-overboekingen worden als inkomen geteld | De audit bewijst dit niet. Bestaande classificatie en reconciliatie sluiten bevestigde overboekingen uit; mogelijke overboekingen blijven ter controle. Geen automatische nieuwe matches toegevoegd. |
| `null maanden` en rentevoordeel bij grootste schuld | Bevestigd. Onbekende duur krijgt nu een normale tekst. De sorteervolgorde blijft behouden, maar heet “Grootste hoofdsom eerst”, zonder renteclaim. Oude AI-strategieteksten mogen de financiële betekenis niet overschrijven. Eigen notities blijven staan en zijn duidelijk geen betaalbewijs. |
| AI start bij navigeren | Bevestigd voor de bespaarcoach. De automatische aanvraag is verwijderd. Ook het opnieuw berekenen van een opgeslagen schuldstrategie bij openen en een impliciete AI-aanvraag na voorstelacceptatie zijn verwijderd. Nieuwe budgetafhankelijke voorstellen worden geblokkeerd zolang de basis onvolledig is. |
| Historische planning wordt verzonnen | Bestaande bescherming gevonden en behouden: zonder bewaard periodeplan alleen herkende historische betalingen. Huidige invoer wordt geen fictieve oude planning. |
| Patronen zijn geen netto-uitgaven | Bevestigd: de potjes betreffen bruto aankopen; terugbetalingen zijn niet verrekend. De interface onderscheidt nu het bedrag vóór budgetdekking van het bedrag buiten budget. Herkenningsregels zijn aannames over aankoopinhoud. |

## P0 — financiële betekenis

Geen tweede financiële opslag of bankmodel toegevoegd. `personalInput`, `remainingPayments`, `project`, `makePeriodPlan` en `reconcilePeriod` blijven de bestaande bronnen voor afgeleide waarden.

- **Banksaldo:** som van laatst opgehaalde relevante EUR-saldi; reeds geboekte betalingen zitten hierin. Ophaaltijd is geen garantie voor actuele bankgegevens.
- **Ontvangen versus verwacht inkomen:** geboekte ontvangsten blijven gescheiden van toekomstige projectiegebeurtenissen. Herhaling van salaris is een verwachting.
- **Perioderuimte:** bijgestelde verwachting van inkomsten minus lasten minus aflossingen binnen de salarisperiode 23ste–22ste. Planning en Schulden gebruiken dezelfde regels. Dit is geen banksaldo of besteedbaar bedrag.
- **Besteedbaar tot datum:** het minimum van de huidige ruimte na bevestigde reserveringen en de dagelijkse ruimte tot de dag vóór de volgende verwachte ontvangst. Zonder geplande ontvangst wordt expliciet 30 dagen gebruikt. Onvolledige informatie blijft onbekend; toekomstig inkomen wordt niet als huidig geld opgeteld.
- **Budget:** alleen het resterende deel wordt in de projectie gereserveerd. Geboekte aankopen worden niet nogmaals van het beginsaldo afgetrokken. Dagelijkse aannames worden in de korte lijst per salarisperiode gebundeld.
- **Aflossing:** de bestaande betaalhistorie verlaagt de schuld eenmaal; geen tweede afschrijving van het opgehaalde saldo. Zonder regeling wordt geen nieuwe aflossing verzonnen.
- **Reservering:** onbekend is niet nul. Doelen zijn niet automatisch reserveringen of betalingen. De bestaande tijdelijke projectie-invoer blijft sessiegebonden.
- **Onbekende kosten:** blokkeren alleen een horizon die ze raken; een onbekende datum blijft een onzekerheid vanaf nu. Een reeds betaald onbekend maandbedrag bewijst geen volledige toekomstverwachting.
- **Monitoring:** waarschuwingen voor een berekend banksaldotekort blijven mogelijk bij complete geldstromen, ook als reserveringen onbekend zijn. De melding heet nadrukkelijk een banksaldoverwachting, geen besteedbaar bedrag. Onbekende geldstromen verhinderen een exacte tekortclaim. Scanschema, providers en toegang zijn niet gewijzigd.

## P1 — behouden functies, nieuwe vindbaarheid

| Dagelijks onderdeel | Bestaande functies |
|---|---|
| Overzicht | Vier niveaus: financiële positie; komende ontvangsten/betalingen; laagste banksaldo en onzekerheid; belangrijkste controle plus overige controles. |
| Transacties | Bestaande `BankPatterns` rechtstreeks toegankelijk: periode, rekening, zoeken, richting, soort, groepen, onderliggende regels en herkenningsregels. De bestaande betaalcontrole, verdelingen, factuurperiode en correctiehistorie zijn hier ook bereikbaar. Tellers volgen de selectie en benoemen hun scope. |
| Planning | Bestaand Fundament en salarisperiodehistorie. Betaalcontrole en bewerken zijn afzonderlijk te openen; werkabonnementen staan achter een gerichte bediening. |
| Schulden & doelen | Schuldenkaart, betaalhistorie, afspraken, vermogensregister en doelen via subnavigatie. Een leeg vermogensregister bewijst geen kritieke buffer. |
| Inzicht | Bestaande potjes en Vooruitblik. Eerst de basisverwachting; best/worst-case en scenario-invoer op verzoek. |
| Instellingen | Account/opslag, rekeningen, bankverbindingen, backup en profiel/Intentie. Bestaande stapnamen blijven bereikbaar voor onthouden navigatie en moduswisselen waar een tegenhanger bestaat. |

Een groep herkenningsvragen, ontbrekende prognosevelden en ontvangen meldingen zijn verschillende scopes, geen optelbare controles. Het overzicht maakt dat onderscheid. Meldingen worden per oorzaak, onderwerp en periode gebundeld, zonder overlappende bedragen op te tellen.

## P2 — presentatie en bediening

- De bestaande layout en stijlen worden hergebruikt. Personal krijgt een rustige tweekoloms desktopindeling en een gedeeld financieel overzicht op mobiel.
- AI is op desktop een native dialoog met sluitknop/Escape; op mobiel blijft de bestaande opvraagbare gids behouden. Navigatie start geen AI-aanvraag.
- Saldo en besteedbaarheid staan samen bovenaan. Technische synchronisatie-/opslagdetails zijn ondergeschikt; opslagfouten blijven direct zichtbaar.
- Doelen en rekeningen tonen het formulier pas na een actie. Bewerken opent het juiste formulier.
- Betaalcontrole toont op mobiel postregels met labels, zonder een brede pagina. De hoofdnavigatie en instellingen blijven bereikbaar.
- Bedragen via de gedeelde formatter hebben twee decimalen. Ontbrekende bedragen worden niet door de formatter nul.
- Banktekst wordt uitsluitend voor weergave opgeschoond; originele omschrijvingen, transactie-ID’s en bewijs blijven intact. Geen HTML wordt uitgevoerd.
- Backup en account geven dezelfde uitleg over de lokale kopie en ingeschakelde cloudopslag.

## Tests en preview

**274 van 274 regressietests geslaagd; strenge TypeScript-controle en productiebuild geslaagd.** De definitieve uitkomsten staan in `../artifacts/personal-review/verification.txt` en de JSON-bestanden met browsercontroles.

Dertien nieuwe regressies in `tests/personal-reliability.test.tsx` toetsen onbekende reserveringen versus nul, bank versus besteedbaar, positief eindbedrag met tussentijds tekort, horizonafhankelijke onbekende kosten, verstreken betaaldatum zonder bewijs, onbekende abonnementen versus losse credits, perioderuimte en bevestigd lege overzichten, resterende budgetbundeling, display-only tekstopschoning, navigatie/filters, meldinggroepering, monitoring van een banksaldotekort en bedragnotatie.

Bestaande regressies zijn uitgevoerd voor overboekingen, herhaalde import, vroegere factuurbetalingen, deelbetalingen, terugboekingen, budgetoverschrijding, inhoudingen, aflossingen, gecombineerde verdelingen, persoonlijke/zakelijke isolatie, scenarioreset, historie en AI-context. Vier bestaande presentatie/semantiektests zijn gericht bijgewerkt aan de nieuwe opdracht; geen instellingen versoepeld.

Browsercontroles gebruiken uitsluitend een geïsoleerd testprofiel en fictieve data op 1440×1000 en 390×844:

- Overzicht, alle vijf hoofdingangen en de relevante subnavigatie.
- Rekening-, richting- en zoekfilter; onderliggende bankomschrijving zonder zichtbare HTML.
- Onvolledige Planning en Schulden, leeg vermogensregister, formulieren op verzoek.
- Rekening bewerken, opslaan en herladen; navigatie na herladen.
- Vooruitblik met onbekende gegevens, bevestigd nul, bekend tussentijds tekort, scenario openen en aannames wissen.
- AI openen/sluiten, geen automatische AI- of bankaanvragen tijdens navigatie. Ook een eerder gekozen schuldstrategie genereert bij openen geen nieuwe voorstellen; onvolledige capaciteit blokkeert nieuwe analyse en oude renteclaims worden niet getoond.
- Geen JavaScript-paginafouten of horizontale pagina-overflow in deze controles.

De lokale server is bereikbaar op **http://127.0.0.1:5187**. Die serveert de productiebuild, maar blokkeert alle API-aanroepen en laadt geen secrets of backend. De gele balk markeert de fictieve reviewgegevens. De eerste vulling gebeurt alleen wanneer op die preview-origin nog geen persoonlijke administratie staat.

Opnieuw starten vanuit de reviewwerkmap:

```sh
npm run build
node --import tsx scripts/personal-review-server.mjs
```

De screenshots staan in `artifacts/personal-review/`: desktop/mobiel voor overzicht, transacties, planning, vooruitblik, leeg en ingevulde tekortverwachting.

## Grenzen en beoordeling vóór publicatie

- Er is geen echte productieadministratie aangepast of opnieuw ingelezen. Specifieke huurboekingen, historische notities en mogelijke top-ups zijn niet als fout of duplicaat bestempeld. Daarvoor blijft concrete transactieverificatie nodig.
- Reserveringen en scenario-aannames zijn, zoals voorheen, tijdelijk en worden bij herladen gewist. Dat is zichtbaar in de bediening. Een aparte blijvende reserveringsadministratie is niet stilzwijgend ingevoerd.
- Terugbetalingen blijven buiten het bruto potjesoverzicht; betaalreconciliatie verwerkt terugboekingen wel. Er is geen nieuw netto-aankoopmodel gemaakt.
- Aflosstrategieën zijn geen renteoptimalisatie. Rente, boetes en nieuwe kosten worden niet berekend zonder gegevens.
- De projectie voorspelt niet iedere toekomstige incidentele aankoop. Onbekende geregistreerde verplichtingen worden expliciet gemaakt, geen fictieve bandbreedte.
- De build meldt bestaande grote JavaScript-bundels en verouderde Browserslist-data. Dat zijn resterende onderhoudspunten, geen versoepelde buildcontrole.
- Native smartphone-installatie, pushbezorging, echte AI, echte bankaanroepen en cloudopslag zijn niet live getest in deze opdracht: de preview blokkeert die bewust. Bestaande tests daarvan draaien met fixtures/mocks.
- Productiepublicatie is gestopt zoals gevraagd. Eerst beoordeling van deze lokale wijziging; er is geen productie-deployment aangevraagd.

## Gewijzigde bestanden

Zie `../artifacts/personal-review/changed-files.txt` voor de complete lijst. De financiële kernwijzigingen zitten in `src/projection/`, `src/bank/periodReconciliation.ts`, `src/logic/periodRoom.ts` en `src/monitoring/engine.ts`. De presentatie hergebruikt de bestaande componenten, met `PersonalOverview`, `PersonalNavigation` en `GuideDialog` als kleine nieuwe samenstellingen. De afzonderlijke Public-repository bevat geen van deze wijzigingen.
