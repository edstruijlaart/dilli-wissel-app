import React, { useState, useEffect } from 'react';
import { T, base, card, btnP, mono } from '../theme';
import { fmt } from '../utils/format';
import Icons from '../components/Icons';
import DilliLogo from '../components/DilliLogo';
import Badge from '../components/Badge';
export default function SummaryView({ state, onNewMatch }) {
  const { players, playTime, matchKeeper, subHistory, homeTeam, awayTeam, homeScore, awayScore, matchCode } = state;
  const [goalEvents, setGoalEvents] = useState([]);

  // Haal doelpunten op van server voor share-functie
  useEffect(() => {
    if (!matchCode) return;
    fetch(`/api/match/events/${matchCode}`)
      .then(r => r.ok ? r.json() : [])
      .then(evs => setGoalEvents(evs.filter(e => e.type === 'goal_home' || e.type === 'goal_away')))
      .catch(() => {});
  }, [matchCode]);

  const sorted = [...players].sort((a, b) => (playTime[b] || 0) - (playTime[a] || 0));
  const max = Math.max(...Object.values(playTime), 1);

  return (
    <div style={base}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px" }}>
        <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
          <DilliLogo size={56} />
          <div style={{ marginBottom: 8, marginTop: 8 }}>{Icons.flag(28, T.accent)}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Afgelopen!</h1>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{homeTeam || "Thuis"}</div>
              <div style={{ ...mono, fontSize: 36, fontWeight: 700 }}>{homeScore}</div>
            </div>
            <span style={{ fontSize: 20, color: T.textMuted, fontWeight: 300 }}>–</span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{awayTeam || "Uit"}</div>
              <div style={{ ...mono, fontSize: 36, fontWeight: 700 }}>{awayScore}</div>
            </div>
          </div>
        </div>
        <div style={{ ...card, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>{Icons.timer(18, T.textDim)}<span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Speeltijd</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sorted.map(p => { const t = playTime[p] || 0; const isK = p === matchKeeper; return (
              <div key={p}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{isK && Icons.glove(14, T.keeper)}{p}</span>
                  <span style={{ ...mono, fontSize: 13, color: T.textDim }}>{fmt(t)}</span>
                </div>
                <div style={{ height: 6, background: T.glass, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(t / max) * 100}%`, background: isK ? T.keeper : T.accent, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
              </div>
            ); })}
          </div>
        </div>
        {subHistory.length > 0 && (
          <div style={{ ...card, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>{Icons.swap(16, T.textDim)}<span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Wissels ({subHistory.length})</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subHistory.map((s, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}`, fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ ...mono, fontSize: 12, color: T.textMuted }}>{s.time}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>H{s.half}</span>
                    {s.manual && <Badge variant="manual">handmatig</Badge>}
                    {s.keeperSwap && <Badge variant="keeper">keeper gewisseld</Badge>}
                    {s.keeperChange && <Badge variant="keeper">nieuwe keeper</Badge>}
                  </div>
                  {s.keeperChange ? (
                    <span style={{ color: T.keeper }}>{Icons.glove(12, T.keeper)} {s.newKeeper} is nu keeper</span>
                  ) : (
                    <span><span style={{ color: T.danger }}>⬇ {s.out.join(", ")}</span><span style={{ color: T.textMuted }}> → </span><span style={{ color: T.accent }}>⬆ {s.inn.join(", ")}</span></span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {goalEvents.length > 0 && (
          <div style={{ ...card, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⚽</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Doelpunten</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {goalEvents.map((g, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}`, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...mono, fontSize: 12, color: T.textMuted, minWidth: 36 }}>{g.time}</span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>H{g.half}</span>
                  {g.type === 'goal_home' ? (
                    <span style={{ fontWeight: 600, color: T.accent }}>{g.scorer || (homeTeam || 'Thuis')}</span>
                  ) : (
                    <span style={{ fontWeight: 600, color: T.danger }}>{awayTeam || 'Uit'}</span>
                  )}
                </div>
              ))}
            </div>
            {(() => {
              const homeGoals = goalEvents.filter(g => g.type === 'goal_home' && g.scorer);
              if (homeGoals.length < 2) return null;
              const counts = {};
              homeGoals.forEach(g => { counts[g.scorer] = (counts[g.scorer] || 0) + 1; });
              const topScorers = Object.entries(counts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
              if (topScorers.length === 0) return null;
              return (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: `${T.accent}15`, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <span>🌟</span>
                  {topScorers.map(([name, count], i) => (
                    <span key={name} style={{ fontWeight: 700, color: T.accent }}>
                      {i > 0 && ', '}{name} ({count}x)
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        <button onClick={() => shareCoachResult({ homeTeam, awayTeam, homeScore, awayScore }, goalEvents)} style={{
          width: "100%", padding: "14px 24px", marginBottom: 10,
          background: "linear-gradient(135deg, #25D366, #128C7E)",
          border: "none", borderRadius: 14,
          fontWeight: 700, fontSize: 15, cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(37,211,102,0.3)"
        }}>
          {Icons.share(16, "#fff")} Deel uitslag
        </button>
        <button onClick={onNewMatch} style={{ ...btnP, width: "100%", padding: "16px 0", fontSize: 16, boxShadow: "0 4px 16px rgba(22,163,74,0.25)" }}>Nieuwe wedstrijd</button>
      </div>
    </div>
  );
}

function shareCoachResult(match, goalEvents) {
  const home = match.homeTeam || 'Thuis';
  const away = match.awayTeam || 'Uit';
  const won = match.homeScore > match.awayScore;
  const draw = match.homeScore === match.awayScore;
  const emoji = won ? '🎉' : draw ? '🤝' : '😤';

  let text = `${emoji} ${home} ${match.homeScore} - ${match.awayScore} ${away}\n`;

  // Doelpuntmakers (alleen thuisdoelpunten met scorer)
  const homeGoals = goalEvents.filter(e => e.type === 'goal_home' && e.scorer);
  if (homeGoals.length > 0) {
    const scorerCount = {};
    homeGoals.forEach(g => { scorerCount[g.scorer] = (scorerCount[g.scorer] || 0) + 1; });
    const scorerStr = Object.entries(scorerCount)
      .map(([name, count]) => count > 1 ? `${name} (${count}x)` : name)
      .join(', ');
    text += `⚽ ${scorerStr}\n`;
  }

  // Probeer Web Share API eerst (werkt op iOS + Android)
  if (navigator.share) {
    navigator.share({ text: text.trim() }).catch(() => {
      navigator.clipboard?.writeText(text.trim());
    });
  } else {
    const url = `https://wa.me/?text=${encodeURIComponent(text.trim())}`;
    window.open(url, '_blank');
  }
}
