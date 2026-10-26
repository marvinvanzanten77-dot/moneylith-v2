# Directe bunq-koppeling

De persoonlijke bunq Pro/Elite-koppeling leest geboekte betalingen en beschikbare EUR-saldi. Er is geen betalingsfunctie. Lunch Flow blijft de ING-provider. Beide gebruiken dezelfde Moneylith-modellen, bankverwerking, correcties, salarisperioden, potjes, prognose en drie dagelijkse scans.

## Sleutel invullen

In de repository staat het genegeerde bestand `.env.bunq.local` met alleen:

```dotenv
BUNQ_API_KEY=
```

Vul de sleutel achter `=` in. Geen `VITE_`-variabele. `.env.example` bevat uitsluitend een lege placeholder. Bestandstoegang is beperkt tot de lokale eigenaar (0600). Installatie-, teken- en sessiesleutels worden automatisch aangemaakt.

Een nieuwe bunq-sleutel moet binnen één uur worden geactiveerd. Een gewone bunq-sleutel kan aan uitgaande IP-adressen zijn gebonden. Activeer een sleutel voor de live-server daarom niet eerst op de Mac. Voor een omgeving met wisselende uitgaande IP-adressen is vaste uitgaande netwerktoegang of een daarvoor geschikte bunq-sleutel nodig. De integratie verruimt toegestane IP-adressen niet automatisch.

## Lokaal testen

Na invullen: `npm run test:bunq`. Dit activeert de sleutel **vanaf deze Mac** en leest rekeningen, saldo en betalingen afzonderlijk. Het schrijft geen financiële administratie, maakt geen betalingen aan en toont alleen gemaskeerde identificatie, status en aantallen. Context wordt opgeslagen in de genegeerde map `.bunq/` (0700, bestanden 0600).

Herstart de lokale server na het invullen. `npm run dev:local` laadt `.env.bunq.local` expliciet. Bij Bank staan ‘bunq-verbinding testen’, ‘bunq-rekeningen ophalen’ en een bewuste keuze voor een bestaande of nieuwe Moneylith-rekening. Lokale API-verzoeken moeten van dezelfde loopback-origin komen, met de lokale header; productie en doorgestuurde verzoeken worden geweigerd.

## Productie

De lokale env is geen Vercel-configuratie. Zet dezelfde configuratienaam `BUNQ_API_KEY` als servergeheim uitsluitend in de productieomgeving, publiceer de code en activeer daar de koppeling. Geen sleutel in previewdeployments. Gebruik vervolgens de bestaande Moneylith-login en de bunq-knoppen bij Bank. Nog niet gekoppelde rekeningen worden niet automatisch geïmporteerd.

De bunq-acties lopen via de bestaande geauthenticeerde `api/cloud`-route, dezelfde eigenaarcontrole en Origin/headercontrole. Signing-/sessiegegevens worden apart en versleuteld in de bestaande serveropslag bewaard, nooit in de financiële snapshot of browser. Locks voorkomen gelijktijdige authenticatie; revision-CAS voorkomt het overschrijven van gelijktijdige financiële wijzigingen. Een defecte rekening behoudt eerdere data, terwijl de andere provider kan doorgaan.

## Betekenis van gegevens

- `/payment` bevat geboekte betalingen, inclusief kaartbetalingen (`FIS`). Mastercard-autorisaties worden niet als tweede transactie geïmporteerd.
- `balance` is het beschikbare saldo, niet noodzakelijk het saldo vóór kaartreserveringen.
- Geldbedragen worden uit decimale strings via gehele centen verwerkt. Andere valuta worden niet stilzwijgend omgerekend.
- `older_url` wordt tot het einde gevolgd, met controle op host, accountpad, lussen en een tijd/paginalimiet. Bij onvolledigheid wordt de hele betreffende rekening afgewezen.
- Stabiele IDs bevatten provider, bunq-gebruiker, rekening en betaling. Handmatige verrijkingen blijven behouden.
- Alleen bekende eigen volledige IBANs bevestigen interne transfers. Een gelijk bedrag of herkenbare naam is onvoldoende. Onbekende matches blijven te controleren.
- Een bunq-betaling kan een bestaande, uniek herkenbare abonnementpost bevestigen. Generieke ‘OpenAI’-betalingen worden niet zonder onderscheid als ChatGPT-abonnement geboekt: dat kunnen ook API-credits zijn. Ambigue posten zijn via Betalingen controleren te koppelen.
- Handmatige maandbedragen blijven inschattingen; herkende betalingen vullen het werkelijk-betaald-overzicht. Losse credits worden niet automatisch herhaald.
- Bij een gekoppelde bunq-rekening is de top-up intern: het bunq-saldo telt mee, de nog te betalen aankoop blijft gepland. Zonder gekoppelde bunq-rekening blijft de bestaande financieringslogica behouden.

