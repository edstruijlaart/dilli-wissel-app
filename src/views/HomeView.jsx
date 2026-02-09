import React, { useState } from 'react';
import { T, base, card, btnP, btnS } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

export default function HomeView({ onStartLocal, onStartOnline, onJoin }) {
  const [joinCode, setJoinCode] = useState('');
  const [showCoachCode, setShowCoachCode] = useState(false);
  const [coachCode, setCoachCode] = useState('');
  const [coachError, setCoachError] = useState('');
  const [checking, setChecking] = useState(false);
  const [loggedInTeam, setLoggedInTeam] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dilli_coach'))?.team || null; } catch { return null; }
  });

  const logout = () => {
    localStorage.removeItem('dilli_coach');
    setLoggedInTeam(null);
  };

  const handleJoinInput = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setJoinCode(val);
    if (val.length === 4) onJoin(val);
  };

  const handleStartOnline = () => {
    const saved = localStorage.getItem('dilli_coach');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        onStartOnline(data);
      } catch {
        onStartOnline({});
      }
      return;
    }
    setShowCoachCode(true);
    setCoachCode('');
    setCoachError('');
  };

  const verifyCoachCode = async () => {
    if (!coachCode.trim()) return;
    setChecking(true);
    setCoachError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coachCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        const teamData = { team: data.team || null, players: data.players || [] };
        localStorage.setItem('dilli_coach', JSON.stringify(teamData));
        setLoggedInTeam(teamData.team);
        setShowCoachCode(false);
        onStartOnline(teamData);
      } else {
        setCoachError('Ongeldige code');
      }
    } catch {
      setCoachError('Verbinding mislukt');
    }
    setChecking(false);
  };

  return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <DilliLogo size={80} />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16, marginBottom: 4, color: T.text }}>Dilli Wissel</h1>
      <p style={{ fontSize: 13, color: T.textDim, marginBottom: 32 }}>v.v. Dilettant wisselmanager</p>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Wedstrijd starten */}
        <button onClick={handleStartOnline} style={{ ...btnP, padding: "16px 24px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%" }}>
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

        {/* Ingelogd als / uitloggen */}
        {loggedInTeam && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Ingelogd als <strong style={{ color: T.text }}>{loggedInTeam}</strong></span>
            <button onClick={logout} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, textDecoration: "underline", cursor: "pointer", marginLeft: 8, fontFamily: "'DM Sans',sans-serif" }}>Uitloggen</button>
          </div>
        )}
      </div>

      {/* Coach code modal */}
      {showCoachCode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 28, width: "100%", maxWidth: 320, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Coachcode</h3>
            <p style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Voer je coachcode in om een wedstrijd te starten</p>
            <input
              type="text"
              value={coachCode}
              onChange={(e) => { setCoachCode(e.target.value); setCoachError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && verifyCoachCode()}
              placeholder="Code"
              autoFocus
              autoComplete="off"
              style={{
                width: "100%", textAlign: "center", fontSize: 24, fontWeight: 700,
                padding: "12px 16px", border: `2px solid ${coachError ? T.danger : T.glassBorder}`,
                borderRadius: 14, outline: "none", fontFamily: "'JetBrains Mono',monospace",
                color: T.text, background: T.glass, transition: "border-color 0.2s",
              }}
            />
            {coachError && <p style={{ fontSize: 12, color: T.danger, marginTop: 8, fontWeight: 600 }}>{coachError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCoachCode(false)} style={{ ...btnS, flex: 1, padding: "12px 16px" }}>Annuleren</button>
              <button onClick={verifyCoachCode} disabled={checking || !coachCode.trim()} style={{ ...btnP, flex: 1, padding: "12px 16px", opacity: checking || !coachCode.trim() ? 0.5 : 1 }}>
                {checking ? 'Checken...' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
