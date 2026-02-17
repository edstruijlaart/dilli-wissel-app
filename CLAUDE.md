# Dilli Wissel App v3

## Waarom dit project bestaat

Ed is voetbalcoach bij v.v. Dilettant (jeugdteam van zijn zoontje). Deze app regelt
eerlijke speeltijdverdeling tijdens wedstrijden. Ouders, opa's en oma's kunnen live
meekijken via een deelbare 4-letter code: score, timer, wissels, audio-updates en foto's.

**Eigenaar**: Ed Struijlaart
**Status**: Actief productie — v3.6.x
**URL**: https://dilli.edstruijlaart.nl
**Vercel project**: `ed-struijlaarts-projects/dilli-wissel-app`

---

## Tech Stack

| Component | Technologie | Doel |
|-----------|-------------|------|
| Framework | React 18 + Vite 6 | Frontend + build |
| PWA | vite-plugin-pwa (Workbox) | Installeerbaar op homescreen |
| Styling | Inline CSS-in-JS | Geen build-stap voor styles |
| Fonts | Google Fonts | DM Sans + JetBrains Mono |
| Audio (tonen) | Tone.js 14 | Fluitsignalen |
| Live audio | LiveKit (`livekit-client` + `livekit-server-sdk`) | WebRTC audio streaming coach → kijkers |
| Data (match state) | Vercel KV (`@upstash/redis`) | Match state + events (TTL 8 uur) |
| Data (audio/foto) | Vercel Blob (`@vercel/blob`) | Audio webm + JPEG foto's |
| API | Vercel Serverless Functions | `/api/match/*` routes |
| Hosting | Vercel | Auto-deploy bij git push |

---

## Volledige Bestandsstructuur

