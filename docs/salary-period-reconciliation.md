# Salarisperiode in Fundament

Persoonlijk gebruikt de periode van de 23ste tot en met de 22ste. Boekingsdatums blijven intact. Iedere succesvolle banksync bewaart de eerste beschikbare inschatting van de lopende periode in `moneylith.personal.periodPlans.v1`. Fundament doet dit ook bij het eerste openen. De inschatting is een auditmoment van bestaande invoer, geen tweede bewerkbare administratie. Latere imports overschrijven haar niet. De vastleggingsdatum is zichtbaar; voor oudere periodes zonder snapshot worden geen historische verwachtingen verzonnen.

De vergelijking is afgeleid van de bestaande transacties, expliciete bankkoppelingen bij inkomens/lasten, categorie-budgetten en de bestaande aflossingshistorie. Ze wordt na iedere wijziging opnieuw berekend, ook buiten het controlemoment van de 23ste t/m de 7de. De bestaande drie dagelijkse scans blijven ongewijzigd. Handmatig bevestigde betalingen via bunq, contant of derden staan per periode in `moneylith.personal.periodPaid.v1`; die veranderen geen banksaldo.

- Boekingen tellen eenmaal per stabiele transactie-ID; zakelijke rekeningen zijn uitgesloten.
- Ambigue koppelingen worden niet automatisch aan een post toegewezen.
- Een top-up of geldopname bewijst geen besteding aan een specifieke last. Het bedrag is wel al in het bankverloop verwerkt.
- Alleen werkelijk opgehaalde banksaldi worden als huidig saldo getoond. Geen gereconstrueerd historisch saldo wordt als feit gepresenteerd.
- Een expliciete terugboeking met een unieke tegenboeking op dezelfde rekening/tegenpartij/bedrag corrigeert de waargenomen betaling. Meerdere kandidaten vragen controle.
- Een teruggeboekte reeds verwerkte schuldaflossing geeft een controlemelding: hoofdsom en resterend schema worden niet blind teruggedraaid.
- Schuldaflossingen gebruiken een expliciet geactiveerde tegenpartij + uniek dossierkenmerk + startdatum. Met schema worden de bestaande termijnen gebruikt; zonder schema een afzonderlijke betaling, maximaal de openstaande hoofdsom. Kosten en overbetalingen vragen controle.
- Losse bevestigingen in Fundament gebruiken dezelfde aflossingshistorie en opslag met rollback als automatische bankverwerking. Een gecombineerde betaling kan over verschillende schulden worden verdeeld; het resterende deel blijft zichtbaar.
- Budgetten blijven in de lopende periode minstens gereserveerd tot de periode sluit. Andere aankopen worden niet stilzwijgend als vaste lasten geboekt.

De periodeweergave bewaart geen bank- of AI-sleutels. De desktopknop gebruikt de bestaande geautoriseerde cloud-bankscanroute en toont fouten zonder gegevensreset.

## Vooruitblik
Dezelfde reconciliatie levert de resterende verplichtingen voor de huidige salarisperiode. Reeds herkende huur/betalingen verlagen de nog verwachte post. Een gedeeltelijke betaling laat het restant staan; een verlopen datum is geen betaalbewijs. Zonder betrouwbare toekomstige datum wordt het restant voorzichtig op morgen gezet en als aanname getoond. Latere maanden gebruiken de ingestelde betaaldata (zonder datum voorlopig de 23ste).

Tanken en boodschappen gebruiken het budget minus herkende uitgaven sinds de 23ste. Alleen het restant wordt in gehele centen over de resterende dagen verdeeld. Vanaf zeven waargenomen kalenderdagen geeft het huidige uitgaventempo een expliciete indicatie van mogelijke overschrijding; deze wordt niet stilzwijgend als nieuwe verplichting geboekt. Bij ontbrekende bankhistorie is ook die indicatie onvolledig. Een nieuw salarisperiodebudget begint op de 23ste.

Bunq-top-ups en geldopnames zijn reeds van de gekoppelde bankrekeningen af. Ze worden als beschikbare financiering van bunq-/contante lasten behandeld, na aftrek van zelf bevestigde betalingen. Dit is een aanname over bestemming, geen bewijs dat een specifieke factuur is betaald; andere bestedingen buiten de gekoppelde rekeningen zijn niet zichtbaar. Oude bunq-/cashsaldi zijn onbekend. Bestaande schuldsaldi worden alleen door de betaaladministratie gewijzigd, nooit door Vooruitblik. Achterstallige resterende schuldtermijnen blijven verwacht totdat sync/bevestigde toewijzing het schema bijwerkt.

## Afgesproken aflossingen blijven leidend
Het schuldenoverzicht gebruikt uitsluitend de vastgelegde maandtermijnen, begrensd door het resterende saldo. Beschikbare ruimte, een gekozen strategie of een nog niet overgenomen voorstel verhogen dit bedrag niet. Zodra een lening is afbetaald, wordt de vrijgekomen termijn niet automatisch doorgeschoven naar andere schulden. Extra aflossen vereist een expliciete keuze; een voorstel blijft apart van de afgesproken maandlast.
