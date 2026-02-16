import React, { useState, useEffect, useRef } from 'react';
import { T, base, card, mono } from '../theme';
import { fmt } from '../utils/format';
import { fireConfetti } from '../utils/confetti';
import { notifyGoal } from '../utils/audio';
import { useMatchPolling } from '../hooks/useMatchPolling';
import DilliLogo from '../components/DilliLogo';
import Badge from '../components/Badge';
import Icons from '../components/Icons';
import AudioTimeline from '../components/AudioTimeline';
import LiveAudio from '../components/LiveAudio';

export default function ViewerView({ code, onBack }) {
  const { match, events, error, loading, getElapsed, getSubElapsed } = useMatchPolling(code);
  const [timer, setTimer] = useState(0);
  const [goalToast, setGoalToast] = useState(null);
  const [goalType, setGoalType] = useState('home'); // 'home' | 'away'
  const [streamBanner, setStreamBanner] = useState(false);
  const prevEventsLen = useRef(-1); // -1 = nog niet geïnitialiseerd
  const prevLiveAudio = useRef(null);

  // Lokale timer die elke seconde tikt (niet afhankelijk van polling)
  useEffect(() => {
    const iv = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Detecteer nieuwe doelpunten en schiet confetti af
  useEffect(() => {
    if (events.length === 0) return;

    // Eerste keer events laden: onthoud aantal maar trigger GEEN effecten
    if (prevEventsLen.current === -1) {
      prevEventsLen.current = events.length;
      return;
    }

    if (events.length <= prevEventsLen.current) {
      prevEventsLen.current = events.length;
      return;
    }
    // Check alleen de nieuwe events (na initialisatie)
    const newEvents = events.slice(prevEventsLen.current);
    prevEventsLen.current = events.length;

    for (const ev of newEvents) {
      if (ev.type === 'goal_home') {
        fireConfetti();
        notifyGoal();
        setGoalType('home');
        const msg = ev.scorer ? `DOELPUNT! ${ev.scorer} scoort!` : 'DOELPUNT!';
        setGoalToast(msg);
        setTimeout(() => setGoalToast(null), 4000);
        break;
      }
      if (ev.type === 'goal_away') {
        fireConfetti('sad');
        setGoalType('away');
        setGoalToast('Tegendoelpunt...');
        setTimeout(() => setGoalToast(null), 4000);
        break;
      }
    }
  }, [events]);

  // Detecteer live audio stream start
  useEffect(() => {
    if (!match || !match.isRunning || match.halfBreak) {
      prevLiveAudio.current = null;
      return;
    }

    // Check if live audio event was added
    const liveAudioEvents = events.filter(ev => ev.type === 'live_audio_start');
    const hasLiveAudio = liveAudioEvents.length > 0;

    if (hasLiveAudio && prevLiveAudio.current === false) {
      // Stream just started!
      setStreamBanner(true);
      setTimeout(() => setStreamBanner(false), 5000);
    }

    prevLiveAudio.current = hasLiveAudio;
  }, [events, match]);

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

  // Wedstrijd afgelopen: toon samenvatting
  if (match.status === 'ended') {
    return <MatchSummary match={match} events={events} code={code} onBack={onBack} />;
  }

  return (
    <div style={{ ...base, padding: "16px 16px 80px" }}>
      {/* Goal toast */}
      {goalToast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: goalType === 'home'
            ? "linear-gradient(135deg, #16A34A, #22C55E)"
            : "linear-gradient(135deg, #6B7280, #9CA3AF)",
          color: "#fff",
          padding: "14px 28px", borderRadius: 16, fontSize: 18, fontWeight: 800,
          zIndex: 10000, textAlign: "center",
          boxShadow: goalType === 'home'
            ? "0 8px 32px rgba(22,163,74,0.4)"
            : "0 8px 32px rgba(107,114,128,0.4)",
          animation: "goalIn 0.4s ease-out", fontFamily: "'DM Sans',sans-serif",
          maxWidth: "90vw"
        }}>
          {goalToast}
        </div>
      )}
      <style>{`@keyframes goalIn { from { opacity:0; transform:translateX(-50%) scale(0.7) translateY(-20px); } to { opacity:1; transform:translateX(-50%) scale(1) translateY(0); } }`}</style>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(18, T.textMuted)}</button>
          <DilliLogo size={36} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{match.team || match.homeTeam}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Code: {code} — {statusLabel[match.status] || match.status}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {match.viewers > 0 && <span style={{ fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 3 }}>{Icons.eye(12, T.textMuted)} {match.viewers}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: match.isRunning && !match.isPaused ? T.accent : T.textMuted, animation: match.isRunning && !match.isPaused ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>{match.isRunning && !match.isPaused ? "Live" : "Pauze"}</span>
            </div>
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

        {/* Live Audio Streaming */}
        {match.isRunning && !match.halfBreak && (
          <LiveAudio matchCode={code} isCoach={false} onError={(err) => console.error('Live audio error:', err)} />
        )}

        {/* Audio Timeline - Only show latest update for viewers */}
        <AudioTimeline matchCode={code} maxItems={1} />

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

        {/* Event feed - only non-photo events (goals, subs, etc.) */}
        {events.filter(ev => ev.type !== 'photo').length > 0 && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Gebeurtenissen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...events].filter(ev => ev.type !== 'photo').reverse().slice(0, 20).map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.textDim }}>
                  <span style={{ ...mono, fontSize: 11, color: T.textMuted, minWidth: 40 }}>{ev.time || ''}</span>
                  <span>{formatEvent(ev)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stream start banner (subtle) */}
        {streamBanner && (
          <div
            style={{
              position: 'fixed',
              top: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #16A34A, #22C55E)',
              color: '#FFF',
              padding: '12px 24px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              zIndex: 9999,
              boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
              animation: 'slideDown 0.3s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFF', animation: 'pulse 1.5s infinite' }} />
            Live audio is nu actief
          </div>
        )}
        <style>{`
          @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function MatchSummary({ match, events, code, onBack }) {
  const allGoals = events.filter(ev => ev.type === 'goal_home' || ev.type === 'goal_away');
  const halves = match.halves || 2;

  // Groepeer goals per helft
  const goalsByHalf = {};
  for (let h = 1; h <= halves; h++) goalsByHalf[h] = [];
  allGoals.forEach(g => {
    const h = g.half || 1;
    if (!goalsByHalf[h]) goalsByHalf[h] = [];
    goalsByHalf[h].push(g);
  });

  // Hattrick detectie: 3+ goals van dezelfde speler in dezelfde helft
  const hattricks = [];
  for (let h = 1; h <= halves; h++) {
    const scorerCount = {};
    goalsByHalf[h].filter(g => g.type === 'goal_home' && g.scorer).forEach(g => {
      scorerCount[g.scorer] = (scorerCount[g.scorer] || 0) + 1;
    });
    Object.entries(scorerCount).forEach(([name, count]) => {
      if (count >= 3) hattricks.push({ name, count, half: h });
    });
  }

  // Resultaat bepalen
  const won = match.homeScore > match.awayScore;
  const draw = match.homeScore === match.awayScore;
  const resultText = won ? 'Gewonnen!' : draw ? 'Gelijkspel' : 'Verloren';
  const resultColor = won ? T.accent : draw ? T.warn : T.danger;

  // Topscorer
  const scorerTotals = {};
  allGoals.filter(g => g.type === 'goal_home' && g.scorer).forEach(g => {
    scorerTotals[g.scorer] = (scorerTotals[g.scorer] || 0) + 1;
  });
  const topScorer = Object.entries(scorerTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ ...base, padding: "16px 16px 80px" }}>
      <style>{`
        @keyframes summaryIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        .sum-row { animation: summaryIn 0.5s ease-out both; }
      `}</style>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(18, T.textMuted)}</button>
          <DilliLogo size={36} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{match.team || match.homeTeam}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Wedstrijd afgelopen</div>
          </div>
        </div>

        {/* Resultaat */}
        <div style={{ ...card, padding: "28px 20px", marginBottom: 14, textAlign: "center", animation: "scaleIn 0.6s ease-out" }}>
          {Icons.whistle(36, resultColor)}
          <div style={{ fontSize: 22, fontWeight: 800, color: resultColor, marginTop: 8 }}>{resultText}</div>
        </div>

        {/* Eindstand */}
        <div style={{ ...card, padding: "20px 24px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, animation: "summaryIn 0.5s ease-out 0.1s both" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 13, color: T.textDim, fontWeight: 600, marginBottom: 6 }}>{match.homeTeam || 'Thuis'}</div>
            <div style={{ ...mono, fontSize: 52, fontWeight: 800, color: T.text, lineHeight: 1 }}>{match.homeScore}</div>
          </div>
          <div style={{ fontSize: 20, color: T.textMuted, fontWeight: 300 }}>—</div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 13, color: T.textDim, fontWeight: 600, marginBottom: 6 }}>{match.awayTeam || 'Uit'}</div>
            <div style={{ ...mono, fontSize: 52, fontWeight: 800, color: T.text, lineHeight: 1 }}>{match.awayScore}</div>
          </div>
        </div>

        {/* Hattrick alert */}
        {hattricks.map((ht, i) => (
          <div key={i} style={{
            ...card, padding: "14px 20px", marginBottom: 14, textAlign: "center",
            background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.06))",
            borderColor: "rgba(168,85,247,0.2)",
            animation: `scaleIn 0.6s ease-out ${0.3 + i * 0.1}s both`
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🎩</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#A855F7" }}>HATTRICK!</div>
            <div style={{ fontSize: 14, color: T.textDim, marginTop: 2 }}>
              {ht.name} scoorde {ht.count}x in helft {ht.half}
            </div>
          </div>
        ))}

        {/* Doelpunten per helft */}
        {allGoals.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 14, animation: "summaryIn 0.5s ease-out 0.2s both" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Doelpunten</div>
            {Array.from({ length: halves }, (_, i) => i + 1).map(h => {
              const hGoals = goalsByHalf[h] || [];
              if (hGoals.length === 0) return null;
              return (
                <div key={h} style={{ marginBottom: h < halves ? 14 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${T.glassBorder}` }}>
                    Helft {h}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {hGoals.map((g, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                        <span style={{ ...mono, fontSize: 12, color: T.textMuted, minWidth: 42 }}>{g.time || ''}</span>
                        {g.type === 'goal_home' ? (
                          <>
                            <span style={{ fontSize: 16 }}>⚽</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                              {g.scorer || 'Doelpunt'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 16, opacity: 0.5 }}>⚽</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: T.textDim }}>Tegendoelpunt</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {allGoals.length === 0 && (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: 10 }}>Geen doelpunten</div>
            )}
          </div>
        )}

        {/* Topscorer */}
        {topScorer && topScorer[1] >= 2 && (
          <div style={{ ...card, padding: "14px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, animation: "summaryIn 0.5s ease-out 0.3s both" }}>
            <span style={{ fontSize: 24 }}>⭐</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Topscorer</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{topScorer[0]} ({topScorer[1]}x)</div>
            </div>
          </div>
        )}

        {/* 0-0 */}
        {allGoals.length === 0 && (
          <div style={{ ...card, padding: 20, marginBottom: 14, textAlign: "center", animation: "summaryIn 0.5s ease-out 0.2s both" }}>
            <div style={{ fontSize: 13, color: T.textMuted }}>Geen doelpunten deze wedstrijd</div>
          </div>
        )}

        {/* Deel uitslag */}
        <button onClick={() => shareResult(match, events)} style={{
          width: "100%", padding: "14px 24px",
          background: "linear-gradient(135deg, #25D366, #128C7E)",
          border: "none", borderRadius: 14,
          fontWeight: 700, fontSize: 15, cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
          animation: "summaryIn 0.5s ease-out 0.4s both"
        }}>
          {Icons.share(16, "#fff")} Deel uitslag
        </button>

        {/* Terug knop */}
        <button onClick={onBack} style={{
          width: "100%", padding: "14px 24px", background: T.glass,
          border: `1px solid ${T.glassBorder}`, borderRadius: 14,
          fontWeight: 600, fontSize: 15, cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif", color: T.textDim,
          marginTop: 8,
          animation: "summaryIn 0.5s ease-out 0.5s both"
        }}>
          Terug naar start
        </button>
      </div>
    </div>
  );
}