```
dilli-wissel-app/
├── index.html                    # Vite entry, dynamisch manifest op basis van URL
├── package.json                  # v3.6.x
├── vite.config.js                # Vite + React + PWA config
├── vercel.json                   # SPA rewrites + API routes
├── CLAUDE.md                     # Dit bestand
│
├── public/
│   ├── favicon.svg               # v.v. Dilettant club logo (SVG, uit DilliLogo.jsx)
│   ├── admin-manifest.json       # PWA manifest voor /admin route
│   └── icons/
│       ├── icon-192.png          # PWA icon (klein)
│       └── icon-512.png          # PWA icon (groot)
│
├── api/                          # Vercel Serverless Functions
│   ├── auth/
│   │   └── verify.js            # Coach authenticatie verificatie
│   ├── admin/
│   │   ├── teams.js             # Admin: teams beheren
│   │   ├── matches.js           # Admin: wedstrijden overzicht
│   │   └── delete-match.js      # Admin: wedstrijd verwijderen
│   └── match/
│       ├── create.js            # POST: wedstrijd aanmaken, 4-letter code genereren
│       ├── live.js              # GET: live wedstrijden overzicht (voor HomeView)
│       ├── [code].js            # GET/PUT: match state (Vercel KV)
│       ├── events/
│       │   └── [code].js        # GET/POST: event log (goals, wissels, foto's, audio_start)
│       ├── audio/
│       │   └── [code].js        # GET/POST/DELETE: audio messages (Vercel Blob)
│       ├── audio-token/
│       │   └── [code].js        # POST: LiveKit JWT token genereren
│       └── photo/
│           └── upload.js        # POST/DELETE: foto upload (Vercel Blob, BLOB2 token)
│
└── src/
    ├── main.jsx                  # React root mount
    ├── version.js                # VERSION constante — update bij elke release!
    ├── App.jsx                   # Hoofd router: HomeView | MatchView | SummaryView | ViewerView | AdminView
    ├── theme.js                  # Design tokens: kleuren, card, btnP, btnS, btnD, mono
    │
    ├── utils/
    │   ├── format.js             # fmt(seconds) → "mm:ss", parseNames()
    │   ├── audio.js              # playWhistle(), vibrate(), notifyGoal() via Tone.js
    │   └── confetti.js           # fireConfetti() canvas animatie bij doelpunten
    │
    ├── hooks/
    │   ├── useMatchState.js      # CENTRALE STATE: alle wedstrijd state + wisselalgoritme
    │   │                         # Exporteert: addEvent, updateScore, startTimer, etc.
    │   └── useMatchPolling.js    # Viewer polling: GET /api/match/{code} elke 5s
    │                             # Returnt: match, events, getElapsed(), getSubElapsed()
    │
    ├── components/
    │   ├── Icons.jsx             # SVG iconen: football, timer, swap, play, pause, check,
    │   │                         # x, eye, microphone, camera, image, glove, whistle, etc.
    │   ├── DilliLogo.jsx         # v.v. Dilettant club logo SVG component
    │   ├── Badge.jsx             # Status badges: "Veld", "Bank", "Keeper"
    │   ├── Stepper.jsx           # Numerieke +/- stepper (setup config)
    │   ├── AudioRecorder.jsx     # Opnemen + uploaden audio update (coach)
    │   │                         # Props: matchCode, matchTime, currentHalf, onClose, onUploaded
    │   │                         # Features: record, stop, preview, optioneel bericht (60 tekens)
    │   ├── AudioTimeline.jsx     # Gecombineerde Updates feed: audio + foto's samen
    │   │                         # Props: matchCode, isCoach, maxItems
    │   │                         # Coach (isCoach=true): alle updates, × delete knop voor audio + foto
    │   │                         # Viewer (maxItems=1): alleen laatste update ("Laatste Update")
    │   │                         # Polt elke 10s (audio via Blob list, foto's via events API)
    │   ├── LiveAudio.jsx         # LiveKit WebRTC audio streaming
    │   │                         # Coach: start/stop microfoon, mute knop, luisteraars teller
    │   │                         # Viewer: verbindt alleen als er echt audio tracks zijn (geen false positive)
    │   │                         #   → 5s timeout: geen stream → status 'no_stream'
    │   │                         #   → TrackSubscribed: pas dan status 'connected'
    │   └── PhotoCapture.jsx      # Camera + bibliotheek foto upload (coach)
    │                             # Props: matchCode, onClose, onPhotoUploaded({url, caption})
    │                             # Features: camera (environment-facing), bibliotheek kiezen,
    │                             #   compressie (max 1920x1080, JPEG 80%), optionele caption (80 tekens)
    │
    └── views/
        ├── HomeView.jsx          # Startscherm: live wedstrijden + coach login + viewer join
        │                         # Viewer-first UI: grote "Kijk live mee" knop
        ├── SetupView.jsx         # Coach setup: spelers, keeper, config
        ├── MatchView.jsx         # COACH LIVE VIEW
        │                         # Volgorde van boven naar onder:
        │                         #   Online indicator (code, viewers)
        │                         #   Timer card (helft, tijd, progressbar, wissel countdown)
        │                         #   Scoreboard (+ doelpuntscorer popup)
        │                         #   Live Audio component (coach zend, viewers luisteren)
        │                         #   Audio + Foto knoppen (alleen tijdens lopende wedstrijd)
        │                         #   Keeper picker
        │                         #   Rust kaart (als halfBreak)
        │                         #   Wissel alert (automatisch)
        │                         #   Veld (spelers in het veld, klik voor handmatige wissel)
        │                         #   Bank (bankspelers)
        │                         #   Updates feed (AudioTimeline isCoach=true, onderaan)
        ├── ViewerView.jsx        # KIJKER LIVE VIEW
        │                         # Volgorde van boven naar onder:
        │                         #   Header (team, code, status indicator)
        │                         #   Timer
        │                         #   Score
        │                         #   Live Audio (Luister live mee knop)
        │                         #   Laatste Update (AudioTimeline maxItems=1)
        │                         #   Rust kaart
        │                         #   Veld (read-only)
        │                         #   Bank (read-only)
        │                         #   Gebeurtenissen (goals + wissels, geen foto's)
        │                         #   Subtiele banner bij stream start (+5s auto-dismiss)
        ├── SummaryView.jsx       # Na afloop: speeltijd statistieken, wisselgeschiedenis
        └── AdminView.jsx         # Admin panel: wedstrijden beheren
```

---

## Features Overzicht

### Coach
- **Setup**: spelers invoeren (handmatig of clipboard paste), keeper aanwijzen, config instellen
- **Live timer**: helft/halves, progressbar, wissel countdown, pause, blessuretijd
- **Score**: +/- knoppen, doelpuntscorer popup (wie scoorde?)
- **Wissels**: automatische wisseladviezen op interval, handmatig tap-to-sub
- **Keeper swap**: andere keeper aanwijzen tijdens wedstrijd
- **Audio update**: opnemen (webm), optioneel bericht (60 tekens), upload naar Vercel Blob
- **Foto**: camera of bibliotheek, compressie, optionele caption (80 tekens), upload
- **Live audio**: WebRTC via LiveKit, coach zendt microfoon uit, viewers luisteren
- **Updates beheren**: alle audio/foto updates zien, verwijderen (× knop)
- **Confetti + geluid + vibratie**: bij doelpunten
- **Wake lock**: scherm blijft aan tijdens wedstrijd

