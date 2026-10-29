# Adaptieve verwachtingen

Implementatie op de privébranch `personal/ui-reset`. Geen wijziging aan publieke
routes, bankauthenticatie of opgeslagen echte maandbedragen.

## Berekening

`src/bank/expectations.ts` leidt een tijdelijke verwachting af uit de bestaande
records en dezelfde betaalmatching als het maandoverzicht. Maximaal drie
voltooide salarisperioden tellen mee. Minimaal twee perioden met betalingen zijn
nodig voor een bankschatting. Als alternatief kunnen recente expliciet ingevoerde
maandbedragen een voorlopige basis leveren. Geen onbeperkte extrapolatie uit een
jarenoude invoer. Bedragen worden in centen gemiddeld.

Expliciete maandbedragen, inclusief nul en expliciet onbekend, blijven behouden.
Een schatting krijgt eigen herkomstinformatie en vervangt geen bronrecord.
Bij één herkende betaling per eerdere periode mag een actuele betaling een
*geschatte* variabele rekening vervangen. Een expliciet opgegeven factuur houdt
bij deelbetaling wel een restant. Meerdere aankopen en budgetten blijven een
resterende verwachting houden. Terugboekingen worden niet als betaling beschouwd.

Alleen waargenomen werktools zonder eigen maandplanning delen een afgeleid
flexibel budget. Historische aankopen van verschillende tools en credits worden
samengenomen. Een losse aankoop maakt geen abonnement. Nieuwe, reeds als
werktool herkende aankopen verbruiken het gezamenlijke budget. Handmatig geplande
tools blijven erbuiten, zodat ze niet dubbel meetellen. Perioden zonder herkende
betalingen tellen niet ongemerkt als nul; de basis kan daardoor conservatief zijn.

## Aansluiting

- `personalInput` gebruikt de afleiding voor dashboard, vooruitblik en bestaande
  afnemers van deze projectie, inclusief serverberekeningen.
- `remainingPayments` trekt geboekte bedragen niet opnieuw van het saldo af.
- `workspaceModel` gebruikt dezelfde afleiding voor Planning. Bewerkvensters
  blijven de oorspronkelijke records gebruiken.
- `processBankSync` en `useDashboard` bewaren de eerste periode-inschatting.
  Nieuwe afschrijvingen wijzigen de actuele verwachting, niet die beginstand.
- Planning toont Geschat en in details de startinschatting en actuele bedragen.

## Grenzen

Geen schatting zonder bruikbare historie. Niet-herkende leveranciers vragen nog
indeling. Onzichtbare cashbetalingen, persoonlijke reserveringen en niet-bekende
verplichtingen zijn niet uit de afschriften af te leiden. Een geslaagde scan is
geen garantie voor actuele bankinformatie. Het automatisch werkbudget heeft nog
geen eigen bewerkformulier; bestaande handmatige toolplanning blijft leidend.

## Controle

Tien nieuwe regressietests; volledige suite 304 tests geslaagd. Browsercontrole
met fictieve transacties op 1536 en 390 pixels: gezamenlijk budget, actualisering
na sync-event, oorspronkelijke records behouden, geen JavaScriptfouten of
horizontale overflow. Productiebuild en strenge typecheck zijn geslaagd. Geen wijzigingen aan de echte cloudadministratie tijdens deze tests.
