# TypeScript-controle

Voer `npm run typecheck` uit voor de volledige strenge controle van `src`, `api` en de Vite-configuratie, inclusief de declaraties van afhankelijkheden. `npm run build` voert deze controle verplicht uit voordat Vite de productieversie bouwt. `npm test` voert de regressietests uit.

Op 10 september 2026 zijn de 85 bestaande compilerfouten opgelost. De TypeScript-instellingen zijn niet versoepeld en bibliotheekcontroles zijn niet overgeslagen.

- Eén canoniek transactietype; expliciete omzetting tussen opgeslagen schulden en de formuliervelden, met behoud van oude bedragen, maandlasten en opmerkingen.
- Correcte types voor terugkerende kosten, AI-potjes, focus zonder selectie, schuldvoorstellen en oudere opgeslagen strategiekeuzes.
- Ontbrekende imports en Turnstile-configuratie aangevuld; optionele tokens en numerieke invoer correct vernauwd.
- Het ongebruikte prototype `App.new.tsx` en de niet-aangeroepen `ActionZone` verwijderd. Hun historie blijft in Git beschikbaar.
- Recharts bijgewerkt van 3.5.1 naar 3.10.1 om de declaraties met de geïnstalleerde Redux-versie te laten aansluiten.
- PDF.js gebruikt de bestaande `.mjs`-module en een door Vite gebundelde worker-URL. Een kopie van de PDF-buffer voorkomt dat tekstextractie de buffer voor een eventuele OCR-poging overdraagt en onbruikbaar maakt.

Validatie: nul TypeScript-fouten, 50 geslaagde tests, geslaagde productiebuild. Browsercontrole omvat schulden bewerken en herladen, de drie grafiekcomponenten en tekstextractie/opslag van een test-PDF met de gebundelde PDF-worker. Een externe AI-analyse, bankverbinding en volledige OCR-herkenning zijn geen onderdeel van deze controle.
