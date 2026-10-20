# Lunch Flow: persoonlijke lokale koppeling

> Historisch verslag van de lokale fase (19 oktober 2026). Voor de aanvullende afgeschermde liveproef en de huidige toegangscontrole: zie [lunchflow-private.md](./lunchflow-private.md).

## Audit en afbakening

Onderzocht op 19 oktober 2026 vanaf `8276807`. Geen toepasselijk AGENTS.md aangetroffen in de repository of bovenliggende projectmappen. De bestaande wijziging in `.vscode/settings.json` is ongemoeid gelaten.

Moneylith gebruikt React/Vite, lokale persoonlijke rekeningen/transacties, een gescheiden zakelijke administratie en Vercel API-routes. Er bestaan Plaid- en TrueLayer-integraties. Cloudsessies leveren geen geverifieerde eigenaar-autorisatie voor één gedeelde persoonlijke Lunch Flow-sleutel. Deze proef heeft daarom **geen publieke API-route**: uitsluitend een Vite-ontwikkelmiddleware, met controles op loopback-adres, exacte localhost-host/origin, aangepaste header en niet-productieomgeving. Geen CORS-openstelling. Geen sleutel in browser, opslag, bundle of loguitvoer.

De automatische verwijdering van bankgegevens bij een ontbrekende TrueLayer-sessie is verwijderd. Expliciete legacy-provideracties behouden Lunch Flow-gegevens.

## Starten

1. Vul `LUNCHFLOW_API_KEY` in `.env` naast `package.json` in. Dit bestand wordt door Git genegeerd. `.env.example` bevat alleen een lege placeholder.
2. Losse test: `npm run test:lunchflow`. De test leest de rekeningenlijst, saldo en transacties per rekening; uitvoer bevat uitsluitend gemaskeerde identificatie, aantallen en technische status. Import wordt daarnaast tweemaal in geheugen uitgevoerd, met een handmatige verrijking ertussen. Er wordt geen administratie opgeslagen.
3. Interface: `npm run dev:local`, open `http://localhost:5173`, kies Persoonlijk → Bank → Lunch Flow → Rekeningen ophalen.
4. Kies per rekening een bestaande Moneylith-rekening of expliciet een nieuwe rekening. Klik Synchroniseren. Niet geselecteerde rekeningen blijven ongemoeid.
Gebruik hetzelfde adres als voorheen voor je bestaande administratie. `localhost` en `127.0.0.1` hebben afzonderlijke browseropslag; een andere host kan daarom leeg lijken zonder dat gegevens verwijderd zijn.

5. Herstart de lokale server na een sleutelwijziging. Voor deze bankproef is de losse oude backend op poort 3000 niet nodig; andere bestaande API-functies kunnen die wel nodig hebben.

## Gegevens en gedrag

- Accountkoppelingen, saldo, ophaaltijd en laatste succesvolle synchronisatie staan bij de bestaande persoonlijke rekening. Geen tweede financiële opslag. De volledige transacties staan in de bestaande persoonlijke transactiestore.
- Per rekening worden pas wijzigingen toegepast wanneer zowel saldo als transacties zijn geslaagd. Andere rekeningen kunnen wel slagen; de interface vermeldt gedeeltelijk succes. Oude gegevens en tijdstippen blijven staan bij fouten.
- Expliciete koppeling aan bestaande rekeningen voorkomt ongemerkte dubbele rekeningen. Er is geen automatische matching op naam. Een tweede providerrekening kan niet aan hetzelfde doel worden gekoppeld.
- Transactie-ID: provider + providerrekening-ID + providertransactie-ID. Herhaalde synchronisatie overschrijft geen categorieën, notities of andere extra gebruikersvelden. Bewerkte omschrijving, tegenpartij, datum en bedrag blijven behouden; nieuwe providerwaarden worden afzonderlijk bewaard.
- Een handmatig startsaldo blijft behouden. Het opgehaalde saldo staat afzonderlijk op de rekening en is zichtbaar bij Rekeningen. Vooruitblik gebruikt dit saldo na de bestaande expliciete actualiteitsbevestiging; historische transacties worden niet opnieuw opgeteld.
- Geldbedragen worden op gehele centen gevalideerd en naar het bestaande bedragmodel vertaald. De huidige financiële modellen rekenen in EUR: andere valuta worden eerlijk geweigerd, niet stilzwijgend omgerekend.
- Alleen geboekte transacties (`include_pending=false`), alle beschikbare geschiedenis, zonder verzonnen datumfilter. Geen gegevensverwijdering op basis van het ontbreken van een oude transactie in een latere response. Bestaande CSV-/andere-providerimports worden niet automatisch samengevoegd of verwijderd; kies bewust om historische overlap te vermijden.
- Ophalen bij Lunch Flow is geen gegarandeerde nieuwe banksynchronisatie. Het getoonde tijdstip is de ophaaltijd, niet een door de bank bevestigde actualiteitsdatum.
- Niet-actieve rekeningen en expliciete reconnect/reauthorization-signalen vragen de gebruiker de verbinding in Lunch Flow te controleren/herstellen. Er wordt geen Platform OAuth-flow gesimuleerd.

