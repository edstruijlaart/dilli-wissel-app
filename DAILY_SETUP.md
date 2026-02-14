# Daily.co Setup - Live Audio Streaming

De Dilli Wissel App gebruikt **Daily.co** voor live audio streaming (coach naar viewers).

## Setup Stappen

### 1. Daily.co Account Aanmaken

1. Ga naar https://dashboard.daily.co/signup
2. Maak gratis account aan (geen creditcard nodig)
3. Gratis tier: **10.000 minuten/maand** (= 166 uur, meer dan genoeg)

### 2. API Key Ophalen

1. Log in op https://dashboard.daily.co
2. Ga naar **Settings** → **Developers**
3. Kopieer je **API Key** (begint met een lange string)

### 3. Domain Naam (optioneel)

Je Daily.co domain is standaard: `your-username.daily.co`

Als je een custom domain wilt (bijv. `dilli-wissel.daily.co`):
1. Ga naar **Settings** → **Domain**
2. Kies een custom domain naam
3. Noteer de naam

### 4. Vercel Environment Variables

Voeg toe in Vercel dashboard:

**Production + Preview + Development:**

```
DAILY_API_KEY=your_api_key_here
DAILY_DOMAIN=dilli-wissel (of je custom domain naam, zonder .daily.co)
```

**Stappen:**
1. Ga naar https://vercel.com/ed-struijlaarts-projects/dilli-wissel-app/settings/environment-variables
2. Klik **Add New**
3. Name: `DAILY_API_KEY`
4. Value: [plak je API key]
5. Environment: **All** (Production, Preview, Development)
6. Klik **Save**
7. Herhaal voor `DAILY_DOMAIN`

### 5. Redeploy

Na het toevoegen van environment variables:
1. Ga naar **Deployments** tab
2. Klik op **...** bij laatste deployment
3. Klik **Redeploy**

OF gewoon een nieuwe commit pushen triggert automatisch deployment.

### 6. Testen

**Coach mode:**
1. Start een wedstrijd (online mode)
2. Klik "Start live audio"
3. Je ziet: "🔴 LIVE AUDIO - 1 luisteraar" (jezelf)

**Viewer mode:**
1. Open de deellink in een andere browser/telefoon
2. Klik "Luister live mee"
3. Je hoort de coach live

## Hoe het werkt

- **Coach**: Drukt op "Start live audio" → Daily.co room wordt aangemaakt → Microfoon gaat aan
- **Viewers**: Zien "Luister live mee" knop → Joinen de room → Horen coach live
- **Audio-only**: Geen video, licht op batterij
- **WebRTC**: Lage latency (~100-300ms)
- **Auto-cleanup**: Rooms vervallen na 24 uur

## Kosten

- **Gratis tier**: 10.000 minuten/maand
- **Schatting**: ~50 wedstrijden/maand à 90 minuten = 4.500 min/maand
- **Conclusie**: Ruim binnen gratis tier

Als je meer nodig hebt:
- **Pro plan**: $99/maand, 100.000 minuten

## Troubleshooting

**"Daily.co not configured" error:**
- Check of DAILY_API_KEY in Vercel staat
- Redeploy na toevoegen env vars

**"Failed to create audio room":**
- Check of API key klopt
- Check Daily.co dashboard of je gratis tier nog minuten heeft

**Geen audio:**
- Check microfoon permissies in browser
- iOS: werkt alleen als PWA geïnstalleerd (Safari beperking)
- Android: werkt in alle browsers

**Veel latency:**
- Normaal: 100-300ms
- Bij slechte verbinding: tot 1-2 seconden
- Check internetsnelheid coach (upload!) en viewers (download)

## Links

- Daily.co Dashboard: https://dashboard.daily.co
- Docs: https://docs.daily.co
- React SDK: https://docs.daily.co/reference/daily-js
