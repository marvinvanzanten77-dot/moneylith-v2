# Persoonlijke AI-agent

Alleen de privéaftakking. Geen wijzigingen aan publieke accounts, prijzen of bankkoppelingen.

## Werking
De nieuwe rustige interface opent de assistent via de kop en het menu. De server leest de actuele versleutelde eigenaaradministratie, inclusief de gedeelde vooruitblik. Aanvullende persoonlijke velden kunnen gepagineerd worden gelezen. Zakelijke collecties en als zakelijk aangeduide rekeningen/transacties worden uitgesloten.

Concrete chatopdrachten kunnen acht collecties bijwerken:
- Rekeningen: handmatige rekening aanmaken, naam/type/omschrijving.
- Inkomen: bedrag, betaaldag, volgen banksalaris en informatieve inhoudingen.
- Verwachte inkomsten: bedrag, datum en toelichting.
- Vaste lasten/budgetten: bedragen, maandafwijkingen, betaalwijze, categorie en betaaldag.
- Schulden: expliciet saldo, regeling, termijnen en notities.
- Vermogen: soort, naam en waarde.
- Doelen: doelbedrag, voortgang, maandinleg en deadline.
- Transacties: notities en categoriecorrecties via de bestaande classificatielogica.

Overige velden zijn leesbaar waar aanwezig, maar niet willekeurig schrijfbaar. Bankbedragen, provideridentificaties, echte betalingen en verwijderingen zijn uitgesloten. Niet alle rekeningtypen of classificatiewijzigingen zijn toegestaan. Ontbrekende noodzakelijke invoer moet worden nagevraagd. Onbekend wordt niet nul. Een nieuwe rekening activeert geen bankkoppeling.

## Betrouwbaarheid
- Bestaande eigenaarauthenticatie, origincontrole en versleutelde cloudopslag.
- Server haalt context op; client kan geen financiële context voor een wijziging opleggen.
- Veldallowlist, bedrag-/datumvalidatie en maximaal tien wijzigingen per opdracht.
- Eén atomische opslag met versiecontrole; banksync of apparaatconflict blokkeert overschrijven.
- Verzoek-ID voorkomt herhaling van reeds opgeslagen opdrachten.
- Laatste honderd wijzigingsbewijzen opgeslagen; tien zichtbaar in de interface.
- Ongedaan maken controleert eerst of de betrokken gegevens sindsdien ongewijzigd zijn.
- Chat wissen verwijdert geen financiële wijzigingen.
- Modeltoolresultaten en transactieomschrijvingen gelden als gegevens, niet als opdrachten.
- Hypothetische scenario's schrijven niet; prognosevragen gebruiken de bestaande berekening.

## Controles en beperkingen
Regressietests dekken veldvalidatie, gegevensscheiding, maandbedragen, onvolledige bestaande regels, categoriecorrecties, regelingaliases, versleuteld opslaan, idempotentie, versieconflicten en undo. Bestaande cloudtests controleren geweigerde ongeauthenticeerde/verkeerde-origin verzoeken.

De browsercontrole gebruikt synthetische API-antwoorden op desktop (1536 px) en mobiel (390 px): chat, wijzigingsbewijzen, undo, reset, geen horizontale overflow of JavaScript-fouten. Dit bewijst geen echte modelaanroep.

Een echte OpenAI-aanroep is nog niet geverifieerd: lokaal ontbreekt OPENAI_API_KEY. Geen echte administratie gewijzigd tijdens tests. Niet gepubliceerd. Voor vrijgave is een echte afgeschermde end-to-end-aanroep met gecontroleerde testgegevens nog vereist. Promptgebaseerd begrip van toestemming blijft modelafhankelijk; servervalidatie beperkt velden en acties maar bewijst niet dat elke interpretatie juist is.
