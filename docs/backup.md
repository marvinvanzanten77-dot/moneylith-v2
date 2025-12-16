# Back-up en export

Dit project bewaart alle plannersgegevens in `localStorage` in de browser (geen server-side opslag). De back-up functie
exporteert die volledige lokale staat naar een JSON-bestand.

## Wat wordt meegenomen
- Rekeningen, afschriften, transacties
- Inkomen, vaste lasten, schulden, vermogen
- Doelen, intenties, potjes/buckets en handmatige overrides
- AI-notities (analyse-output en chatgeschiedenis) en potjes-afleidingen
- Temporare configuraties zoals geselecteerde maand, ritme overrides en statusvlaggen

Gevoelige zaken zoals sessies of secrets worden niet opgeslagen in `localStorage` en worden dus ook niet meegenomen.

## Hoe gebruik je het
1) Ga naar de Back-up & export kaart (in de AI-analyse tab, rechterkolom).
2) Klik **Download JSON-back-up** en bewaar het bestand lokaal.
3) Om te herstellen: kies het JSON-bestand bij **Herstel vanuit JSON**. De pagina ververst daarna automatisch.

## Aanbevolen frequentie
- Maak een back-up zodra je belangrijke wijzigingen hebt gedaan (nieuwe afschriften, doelen, potjes of schulden).
- Bewaar meerdere generaties (bv. maandelijks) zodat je kunt terugvallen op een vorige versie.
