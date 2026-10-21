# Eigen Moneylith-account

De bestaande persoonlijke Lunch Flow-toegang kan eenmalig het eigen account activeren bij Instellingen. Gebruik het geconfigureerde eigenaarsadres, een zelfgekozen wachtwoord (12–256 tekens) en de bestaande persoonlijke testcode, of een nog geldige persoonlijke testcookie. De API-sleutel is hiervoor nooit nodig in de browser.

Er is geen publieke registratie: de server controleert eigenaarschap voordat een accountrecord wordt aangemaakt. Het record wordt atomair aangemaakt en kan niet door een tweede registratie worden overschreven. Inloggen gebruikt scrypt, een serverondertekende HttpOnly-sessiecookie en een gedeelde Redis-limiet voor inlogpogingen. De bankroute controleert de sessie én het geverifieerde eigenaarsrecord. De oorspronkelijke tijdelijke banktest blijft beschikbaar.

Productie vereist `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CLOUD_AUTH_SECRET` en `CLOUD_ENCRYPTION_KEY`, naast de bestaande serverzijdige Lunch Flow-configuratie. Zonder deze configuratie werkt accountopslag niet; er is geen tijdelijke geheugenopslag of bekende standaardsleutel als terugval. Sleutels moeten onafhankelijk willekeurig zijn (32 bytes hex). Geen gegevens voor deze functie worden in een VITE-variabele geplaatst.

De eigen Redis-resource `moneylith-production` is alleen aan productie gekoppeld, in Frankfurt, met eviction en automatische planupgrade uitgeschakeld. Backups blijven nodig: deze implementatie is geen historisch cloudarchief.

## Opslag en apparaten

Na activering/inloggen slaat de app gewijzigde financiële gegevens ongeveer elke vijf seconden op zolang de pagina geopend is. Wacht op de opslagmelding voordat je het venster sluit, of gebruik ‘Nu opslaan’. De cloud bewaart één versleutelde administratie met een revisie. Voor elk opslaan vergelijkt Redis atomair die revisie; een verouderd apparaat krijgt een conflict in plaats van een stilzwijgende overschrijving.

Bij inloggen is ‘Cloudadministratie laden’ zichtbaar en aangevinkt. Dit bewaart eerst een lokale herstelkopie en laadt vervolgens de cloudadministratie. Bij herladen worden nieuwe cloudgegevens alleen automatisch geladen als de lokale administratie sinds de vorige synchronisatie niet gewijzigd is. Conflicten worden niet automatisch samengevoegd. Een lokale herstelkopie staat onder `moneylith.cloud.localRecovery`; die wordt niet naar de cloud gestuurd. Uitloggen sluit zowel de account- als testtoegang, maar verwijdert geen lokale financiële gegevens.

Persoonlijke en zakelijke gegevens en hun afzonderlijke chats behouden hun bestaande opslagsleutels. Demo-opslag, cookies, inlogcodes, API-tokens en cloudmetadata worden niet opgenomen. Payloads zijn begrensd tot 3,5 MB; bij overschrijding blijven lokale gegevens behouden.

## Bankherkenning

Synchroniseren schrijft rekeningen, transacties, nieuwe inkomen-/lastenregels en herkenningsmetadata samen naar de bestaande persoonlijke opslag, met terugrollen bij opslagfouten. Diagnostiek en het ophalen van de rekeningenlijst wijzigen geen financiële invoer.

Herkenning gebruikt maximaal 120 dagen, een herkenbare tegenpartij, relevante omschrijving en ten minste drie opeenvolgende maandelijkse betalingen. Mogelijke eigen overboekingen en terugbetalingen worden uitgesloten. Bedrag en betaaldag komen van de laatste waarneming en blijven een te controleren verwachting; de bestaande invoercontrole wordt niet automatisch bevestigd.

Handmatige regels worden nooit overschreven. Bij bestaande handmatige invoer wordt de herkenning ter vergelijking getoond, zodat hetzelfde inkomen of dezelfde last niet ongemerkt dubbel wordt ingevuld. Eerder toegevoegde, aangepaste of verwijderde herkenningen worden niet opnieuw toegevoegd. Een gewijzigde toekomstige betaling wordt niet automatisch aangepast. Niet herkende afschrijvingen worden als waargenomen overige uitgaven getoond, niet als vastgestelde maandlast.

Schuldsaldi, doelen, onbekende bedragen, reserveringen en toekomstig salaris worden niet verzonnen. Deze versie importeert bankgegevens uitsluitend naar Persoonlijk; zakelijke banktoewijzing is geen onderdeel van deze wijziging. Er is nog geen wachtwoordherstel via e-mail, automatisch samenvoegen van apparaatconflicten of ondersteuning voor andere gebruikers.