### Kijker
- **Live volgen**: score, timer, veld/bank bezetting via polling (5s interval)
- **Laatste update**: meest recente audio of foto bovenaan
- **Luister live mee**: als coach live audio uitzend (WebRTC, automatisch starten)
- **Doelpunt notificatie**: confetti + toast bij goals
- **Foto's bekijken**: fullscreen tap in Updates feed
- **Stream start banner**: subtiele groene banner als coach live gaat (+5s auto-dismiss)
- **Geen stream melding**: duidelijke melding als er geen actieve audio stream is

---

## Data Flow

### Match State (Vercel KV)
```
Coach → PUT /api/match/{code} → Redis (TTL 8u)
                                     ↓ poll elke 5s
                              Viewer GET /api/match/{code}
```

### Events (Vercel KV)
```
Coach addEvent() → POST /api/match/events/{code} → Redis array
  - type: 'goal_home' | 'goal_away' | 'sub' | 'photo' | 'live_audio_start'
  - time, half, url (foto), caption (foto), scorer (goal)
```

### Audio Updates (Vercel Blob)
```
Coach → AudioRecorder → POST /api/match/audio/{code}
  Headers: X-Match-Time, X-Half, X-Message (URL-encoded)
  Body: audio/webm blob
  Blob metadata: { matchTime, half, message }
  → Vercel Blob opgeslagen als: match/{code}/audio/{timestamp}-{time}-H{half}.webm
```

### Foto's (Vercel Blob)
```
Coach → PhotoCapture → POST /api/match/photo/upload
  Body: { matchCode, image (base64 JPEG), timestamp, caption }
  Blob metadata: { caption }
  BLOB2_READ_WRITE_TOKEN (aparte token!)
  → Vercel Blob opgeslagen als: match-{code}-{timestamp}.jpg
```

### Live Audio (LiveKit WebRTC)
```
Coach → POST /api/match/audio-token/{code} → JWT token
Coach → LiveKit Room (publish mic)
             ↓
Viewer → POST /api/match/audio-token/{code} → JWT token
Viewer → LiveKit Room (subscribe)
  → 5s timeout: als geen audio tracks → 'no_stream'
  → TrackSubscribed → 'connected' (echte audio)
```

---

## Vercel Environment Variables

