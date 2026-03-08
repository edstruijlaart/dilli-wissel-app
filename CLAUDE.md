# Dilli Wissel App v3

## Waarom dit project bestaat

Ed is voetbalcoach bij v.v. Dilettant (jeugdteam van zijn zoontje). Deze app regelt
eerlijke speeltijdverdeling tijdens wedstrijden. Ouders, opa's en oma's kunnen live
meekijken via een deelbare 4-letter code: score, timer, wissels, audio-updates en foto's.

**Eigenaar**: Ed Struijlaart
**Status**: Actief productie — v3.21.0
**URL**: https://dilli.edstruijlaart.nl
**Vercel project**: `ed-struijlaarts-projects/dilli-wissel-app`

---

## Tech Stack

| Component | Technologie | Doel |
|-----------|-------------|------|
| Framework | React 18 + Vite 6 | Frontend + build |
| PWA | vite-plugin-pwa (injectManifest) | Installeerbaar + push notifications |
| Push | Web Push API + web-push | Coach/kijker notificaties (VAPID) |
| Styling | Inline CSS-in-JS | Geen build-stap voor styles |
| Fonts | Google Fonts | DM Sans + JetBrains Mono |
| Audio (tonen) | Tone.js 14 | Fluitsignalen |
| Data (match state) | Vercel KV (`@upstash/redis`) | Match state + events (TTL 8 uur) |
| Data (audio/foto) | Vercel Blob (`@vercel/blob`) | Audio webm + JPEG foto's |
| API | Vercel Serverless Functions | `/api/match/*` routes |
| Hosting | Vercel | Auto-deploy bij git push |

---

## Volledige Bestandsstructuur

```
dilli-wissel-app/
├── index.html                    # Vite entry, dynamisch manifest op basis van URL
├── package.json                  # v3.20.0
├── vite.config.js                # Vite + React + PWA config (injectManifest)
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
│   ├── secretariaat/
│   │   └── verify.js            # Secretariaat authenticatie verificatie
│   ├── _lib/
│   │   ├── redis.js             # Upstash Redis client + MATCH_TTL
│   │   └── push.js              # Web Push utility: sendPush, sendPushToAll, checkDedup
│   ├── push/
│   │   ├── subscribe.js         # POST: PushSubscription opslaan (coach/viewer)
│   │   ├── vapid-key.js         # GET: VAPID public key ophalen
│   │   └── test.js              # GET: push diagnostics, POST: test push met per-device resultaten
│   ├── kleedkamers.js           # GET/PUT: kleedkamer toewijzingen (Vercel KV)
│   ├── schedule.js              # GET: VoetbalAssist proxy (wedstrijdprogramma, cache 5 min)
│   └── match/
│       ├── create.js            # POST: wedstrijd aanmaken, 4-letter code genereren
│       ├── live.js              # GET: live wedstrijden overzicht (voor HomeView)
│       ├── save.js              # POST: wedstrijd opslaan in historie (permanent KV, max 100/team)
│       ├── [code].js            # GET/PUT: match state + server-side coach push checks
│       ├── events/
│       │   └── [code].js        # GET/POST: event log + viewer push bij goals/wissels/einde
│       ├── audio/
│       │   └── [code].js        # GET/POST/DELETE: audio messages (Vercel Blob)
│       └── photo/
│           └── upload.js        # POST/DELETE: foto upload (Vercel Blob, BLOB2 token)
│
└── src/
    ├── main.jsx                  # React root mount
    ├── version.js                # VERSION constante — update bij elke release!
    ├── sw.js                     # Custom Service Worker: push + notificationclick + Workbox precaching
    ├── App.jsx                   # Hoofd router: HomeView | SetupView | MatchView | SummaryView | ViewerView | AdminView | SecretariaatView
    ├── theme.js                  # Design tokens: kleuren, card, btnP, btnS, btnD, mono
    │
    ├── data/
    │   └── formations.js           # 8 standaard formaties (4-3-3 t/m 4-5-1) + assignPlayersToFormation() + FORMATION_KEYS
    │
    ├── utils/
    │   ├── format.js             # fmt(seconds) → "mm:ss", parseNames()
    │   ├── audio.js              # playWhistle(), vibrate(), notifyGoal() via Tone.js
    │   ├── confetti.js           # fireConfetti() canvas animatie bij doelpunten
    │   └── pushNotifications.js  # isPushSupported, subscribeToPush, isIOS, isInstalledPWA
    │
    ├── hooks/
    │   ├── useMatchState.js      # CENTRALE STATE: alle wedstrijd state + wisselalgoritme
    │   │                         # Exporteert: addEvent, updateScore, startTimer, executeSubs,
    │   │                         #   skipSubs, editSubProposal, excludePlayer, swapKeeper, etc.
    │   │                         # Pure functions: generateSubSchedule(), recalculateRemainingSlots()
    │   │                         # State: subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot
    │   └── useMatchPolling.js    # Viewer polling: GET /api/match/{code} elke 5s
    │                             # Returnt: match, events, getElapsed(), getSubElapsed()
    │
    ├── components/
    │   ├── FieldView.jsx         # SVG voetbalveld: speler markers, drag & drop, rugnummers, keeper/goal iconen
    │   │                         # Props: onField, playerPositions, squadNumbers, matchKeeper, interactive,
    │   │                         #   onPositionChange (drag), onPlayerTap (wissel), goalScorers
    │   ├── FormationPicker.jsx   # Horizontale formatie-selector (8 standaard + "Vrij")
    │   │                         # Props: value, onChange
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
    │   ├── PushPermissionBanner.jsx # Push notificatie permissie banner (coach + viewer)
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
        │                         #   Audio + Foto knoppen (alleen tijdens lopende wedstrijd)
        │                         #   Keeper picker
        │                         #   Rust kaart (als halfBreak)
        │                         #   Wissel alert (editable dropdowns, skip-waarschuwing)
        │                         #   Veld (spelers in het veld, klik voor handmatige wissel)
        │                         #   Bank (bankspelers) + excluded players banner
        │                         #   Wisselschema preview (inklapbaar, status per slot)
        │                         #   Blessure/Uitsluiting knop + injury picker overlay
        │                         #   Updates feed (AudioTimeline isCoach=true, onderaan)
        ├── ViewerView.jsx        # KIJKER LIVE VIEW
        │                         # Volgorde van boven naar onder:
        │                         #   Header (team, code, status indicator)
        │                         #   Timer
        │                         #   Score
        │                         #   Laatste Update (AudioTimeline maxItems=1)
        │                         #   Rust kaart
        │                         #   Veld (read-only)
        │                         #   Bank (read-only)
        │                         #   Gebeurtenissen (goals + wissels, geen foto's)
        ├── SummaryView.jsx       # Na afloop: speeltijd statistieken, wisselgeschiedenis,
        │                         #   schema-adherence stats (uitgevoerd/overgeslagen/%),
        │                         #   excluded players, wedstrijd opslaan
        ├── AdminView.jsx         # Admin panel: wedstrijden + teams beheren
        └── SecretariaatView.jsx  # Secretariaat: programma (VoetbalAssist), live wedstrijden, kleedkamers
```

