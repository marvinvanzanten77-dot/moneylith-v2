# Persoonlijke Lunch Flow-liveproef

Deze uitbreiding vervangt de eerdere beperking tot lokaal gebruik op **www.moneylith.nl**. Het is uitsluitend een persoonlijke proef, geen publieke bankkoppeling voor andere Moneylith-gebruikers.

## Gebruik

1. Open www.moneylith.nl → Persoonlijk → Bank.
2. Gebruik het geconfigureerde eigenaar-e-mailadres en de aparte testcode uit het lokale, Git-ignored bestand `.env.lunchflow-owner.local`, veld `MONEYLITH_OWNER_TEST_CODE`. Dit is niet het gewone Moneylith-wachtwoord en niet de Lunch Flow API-sleutel.
3. Klik **Persoonlijke test openen**, daarna **Verbinding testen**. De test leest rekeningen, saldo en geboekte transacties, toont uitsluitend gemaskeerde identificatie en aantallen, en wijzigt geen administratie.
4. Voor werkelijk importeren: **Rekeningen ophalen**, kies per rekening een bestaande Moneylith-rekening of expliciet een nieuwe rekening, daarna **Synchroniseren**.
5. **Testtoegang sluiten** beëindigt de browsersessie. De sessie vervalt na één uur. Reeds opgeslagen financiële gegevens blijven bewaard in de bestaande persoonlijke browseropslag.

Plaid is uit de Bank-interface verwijderd. De historische providerbestanden en bestaande gebruikersgegevens zijn niet verwijderd. De lokale Lunch Flow-proef blijft eveneens beschikbaar.

## Toegangsgrens

De bestaande cloudlogin gebruikt zonder extra configuratie geen duurzame accountopslag en heeft een ontwikkelsleutel als fallback. Registratie bewijst geen eigendom van een e-mailadres. Daarom verleent een gewone cloudsessie **geen toegang** tot deze persoonlijke banksleutel.

De liveproef gebruikt een beperkt, vooraf geconfigureerd eigenaaraccount met een willekeurige 256-bit testcode. Er is geen registratie, wachtwoordherstel of publieke mogelijkheid jezelf eigenaar te maken. De testcode is geen zelfgekozen wachtwoord: alleen de SHA-256-hash wordt op de server gezet. De API-sleutel en sessiesleutel blijven serverzijdig. Een vaste hostcookie met Secure, HttpOnly en SameSite=Strict bevat een ondertekende sessie van maximaal één uur. Verandering van testcodehash of sessiesleutel maakt bestaande sessies ongeldig.

Alle bankacties gebruiken de bestaande route `/api/bank/sync?provider=lunchflow`. De Lunch Flow-afhandeling controleert vóór iedere provideraanroep configuratie, POST, de exacte origin `https://www.moneylith.nl`, een eigen verzoekheader en de geldige eigenaarsessie. Andere e-mailadressen, ontbrekende/vervalste/verlopen cookies en cross-origin-verzoeken krijgen geen bankdata. De responses zijn `private, no-store`. Er bestaat geen onbeveiligde `/api/lunchflow`-productieroute. De login en sessiestatus zijn openbaar bereikbaar maar leveren nooit bankgegevens of de eigenaaridentiteit op.

De bestaande rate limiter wordt gebruikt (30 verzoeken per minuut per IP per instantie). Dit is geen wereldwijde limiet over alle serverless-instanties; de sterke willekeurige testcode blijft essentieel. Bouw dit niet om tot een eenvoudig zelfgekozen wachtwoord zonder passende wachtwoordhashing, duurzame throttling en herstelbeveiliging.

## Serverconfiguratie

Alleen Production:

- `LUNCHFLOW_API_KEY`
- `LUNCHFLOW_PRIVATE_ENABLED=true`
- `LUNCHFLOW_OWNER_EMAIL`
- `LUNCHFLOW_OWNER_CODE_HASH` — 64 hextekens, hash van de willekeurige testcode
- `LUNCHFLOW_SESSION_SECRET` — 32 willekeurige bytes als 64 hextekens

Ontbrekende of ongeldige configuratie sluit de toegang. Preview-deployments worden expliciet geweigerd. Geen van deze variabelen heeft een VITE_-prefix. De onbewerkte testcode wordt niet als servervariabele geüpload en staat niet in Git, browseropslag of de frontendbundle.

Uitschakelen: zet de activeringsvariabele uit en deploy opnieuw. Om bestaande sessies direct bij de volgende deployment ongeldig te maken: roteer de sessiesleutel of testcodehash. De API-sleutel kan ook bij Lunch Flow worden ingetrokken.

## Verificatie vóór publicatie

- 107 regressietests geslaagd, inclusief eigenaarconfiguratie, vervalste/verlopen cookies, verkeerde eigenaar/code, andere origin, methode, ontbrekende sessie, beschermde bankacties en gemaskeerde diagnostiek.
- Strenge TypeScript-controle en productiebuild geslaagd.
- Productie-interface in geïsoleerde browser met fictieve provider: geen testknop vóór login; verkeerde code geweigerd; login, testen zonder opslagwijzigingen, sessiebehoud na herladen, mobiel en uitloggen geslaagd. Geen Plaid-bediening of browser-runtimefouten.
- Na publicatie moeten de nieuwe deployment en een echte beschermde provideraanroep op www.moneylith.nl worden gecontroleerd. Dit staat los van de eerdere echte lokale controles.

Voor meerdere gebruikers blijft een aparte Platform API-integratie nodig met betrouwbare gebruikersidentiteit, gebruikersgebonden autorisatie, OAuth en veilige tokenopslag/vernieuwing per gebruiker.
