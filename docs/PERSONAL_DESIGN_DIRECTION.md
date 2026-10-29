# Ontwerprichting privé-Moneylith

Status: ontwerpafspraken na het terughalen van de afgewezen uitbreiding.
Dit document beschrijft de ontwerptoets. De actuele bouwstand staat in
PERSONAL_VISUAL_WORKSPACE.md. De publieke versie en productie zijn niet gewijzigd.

## De afspraak

Minimale informatie, makkelijke bediening, rustige sfeer. Overzichtelijk,
snel te begrijpen en functioneel. Visuele representaties hebben de voorkeur
wanneer ze iets sneller duidelijk maken dan tekst.

De aangeleverde schets is de bron voor de uitstraling: warme lichte achtergrond,
ruimte, rustige typografie, zachte oppervlakken, bescheiden kleuraccenten en
herkenbare iconen. De berghero hoort bij het welkom op het startscherm; niet elke
detailpagina krijgt een grote afbeelding. Details moeten juist sneller bereikbaar zijn.

## Wat fout ging in de afgewezen uitbreiding

- De oude scherminhoud bleef de indeling bepalen: formulieren, uitleg en controles
  werden alleen anders gekleurd. De hoeveelheid informatie bleef te groot.
- Een nieuwe rij tabs en een uitgebreid menu maakten de navigatie alweer dominant.
- Oude pagina’s brachten dubbele titels, kaders en uitklappers mee.
- Technische volledigheid werd verward met een bruikbare eerste weergave.
- Een algemene CSS-laag over oude componenten levert geen nieuw interactieontwerp op.

De oude App-renderer, tabnavigatie en stijloverschrijvingen zijn uit het nieuwe
scherm verwijderd. De oorspronkelijke broncode is behouden voor logica en
referentie. Het dashboard met zijn bestaande detailvensters blijft de werkbasis.

## Vaste opbouw

1. Eén hoofdvraag en één duidelijk visueel antwoord.
2. Alleen de belangrijkste bedragen of eerstvolgende gebeurtenissen.
3. Eén duidelijke hoofdactie; overige acties bij het relevante item.
4. Selecteer een item om details te zien. Kies Bewerken om invoer te openen.

Geen lange waarschuwinglijsten bovenaan. Een ontbrekend bedrag krijgt een korte
status en een directe aanvulactie. Onbekend wordt nooit nul. Essentiële fouten,
zoals mislukte opslag, blijven zichtbaar en mogen niet verdwijnen voor de esthetiek.

Gebruik gewone woorden. Vermijd schermnamen die eerst uitleg nodig hebben.
De bestaande namen zijn hieronder alleen gebruikt om alle functies te inventariseren.

## Informatie en bediening per onderwerp

| Onderwerp | Eerste zichtbare antwoord | Visuele vorm | Bij openen / bewerken |
| --- | --- | --- | --- |
| Start | Waar sta ik nu? | Bestaande vier kaarten en korte verplichtingenstrook | Open het betreffende onderwerp; geen tweede compleet dashboard |
| Rekeningen / vermogen | Hoeveel heb ik, en waar? | Rustige lijst met rekeningicoon en saldo; bezittingen apart | Rekeningdetails, saldoherkomst, actieve status; bankbeheer via profiel/menu |
| Planning / Fundament | Wat moet er nog af deze salarisperiode? | Tijdlijn van ontvangsten en betalingen; onderscheid betaald en verwacht | Betaling selecteren: bedrag, datum, betaalwijze; gericht bewerken |
| Budgetten | Hoeveel ruimte is er nog voor tanken en boodschappen? | Bedrag gebruikt / budget met eenvoudige balk | Budget of maandbedrag aanpassen; transacties achter het gebruikte bedrag |
| Uitgaven / Patronen | Waar gaat mijn vrije geld naartoe? | Een beperkt aantal potjes met bedrag en vergelijkbare balken | Aankopen per potje; één korte bespaartip; onbekende aankoop via één vraag tegelijk |
| Vooruitblik | Red ik het tot mijn volgende inkomen? | Eén rustige saldolijn, met komende belangrijke betalingen | Periode wijzigen; een zelfgekozen scenario als tweede lijn met verschil |
| Schulden | Wat staat open en wat betaal ik nu? | Totaal openstaand plus compacte schuldenlijst | Afspraken en betalingen per schuld; voortgang alleen met betrouwbare beginstand |
| Doelen | Hoe ver ben ik? | Doel met voortgang en eventueel deadline | Bedrag of doel bewerken; gepland sparen is geen echt gespaard geld |
| Meldingen | Wat vraagt nu aandacht? | Korte lijst, belangrijkste eerst, met duidelijke actie | Details of geschiedenis; voorkeuren en pushinstellingen apart |
| AI | Waar kan ik hulp bij gebruiken? | Contextuele hulpactie bij het onderwerp | Compact gesprek met alleen relevante context, echte laad- en foutstatus |
| Instellingen | Wat wil ik beheren? | Korte lijst: account, banken, app, gegevens | Eén instelling of formulier tegelijk; back-up/import onder gegevens |

Abonnementen zijn gewone geplande uitgaven met maandafhankelijke bedragen,
geen tweede dashboard. Ingehouden lasten, schuldallocaties en categoriecorrecties
blijven bereikbaar bij de betreffende post of transactie. Intentie en voorkeuren
voor begeleiding horen onder profiel, niet als verplichte eerste stap.