---

## Features Overzicht

### Coach
- **Setup**: spelers invoeren (handmatig of clipboard paste), keeper aanwijzen, config instellen
- **Live timer**: helft/halves, progressbar, wissel countdown, pause, blessuretijd
- **Score**: +/- knoppen, doelpuntscorer popup (wie scoorde?)
- **Push notifications** (v3.20.0): Web Push API voor coach + kijker, ook bij scherm uit
  - Coach: wisseladvies, rust, einde wedstrijd, blessuretijd voorbij (server-side timer detection)
  - Kijker: goals, wissels, rust, einde wedstrijd, foto's (event-triggered)
  - iOS: installatie-prompt voor PWA (push vereist homescreen installatie)
- **Wisselalgoritme** (v3.18.0): pre-berekend wisselschema voor maximale eerlijke speeltijd
  - `generateSubSchedule()` berekent volledig schema bij match start over alle helften
  - `subsPerSlot = max(1, min(B, min(fieldSlots, round(B*I/D))))` — optimaal aantal wissels per moment
  - Editable sub alert: coach kan wisselparen aanpassen via dropdowns (met duplicate prevention)
  - Latency-compensatie: `subTimer` start op overshoot waarde, niet op 0
  - Schema herberekening bij: skip, blessure, edit, keeper-swap
  - Skip-waarschuwing na 2+ overgeslagen wissels
  - Wisselschema preview: inklapbaar overzicht met status icons (✅ ⏭️ 🔄 ⏳)
  - Blessure/Uitsluiting: speler mid-match uit pool halen, auto-vervanging + schema herberekening
  - Schema-adherence statistieken in SummaryView (uitgevoerd/overgeslagen/percentage)
  - Handmatig tap-to-sub blijft beschikbaar naast schema
- **Multi-coach sync**: meerdere coaches delen dezelfde wedstrijd, server is single source of truth.
  Coaches pollen elke 3s, adopteren wijzigingen van andere coaches (score, wissels, helft, timer).
  Anti-echo guards (`_coachId` + `isAdoptingRef`) voorkomen sync-loops.