| Variabele | Gebruik |
|-----------|---------|
| `KV_REST_API_URL` | Vercel KV (match state + events) |
| `KV_REST_API_TOKEN` | Vercel KV token |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (audio) |
| `BLOB2_READ_WRITE_TOKEN` | Vercel Blob (foto's, apart store) |
| `LIVEKIT_URL` | LiveKit server URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `ADMIN_PASSWORD` | Admin panel toegang |

---

## Design System

Alle design tokens in `src/theme.js`:

```javascript
T.accent      // #16A34A  — groen (primair)
T.warn        // #D97706  — oranje (keeper, rust)
T.danger      // #DC2626  — rood (live audio, stop)
T.text        // Hoofdtekst
T.textMuted   // Subtext
T.textDim     // Placeholder
T.glass       // Glassmorphism achtergrond
T.glassBorder // Glassmorphism rand

card    // Card stijl (border, borderRadius, padding)
btnP    // Primaire knop (groen)
btnS    // Secundaire knop (glas)
btnD    // Danger knop (rood)
mono    // JetBrains Mono font stijl
```

---

## Bekende Valkuilen

| Situatie | Oplossing |
|----------|-----------|
| Service worker cached oude versie | Hard refresh (Cmd+Shift+R) of PWA herinstalleren |
| `addEvent` undefined | Controleer return statement van `useMatchState.js` — alle exports moeten er in staan |
| Foto upload mislukt | Controleer BLOB2_READ_WRITE_TOKEN in Vercel env vars |
| Live audio "actief" zonder stream | Bug was: status 'connected' bij room connect ipv bij track ontvangst. Fix: viewers wachten op TrackSubscribed |
| Audio message niet zichtbaar | Blob metadata via `addMetadata` — check of `blob.metadata?.message` beschikbaar is in list() |
| foto's niet in feed | Events API URL was `/api/match/{code}/events` maar moet zijn `/api/match/events/{code}` |

---

## Ontwikkeling

```bash
npm run dev      # Start Vite dev server
npm run build    # Productie build → dist/
npm run preview  # Preview productie build
```

---

## Release Protocol

**ALTIJD bij elke deploy:**

1. **Versie updaten** in BEIDE bestanden:
   - `src/version.js` → `export const VERSION = '3.x.x';`
   - `package.json` → `"version": "3.x.x"`

2. **Type bepalen:**
   - Patch (3.x.**x**): bug fix, opruimen
   - Minor (3.**x**.0): nieuwe feature
   - Major (**x**.0.0): breaking change

3. **Deploy:**
```bash
git add -A
git commit -m "Release v3.x.x - [samenvatting]"
git push origin main
# Vercel deployt automatisch binnen ~2 min
```

4. **Testen**: hard refresh bij alle testdevices na deploy

---

## Git Branches

- `main` — Actieve productieversie (v3.x)
- `legacy` — v2 (originele 852-regel index.html, standalone zonder multiplayer)

---

## Relatie met andere projecten

Standalone privéproject voor Ed als voetbalcoach. Geen directe relatie met
muziek/podcast projecten. Draait volledig op Vercel (apart project van edstruijlaart.nl).

---

## Pijler: SaaS Transitie — CoachCast

**Status:** In voorbereiding — validatiefase (feb 2026)
**Doel:** White-label SaaS platform voor eerlijke speeltijdverdeling + live ouderbetrokkenheid bij jeugdsport
**Naam beslissing:** **CoachCast** (coachcast.app — nog registreren)
**Rapport:** `~/Desktop/SaaS-Analyse-Wissel-App.pdf` (volledig onderbouwd businessplan)

### Kernstrategie

- **White-label:** Clubs kopen licentie, configureren eigen logo/naam/teamnamen, coaches gebruiken het. Ed beheert niets na lancering.
- **Zero-beheer:** Self-service signup, Mollie betaalflow, geautomatiseerde emails. Geen klantenservice.
- **Naam:** CoachCast — internationaal, beschrijft de killer feature (coach broadcast live naar ouders), domein vrij.
- **Markt:** NL eerst (50.000 jeugdteams, 4.350 clubs), dan België, dan Europa.

### Pakketstructuur

| Pakket | Prijs | Teams | Coaches | Key features |
|--------|-------|-------|---------|--------------|
| **Coach Solo** | €39/seizoen | 1 | 1 | Timer, wissels, score, audio updates, kijkers live mee |
| **Club Starter** | €149/seizoen | 5 | 5 | + Foto's, live audio streaming, eigen logo/naam, club admin |
| **Club Pro** | €299/seizoen | Onbeperkt | Onbeperkt | + Volledig white-label, seizoensstatistieken, PDF export |

Optioneel: jaarlicenties met 15% korting (Coach Solo €69/jaar, Starter €259/jaar, Pro €499/jaar) om churn te reduceren.

### Marktpositie

**0 directe concurrenten** die speeltijdverdeling + live audio + ouder-engagement combineren.
- Spond: communicatie, geen wedstrijdbeheer
- GameChanger: live scoring (VS, baseball), geen speeltijd
- SubTime / Fair Play Time: speeltijd alleen, geen live, geen ouders

**Killer USP:** "Opa en oma luisteren live mee met de wedstrijd van hun kleinkind."

### Financieel Overzicht

| | Jaar 1 | Jaar 2 | Jaar 3 |
|--|--------|--------|--------|
| Omzet (realistisch) | €21.000 | €62.000 | €140.000 |
| Hostingkosten | €1.200 | €6.600 | €6.500 |
| Netto marge | ~94% | ~89% | ~95% (self-hosted LiveKit) |
| Break-even | 30–40 klanten | — | — |

**LiveKit:** Switch naar self-hosted Hetzner VPS (€40/mnd) zodra 50+ Club Starter klanten. Kosten dalen van ~€6.000 naar €480/jaar.

### Te Bouwen (SaaS Laag — 4–6 weken)

- [ ] Domein registreren: coachcast.app + coachcast.io
- [ ] User accounts (FastAPI backend, Pi :8094, JWT auth)
- [ ] PostgreSQL schema (users, clubs, teams, matches, subscriptions)
- [ ] White-label configuratie (logo upload, naam, teamnamen)
- [ ] Mollie betaalflow (seizoensbetaling + webhook)
- [ ] Feature gates (check subscription bij audio/foto/live audio)
- [ ] Club admin portal (teams + coaches beheren)
- [ ] Coaches uitnodigen via magic link (Resend)
- [ ] Privacy statement + verwerkersovereenkomst (GDPR, minderjarigen)
- [ ] Landing page (coachcast.app)

### Risico's (Samenvatting)

| Risico | Niveau | Mitigatie |
|--------|--------|-----------|
| Ed's beschikbare tijd | Hoog | Zero-beheer architectuur, strikte scope |
| Seizoensgebonden churn | Hoog | Jaarlicentie optie + automatische herinnering |
| LiveKit kosten bij schaal | Middel | Self-hosted VPS bij 50+ klanten |
| Betalingsbereidheid | Middel | Coach Solo (€39) als laagdrempelige instap |
| GDPR minderjarigen | Middel | Privacy statement + verwerkersovereenkomst |

### Validatieprotocol (Nu — Fase 0)

Doe dit VOOR je ook maar één regel SaaS-code schrijft:

1. Vraag 5 coaches buiten Dilettant het te gebruiken (gratis)
2. Meet: gebruiken ze het elke wedstrijd? Delen ouders de code?
3. Vraag direct: "Zou je €39 betalen voor een seizoen?"
4. **Go als:** 4 van 5 zeggen ja op de betaalvraag
5. **No-go als:** coaches stoppen na 3 wedstrijden of niemand wil betalen

### Naamrationale: CoachCast

- **Internationaal:** werkt in NL, Duitsland, Engeland zonder vertaling
- **Beschrijvend:** coach cast (broadcast) live naar ouders — precies wat het doet
- **Modern:** -cast suffix (podcast, Chromecast) signaleert streaming/live
- **Domein vrij:** coachcast.app + coachcast.io beschikbaar (feb 2026)
- **Geen rebranding nodig:** bij internationale expansie zelfde naam, andere taal UI

App-UI blijft initieel **Nederlands**. Naam en domein zijn internationaal. Zo deed Spond het ook.

---

### Landing Page Demo — Strategie & Grenzen

**Aanbevolen aanpak (gefaseerd):**

**Fase 0 — Coming soon pagina (week 1):**
- Embed een 45-60 seconden MP4 screen recording
- Coach-scherm + ouder-scherm naast elkaar
- Ed's stem als audio-update (killer feature zichtbaar)
- Waitlist formulier (Resend, naam + email)
- Geen backend nodig, werkt altijd

**Fase 1 — Echte landingspagina met "Kijk mee als ouder" knop:**
- Altijd-actieve demowedstrijd: vaste code `DEMO`
- Bezoeker tikt DEMO in, ziet het echte viewer-scherm
- Nep-activiteit via cron job (wissel, goal, timer tick) zodat het levendig oogt
- Optioneel: pre-recorded audio van Ed als coach-voice

**⚠️ Bekende beperkingen demo:**

| Probleem | Oplossing |
|----------|-----------|
| Demo-match lijkt dood (0-0, timer stil) | Cron job genereert nep-activiteit elke paar minuten |
| Audio staat stil — juist dat verkoopt het | Pre-recorded audio loop via LiveKit bot, of toon UI zonder geluid |
| Iemand kaapt de demo-match (code DEMO is publiek) | Coach-route voor DEMO vergrendelen (wachtwoord of IP-check) |
| Vercel KV TTL gooit match weg na 8 uur | Cron job reset demo-match dagelijks, of TTL uitschakelen voor demo-key |
| Viewer-demo toont alleen output, niet de coach-kant | Screen recording toont coach-kant, live demo toont viewer-kant — beiden nodig |
| 50-80 gelijktijdige viewers max (Vercel free tier) | Geen issue in validatiefase, upgrade pas bij schaal |
| LiveKit free tier: ~3.300 demo-sessies/mnd | Ruim genoeg tot 50+ clubs |

**Conclusie:** Fase 0 (screen recording) is de juiste first step. Fase 1 (live demo) bouw je pas als de SaaS-laag staat en je echte wedstrijden kunt doorsluizen als social proof.
