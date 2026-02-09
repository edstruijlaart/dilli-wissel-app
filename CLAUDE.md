# Dilli Wissel App v2

## Wat is dit?
Wisselmanager voor v.v. Dilettant jeugdvoetbal. Regelt eerlijke speeltijdverdeling
tijdens wedstrijden met automatische wisselschema's.

**Eigenaar**: Ed Struijlaart (voor het team van zijn zoontje)
**Status**: Actief in gebruik op wedstrijddagen

## Tech Stack

| Component | Technologie |
|-----------|-------------|
| Framework | React 18.2.0 (CDN, geen build step) |
| Audio | Tone.js 14.8.49 (fluitsignalen) |
| Transpiler | Babel standalone (in-browser) |
| Styling | Inline CSS-in-JS |
| Fonts | Google Fonts (DM Sans, JetBrains Mono) |
| PWA | Service Worker voor offline gebruik |

## Architectuur

**Eén enkel HTML-bestand** (~59KB). Geen server, geen database, geen build process.
Alles draait client-side via CDN-geladen React + Babel.

```
dilli wissel app v2/
├── index.html          # De hele app (React + CSS + logica)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (offline caching)
└── icons/              # App iconen voor homescreen
```

## Drie Views

1. **SETUP** — Spelers invoeren (handmatig of plakken), keeper aanwijzen, wedstrijdinstellingen
2. **MATCH** — Live timer, veld/bank weergave, wisselwaarschuwingen, score bijhouden
3. **SUMMARY** — Speeltijdstatistieken, wisselgeschiedenis

## Key Features

- **Fair rotation**: Wisselalgoritme op basis van minst gespeelde tijd
- **Clipboard parsing**: Plak een spelerslijst, filtert automatisch nummers/coachnamen
- **Geluid + vibratie**: Fluitsignaal via Tone.js, verschillende trilpatronen
- **Confetti**: Bij doelpunten
- **iOS geoptimaliseerd**: Landscape lock hint, wake lock, safe-area insets

## Configureerbare Parameters

- Speelduur per helft (minuten)
- Aantal spelers op het veld (minimum 3)
- Wisselinterval (automatische prompts elke N minuten)
- Team namen (thuis/uit)
- Keeper slot (aparte regels)

## Design

- Licht thema (geen dark mode)
- Primaire kleur: `#16A34A` (groen)
- Keeper kleur: `#D97706` (oranje)
- Dilettant club logo als custom SVG

## Productie

- **Geen server nodig**: Statisch HTML bestand, draait volledig client-side
- **Gebruik**: Ed opent de PWA op zijn iPhone langs het voetbalveld
- **Deployment**: Open `index.html` in Safari → Deel → Zet op beginscherm
- **Offline**: Service Worker cachet alles, werkt zonder internet

## Belangrijk

- **Geen database**: Alle state zit in React component state (weg na refresh)
- **Geen build**: Direct openen in browser, wijzigingen direct zichtbaar
- **Standalone**: Geen relatie met andere Ed Struijlaart projecten
- **PWA**: Installeerbaar op iOS homescreen voor gebruik langs de lijn
