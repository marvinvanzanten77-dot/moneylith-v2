# Teruggedraaide incasso's en chatpop-up

De persoonlijke chat is een zwevend, niet-blokkerend venster. Minimaliseren en navigeren houden het component in leven, zodat concepten, lopende aanvragen en antwoorden behouden blijven. Escape minimaliseert en herstelt de focus op de opener. Publieke onderdelen zijn niet gewijzigd.

Teruggedraaide incasso's worden rechtstreeks uit de bestaande transacties afgeleid, zonder tweede schuldenadministratie. Alleen persoonlijke geboekte EUR-transacties tot de peildatum tellen mee. Dubbele transactie-ID's tellen eenmaal.

Een expliciete storno/incassoterugboeking moet één oorspronkelijke afschrijving hebben met dezelfde rekening, tegenpartij en hetzelfde bedrag. Retailrefunds maken geen nieuwe rekening. Generieke providerreversals zonder incasso- of vaste-lastbewijs blijven een controlepunt. Meerdere kandidaten worden niet automatisch gekoppeld.

Bevestigde open posten blijven over salarisperioden heen zichtbaar. Bestaande posten in de lopende planning worden heropend in plaats van gedupliceerd. Overige open posten krijgen een afzonderlijk afgeleid vooruitblikevent. De datum morgen is daarbij expliciet een planningsaanname, geen verwachte bankincassodatum. Bank- en schuldsaldi worden niet veranderd.

Een nieuwe afschrijving sluit een post uitsluitend bij één overeenkomstige factuur-/kenmerkreferentie, tegenpartij, rekening en bedrag. Een teruggedraaide herbetaling sluit niets af. Gedeeltelijke betalingen, betalingen via een andere rekening en betalingen zonder unieke referentie vragen nog controle; een gelijke naam alleen bewijst geen vereffening. Een teruggeboekte schuldaflossing herstelt het historische schuldsaldo niet automatisch.

Tests: zeven gerichte regressies voor periodeovergang, geen mutatie, idempotentie, winkelrefunds, ambiguïteit, referentiematching, opnieuw teruggeboekte betaling, gegevensscheiding en voorkomen van dubbeltelling. Browsercontrole met synthetische gegevens voor desktop/mobiel: openen, minimaliseren, verder navigeren, behouden concept, verzenden, undo en reset. Geen echte betalingen of financiële mutaties uitgevoerd tijdens tests.