## Officiële API en waargenomen verschillen

Geraadpleegd: [Personal API](https://www.lunchflow.app/docs/api/personal-api-overview), [accounts](https://www.lunchflow.app/docs/api/personal-api/listAccounts), [balance](https://www.lunchflow.app/docs/api/personal-api/getAccountBalance), [transactions](https://www.lunchflow.app/docs/api/personal-api/getAccountTransactions).

Authenticatie via `x-api-key`. De opgegeven host `https://lunchflow.app/api/v1` gaf een 308 naar dezelfde route op `https://www.lunchflow.app`. Alleen deze exacte canonical redirect is toegestaan; andere redirects krijgen nooit de sleutel.

De rekeningenresponse bevat in deze echte koppeling geen `currency`, hoewel het documentatievoorbeeld die wel toont. De integratie laat dit onbekend en valideert de valuta afzonderlijk bij saldo en transacties.

De documentatie biedt geen pagina-, cursor- of limit-parameters. De huidige implementatie controleert `total === ontvangen aantal`, unieke IDs en eventuele onverwachte continuation-velden. Bij onvolledige/anders gepagineerde antwoorden wordt geen succes geclaimd; implementatie moet dan aan nieuwe documentatie worden aangepast. Er worden geen ongedocumenteerde pagina's geraden.

## Verificatie

- Volledige regressiesuite: **100 geslaagd, nul mislukt**. Strenge TypeScript-controle en productiebuild geslaagd; bestaande bundelgroottewaarschuwing blijft staan.
- Werkelijke sleutel ontbreekt in de productie-output; `.env` is Git-ignored en niet tracked. HTTP-controles zonder lokale origin en met moneylith.nl als origin gaven 403.
- Echte accounts-aanroep: twee actieve ING-rekeningen.
- Echte saldo-aanroep: beide geslaagd, inclusief validatie.
- Echte transactie-aanroep: beide geslaagd, respectievelijk 2.382 en 981 geboekte transacties; totaal 3.363.
- Echte lokale browserflow: beide rekeningen gesynchroniseerd in een geïsoleerde browser, één gekoppeld aan een bestaande testrekening en één expliciet aangemaakt. Na herladen opnieuw gesynchroniseerd: geen duplicaten; handmatige verrijkingen en bestaande testtransactie behouden; zakelijke opslag ongewijzigd.
- Desktop 1440 × 1000 en mobiel 390 × 844: bediening aanwezig, geen horizontale pagina-overflow. Geen runtime-browserfouten in de gecontroleerde flow. De ongerelateerde legacy-bankstatus was in deze geïsoleerde test gestubd als niet verbonden.
- Foutweergave en byte-identiek behoud van bestaande opslag bij nagebootste netwerkfout gecontroleerd in de browser.
- Regressietests dekken lokale toegangsgrens, redirects, foutcategorieën, incomplete responses, pagineringssignalen, dubbelimport, verrijkingen, gedeeltelijk succes, valuta, opslagfouten, modusscheiding en projectiesaldo.

De gewone gebruikersbrowser is niet aangepast. De echte banksynchronisaties vonden plaats in geheugen en in een afzonderlijke, tijdelijke browsercontext. Geen commit, push of deployment uitgevoerd.

## Voor publieke beschikbaarheid / Platform API

Deze Personal API-sleutel mag niet voor willekeurige bezoekers worden aangeboden. Voor meerdere gebruikers zijn betrouwbare Moneylith-authenticatie, autorisatie per eigenaar, een Lunch Flow Platform-app met clientgegevens en toegestane redirect-URI, gebruikersregistratie/OAuth, state-validatie, serverzijdige versleutelde opslag van tokens per gebruiker en tokenvernieuwing nodig. Vervolgens moeten toestemming, intrekking, gegevensverwijdering, rate limits en operationele monitoring worden uitgewerkt. Zie de [Platform API-documentatie](https://www.lunchflow.app/docs/api/platform-api-overview). Dit is niet in deze proef geïmplementeerd.
