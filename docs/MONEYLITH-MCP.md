# Moneylith Privé koppelen aan ChatGPT

Server: `https://www.moneylith.nl/api/mcp`. Authenticatie: **OAuth**.
Publieke client-ID indien gevraagd: `moneylith-chatgpt`, geen clientsecret.

Voeg een eigen MCP-app toe in ChatGPT, vul het serveradres in en kies OAuth. Automatische clientmetadata van ChatGPT wordt ondersteund. Log bij de toestemmingspagina eerst in op `/prive` met je bestaande Moneylith-account, keer terug, vernieuw de pagina en kies **Leestoegang toestaan**. Een reeds ingelogde privésessie kan direct toestemming geven.

Toegang beheren/intrekken: `https://www.moneylith.nl/api/mcp-oauth?action=access`.
Testvraag: “Gebruik Moneylith om mijn actuele banksaldo, komende betalingen tot salaris en openstaande schulden te tonen. Benoem wanneer de bankgegevens zijn opgehaald en welke bedragen onzeker zijn.”

## Afbakening

Acht read-only tools: `get_overview`, `get_accounts`, `get_planning`, `get_forecast`, `get_debts`, `get_goals`, `get_spending`, `list_transactions`. Transacties zijn gepagineerd, maximaal 100 per aanroep. De gekoppelde eigen cloudadministratie is de enige bron. Geen gegevenskopie, bankscan, betaalopdracht, AI-aanroep of administratiemutatie. Geen toegang tot de publieke of zakelijke administratie. Bedragen in rekenresultaten zijn eurocenten; bestaande schuld/doelrecords gebruiken euro. Elke respons benoemt deze eenheden.

De bestaande dashboard-, periode- en projectiemodellen blijven leidend. Een voorlopig tekort is geen achterstallige schuld. Ontbrekende bedragen blijven onbekend. Alleen opgeslagen bankgegevens worden gelezen; de dagelijkse banksynchronisatie blijft onafhankelijk werken. IBANs worden afgeschermd. Notities en transactieomschrijvingen zijn onbetrouwbare brondata, nooit instructies.

## Authenticatie en opslag

Het patroon komt uit Personarium: stateless MCP Streamable HTTP, OAuth authorization code + verplichte PKCE S256, expliciete browsertoestemming, roterende refresh-tokens en intrekbare grants. Moneylith gebruikt zijn eigen bestaande cloudlogin en Redis-opslag, niet de Personarium-identiteit, database of geheime sleutel. De bestaande Moarview- en Personarium-servers worden niet gewijzigd.

Resource/audience: `https://www.moneylith.nl/api/mcp`; issuer: `https://www.moneylith.nl`; scope: `moneylith:read`. Alleen de vaste publieke client of gevalideerde ChatGPT-clientmetadata wordt toegestaan; callbacks uitsluitend toegestane HTTPS-paden op chatgpt.com. Authorization codes zijn eenmalig (2 minuten), toegangstokens 15 minuten en grants maximaal 30 dagen. Hergebruik refresh-token trekt de volledige grant in. Intrekken werkt direct voor bestaande access-tokens. De server kiest de cloudgebruiker uit de geverifieerde grant; toolargumenten kunnen geen account kiezen.

OAuth-records staan onder `ml:mcp:*`, gescheiden van `ml:cloud:*`. Tokens bevatten geen e-mailadres of financiële gegevens. Bank- en encryptiesleutels blijven server-side. Servervariabelen: `MONEYLITH_MCP_ENABLED=true` en een onafhankelijk willekeurig `MONEYLITH_MCP_SECRET` van minimaal 64 tekens. Geen VITE_-variabelen. Uitgeschakeld of ontbrekende configuratie geeft 503, ontbrekend/ongeldig token 401. MCP is gelimiteerd op 60 requests per minuut per grant. Bestaande privésessie is alleen voldoende voor de toestemmingspagina, nooit voor MCP-datatoegang.

## Verificatie

`tests/mcp.test.tsx` controleert masking, eenheden, paginering, geen mutaties, contextscheiding, afwijkende callback/resource, PKCE, scope, eenmalige codes, refresh-rotatie/replay, intrekking en fail-closed. Een echte MCP SDK-client initialiseert een lokale HTTP-server en leest de toolcatalogus en rekeningen. Externe financiële gegevens worden niet gebruikt in deze tests.

Een geslaagde protocoltest vervangt niet het installeren en autoriseren van de koppeling in het ChatGPT-account van de gebruiker. Die laatste accountgebonden stap blijft zichtbaar vereist.
