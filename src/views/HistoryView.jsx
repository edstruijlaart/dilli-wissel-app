import React, { useState, useEffect } from 'react';
import { T, card, btnP, btnS } from '../theme';
import { fmt } from '../utils/format';

export default function HistoryView({ team, onBack }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!team) return;
    fetch(`/api/match/history?team=${encodeURIComponent(team)}`)
      .then(r => r.json())
      .then(data => { setMatches(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [team]);

  if (selected) return <MatchDetail match={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", background: "#F5F5F7", padding: "20px 16px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnS, marginBottom: 16, fontSize: 13, padding: "6px 14px" }}>
          ← Terug
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>
          Wedstrijden — {team}
        </h2>

        {loading && <p style={{ color: T.textMuted, fontSize: 14 }}>Laden...</p>}
        {!loading && matches.length === 0 && (
          <p style={{ color: T.textMuted, fontSize: 14 }}>Nog geen opgeslagen wedstrijden.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matches.map(m => (
            <button key={m.id} onClick={() => setSelected(m)} style={{
              ...card, textAlign: "left", cursor: "pointer", border: `1px solid ${T.glassBorder}`,
              background: "white", padding: "14px 16px", borderRadius: 14, width: "100%",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                    {m.homeTeam || '?'} vs {m.awayTeam || '?'}
                  </div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                    {new Date(m.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.homeScore} - {m.awayScore}
                </div>
              </div>
              {m.subCount > 0 && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  {m.subCount} wissels
                  {m.excludedPlayers?.length > 0 && ` · ${m.excludedPlayers.length} uitgevallen`}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchDetail({ match, onBack }) {
  const [showLog, setShowLog] = useState(false);
  const m = match;

  // Speeltijd sorteren (meest gespeeld eerst)
  const playTimeEntries = Object.entries(m.playTime || {}).sort((a, b) => b[1] - a[1]);
  const maxTime = playTimeEntries.length > 0 ? playTimeEntries[0][1] : 1;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", background: "#F5F5F7", padding: "20px 16px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnS, marginBottom: 16, fontSize: 13, padding: "6px 14px" }}>
          ← Terug naar overzicht
        </button>

        {/* Header */}
        <div style={{ ...card, background: "white", padding: 20, borderRadius: 16, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            {new Date(m.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 4 }}>
            {m.homeTeam} vs {m.awayTeam}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: T.text, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
            {m.homeScore} - {m.awayScore}
          </div>
          {Object.keys(m.goalScorers || {}).length > 0 && (
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>
              {Object.entries(m.goalScorers).map(([name, count]) => `${name}${count > 1 ? ` (${count})` : ''}`).join(', ')}
            </div>
          )}
        </div>

        {/* Speeltijden */}
        <div style={{ ...card, background: "white", padding: 16, borderRadius: 14, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 10px" }}>Speeltijd</h3>
          {playTimeEntries.map(([name, seconds]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <div style={{ flex: 1, height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(seconds / maxTime) * 100}%`, background: T.accent, borderRadius: 4 }} />
              </div>
              <div style={{ width: 40, fontSize: 11, color: T.textMuted, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(seconds)}</div>
            </div>
          ))}
        </div>

        {/* Wisselgeschiedenis */}
        {(m.subHistory || []).length > 0 && (
          <div style={{ ...card, background: "white", padding: 16, borderRadius: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 10px" }}>Wissels ({m.subHistory.length})</h3>
            {m.subHistory.map((sub, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "flex", gap: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: T.textDim, minWidth: 40 }}>{sub.time}</span>
                <span>
                  {sub.keeperChange ? '🧤 ' : sub.injury ? '🏥 ' : sub.manual ? '✋ ' : '🔄 '}
                  {(sub.out || []).join(', ')} → {(sub.inn || []).join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Events */}
        {(m.events || []).length > 0 && (
          <div style={{ ...card, background: "white", padding: 16, borderRadius: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 10px" }}>Gebeurtenissen</h3>
            {m.events.filter(e => !['sub_auto', 'sub_manual'].includes(e.type)).slice(0, 30).map((ev, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textMuted, marginBottom: 3 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", marginRight: 8 }}>{ev.time || ''}</span>
                {formatEvent(ev)}
              </div>
            ))}
          </div>
        )}

        {/* Debug Log */}
        {(m.matchLog || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowLog(!showLog)} style={{ ...btnS, fontSize: 12, padding: "6px 12px" }}>
              {showLog ? 'Verberg' : 'Toon'} debug log ({m.matchLog.length} entries)
            </button>
            {showLog && (
              <div style={{ marginTop: 8, ...card, background: "#1a1a2e", padding: 12, borderRadius: 10, maxHeight: 300, overflow: "auto" }}>
                {m.matchLog.map((entry, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#a0aec0", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                    {new Date(entry.t).toLocaleTimeString('nl-NL')} — <span style={{ color: "#63b3ed" }}>{entry.action}</span>
                    {entry.out && ` out:${JSON.stringify(entry.out)}`}
                    {entry.inn && ` in:${JSON.stringify(entry.inn)}`}
                    {entry.overlap && ` overlap:${JSON.stringify(entry.overlap)}`}
                    {entry.missing && ` missing:${JSON.stringify(entry.missing)}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Uitgevallen spelers */}
        {(m.excludedPlayers || []).length > 0 && (
          <div style={{ fontSize: 12, color: T.danger, fontWeight: 600, padding: "8px 12px", background: "rgba(220,38,38,0.05)", borderRadius: 8 }}>
            Uitgevallen: {m.excludedPlayers.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function formatEvent(ev) {
  switch (ev.type) {
    case 'goal_home': return `⚽ Doelpunt${ev.scorer ? ` (${ev.scorer})` : ''}`;
    case 'goal_away': return '⚽ Tegendoelpunt';
    case 'half_start': return `▶️ Helft ${ev.half} gestart`;
    case 'half_end': case 'half_end_manual': return `⏸️ Helft ${ev.half} afgelopen`;
    case 'match_end': case 'match_end_manual': return '🏁 Wedstrijd afgelopen';
    case 'match_start': return '🏟️ Aftrap';
    case 'injury_sub': return `🏥 ${ev.out} → ${ev.inn} (blessure)`;
    case 'injury_no_sub': return `🏥 ${ev.out} uit wedstrijd`;
    case 'keeper_change': case 'keeper_rotation': return `🧤 Keeper: ${ev.newKeeper}`;
    case 'state_repair': return '⚠️ State hersteld';
    case 'injury_time_start': return '⏱️ Blessuretijd';
    default: return ev.type;
  }
}
