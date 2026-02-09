import React from 'react';
import { T, base, card, btnP, btnS, btnD, mono } from '../theme';
import { fmt } from '../utils/format';
import { fireConfetti } from '../utils/confetti';
import { vibrate } from '../utils/audio';
import Icons from '../components/Icons';
import Badge from '../components/Badge';
import { VIEWS } from '../hooks/useMatchState';

export default function MatchView({ state }) {
  const {
    halfDuration, halves, subInterval, currentHalf, matchTimer, subTimer,
    isRunning, isPaused, setIsPaused, showSubAlert, suggestedSubs,
    halfBreak, manualSubMode, setManualSubMode, matchKeeper,
    showKeeperPicker, setShowKeeperPicker,
    homeTeam, awayTeam, homeScore, setHomeScore, awayScore, setAwayScore,
    onField, onBench, playTime, setView, setIsRunning,
    executeSubs, skipSubs, startNextHalf, manualSub, swapKeeper,
  } = state;

  const hs = halfDuration * 60;
  const he = matchTimer - (currentHalf - 1) * hs;
  const hr = hs - he;
  const sr = subInterval * 60 - subTimer;
  const hp = (he / hs) * 100;
  const urgent = sr <= 30 && onBench.length > 0 && !showSubAlert;

  return (
    <div style={base}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        {/* Timer */}
        <div style={{ ...card, padding: 20, marginBottom: 10, position: "relative", overflow: "hidden" }}>
          {urgent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.warn},transparent)`, animation: "pulse 1.5s ease infinite" }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Helft</div>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{currentHalf}<span style={{ color: T.textMuted, fontSize: 20 }}>/{halves}</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Tijd</div>
              <div style={{ ...mono, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{fmt(matchTimer)}</div>
            </div>
          </div>
          <div style={{ height: 4, background: T.glass, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(hp, 100)}%`, background: T.accent, borderRadius: 2, transition: "width 1s linear" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: T.textMuted }}>Rest: {fmt(Math.max(0, hr))}</span>
            {onBench.length > 0 && <span style={{ ...mono, color: urgent ? T.warn : T.textMuted, fontWeight: urgent ? 700 : 500 }}>Wissel: {fmt(Math.max(0, sr))}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setIsPaused(!isPaused)} style={{ ...(isPaused ? btnP : btnS), flex: 1, padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {isPaused ? Icons.play(12, "#FFFFFF") : Icons.pause(12, T.textDim)} {isPaused ? "Hervat" : "Pauze"}
            </button>
            <button onClick={() => setShowKeeperPicker(!showKeeperPicker)} style={{ ...btnS, padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, borderColor: showKeeperPicker ? T.keeperDim : T.glassBorder }}>
              {Icons.glove(14, T.keeper)}
            </button>
            <button onClick={() => { setIsRunning(false); setView(VIEWS.SUMMARY); }} style={{ ...btnD, padding: "10px 16px" }}>Stop</button>
          </div>
        </div>

        {/* Scoreboard */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{homeTeam || "Thuis"}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button onClick={() => setHomeScore(Math.max(0, homeScore - 1))} style={{ background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.textDim, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>−</button>
              <span style={{ ...mono, fontSize: 36, fontWeight: 700, color: T.text, minWidth: 36, textAlign: "center" }}>{homeScore}</span>
              <button onClick={() => { setHomeScore(homeScore + 1); fireConfetti(); vibrate([100, 50, 200]); }} style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.accent, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>+</button>
            </div>
          </div>
          <div style={{ fontSize: 20, color: T.textMuted, fontWeight: 300, padding: "0 4px" }}>–</div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{awayTeam || "Uit"}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button onClick={() => setAwayScore(Math.max(0, awayScore - 1))} style={{ background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.textDim, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>−</button>
              <span style={{ ...mono, fontSize: 36, fontWeight: 700, color: T.text, minWidth: 36, textAlign: "center" }}>{awayScore}</span>
              <button onClick={() => setAwayScore(awayScore + 1)} style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.accent, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>+</button>
            </div>
          </div>
        </div>

        {/* Keeper picker */}
        {showKeeperPicker && (
          <div style={{ ...card, padding: 16, marginBottom: 10, borderColor: T.keeperDim, background: "rgba(217,119,6,0.04)", animation: "slideIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {Icons.glove(18, T.keeper)}
              <span style={{ fontSize: 14, fontWeight: 700, color: T.keeper }}>Keeper wisselen</span>
              <button onClick={() => setShowKeeperPicker(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(14, T.textMuted)}</button>
            </div>
            <p style={{ fontSize: 12, color: T.textDim, marginBottom: 10 }}>Kies de nieuwe keeper uit veld of bank</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {onField.map(p => {
                const isK = p === matchKeeper;
                return (
                  <button key={p} onClick={() => !isK && swapKeeper(p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: isK ? "rgba(217,119,6,0.08)" : T.glass, border: `1px solid ${isK ? T.keeperDim : T.glassBorder}`, cursor: isK ? "default" : "pointer", textAlign: "left", fontFamily: "'DM Sans',sans-serif", color: T.text, width: "100%", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isK && Icons.glove(14, T.keeper)}
                      <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span>
                      {isK && <Badge variant="keeper">Nu keeper</Badge>}
                    </div>
                    {!isK && <span style={{ fontSize: 12, color: T.keeper, fontWeight: 600 }}>Maak keeper →</span>}
                  </button>
                );
              })}
              {onBench.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8, marginBottom: 2, paddingLeft: 4 }}>Bank</div>
                  {onBench.map(p => (
                    <button key={p} onClick={() => swapKeeper(p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}`, cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans',sans-serif", color: T.text, width: "100%", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span>
                        <Badge variant="bench">Bank</Badge>
                      </div>
                      <span style={{ fontSize: 12, color: T.keeper, fontWeight: 600 }}>Maak keeper →</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Half break */}
        {halfBreak && (
          <div style={{ ...card, padding: 24, marginBottom: 10, textAlign: "center", borderColor: T.warnDim, background: "rgba(217,119,6,0.04)", animation: "slideIn 0.2s ease" }}>
            <div style={{ marginBottom: 8 }}>{Icons.whistle(32, T.warn)}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.warn, margin: "0 0 8px" }}>Rust!</h2>
            <p style={{ color: T.textDim, fontSize: 14, marginBottom: 16 }}>Klaar voor helft {currentHalf + 1}?</p>
            <button onClick={startNextHalf} style={{ ...btnP, width: "100%", padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{Icons.play(14, "#FFFFFF")} Start helft {currentHalf + 1}</button>
          </div>
        )}

        {/* Sub alert */}
        {showSubAlert && !halfBreak && (
          <div style={{ ...card, padding: 20, marginBottom: 10, borderColor: T.warnDim, background: "rgba(217,119,6,0.04)", animation: "slideIn 0.2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ marginBottom: 4 }}>{Icons.whistle(30, T.warn)}</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.warn, margin: 0 }}>Tijd om te wisselen!</h2>
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Klok loopt door — neem de tijd</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {suggestedSubs.out.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {Icons.arrowDown(14)} <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span> <span style={{ ...mono, fontSize: 11, color: T.textMuted }}>{fmt(playTime[p] || 0)}</span>
                  </div>
                  <span style={{ color: T.textMuted }}>→</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{suggestedSubs.inn[i]}</span> <span style={{ ...mono, fontSize: 11, color: T.textMuted }}>{fmt(playTime[suggestedSubs.inn[i]] || 0)}</span> {Icons.arrowUp(14)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={executeSubs} style={{ ...btnP, flex: 1, padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{Icons.check(16, "#FFFFFF")} Wissel!</button>
              <button onClick={skipSubs} style={{ ...btnS, padding: "12px 16px" }}>Sla over</button>
            </div>
          </div>
        )}

        {/* Field */}
        <div style={{ ...card, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: T.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>In het veld ({onField.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[...onField.filter(p => p === matchKeeper), ...[...onField.filter(p => p !== matchKeeper)].sort((a, b) => (playTime[b] || 0) - (playTime[a] || 0))].map(p => {
              const isK = p === matchKeeper; const isSel = manualSubMode === p;
              return (
                <div key={p} onClick={() => { if (onBench.length > 0 && !showSubAlert && !halfBreak) setManualSubMode(manualSubMode === p ? null : p); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    background: isSel ? "rgba(220,38,38,0.06)" : isK ? "rgba(217,119,6,0.04)" : "rgba(22,163,74,0.03)",
                    border: isSel ? `1px solid ${T.dangerDim}` : `1px solid ${T.glassBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isK && Icons.glove(14, T.keeper)}
                    <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span>
                    {isK && <Badge variant="keeper">Keeper</Badge>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...mono, fontSize: 12, color: T.textMuted }}>{fmt(playTime[p] || 0)}</span>
                    {isSel && <span style={{ fontSize: 11, color: T.danger, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{Icons.arrowDown(12)} kies vervanger</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        {onBench.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: T.warn }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Bank ({onBench.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[...onBench].sort((a, b) => (playTime[a] || 0) - (playTime[b] || 0)).map(p => (
                <div key={p} onClick={() => { if (manualSubMode) { manualSub(manualSubMode, p); setManualSubMode(null); } }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, transition: "all 0.15s",
                    background: manualSubMode ? "rgba(22,163,74,0.04)" : "rgba(217,119,6,0.03)",
                    border: manualSubMode ? `1px solid ${T.accentDim}` : `1px solid ${T.glassBorder}`,
                    cursor: manualSubMode ? "pointer" : "default" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...mono, fontSize: 12, color: T.textMuted }}>{fmt(playTime[p] || 0)}</span>
                    {manualSubMode && <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{Icons.arrowUp(12)} tap</span>}
                  </div>
                </div>
              ))}
            </div>
            {!manualSubMode && !showSubAlert && !halfBreak && <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center", marginTop: 10, marginBottom: 0 }}>Tik op veldspeler voor handmatige wissel</p>}
          </div>
        )}
      </div>
    </div>
  );
}
