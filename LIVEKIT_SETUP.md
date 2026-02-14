# LiveKit Setup - Live Audio Streaming

De Dilli Wissel App gebruikt **LiveKit** voor live audio streaming (coach naar viewers).

## Waarom LiveKit?

✅ **Open source** - Geen vendor lock-in
✅ **Self-hostable** - Later op eigen Pi/NAS draaien (gratis)
✅ **Genereuze gratis tier** - Betere limits dan alternatieven
✅ **Low latency** - WebRTC, ~100-300ms delay
✅ **Audio-only** - Licht op batterij

## Setup Stappen

### 1. LiveKit Cloud Account (5 min)

1. Ga naar: https://cloud.livekit.io
2. Sign up (gratis, geen creditcard)
3. Maak een nieuw project:
   - Name: **Dilli Wissel**
   - Region: **Europe** (Amsterdam/Frankfurt)

### 2. API Credentials Ophalen (2 min)

1. In LiveKit dashboard → **Settings**
2. Kopieer:
   - **API Key** (lijkt op: `APIxxx...`)
   - **API Secret** (lijkt op: `xxx...`)
   - **WebSocket URL** (bijv: `wss://dilli-wissel-abc123.livekit.cloud`)

### 3. Vercel Environment Variables (2 min)

Voeg toe in Vercel dashboard:

1. Ga naar: https://vercel.com/ed-struijlaarts-projects/dilli-wissel-app/settings/environment-variables

2. Voeg 3 variables toe:

**Variable 1:**
- Name: `LIVEKIT_API_KEY`
- Value: [plak je API Key]
- Environments: **All** (Production + Preview + Development)

**Variable 2:**
- Name: `LIVEKIT_API_SECRET`
- Value: [plak je API Secret]
- Environments: **All**

**Variable 3:**
- Name: `LIVEKIT_URL`
- Value: [plak je WebSocket URL, bijv: `wss://dilli-wissel-abc123.livekit.cloud`]
- Environments: **All**

3. Klik **Save** na elke variable

### 4. Redeploy (1 min)

**Optie A:** Ga naar **Deployments** → klik **...** bij laatste deployment → **Redeploy**

**Optie B:** Push nieuwe commit (triggert auto-deploy)

---

## Testen

**Zodra env vars staan en app deployed is:**

### Test 1: Coach Mode

1. Start wedstrijd in **online mode**
2. Klik **"Start live audio"**
3. Microfoon permissie toestaan
4. Je ziet: **"🔴 LIVE AUDIO - 1 luisteraar"** (jezelf)

### Test 2: Viewer Mode

1. Open deellink op **andere telefoon/laptop**
2. Klik **"Luister live mee"**
3. Je hoort de coach live (met ~100-300ms delay)

---

## Hoe het werkt

```
Coach drukt "Start live audio"
  ↓
Backend genereert LiveKit access token (JWT)
  ↓
Coach microfoon gaat aan → audio stream naar LiveKit
  ↓
Viewers joinen zelfde room met token
  ↓
Audio wordt real-time gestreamd (WebRTC)
```

**Coach permissions:**
- `canPublish: true` → kan spreken
- `canSubscribe: true` → kan horen (zichzelf)

**Viewer permissions:**
- `canPublish: false` → kan alleen luisteren
- `canSubscribe: true` → hoort coach

---

## Gratis Tier Limits

LiveKit Cloud gratis tier:

- **50 GB/maand bandwidth**
- **Onbeperkt participants**
- **Onbeperkt rooms**

**Schatting:**
- Audio: ~50 kbps per stream
- 90 min wedstrijd = ~33 MB per viewer
- 10 viewers = 330 MB per wedstrijd
- **~150 wedstrijden/maand binnen gratis tier**

**Conclusie:** Ruim voldoende voor jeugdvoetbal.

---

## Self-Hosting (Later)

LiveKit is open source. Je kunt het later zelf hosten:

**Optie 1: Raspberry Pi**
- Install LiveKit server op Pi
- Alleen voor lokaal netwerk (geen internet traffic)

**Optie 2: NAS (Docker)**
- LiveKit Docker image op Synology
- Meer stabiel dan Pi

**Optie 3: VPS**
- €5-10/maand VPS (Hetzner/DigitalOcean)
- Volledig zelf beheerd

**Voordeel self-hosting:**
- €0 per maand
- Volledige controle
- Geen data naar third party

**Nadeel:**
- Meer technisch onderhoud
- Moet je zelf TURN server regelen (voor NAT traversal)

---

## Troubleshooting

### "LiveKit not configured" error

**Oplossing:**
1. Check of alle 3 env vars in Vercel staan
2. Redeploy na toevoegen env vars

### "Failed to get access token"

**Oplossing:**
1. Check of API Key + Secret kloppen (kopieer opnieuw)
2. Check LiveKit dashboard of project actief is

### Geen audio hoorbaar

**Coach kant:**
- Check microfoon permissie in browser
- iOS Safari: werkt alleen als PWA geïnstalleerd
- Test microfoon in andere app (bijv. Voice Memos)

**Viewer kant:**
- Check volume (niet muted)
- Check speaker/koptelefoon werkt
- Probeer andere browser

### Veel latency (>2 seconden)

**Normaal:** 100-300ms
**Acceptabel:** Tot 1 seconde
**Probleem:** >2 seconden

**Oplossingen:**
1. Check internetverbinding (vooral coach upload speed!)
2. Andere viewers dichter bij coach = lagere latency
3. Gebruik WiFi i.p.v. 4G (stabieler)
4. Kies LiveKit region dichter bij Nederland (Europe/Amsterdam)

### Audio kraakt/valt weg

**Oorzaken:**
- Slechte internetverbinding
- Te veel background apps (sluit WhatsApp/Instagram)
- Batterij bespaar modus (zet uit)

**Oplossingen:**
1. Coach: Sluit andere apps, alleen Dilli app open
2. WiFi i.p.v. mobiel internet
3. Laad telefoon tijdens wedstrijd

---

## LiveKit Dashboard

Bekijk live stats in LiveKit dashboard:

1. Ga naar: https://cloud.livekit.io
2. Klik op je project
3. **Rooms** tab → zie actieve rooms
4. **Metrics** tab → bandwidth usage, participants

Handig om te monitoren of alles werkt!

---

## Links

- **LiveKit Cloud Dashboard:** https://cloud.livekit.io
- **Docs:** https://docs.livekit.io
- **React SDK:** https://docs.livekit.io/client-sdk-js/
- **Self-hosting guide:** https://docs.livekit.io/deploy/
- **GitHub:** https://github.com/livekit/livekit
