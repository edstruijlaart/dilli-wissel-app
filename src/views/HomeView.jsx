import React, { useState } from 'react';
import { T, base, card, btnP, btnS } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

export default function HomeView({ onStartLocal, onStartOnline, onJoin }) {
  const [joinCode, setJoinCode] = useState('');

  const handleJoinInput = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setJoinCode(val);
    if (val.length === 4) onJoin(val);
  };

  return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <DilliLogo size={80} />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16, marginBottom: 4, color: T.text }}>Dilli Wissel</h1>
      <p style={{ fontSize: 13, color: T.textDim, marginBottom: 32 }}>v.v. Dilettant wisselmanager</p>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Wedstrijd starten */}
        <button onClick={onStartOnline} style={{ ...btnP, padding: "16px 24px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%" }}>
          {Icons.football(22, "#FFF")}
          Wedstrijd starten
        </button>

        {/* Lokaal (zonder delen) */}
        <button onClick={onStartLocal} style={{ ...btnS, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
          {Icons.timer(18)}
          Alleen voor mezelf (offline)
        </button>

        {/* Scheidingslijn */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
          <div style={{ flex: 1, height: 1, background: T.glassBorder }} />
          <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>OF MEEKIJKEN</span>
          <div style={{ flex: 1, height: 1, background: T.glassBorder }} />
        </div>

        {/* Code invoeren */}
        <div style={{ ...card, padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: T.textDim, marginBottom: 12 }}>Heb je een code gekregen?</p>
          <input
            type="text"
            value={joinCode}
            onChange={handleJoinInput}
            placeholder="XXXX"
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            style={{
              width: "100%", maxWidth: 180, textAlign: "center", fontSize: 32, fontWeight: 800,
              letterSpacing: 8, padding: "12px 16px", border: `2px solid ${T.glassBorder}`,
              borderRadius: 14, outline: "none", fontFamily: "'JetBrains Mono',monospace",
              color: T.text, background: T.glass, transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = T.accent}
            onBlur={(e) => e.target.style.borderColor = T.glassBorder}
          />
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>Voer de 4-letter code in om mee te kijken</p>
        </div>
      </div>
    </div>
  );
}
