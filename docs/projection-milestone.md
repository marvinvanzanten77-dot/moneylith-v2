# Gecombineerde financiële vooruitblik

Baseline: `17ed31f`. Audit uitgevoerd vóór de implementatie.

## Wat bestond al?

- `MoneylithSnapshot` verzamelde persoonlijke rekeningen, transacties, inkomen, vaste lasten, schulden, vermogen, doelen en AI-patronen. Toekomstige inkomsten, gebruikte automatische vaste-lastenpatronen en controlebewijzen ontbraken daarin.
- Persoonlijke Vooruitblik gebruikte een los twaalfmaandenmodel met samengevatte bedragen. Het telde vermogen als buffer, verwerkte geen betaaldata en verbond extra sparen niet aan beschikbare kasstroom.
- Zakelijk heeft één eigen administratie (`BusinessData`) met facturen/vervaldata, gekoppelde betalingen, beginsaldi/datums, schulden/aflossingen, bedrijfsmiddelen, reserveringen, doelen en een maandplan. `calculateBusiness`, exacte invoercontroles en de maandprognose bestonden al.
- Zakelijke scenario's waren apart opgeslagen als omzetverschil, extra kosten en eenmalige tegenvaller. Persoonlijke scenario's waren tijdelijk binnen het tabblad.
- De gedeelde AI kende de persoonlijke snapshot en gevalideerde zakelijke administratie, intentiekeuzes en stijlen. Alleen zakelijke maandprognoses werden meegestuurd; er was geen gezamenlijke gedateerde projectie.
- Persoonlijke vaste lasten en schulden kunnen een betaaldag hebben; eenmalige inkomsten hebben een datum. Gewone inkomsten hadden nog geen ontvangstdag. Persoonlijke rekeningen hebben een bedrag maar geen peildatum. Historische transacties en patroonbedragen zijn geen bevestigde toekomstige boekingen.

## Toegevoegde verbindingen

`projection/adapters` leidt uitsluitend tijdelijke rekeninvoer af uit de bestaande bronnen. `projection/engine` berekent dezelfde gedateerde tijdlijn voor beide modi in gehele eurocenten, met 7/30/90 dagen en een langere horizon. Dit is geen nieuwe opgeslagen administratie.

- Snapshot uitgebreid met toekomstige inkomsten, daadwerkelijk geselecteerde vaste-lastenpatronen en bestaande controlebewijzen.
- Inkomen kan een optionele ontvangstdag krijgen. Ontbrekende datums worden niet geraden: de gebruiker kan expliciet een maandelijkse betaaldag aannemen.
- Persoonlijke rekeningsaldi vereisen expliciete bevestiging als actuele saldi; ontbreken of wijzigingen maken de projectie weer onvolledig. Bezittingen worden niet als bankgeld bijgeteld.
- Reeds gereserveerd persoonlijk geld vereist een expliciete invoer (ook nul); zonder die invoer kan het banksaldo bekend zijn maar de beschikbare ruimte blijft onbekend.
- Variabele uitgaven zijn een expliciete aanname; een leeg budget is onbekend, nul wordt geaccepteerd als ingevoerde nul.
- Zakelijke berekeningen ondersteunen nu een exacte peildatum. Toekomstige betalingen zitten niet al in het huidige saldo. Facturen worden na aftrek van gekoppelde betalingen slechts eenmaal gepland.
- Reguliere en extra aflossingen delen dezelfde resterende hoofdsom. Reeds expliciet geplande zakelijke aflossingen verminderen de geplande maandtermijn.
- Reserveringen veranderen beschikbare ruimte, geen bankgeld. Betaling van gereserveerde belasting verandert bankgeld en laat de bijbehorende reserve vrij.
- Kwartaalbetalingen volgen kalenderkwartalen, niet drie willekeurige maanden vanaf het startpunt.
- Actieve doelen en deadlines worden meegegeven als voornemens. Benodigde inleg wordt apart berekend met expliciet genoemde perioden van dertig dagen; doelen veroorzaken geen dubbele aflossingen of fictieve uitgaven.
- Scenario's voor inkomsten, maandlasten, aankopen, reserveringen, extra aflossingen en factuurdatums zijn tijdelijke overlays. Een bestaand opgeslagen zakelijk scenario kan expliciet worden toegepast; verwijderen wist geen bestaande administratie of opgeslagen scenario.

## AI

De server bouwt de projectie opnieuw uit toegestane brongegevens en gevalideerde aannames; aangeleverde projectietotalen tellen niet mee. Voor herkenbare vragen met één expliciet eurobedrag kan de server een tijdelijk aflos-, inkomsten-, aankoop- of reserveringsscenario doorrekenen. Onduidelijke bedragen, meerdere schulden of expliciete datums vragen om een keuze in Vooruitblik.

Bij projectievragen levert het taalmodel uitsluitend kwalitatieve uitleg. De server voegt de exacte rekenuitkomst toe en keurt modeltekst met financiële cijfers/eurobedragen af (de vaste termijnen 7/30/90/365 dagen mogen wel worden genoemd); maximaal één herstelpoging, daarna de bestaande eerlijke foutstatus. De bestaande zakelijke antwoordcontrole, toegangsbeveiliging, API-sleutelopslag en chatisolatie blijven behouden.

