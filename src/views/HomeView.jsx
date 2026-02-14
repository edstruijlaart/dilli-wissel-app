import React, { useState, useEffect } from 'react';
import { T, base, card, btnP, btnS } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

export default function HomeView({ onStartLocal, onStartOnline, onJoin, onJoinAsCoach }) {
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [showCoachCode, setShowCoachCode] = useState(false);
  const [coachCode, setCoachCode] = useState('');
  const [coachError, setCoachError] = useState('');
  const [checking, setChecking] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [verifiedTeamData, setVerifiedTeamData] = useState(null);
  const [loggedInTeam, setLoggedInTeam] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dilli_coach'))?.team || null; } catch { return null; }
  });

  // Haal live wedstrijden op
  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 5000); // Poll elke 5s
    return () => clearInterval(interval);
  }, []);

  const fetchLiveMatches = async () => {
    try {
      const res = await fetch('/api/match/live');
      const data = await res.json();
      setLiveMatches(data.matches || []);
    } catch (err) {
      console.error('Failed to fetch live matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('dilli_coach');
    setLoggedInTeam(null);
  };

  const handleMatchClick = (match) => {
    setSelectedMatch(match);
    setShowCoachCode(true);
    setCoachCode('');
    setCoachError('');
  };

  const handleSkipToViewer = () => {
    if (selectedMatch) {
      onJoin(selectedMatch.code);
      setShowCoachCode(false);
      setSelectedMatch(null);
    }
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
        setVerifiedTeamData(teamData);
        setShowCoachCode(false);
        setShowNamePrompt(true);
      } else {
        setCoachError('Ongeldige code');
      }
    } catch {
      setCoachError('Verbinding mislukt');
    }
    setChecking(false);
  };

  const confirmCoachName = () => {
    if (!coachName.trim() || !verifiedTeamData) return;

    const teamData = {
      ...verifiedTeamData,
      coachName: coachName.trim()
    };
    localStorage.setItem('dilli_coach', JSON.stringify(teamData));
    setLoggedInTeam(teamData.team);
    setShowNamePrompt(false);

    // Als we een wedstrijd geselecteerd hebben → join als coach
    if (selectedMatch && onJoinAsCoach) {
      onJoinAsCoach(selectedMatch.code).then(success => {
        if (!success) {
          setCoachError('Wedstrijd niet gevonden');
          setShowCoachCode(true);
        }
        setSelectedMatch(null);
      });
    } else {
      // Anders nieuwe wedstrijd starten
      onStartOnline(teamData);
    }

    setCoachName('');
    setVerifiedTeamData(null);
  };

  const statusText = (status) => {
    if (status === 'live') return '🟢 Live';
    if (status === 'paused') return '⏸️ Gepauzeerd';
    if (status === 'halftime') return '☕ Rust';
    if (status === 'setup') return '⏱️ Setup';
    return status;
  };

  const shareMatch = async (match, e) => {
    e.stopPropagation(); // Voorkom match click
    const url = `${window.location.origin}?join=${match.code}`;
    const text = `Kijk live mee: ${match.homeTeam} - ${match.awayTeam}\n${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch (err) {
        // User cancelled of not supported
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Link gekopieerd!');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Link gekopieerd!');
  };

  return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <DilliLogo size={80} />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16, marginBottom: 4, color: T.text }}>Dilli Wissel</h1>
      <p style={{ fontSize: 13, color: T.textDim, marginBottom: 32 }}>v.v. Dilettant wisselmanager</p>

      <div style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Wedstrijd starten */}
        <button onClick={handleStartOnline} style={{ ...btnP, padding: "16px 24px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%" }}>
          {Icons.football(22, "#FFF")}
          Nieuwe wedstrijd starten
        </button>

        {/* Live wedstrijden */}
        {loading ? (
          <div style={{ ...card, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: T.textDim }}>Wedstrijden laden...</p>
          </div>
        ) : liveMatches.length > 0 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.glassBorder }} />
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>LIVE WEDSTRIJDEN</span>
              <div style={{ flex: 1, height: 1, background: T.glassBorder }} />
            </div>
            {liveMatches.map((match) => (
              <div key={match.code} style={{ position: 'relative' }}>
                <button
                  onClick={() => handleMatchClick(match)}
                  style={{
                    ...card,
                    padding: 16,
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: "pointer",
                    border: "none",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                      {match.homeTeam} - {match.awayTeam}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                      {statusText(match.status)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>
                      {match.homeScore} - {match.awayScore}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>
                      {match.viewers > 0 ? `👀 ${match.viewers} kijker${match.viewers !== 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                </button>
                {/* Share button */}
                <button
                  onClick={(e) => shareMatch(match, e)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.accent,
                    transition: 'all 0.2s',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = T.accentDim;
                    e.currentTarget.style.borderColor = T.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = T.glass;
                    e.currentTarget.style.borderColor = T.glassBorder;
                  }}
                >
                  {Icons.share(14, T.accent)}
                  Deel
                </button>
              </div>
            ))}
          </>
        ) : null}

        {/* Lokaal (zonder delen) */}
        <button onClick={onStartLocal} style={{ ...btnS, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: liveMatches.length > 0 ? 8 : 0 }}>
          {Icons.timer(18)}
          Alleen voor mezelf (offline)
        </button>

        {/* Ingelogd als / uitloggen */}
        {loggedInTeam && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Ingelogd als <strong style={{ color: T.text }}>{loggedInTeam}</strong></span>
            <button onClick={logout} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, textDecoration: "underline", cursor: "pointer", marginLeft: 8, fontFamily: "'DM Sans',sans-serif" }}>Uitloggen</button>
          </div>
        )}

        {/* Versie & Ontwikkelaar */}
        <div style={{ textAlign: "center", marginTop: 32, paddingBottom: 20 }}>
          <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
            Versie 3.1.0
          </p>
          <p style={{ fontSize: 11, color: T.textMuted }}>
            Ontwikkeld door <strong style={{ color: T.text }}>Ears Want Music</strong>
          </p>
        </div>
      </div>

      {/* Coach code modal */}
      {showCoachCode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {selectedMatch ? 'Ben je coach?' : 'Coachcode'}
            </h3>
            {selectedMatch && (
              <p style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 8 }}>
                {selectedMatch.homeTeam} - {selectedMatch.awayTeam}
              </p>
            )}
            <p style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
              {selectedMatch
                ? 'Voer de coach code in om wissels te kunnen doen'
                : 'Voer je coachcode in om een wedstrijd te starten'}
            </p>
            <input
              type="text"
              value={coachCode}
              onChange={(e) => { setCoachCode(e.target.value); setCoachError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && verifyCoachCode()}
              placeholder="Jouw code"
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
              <button
                onClick={() => { setShowCoachCode(false); setSelectedMatch(null); }}
                style={{ ...btnS, flex: 1, padding: "12px 16px" }}
              >
                Annuleren
              </button>
              <button
                onClick={verifyCoachCode}
                disabled={checking || !coachCode.trim()}
                style={{ ...btnP, flex: 1, padding: "12px 16px", opacity: checking || !coachCode.trim() ? 0.5 : 1 }}
              >
                {checking ? 'Checken...' : 'Bevestig'}
              </button>
            </div>
            {selectedMatch && (
              <button
                onClick={handleSkipToViewer}
                style={{
                  ...btnS,
                  width: "100%",
                  padding: "12px 16px",
                  marginTop: 8,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
              >
                {Icons.eye(16)}
                Als toeschouwer meekijken
              </button>
            )}
          </div>
        </div>
      )}

      {/* Coach name modal */}
      {showNamePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ ...card, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              Wat is je naam?
            </h3>
            <p style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
              Zo kunnen spelers en ouders zien wie er coacht
            </p>
            <input
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCoachName()}
              placeholder="Bijv. Ed"
              autoFocus
              autoComplete="name"
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: 18,
                fontWeight: 600,
                padding: "12px 16px",
                border: `2px solid ${T.glassBorder}`,
                borderRadius: 14,
                outline: "none",
                fontFamily: "'DM Sans',sans-serif",
                color: T.text,
                background: T.glass,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setShowNamePrompt(false); setCoachName(''); setVerifiedTeamData(null); }}
                style={{ ...btnS, flex: 1, padding: "12px 16px" }}
              >
                Annuleren
              </button>
              <button
                onClick={confirmCoachName}
                disabled={!coachName.trim()}
                style={{ ...btnP, flex: 1, padding: "12px 16px", opacity: !coachName.trim() ? 0.5 : 1 }}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
