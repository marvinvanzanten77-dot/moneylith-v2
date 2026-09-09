# Zakelijke demo van Moneylith

Open [www.moneylith.nl/#zakelijk-demo](https://www.moneylith.nl/#zakelijk-demo). De knop **Zakelijk** in Persoonlijk opent de laatst gekozen zakelijke administratie; bij het eerste gebruik is dat de demo. Op het startscherm staat ook een directe ingang. **Persoonlijk** bovenaan brengt je terug.

## Morgen zelf aanpassen

1. **Intentie → Bedrijfsrichting aanpassen**: bedrijfsnaam, doel, druk en richting.
2. **Fundament / Inbox → Toevoegen of Bewerk**: omzetfacturen, kosten, bonnetjes en investeringen. Bedragen voer je exclusief btw in; btw en inclusief btw staan erbij. Gebruik bijvoorbeeld `1250,50`, zonder duizendtalscheiding.
3. **Rekeningen**: beginsaldo vóór de eerste ingevoerde betaling. **Patronen**: werkelijke ontvangsten, betalingen en overboekingen. Koppel factuurbetalingen aan het bestaande document. Een deelbetaling mag; meer betalen dan het factuurtotaal wordt geweigerd.
4. **Schulden / Vermogen / Doelen**: leningen, maandaflossingen, handmatige boekwaarden en plannen toevoegen of wijzigen. Rente is een aparte kostenpost.
5. **Fundament / Vooruitblik → Maandplan aanpassen**: nieuwe toekomstige omzet, kosten, btw-aannames en privéonttrekkingen. **Vermogen / Vooruitblik / Instellingen → Reserveringen aanpassen**: eigen geschat belastingpercentage en extra buffer.
6. Controleer na een financiële wijziging de betrokken overzichten opnieuw. De melding noemt wat nog ontbreekt. Bevestig een lege lijst alleen als je werkelijk bedoelt dat er geen posten zijn. Lege planvelden zijn onbekend; ingevoerd `0` is een geldige waarde.
7. **Vooruitblik → Scenario aanpassen**: meer/minder omzet, extra kosten of een eenmalige tegenvaller. De beginstand verandert niet; het scenario rekent twaalf volgende maanden door. **Terug naar maandplan** zet alleen de scenario-afwijkingen op nul.
8. Alles wordt in deze browser bewaard, ook na herladen en moduswisselen. Maak via **Backup** een eigen export; er is geen automatische cloudbackup.

**Alleen demo terugzetten** vervangt na bevestiging uitsluitend de fictieve administratie door Studio Rivier. Met **Open eigen zakelijke administratie** begin je leeg, of heropen je jouw eerder opgeslagen echte administratie. De eigen administratie heeft geen demo-resetknop.

## Waar staat de code?

| Bestand | Aanpassen |
| --- | --- |
| `src/WorkspaceApp.tsx` | Keuze Persoonlijk/demo/eigen administratie, directe links en lazy loading |
| `src/App.tsx`, `src/components/OnboardingChoice.tsx` | Ingangen vanuit de bestaande persoonlijke app |
| `src/business/BusinessWorkspace.tsx` | Alle elf zakelijke schermen, veldlabels en bediening |
| `src/business/Editor.tsx` | Gedeelde toegankelijke invoerdialogen en bewerkbare lijsten |
| `src/business/business.css` | Zakelijke vormgeving en mobiele navigatie |
| `src/business/copy.ts` | Tabnamen, toelichtingen en centrale rekenaannames |
| `src/business/demo.ts` | Alle fictieve voorbeeldgegevens van Studio Rivier |
| `src/business/model.ts` | Versie/schema, centen, datum- en invoervalidatie, opslagsleutels |
| `src/business/finance.ts` | Berekeningen, afhankelijkheden, controlebevestigingen, scenario en lokale AI-context |
| `src/business/storage.ts` | Laden, opslaan, exportherstel en uitsluitend demo resetten |
| `src/logic/inputReadiness.ts` | Bestaande gedeelde oplossing voor bevestiging van exacte invoer |
| `tests/business.test.tsx` | Zakelijke regressietests |

Een wijziging in `demo.ts` overschrijft geen opgeslagen demo. Kies daarna bewust **Alleen demo terugzetten** om de gewijzigde voorbeelden te laden. Voor een schemawijziging is een expliciete migratie nodig; vervang bestaande gebruikersgegevens nooit door voorbeelden.

Lokaal: `npm ci`, `npm test`, `npm run build`, `npx tsc --noEmit`. Gebruik `npm run dev` en open de getoonde lokale URL met `/#zakelijk-demo`. Dit vereist geen bank-, AI- of Vercel-geheimen. Publicatie loopt via `main` rechtstreeks naar production; maak hiervoor geen previewdeployment.

## Opslag en isolatie

- Demo: `moneylith.business.demo.v1`.
- Eigen nieuwe zakelijke administratie: `moneylith.business.real.v1`.
- De laatst gekozen tab staat onder dezelfde sleutel plus `.tab`; scenario en bevestigingen staan in de administratie zelf.
- Werkruimtekeuze: `moneylith.workspace.v1`; laatste zakelijke keuze: `moneylith.business.lastWorkspace.v1`.
- De bestaande persoonlijke sleutels en oude zakelijke sleutels worden niet gemigreerd, hergebruikt of gewist. Instellingen biedt een afzonderlijke export van eventuele oude zakelijke opslag.

Elk opslaan valideert de volledige nieuwe administratie, inclusief verwijzingen en factuurbetalingen, vóór de opslag verandert. Een onleesbare bestaande opslag wordt niet vervangen. Een backup kan alleen in hetzelfde type administratie worden hersteld; demo naar echt en echt naar demo worden geweigerd. Herstel vervangt na expliciete bevestiging uitsluitend de gekozen administratie en laat alle controlebevestigingen vervallen. Bestanden groter dan 2 MB worden geweigerd.

## Rekenmodel en aannames

- Bedragen zijn gehele eurocenten. Btw wordt per document op centen afgerond. Factuurdatum bepaalt de maandomzet en kosten; betaaldatum bepaalt de kasstroom. Een factuur wordt dus niet nogmaals omzet bij betaling.
- Winstindicatie = omzet exclusief btw − kosten exclusief aftrekbare btw. Niet-aftrekbare btw op gewone kosten telt mee als kosten. Investeringen zijn geen directe kosten; er is geen automatische afschrijving.
- Leningen en privéstortingen verhogen geldmiddelen zonder omzet. Hoofdsomaflossingen en privéonttrekkingen verlagen geldmiddelen zonder kosten. Overboekingen tussen eigen rekeningen hebben netto geen kasstroomeffect.
- Beschikbaar = bankmiddelen − positieve btw-reserve − geschatte inkomstenbelastingreserve − extra buffer − nog openstaande inkoopfacturen. Bedrijfsmiddelen en nog niet ontvangen verkoopfacturen zijn geen liquide middelen. Een negatief resultaat blijft negatief zichtbaar.
- De fiscale reserves betreffen alleen de geselecteerde maand, verminderd met ingevoerde belastingbetalingen in die maand. Oude belastingschulden zijn niet automatisch bekend. Gebruik de uitkomst niet als kwartaal- of jaaraangifte.
- De vooruitblik gebruikt nieuw maandwerk en betaalt dit in dezelfde toekomstige maand. Reeds uitgereikte, onbetaalde documenten worden één keer op vervaldatum afgewikkeld; achterstallige facturen in maand één. Aflossing stopt bij nul hoofdsom. Rente moet in het kostenplan staan. Reserves blijven op de bank maar zijn niet vrij beschikbaar; een btw-teruggaaf wordt niet alvast als ontvangst geboekt.
- Voor iedere uitkomst gelden eigen invoerafhankelijkheden. Boekwaarden zijn bijvoorbeeld niet nodig voor een liquiditeitsprognose. Wijzigen en later terugzetten van een bedrag herstelt geen oude bevestiging automatisch. Scenario-afwijkingen beginnen expliciet op nul (= maandplan), worden gevalideerd en bewaard. Zonder gecontroleerde basis is ook een scenario geblokkeerd.

Achtergrond voor het onderscheid: [Belastingdienst over privéstortingen en privéonttrekkingen](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/privestortingen_en_priveonttrekkingen) en [voorwaarden voor btw-aftrek](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aftrekken/). De app berekent geen definitieve inkomstenbelasting.

## Wat werkt en wat is beperkt?

Alle tabbladen hebben bruikbare lokale invoer of bediening. Demo en echte administratie gebruiken dezelfde rekenregels. Inbox registreert documentgegevens; bestanden bewaren, OCR, automatische boeking, bankkoppeling, cloudsync en externe AI zijn niet aangesloten in de zakelijke versie. Er wordt geen geslaagde verbinding gesimuleerd. Instellingen kan de zakelijke analyse-invoer lokaal exporteren; onbekende waarden blijven daarin `null`.

Het model richt zich op een Nederlandse zzp’er/eenmanszaak met normale btw. KOR, verlegde btw, valuta, creditnota’s, afschrijvingsschema’s en gemengd privégebruik zijn niet automatisch uitgewerkt. Doelen tonen handmatig bijgehouden voortgang en doen geen haalbaarheidsbelofte of automatische betaling. Het is een bewerkbare planningsdemo, geen volledige boekhouding of aangiftesoftware.

## Implementatiekeuzes en controle

Onderzocht: de zakelijke vertakkingen in `App.tsx`, gedeelde stappen, bedragen, transacties, opslag en invoerbevestiging. De bestaande zakelijke modus was uitgeschakeld en steunde nog op persoonlijke inkomens-/kostenmodellen. Die modellen leggen geen betrouwbare relatie vast tussen btw-factuur en betaling. Daarom gebruikt de actieve zakelijke modus één klein samenhangend document-/betalingsmodel, met de bestaande tabstructuur en gedeelde input-readiness. De persoonlijke schermen zijn behouden; er is geen grote kopie van de persoonlijke app gemaakt. Oude zakelijke opslag blijft beschikbaar voor export, zonder een onbetrouwbare automatische btw-migratie.

Repository vooraf gecontroleerd: `marvinvanzanten77-dot/moneylith-v2`. Vercel-project: `moneylith-v2` (`prj_k2BSKlfxGkI97Np4cSDwbmgqItMA`). De vooraf werkende productiecommit is `f289d2d27fea43cd6897d939dd493889621be113`, deployment `dpl_AqZ1VhA1AvKVqwcNQgeyVSmjxaEn`, met aliases `www.moneylith.nl` en `moneylith.nl`.

Gerichte tests dekken onbekend/gedeeltelijk/nul, bevestigingen, facturen/deelbetalingen/dubbeltelling, overboekingen, leningen, btw, negatieve ruimte, twaalf prognosestappen, scenario-opslag, reload, resetisolatie en ongeldig backupherstel. De persoonlijke input-readiness-tests blijven onderdeel van `npm test`.

De volledige TypeScript-controle had vóór deze wijziging **85 bestaande fouten**. Vergelijking gebeurt op bestandsnaam, foutcode en melding, met regelnummers genegeerd omdat toevoegingen die verschuiven. Hiervan staan 6 fouten in Recharts-typen, 26 in `src/App.tsx`, 2 in `src/App.new.tsx` en 51 in bestaande componenten/logic/types/documentextractie. Nieuwe zakelijke bestanden horen geen fouten toe te voegen. De Vite-productiebuild voert zelf geen TypeScript-controle uit.

### Uitgevoerde controle voor publicatie

- `npm test`: **34 geslaagd** (21 zakelijke tests en 13 bestaande persoonlijke invoertests).
- `npm run build`: geslaagd. Bestaande waarschuwingen over Browserslist en grote bestaande chunks blijven zichtbaar.
- `npx tsc --noEmit`: **85 bestaande fouten, nul nieuwe fouten** ten opzichte van de hierboven genoemde productiecommit.
- Browser lokaal: alle elf zakelijke tabbladen op desktop en 390 × 844 mobiel; geen horizontale pagina-overloop, geen JavaScript-fouten. De tabel en mobiele navigatie kunnen binnen hun eigen vlak scrollen.
- Via de formulieren: bedrijfsnaam/factuurbedrag/scenario gewijzigd, na reload teruggevonden; gewijzigde factuur maakte controle ongeldig; demo-reset annuleren en bevestigen getest. Persoonlijke inkomstenpost en echte zakelijke bedrijfsnaam bleven na demo-reset en reload behouden.
- Persoonlijk: handmatige start, Fundament, invoer en terugschakelen gecontroleerd. Zakelijk deed tijdens de controle geen fetch/XHR-verzoeken. Echte bank- en AI-integraties zijn niet getest of geactiveerd.