## Grenzen van het model

- Betaalmomenten zonder datum, onvolledige invoer en niet-gecontroleerde overzichten verhinderen een volledige toekomstpositie. Bekende gebeurtenissen blijven zichtbaar.
- Een vervaldatum is geen gegarandeerde ontvangst. Een achterstallige factuur heeft een onbekend betaalmoment totdat een scenario een datum geeft.
- Renteontwikkeling zonder ingevoerde rentegegevens, toekomstige tarieven, automatische bankgegevens en ongeregistreerde transacties worden niet verzonnen.
- Nieuw zakelijk werk uit het maandplan begint de volgende kalendermaand; reeds geregistreerde facturen en betalingen blijven afzonderlijke gebeurtenissen.
- De belastinglaag blijft het bestaande schattingsmodel, geen aangifteberekening of aanslag. Expliciet geplande belastingbetalingen vervangen de geschatte betaling in die kalendermaand.
- Toekomstig gedateerde facturen en leningopeningen blokkeren een volledige zakelijke prognose wanneer hun belasting-/aflossingseffect niet betrouwbaar uit de bestaande modellen volgt.
- Doelen zijn niet automatisch geboekte verplichtingen. Een uitkomst boven nul is geen garantie of betaalbaarheidsadvies.
- Aannames en nieuwe scenario's zijn alleen voor de actieve sessie/modus; herladen wist ze. Onderliggende gegevens en gesprekken blijven opgeslagen.

Bankkoppeling, PSD2, transactiesynchronisatie, OCR en cloudaccounts zijn niet toegevoegd.

## Uitgevoerde verificatie (10 oktober 2026)

- Volledige regressiesuite: **88 geslaagd, nul mislukt**. Nieuwe tests staan in `tests/projection.test.tsx`; bestaande chat- en invoerstatustests zijn aangepast aan de gedeelde projectie.
- Strenge TypeScript-controle en productiebuild uitgevoerd zonder versoepeling van instellingen. De bestaande waarschuwing voor grote JavaScriptbundels blijft staan.
- Browsercontrole met herkenbare fictieve records, in een afzonderlijke browsersessie: desktop 1440 × 1000 en mobiel 390 × 844. Beide modi gebruiken dezelfde projectiecomponent, zonder horizontale pagina-overflow. Lege/onvolledige en ingevulde overzichten gecontroleerd.
- Persoonlijk: 7/30/90 dagen respectievelijk €1.500 / €3.300 / €5.900. Een reserveringsscenario van €250 vermindert beschikbare ruimte met €250; de opgeslagen administratie verandert niet.
- Zakelijk: €1.980 / €1.880 / €2.120. Een factuur van €121 een maand verschuiven vermindert de eerste twee termijnen met €121; na 90 dagen is het verschil nul. Scenario verwijderen herstelt de verwachting.
- Moduswisselen behoudt Vooruitblik en neemt geen aannames van de andere modus mee. Herladen verwijdert tijdelijke aannames; rekeninggegevens en chatgeschiedenis blijven bestaan. Het nieuwe ontvangstdagveld is via de browser gewijzigd en de opgeslagen waarde is na herladen gecontroleerd.
- Echte AI-aanroepen via de lokale, actuele API-handler en de provider: HTTP 200 voor beide modi. Zakelijk sluit de uitkomst van €1.759 over 30 dagen aan op het factuurscenario. Persoonlijk rekent de vraag over €200 extra maandinkomsten door naar €3.500 na 30 dagen en €6.500 na 90 dagen. Verzoeken bevatten geen administratie uit de andere modus.
- Een werkelijk mislukte provideraanroep gaf de bestaande foutstatus. Regressietests controleren daarnaast verzonnen modelbedragen, vervalste berekende context, contextscheiding en bestaande bescherming tegen laat binnenkomende antwoorden. Geen browserfouten in de laatste controles.

Deze controles betreffen de lokale implementatie. Deze mijlpaal is niet gepubliceerd en de nieuwe code is niet op productie getest. De bestaande productieversie is niet gewijzigd.

## Gewijzigde bestanden

| Onderdeel | Bestanden |
| --- | --- |
| Gedeelde projectie, afleiding en vraagscenario's | `src/projection/engine.ts`, `src/projection/adapters.ts`, `src/projection/questions.ts` (nieuw) |
| Gedeelde weergave en aansluiting op beide modi | `src/components/ProjectionView.tsx` (nieuw), `src/components/steps/StepActie.tsx`, `src/App.tsx`, `src/business/BusinessWorkspace.tsx`, `src/business/business.css` |
| Bestaande bronmodellen en datumverwerking | `src/core/moneylithSnapshot.ts`, `src/types.ts`, `src/components/IncomeList.tsx`, `src/business/finance.ts` |
| AI-context en servercontrole | `src/ai/context.ts`, `src/components/AiAssistantCard.tsx`, `api/moneylith/analyse.ts` |
| Regressies | `tests/projection.test.tsx` (nieuw), `tests/chat.test.tsx`, `tests/input-readiness.test.tsx` |
| Audit en opleververslag | `docs/projection-milestone.md` (nieuw) |
