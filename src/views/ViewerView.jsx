import React, { useState, useEffect } from 'react';
import { T, base, card, mono } from '../theme';
import { fmt } from '../utils/format';
import { useMatchPolling } from '../hooks/useMatchPolling';
import DilliLogo from '../components/DilliLogo';
import Badge from '../components/Badge';
import Icons from '../components/Icons';

export default function ViewerView({ code, onBack }) {
  const { match, events, error, loading, getElapsed, getSubElapsed } = useMatchPolling(code);
  const [timer, setTimer] = useState(0);

  // Lokale timer die elke seconde tikt (niet afhankelijk van polling)
  useEffect(() => {
    const iv = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const elapsed = getElapsed();
  const subElapsed = getSubElapsed();

  if (loading) return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <DilliLogo size={60} />
      <p style={{ fontSize: 14, color: T.textDim, marginTop: 16 }}>Wedstrijd laden...</p>
    </div>
  );

  if (error) return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
      <p style={{ fontSize: 16, color: T.danger, fontWeight: 700, marginBottom: 12 }}>{error}</p>
      <button onClick={onBack} style={{ background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 14, padding: "10px 24px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", color: T.textDim }}>Terug</button>
    </div>
  );

  if (!match) return null;

  const statusLabel = { setup: 'Wordt opgesteld', live: 'Live', paused: 'Gepauzeerd', halftime: 'Rust', ended: 'Afgelopen' };

  return (
    <div style={{ ...base, padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(18, T.textMuted)}</button>
          <DilliLogo size={36} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{match.team || match.homeTeam}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Code: {code} — {statusLabel[match.status] || match.status}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: match.isRunning && !match.isPaused ? T.accent : T.textMuted, animation: match.isRunning && !match.isPaused ? "pulse 1.5s infinite" : "none" }} />
            <span style={{ fontSize: 11, color: T.textMuted }}>{match.isRunning && !match.isPaused ? "Live" : "Pauze"}</span>
          </div>
        </div>

        {/* Timer */}
        <div style={{ ...card, padding: "20px 24px", marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Helft {match.currentHalf} van {match.halves}
          </div>
          <div style={{ ...mono, fontSize: 48, fontWeight: 800, color: T.text, lineHeight: 1 }}>{fmt(elapsed)}</div>
          {match.isRunning && !match.isPaused && !match.halfBreak && (
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>Wissel over {fmt(Math.max(0, match.subInterval * 60 - subElapsed))}</div>
          )}
        </div>

        {/* Score */}
        <div style={{ ...card, padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 12, color: T.textDim, fontWeight: 600, marginBottom: 4 }}>{match.homeTeam || 'Thuis'}</div>
            <div style={{ ...mono, fontSize: 40, fontWeight: 800, color: T.text }}>{match.homeScore}</div>
          </div>
          <div style={{ fontSize: 16, color: T.textMuted, fontWeight: 300 }}>—</div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 12, color: T.textDim, fontWeight: 600, marginBottom: 4 }}>{match.awayTeam || 'Uit'}</div>
            <div style={{ ...mono, fontSize: 40, fontWeight: 800, color: T.text }}>{match.awayScore}</div>
          </div>
        </div>

        {/* Half break */}
        {match.halfBreak && (
          <div style={{ ...card, padding: 20, marginBottom: 12, textAlign: "center", borderColor: T.warnDim, background: "rgba(217,119,6,0.04)" }}>
            {Icons.whistle(28, T.warn)}
            <p style={{ fontSize: 15, fontWeight: 700, color: T.warn, marginTop: 6 }}>Rust</p>
          </div>
        )}

        {/* Veld */}
        {match.onField && match.onField.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>In het veld</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {match.onField.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: p === match.matchKeeper ? "rgba(217,119,6,0.06)" : T.glass }}>
                  {p === match.matchKeeper && Icons.glove(14, T.keeper)}
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p}</span>
                  {p === match.matchKeeper && <Badge variant="keeper">Keeper</Badge>}
                  <Badge variant="field">Veld</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bank */}
        {match.onBench && match.onBench.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Op de bank</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {match.onBench.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: T.glass }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p}</span>
                  <Badge variant="bench">Bank</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event feed */}
        {events.length > 0 && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Gebeurtenissen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...events].reverse().slice(0, 20).map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.textDim }}>
                  <span style={{ ...mono, fontSize: 11, color: T.textMuted, minWidth: 40 }}>{ev.time || ''}</span>
                  <span>{formatEvent(ev)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatEvent(ev) {
  switch (ev.type) {
    case 'match_start': return 'Wedstrijd gestart';
    case 'half_start': return `Helft ${ev.half} gestart`;
    case 'goal_home': return `Doelpunt${ev.scorer ? ` ${ev.scorer}` : ''}!`;
    case 'goal_away': return 'Tegendoelpunt';
    case 'sub_auto': return `Wissel: ${(ev.out || []).join(', ')} eruit → ${(ev.inn || []).join(', ')} erin`;
    case 'sub_manual': return `Handmatige wissel: ${(ev.out || []).join(', ')} ↔ ${(ev.inn || []).join(', ')}`;
    case 'keeper_change': return `Nieuwe keeper: ${ev.newKeeper}`;
    case 'match_end': return 'Wedstrijd afgelopen';
    default: return ev.type;
  }
}
