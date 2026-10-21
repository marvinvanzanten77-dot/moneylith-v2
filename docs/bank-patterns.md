# Patronen rechtstreeks uit bankgegevens

Bij een persoonlijke Lunch Flow-rekening gebruikt Patronen de reeds opgeslagen banktransacties, onafhankelijk van de gekozen startmodus. Het uploadscherm wordt voor deze route niet getoond. De bestaande afschriftimport blijft beschikbaar voor administraties zonder Lunch Flow-rekening. Bankgegevens worden alleen ververst via Synchroniseren; Patronen doet geen extra providerverzoeken en beweert geen realtime bankinformatie te hebben.

## Herkenning

`src/bank/patterns.ts` indexeert geboekte EUR-transacties op rekening, richting en tegenpartij. Ontbreekt een specifieke tegenpartij, dan gebruikt de index een volledige genormaliseerde omschrijving. Bij generieke betaalverwerkers wordt de omschrijving behouden om verschillende winkels niet alleen op ‘PayPal’ of ‘SEPA’ samen te voegen. De oorspronkelijke provideromschrijving ondersteunt stabiele sleutels wanneer een gebruiker de zichtbare tekst bewerkt.

Alle groepen zijn doorzoekbaar. Vanaf twee betalingen wordt een groep als herhaling getoond, ook bij wisselende bedragen of een onbekend ritme. Ondersteunde indicaties: wekelijks, tweewekelijks, vierwekelijks, maandelijks, per kwartaal en jaarlijks. Een onregelmatige reeks krijgt geen verzonnen maandbedrag. Periodes van 90, 180, 365 en 730 dagen zijn selecteerbaar; oudere patronen blijven bereikbaar via de filter voor alle herhalingen. Eigen overboekingen worden als mogelijk gemarkeerd, niet als bewezen weggelaten op basis van alleen hetzelfde bedrag.

De standaardvragen betreffen recente herhalingen zonder opgeslagen antwoord. Er is geen maximum van negen categorieën; de weergave toont twintig groepen per pagina met ‘Meer groepen tonen’. Transacties zijn per groep stapsgewijs zichtbaar. Een herhaling wordt niet automatisch een vaste last.

## Antwoorden en bestaande financiële modellen

Antwoorden staan in `moneylith.personal.bankPatterns.v1`: soort, betekenis en optioneel een verwijzing naar een bestaande inkomen-/vaste-lastenpost. Er is geen tweede opgeslagen financiële som. Voor inkomen of een vaste last kiest de gebruiker expliciet een bestaande post of een nieuwe maandpost. Koppelen behoudt bestaande bedragen, namen, betaaldagen en notities. Een nieuwe post gebruikt de bestaande `income`/`fixedCosts`-modellen en vereist een expliciet maandbedrag; een onbekende betaaldag blijft onbekend. De volledigheidscontrole in Fundament wordt niet automatisch afgevinkt.

Beslissingen worden tijdens volgende Lunch Flow-synchronisaties opnieuw op passende transacties toegepast. Handmatige categorieën en notities blijven behouden. Door de herkenning geschreven categorieën kunnen met een aangepast antwoord worden bijgewerkt. Reeds gekoppelde financiële posten worden in Fundament bewerkt; de index voegt ze niet nogmaals toe. Nieuwe categorisaties, financiële posten en transacties worden samen opgeslagen en bij een opslagfout teruggedraaid. Deze persoonlijke sleutels vallen onder de bestaande versleutelde accountopslag; zakelijke gegevens worden niet gewijzigd.

## Grenzen

Herkenning blijft een hulpmiddel: veranderende tegenpartijnamen of unieke omschrijvingen kunnen meerdere groepen veroorzaken; meerdere contracten bij dezelfde tegenpartij kunnen juist samen voorkomen. Vergeten of gestopte betalingen en ontbrekende bankhistorie worden niet aangevuld. Een omgerekend maandbedrag is een begrotingsindicatie, niet de daadwerkelijke betaaldatum van een kwartaal- of jaarfactuur. Schuldsaldi en andere onbekende financiële feiten worden niet afgeleid.

## Automatische categorisering en persoonlijke regels

`classificationRules.ts` groepeert bekende winkels over vestigingen heen (boodschappen, Action, sauna). Persoonlijke uitzonderingen staan uitsluitend in `moneylith.personal.bankRules.v1`, binnen de bestaande versleutelde accountopslag. Namen van familieleden, rekeningidentificaties en persoonlijke interpretaties worden niet in de publieke applicatiecode opgenomen. Via **Eigen regels beheren** kunnen regels worden toegevoegd, aangepast, uitgeschakeld of verwijderd. Regels worden direct op bestaande transacties en opnieuw bij synchroniseren toegepast; expliciete groepsantwoorden en handmatige categorieën behouden voorrang.

Een regel kan woorden, richting, exclusieve bedraggrenzen in centen, een bronrekening en een volledige tegenrekening combineren. Alleen twee rekeningcijfers of een gelijk tegengesteld bedrag bewijzen geen interne overboeking. Terugboekingen vallen niet automatisch onder regels voor aankopen. Onbenoemde grensgevallen blijven vragen. Categorisering verandert geen echte bedragen, datums, notities of rekeningbestemmingen.

Top-ups en geldleningen zijn aparte geldbewegingen. Ze worden niet als consumptie of verdiend inkomen in de transactie-afleidingen opgenomen en leveren geen abonnementskosten of openstaand schuldsaldo op. Rekeningrollen zijn expliciete metadata: zakelijke rekeningtransacties worden uitgesloten van persoonlijke automatische inkomsten-/lastensuggesties, maar blijven zichtbaar in hetzelfde bankoverzicht. Deze wijziging migreert geen boekingen, bestaande maandposten, saldi of prognoses naar een andere administratie. Daardoor blijven bestaande handmatige financiële keuzes behouden; een volledige herindeling van bestaande administraties is een afzonderlijke handeling.