## Wanneer een visual helpt

- Tijd: horizontale tijdlijn op desktop, dezelfde gebeurtenissen verticaal op mobiel.
- Budget: gebruikte ruimte en restant in één balk met bedragen.
- Uitgaven: vergelijkbare balken per potje; geen ingewikkelde taart met veel kleuren.
- Prognose: één lijn voor de verwachting. Alleen na expliciete keuze een scenario erbij.
- Doel: voortgang met bedrag; geen percentage zonder betrouwbare doelwaarde.
- Status: icoon plus kort woord, niet uitsluitend kleur.

Geen grafiek bij één bedrag dat op zichzelf duidelijk is. Geen decoratieve meters,
schijnprecisie of fictieve voortgang. Een ontbrekende basis geeft een rustige
lege toestand met de actie die het probleem oplost.

## Financiële betekenis blijft leidend

Banksaldo, vrije ruimte, maandbudget en uitgaven zijn verschillende begrippen.
Bedragen uit de referentieafbeelding zijn geen rekenregels. Elke visual gebruikt
de bestaande financiële berekening met een herkenbare periode en herkomst.
Interne overboekingen, reeds betaalde verplichtingen en schuldaflossingen worden
niet nogmaals afgetrokken. Persoonlijke en zakelijke gegevens blijven gescheiden.
Handmatige betalingen worden niet als voltooid getoond zonder bewijs/bevestiging.
De gebruiker kiest een extra aflossing; de UI maakt niet automatisch een scenario.

## Wat we hergebruiken, en wat we opnieuw ontwerpen

Hergebruiken: typen, opslagcontracten, providerclients, classificatie, reconciliatie,
prognoseberekeningen, validatie, authenticatie en AI-contextbeveiliging.

Opnieuw ontwerpen: schermcompositie, navigatie, detailweergave, formulieren,
meldingen en de manier waarop hulp wordt aangeboden. Geen oude Step-componenten
als volledige pagina onder de nieuwe header monteren. Geen CSS-selectoren om
oude koppen en layouts te verbergen. Eerst een klein expliciet data-/actiecontract
voor een onderwerp, daarna een nieuwe presentatie; geen tweede opslagmodel.

Een kleine bestaande invoercomponent mag alleen worden hergebruikt als die qua
bediening en vorm echt past. Bestaande functies hoeven niet allemaal tegelijk
zichtbaar te zijn om bereikbaar te blijven.

## Bouwvolgorde en toetsing

Eerst één complete route: start → komende betaling → details → bedrag/datum
bewerken → opslaan → bijgewerkte planning en start. Gebruik die route om de
nieuwe detail- en invoerbediening te toetsen voordat we die naar andere onderwerpen
uitbreiden. Daarna budgetten/uitgaven, schulden/doelen, prognose en beheer.

Per route controleren: begrijpelijk zonder uitleg, één duidelijke hoofdactie,
leesbaar op telefoon, toetsenbord/focus, lege en fouttoestand, opslaan/herladen,
geen gegevensverlies en geen dubbele financiële telling. Details openen zonder
de periode of de plek in het overzicht kwijt te raken.

Een overzicht is geslaagd wanneer je snel weet wat de situatie is en wat je kunt
doen. Het aantal aangesloten functies is daarvoor op zichzelf geen bewijs.

## Onderscheid en het gevoel van een meebewegende app

De ambitie van de gebruiker is een product dat zich kan meten met ING, bunq,
Rabobank en huishoudboekplatformen. Dit is een ontwerpopdracht, geen conclusie
uit een concurrentieonderzoek. Professionele kwaliteit zit in betrouwbaarheid,
begrijpelijkheid en een samenhangende ervaring; niet in het aantal elementen.

Moneylith maakt vooral de stap van transactie naar betekenis en passende actie:
wat verandert er voor mij, waar heb ik ruimte en wat verdient aandacht?

- Een geboekte betaling verschuift van verwacht naar betaald, met een subtiele
  overgang en een meteen bijgewerkt restant. Herkenning moet aantoonbaar kloppen.
- Een ontvangen salaris actualiseert de situatie; de app toont het effect zonder
  opnieuw een invoerproces te vragen. Bij onzekerheid staat kort wat nog ontbreekt.
- Bij een budget wordt duidelijk hoeveel ruimte resteert. Een tip verschijnt
  alleen wanneer die relevant en uitvoerbaar is, passend bij de eigen voorkeuren.
- Een aflossing maakt voortgang zichtbaar zonder confetti of opgelegde extra aflossing.
- Na opslaan volgt een duidelijke bevestiging. De gebruiker blijft bij hetzelfde
  onderwerp; geen sprongen naar de bovenkant of onverwachte verlies van invoer.
- Overgangen ondersteunen continuïteit, duren kort en respecteren reduced motion.
  Geen voortdurend bewegende achtergrond of pulserende kaarten als decoratie.
- De toon is warm, volwassen en niet-veroordelend. Geen automatische complimenten
  bij ieder bedrag, schijnempathie, schuldgevoel of claim dat AI emoties kent.
- De app past zich aan aantoonbare financiële gebeurtenissen en expliciete
  voorkeuren aan. Geen afgeleide psychologische labels of ongevraagde conclusies.

Rust betekent ook weten wanneer er niets te melden is. Op de meeste momenten
moet één blik genoeg zijn, en mag de gebruiker weer verder met zijn dag.