function buildShareText(match, events) {
  const home = match.homeTeam || 'Thuis';
  const away = match.awayTeam || 'Uit';
  const won = match.homeScore > match.awayScore;
  const draw = match.homeScore === match.awayScore;
  const emoji = won ? '🎉' : draw ? '🤝' : '😤';

  let text = `${emoji} ${home} ${match.homeScore} - ${match.awayScore} ${away}\n`;

  // Doelpuntmakers
  const goals = events.filter(ev => ev.type === 'goal_home' && ev.scorer);
  if (goals.length > 0) {
    const scorerCount = {};
    goals.forEach(g => { scorerCount[g.scorer] = (scorerCount[g.scorer] || 0) + 1; });
    const scorerStr = Object.entries(scorerCount)
      .map(([name, count]) => count > 1 ? `${name} (${count}x)` : name)
      .join(', ');
    text += `⚽ ${scorerStr}\n`;
  }

  return text.trim();
}

function shareResult(match, events) {
  const text = buildShareText(match, events);

  // Probeer Web Share API eerst (werkt op iOS + Android)
  if (navigator.share) {
    navigator.share({ text }).catch(() => {
      // Fallback: kopieer naar klembord
      navigator.clipboard?.writeText(text);
    });
  } else {
    // Desktop fallback: WhatsApp web
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
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
    case 'photo': return '📷 Foto toegevoegd';
    case 'match_end': return 'Wedstrijd afgelopen';
    default: return ev.type;
  }
}