- **Keeper swap**: andere keeper aanwijzen tijdens wedstrijd (triggert schema herberekening bij bank→veld swap)
- **Audio update**: opnemen (webm), optioneel bericht (60 tekens), upload naar Vercel Blob
- **Foto**: camera of bibliotheek, compressie, optionele caption (80 tekens), upload
- **Updates beheren**: alle audio/foto updates zien, verwijderen (× knop)
- **Confetti + geluid + vibratie**: bij doelpunten
- **Wake lock**: scherm blijft aan tijdens wedstrijd
- **Tactiek modus** (v3.15.0): voor JO13+ / 11v11 teams
  - Twee team-modi: `"speeltijd"` (default, gelijke speeltijd) vs `"tactiek"` (formaties, geen auto-wissels)
  - SVG voetbalveld (FieldView) met drag & drop speler positionering
  - 8 standaard formaties (4-3-3, 4-4-2, etc.) + "Vrij" (custom posities)
  - Rugnummers (squadNumbers) per speler, configureerbaar in Admin
  - Formatie wisselen tijdens wedstrijd, positie-overdracht bij wissel
  - Keeper apart gemarkeerd, doelpuntenmakers met ⚽ indicator
  - Admin: mode toggle, formatie dropdown, rugnummer inputs per team

### Kijker
- **Live volgen**: score, timer, veld/bank bezetting via polling (5s interval)
- **Push notifications**: goals, wissels, rust, einde, foto's — ook bij app op achtergrond
- **Tactiek view**: FieldView (read-only) met formatie, rugnummers en posities (als coach tactiek modus gebruikt)
- **Laatste update**: meest recente audio of foto bovenaan
- **Doelpunt notificatie**: confetti + toast bij goals
- **Foto's bekijken**: fullscreen tap in Updates feed

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
  - type: 'goal_home' | 'goal_away' | 'sub_auto' | 'sub_manual' | 'photo' | 'half_end' | ...
  - time, half, url (foto), caption (foto), scorer (goal)
  → Bij POST: buildViewerPush() stuurt push naar alle viewer subscriptions
```

### Push Notifications (Web Push API)
```
Coach/Kijker → subscribeToPush() → POST /api/push/subscribe
  → KV: push:{CODE}:coach | push:{CODE}:viewer (array van PushSubscriptions)

Coach push (server-side): GET /api/match/{code} checkt timer milestones
  → Dedup via KV: push:sub:{CODE}:{half}:{slot} | push:half:{CODE}:{half} | push:end:{CODE}
  → sendPushToAll(code, 'coach', payload)

Kijker push (event-triggered): POST /api/match/events/{code}
  → buildViewerPush(event, score) → sendPushToAll(code, 'viewer', payload)
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

---

## Vercel Environment Variables