## Verificatie

- Nieuwe regressies: ondertekende installatie/sessie, opgeslagen context hergebruiken, sessie vernieuwen, saldo en gepagineerde kaartbetalingen, foutcodes, geweigerde buitenlandse paginalinks en ongeldige handtekeningen, centen, providerisolatie, idempotentie, notities behouden, abonnementherkenning en top-up/prognose zonder dubbeltelling.
- Eigenaarroute: niet-ingelogd geweigerd, vreemde Origin geweigerd, ontbrekende sleutel expliciet gemeld.
- Volledige suite: 259 tests geslaagd. Strenge typecheck en productiebuild uitgevoerd.
- Echte bunq-sandbox: installatie, sessie, één rekening, saldo en betalingsoverzicht geslaagd. Het overzicht was leeg; paginering en geboekte aankopen zijn met fictieve responses getest.
- Browser: bunq testen/koppelen met fictieve API-responses, alle persoonlijke en zakelijke tabs, desktop en mobiel, twee apparaten en opslagfoutherstel geslaagd.
- Productie geactiveerd op 26 oktober 2026: echte eigenaarstest, rekeninglijst, saldo en 1.083 geboekte betalingen geslaagd. Eén actieve bunq-rekening gekoppeld; gecombineerde ING/bunq-scan: drie rekeningen geslaagd. Herhaling voegde geen duplicaten toe. Sleutel uitsluitend serverzijdig.

Officiële bronnen (geraadpleegd 26 oktober 2026):
- https://doc.bunq.com/basics/signing
- https://doc.bunq.com/basics/pagination
- https://doc.bunq.com/installation
- https://doc.bunq.com/devices
- https://doc.bunq.com/session
- https://doc.bunq.com/payment/payment
- https://doc.bunq.com/monetary-account
- https://raw.githubusercontent.com/bunq/doc/refs/heads/develop/swagger.json
- https://help.bunq.com/articles/bunq-developer-create-and-share-your-apps

## Herkenning van kosten (26 oktober 2026)

- `BILLING` op bunq wordt niet door een algemene bunq-top-upregel verborgen.
- Unieke leveranciersnamen koppelen onder meer SIMYO aan de bestaande telefoonpost. Handmatige bedragen, betaalgrenzen en correcties blijven behouden.
- Herkende werkkosten zonder bestaande post verschijnen als **Alleen betaalde kosten**. Het periodeoverzicht berekent de daadwerkelijke betalingen; een onbekende toekomstverwachting is geen nulbedrag. Deze observaties worden niet automatisch herhaald in Vooruitblik. Daar staat expliciet welke toekomstige bedragen nog niet zijn ingepland. Een zelf ingevuld bedrag maakt de post weer een normale verwachting.
- Generieke betaalverwerkers en OpenAI bewijzen niet welk abonnement of welke credits zijn gekocht; die blijven handmatig te koppelen.
- Een positieve SDD met een gelijk eerder bedrag bij dezelfde tegenpartij markeert een mogelijke terugboeking. Alleen expliciete terugboekingstekst of REVERSAL en één unieke match bevestigen de verrekening; ambigue matches blijven onbekend.
- Regressies controleren leveranciersvarianten, bankkosten versus top-ups, bestaande invoer, verwijderde suggesties, isolatie, geen herhaling van waargenomen kosten en toekomstige Simyo-facturen.
