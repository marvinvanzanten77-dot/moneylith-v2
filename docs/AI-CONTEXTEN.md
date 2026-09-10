# Gedeelde AI-assistent en modusbanner

`AiAssistantCard` verzorgt de chat voor Persoonlijk en eigen zakelijke administratie. `ModeBanner` gebruikt dezelfde persoonlijke opbouw, tekststijlen en verbergknop. Zakelijk opent direct de eigen administratie. Beide banners hebben dezelfde uitleg en verbergbediening, zonder aanvullende demobediening.

## Gegevens en verzoeken

- De chat gebruikt de bestaande route `/api/moneylith/analyse` en het bestaande servermodel. De oude route `/api/moneylith-analyse` verwijst naar dezelfde handler.
- Het nieuwe chatprotocol verstuurt `scope`, `context`, `question` en maximaal 24 eerdere berichten. Persoonlijk verstuurt alleen het persoonlijke snapshotdomein, intentie en invoerstatussen. De oude gezamenlijke AI-geschiedenis en het zakelijke snapshotdomein gaan niet mee.
- Zakelijk verstuurt alleen de actieve `BusinessData`, met een expliciete lijst van toegestane velden. De server herhaalt de selectie, valideert het volledige zakelijke model en controleert of `workspace` bij `scope` hoort. Extra velden uit bijvoorbeeld een geïmporteerde backup worden niet doorgestuurd.
- De server selecteert de instructies; een meegestuurd `system` kan die bij het chatprotocol niet vervangen. Zakelijke controlebevestigingen en prognoses worden opnieuw doorgerekend. Ontbrekende of onvoldoende gecontroleerde totalen worden `null`. Bestaande exact-inputbevestigingen blijven geldig door de veldvolgorde te behouden.
- Zakelijke bedragen zijn eurocenten; persoonlijke bedragen zijn euro's. De instructies onderscheiden facturen, betalingen, winst, kasstroom, btw, belastingreserves, leningen, rente en privéonttrekkingen.
- Financiële gegevens zijn lokale browserinvoer, geen door de server geverifieerde boekhouding. De server heeft geen toegang tot andere lokale administraties. Controlebevestigingen zijn invoerbevestigingen, geen accountantscontrole.

## Gescheiden gesprekken

De sleutels zijn `moneylith.chat.v1.personal` en `moneylith.chat.v1.business-real`. Elke chat wordt afzonderlijk herladen. Reset wist alleen het actieve gesprek. De oude gemengde geschiedenis `moneylith.ai.messages` blijft opgeslagen, maar wordt niet automatisch aan een nieuwe context toegewezen.

De chat krijgt bij een andere context een nieuwe componentinstantie. `ChatRequestGuard` annuleert het verzoek bij verlaten of resetten en verwerpt late resultaten ook als de transportlaag een annulering negeert.

## Backend en toegang

API-sleutels blijven op de server. Ontbrekende configuratie geeft HTTP 503, een mislukte provideroproep HTTP 502, ongeldige invoer HTTP 400 en mislukte verplichte verificatie HTTP 403. Geen mockantwoorden met successtatus. De client toont fouten buiten de gespreksgeschiedenis en laat opnieuw proberen toe.

De bestaande anonieme toegangsopzet blijft behouden: 20 verzoeken per minuut per IP per serverinstantie en de bestaande configureerbare Turnstile-controle. Een zelfgekozen `x-user-id` kan de limiet niet meer omzeilen. Wanneer Turnstile verplicht is, geeft een ontbrekend serversecret geen toegang. Het is geen accountgebonden toegangscontrole of gedistribueerde limiet. De bestaande analyseknoppen behouden hun oudere system/user-contract; de gedeelde chat gebruikt uitsluitend het nieuwe protocol.

## Controle

`npm test`, `npm run typecheck` en `npm run build` blijven verplicht. `tests/chat.test.tsx` controleert contextselectie, validatie, reviewbehoud, ontbrekend versus nul, opslag/reset, late antwoorden, configuratie-/providerfouten en rate-limiting. De bannertest controleert beide modi en hun verbergbediening.

Browsercontrole moet tevens echte providerantwoorden controleren in beide contexten, met fictieve herkenningsnamen. Test bij 1440×1000 en 390×844, wissel tijdens een verzoek, herlaad, reset, simuleer een mislukte oproep en controleer herstel. Controleer na publicatie de productiealias met een verse lading en vergelijk de geladen asset met de zojuist gebouwde versie. Een geslaagde mocktest is geen bewijs dat AI op production actief is.

Bankkoppeling blijft afzonderlijk als niet beschikbaar vermeld. AI maakt daar geen verbinding voor en verandert geen financiële gegevens.

## Verwijderde zakelijke demo

De knop Zakelijk opent altijd `real`, ongeacht een oude demovoorkeur. `#zakelijk-demo` wordt met behoud van het overeenkomstige tabblad naar `#zakelijk` omgezet. Alleen `moneylith.business.real.v1` wordt geladen; bestaande eigen gegevens en `moneylith.chat.v1.business-real` worden niet gemigreerd of gereset. Oude aparte demodata en demochat blijven inert in opslag. De API weigert de oude `business-demo`-scope en weigert demogegevens binnen `business-real`. Een oude demo-backup kan de eigen administratie niet vervangen.

Nieuwe administraties beginnen met lege lijsten, lege intentievelden en onbekende planbedragen (`null`). De bestaande readiness- en nulbevestigingen blijven geldig. De vroegere voorbeeldgenerator staat uitsluitend onder `tests/fixtures` voor financiële regressietests; de applicatie importeert hem niet.