| Variabele | Gebruik |
|-----------|---------|
| `KV_REST_API_URL` | Vercel KV (match state + events) |
| `KV_REST_API_TOKEN` | Vercel KV token |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (audio) |
| `BLOB2_READ_WRITE_TOKEN` | Vercel Blob (foto's, apart store) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `VAPID_SUBJECT` | Web Push contact (`mailto:ed@edstruijlaart.nl`) |
| `ADMIN_PASSWORD` | Admin panel toegang |
| `SECRETARIAAT_PASSWORD` | Secretariaat panel toegang |

---

## Design System

Alle design tokens in `src/theme.js`:

```javascript
T.accent      // #16A34A  — groen (primair)
T.warn        // #D97706  — oranje (keeper, rust)
T.danger      // #DC2626  — rood (stop, alerts)
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
| Audio message niet zichtbaar | Blob metadata via `addMetadata` — check of `blob.metadata?.message` beschikbaar is in list() |
| foto's niet in feed | Events API URL was `/api/match/{code}/events` maar moet zijn `/api/match/events/{code}` |
| **VAPID env vars met newlines** | Vercel dashboard plakt trailing `\n` mee bij env vars. Crasht `webpush.setVapidDetails()` op module-niveau → ALLE push-gerelateerde API routes crashen. Fix: `.trim()` in `push.js` + `vapid-key.js`. Bij nieuwe keys: `printf 'KEY' \| vercel env add` (geen echo, geen newline) |
| Push werkt niet na VAPID key wissel | Oude PushSubscriptions zijn gekoppeld aan oude VAPID key. Gebruiker moet "Herregistreer push" tappen in PushPermissionBanner of PWA herinstalleren |
| Test push crasht (FUNCTION_INVOCATION_FAILED) | Check VAPID keys: `curl /api/push/test?matchCode=TEST` toont key lengths. Als 0 of abnormaal: keys opnieuw zetten |
| iOS push niet op vergrendelscherm | iOS vereist handmatig: Instellingen → Meldingen → Dilli Wissel → Toegangsscherm aan. App toont eenmalige tip na eerste subscribe (v3.21.0) |

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

**CoachCast is een APART project.** CoachCast (`~/Projecten/coachcast/`) is geforkt van
Dilli en heeft eigen KV namespace (`cc:` prefix) en eigen Blob paden (`cc/` prefix).
Wijzigingen in Dilli komen NOOIT automatisch terecht in CoachCast en vice versa.

| Eigenschap | Dilli Wissel App | CoachCast |
|-----------|-----------------|-----------|
| Doel | Persoonlijk gebruik Ed (Dilettant) | Validatie-MVP voor SaaS |
| URL | https://dilli.edstruijlaart.nl | Eigen domein (coachcast.app) |
| Vercel project | `dilli-wissel-app` | `coachcast` |
| KV prefix | `match:` (geen prefix) | `cc:match:` |
| Blob prefix | `match/` (geen prefix) | `cc/match/` |
| Repo | `edstruijlaart/dilli-wissel-app` | `edstruijlaart/coachcast` |
| GitHub | Private | Private |

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
| **Club Starter** | €149/seizoen | 5 | 5 | + Foto's, eigen logo/naam, club admin |
| **Club Pro** | €299/seizoen | Onbeperkt | Onbeperkt | + Volledig white-label, seizoensstatistieken, PDF export |

Optioneel: jaarlicenties met 15% korting (Coach Solo €69/jaar, Starter €259/jaar, Pro €499/jaar) om churn te reduceren.

### Marktpositie

**0 directe concurrenten** die speeltijdverdeling + ouder-engagement combineren.
- Spond: communicatie, geen wedstrijdbeheer
- GameChanger: live scoring (VS, baseball), geen speeltijd
- SubTime / Fair Play Time: speeltijd alleen, geen live, geen ouders

**Killer USP:** "Opa en oma luisteren live mee met de wedstrijd van hun kleinkind."

### Financieel Overzicht

| | Jaar 1 | Jaar 2 | Jaar 3 |
|--|--------|--------|--------|
| Omzet (realistisch) | €21.000 | €62.000 | €140.000 |
| Hostingkosten | €1.200 | €6.600 | €6.500 |
| Netto marge | ~94% | ~89% | ~95% |
| Break-even | 30–40 klanten | — | — |

### Te Bouwen (SaaS Laag — 4–6 weken)

- [ ] Domein registreren: coachcast.app + coachcast.io
- [ ] User accounts (FastAPI backend, Pi :8094, JWT auth)
- [ ] PostgreSQL schema (users, clubs, teams, matches, subscriptions)
- [ ] White-label configuratie (logo upload, naam, teamnamen)
- [ ] Mollie betaalflow (seizoensbetaling + webhook)
- [ ] Feature gates (check subscription bij audio/foto)
- [ ] Club admin portal (teams + coaches beheren)
- [ ] Coaches uitnodigen via magic link (Resend)
- [ ] Privacy statement + verwerkersovereenkomst (GDPR, minderjarigen)
- [ ] Landing page (coachcast.app)

### Risico's (Samenvatting)

| Risico | Niveau | Mitigatie |
|--------|--------|-----------|
| Ed's beschikbare tijd | Hoog | Zero-beheer architectuur, strikte scope |
| Seizoensgebonden churn | Hoog | Jaarlicentie optie + automatische herinnering |
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
| Audio staat stil — juist dat verkoopt het | Pre-recorded audio update, of toon UI zonder geluid |
| Iemand kaapt de demo-match (code DEMO is publiek) | Coach-route voor DEMO vergrendelen (wachtwoord of IP-check) |
| Vercel KV TTL gooit match weg na 8 uur | Cron job reset demo-match dagelijks, of TTL uitschakelen voor demo-key |
| Viewer-demo toont alleen output, niet de coach-kant | Screen recording toont coach-kant, live demo toont viewer-kant — beiden nodig |
| 50-80 gelijktijdige viewers max (Vercel free tier) | Geen issue in validatiefase, upgrade pas bij schaal |

**Conclusie:** Fase 0 (screen recording) is de juiste first step. Fase 1 (live demo) bouw je pas als de SaaS-laag staat en je echte wedstrijden kunt doorsluizen als social proof.
