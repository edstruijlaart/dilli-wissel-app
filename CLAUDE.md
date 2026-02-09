# Dilli Wissel App v3

## Waarom dit project bestaat

Ed is voetbalcoach bij v.v. Dilettant (jeugdteam van zijn zoontje). Deze app regelt
eerlijke speeltijdverdeling tijdens wedstrijden. Ouders, opa's en oma's kunnen straks
live meekijken via een deelbare link.

**Eigenaar**: Ed Struijlaart
**Status**: Actief — Fase 1 (Vite migratie) compleet, Fase 2 (multiplayer) in planning

## Tech Stack

| Component | Technologie |
|-----------|-------------|
| Framework | React 18 |
| Bundler | Vite 6 |
| Audio | Tone.js 14 (fluitsignalen) |
| Styling | Inline CSS-in-JS |
| Fonts | Google Fonts (DM Sans, JetBrains Mono) |
| PWA | vite-plugin-pwa (Workbox) |
| Hosting | Vercel (toekomst: `dilli.edstruijlaart.nl`) |
| Data (fase 2) | Vercel KV (polling, geen WebSockets) |

## Architectuur

### Fase 1 (huidige staat): Standalone PWA

```
dilli-wissel-app/
├── index.html              # Vite entry point
├── package.json            # Dependencies
├── vite.config.js          # Vite + React + PWA plugins
├── vercel.json             # SPA rewrites
├── CLAUDE.md               # Dit bestand
├── public/
│   └── icons/              # PWA iconen (192, 512)
└── src/
    ├── main.jsx            # React root mount
    ├── App.jsx             # View router (SETUP | MATCH | SUMMARY)
    ├── theme.js            # Kleuren, stijlen, globalStyles CSS
    ├── utils/
    │   ├── format.js       # fmt() tijdformatter, parseNames()
    │   ├── audio.js        # playWhistle(), vibrate patronen
    │   └── confetti.js     # fireConfetti() canvas animatie
    ├── hooks/
    │   └── useMatchState.js  # Alle state + wisselalgoritme + acties
    ├── components/
    │   ├── Icons.jsx       # Alle SVG iconen
    │   ├── DilliLogo.jsx   # v.v. Dilettant club logo
    │   ├── Badge.jsx       # Veld/Bank/Keeper badges
    │   └── Stepper.jsx     # Numerieke +/- stepper
    └── views/
        ├── SetupView.jsx   # Spelers invoeren + config
        ├── MatchView.jsx   # Live wedstrijd (timer, score, wissels)
        └── SummaryView.jsx # Statistieken na afloop
```

### Fase 2 (gepland): Multiplayer

```
Toevoegingen:
├── api/
│   └── match/
│       ├── create.js       # POST: wedstrijd aanmaken, code genereren
│       ├── [code].js       # GET/PUT: wedstrijd state ophalen/updaten
│       └── [code]/events.js # GET/POST: event log
└── src/
    ├── hooks/
    │   └── useMatchPolling.js  # Poll /api/match/{code} elke 5s
    └── views/
        ├── HomeView.jsx    # Start/join scherm
        ├── JoinView.jsx    # 4-letter code invoeren
        └── ViewerView.jsx  # Read-only live view
```

## Drie Views

1. **SETUP** — Spelers invoeren (handmatig of plakken), keeper aanwijzen, wedstrijdinstellingen
2. **MATCH** — Live timer, veld/bank weergave, wisselwaarschuwingen, score bijhouden
3. **SUMMARY** — Speeltijdstatistieken, wisselgeschiedenis

## Key Features

- **Fair rotation**: Wisselalgoritme sorteert op minst gespeelde tijd
- **Clipboard parsing**: Plak een spelerslijst, filtert automatisch nummers/coachnamen
- **Geluid + vibratie**: Fluitsignaal via Tone.js, verschillende trilpatronen
- **Confetti**: Bij doelpunten (canvas animatie)
- **iOS geoptimaliseerd**: Landscape lock hint, wake lock, safe-area insets
- **PWA**: Installeerbaar op homescreen, offline via Workbox service worker

## Configureerbare Parameters

- Speelduur per helft (minuten)
- Aantal helften (2-4)
- Aantal spelers op het veld (minimum 3)
- Wisselinterval (automatische prompts elke N minuten)
- Team namen (thuis/uit)
- Keeper slot (aparte regels)

## Design

- Licht thema (geen dark mode)
- Primaire kleur: `#16A34A` (groen)
- Keeper kleur: `#D97706` (oranje)
- v.v. Dilettant club logo als custom SVG

## Ontwikkeling

```bash
npm run dev      # Start Vite dev server
npm run build    # Productie build → dist/
npm run preview  # Preview productie build
```

## Productie

- **Huidige staat**: Lokaal ontwikkelen, PWA installeren via `npm run build` + preview
- **Toekomst (fase 2)**: Vercel deploy op `dilli.edstruijlaart.nl`
- **Legacy versie**: Originele single-file app staat op `legacy` branch

## Git Branches

- `main` — v3 (Vite + React componenten)
- `legacy` — v2 (originele 852-regel index.html, standalone)

## Upgrade Roadmap

Zie planbestand: `~/.claude/plans/synchronous-orbiting-hellman.md`

- **Fase 1** ✅ Vite + React migratie (componenten, build pipeline)
- **Fase 2** 📋 Multiplayer (Vercel KV, polling, rollen, deelbare links)
- **Fase 3** 📋 Uitbreidingen (doelpuntscorer popup, notificaties, geschiedenis)

## Relatie met andere projecten

Standalone privéproject. Geen directe relatie met Ed's muziek/podcast projecten.
Draait straks op Vercel (zelfde account als edstruijlaart.nl, apart project).
