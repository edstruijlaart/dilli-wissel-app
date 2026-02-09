import React, { useEffect } from 'react';
import { T, base, card, btnP, btnS, mono } from '../theme';
import { parseNames } from '../utils/format';
import { vibrate } from '../utils/audio';
import Icons from '../components/Icons';
import DilliLogo from '../components/DilliLogo';
import Badge from '../components/Badge';
import Stepper from '../components/Stepper';

export default function SetupView({ state }) {
  const {
    players, setPlayers, keeper, setKeeper, newPlayer, setNewPlayer,
    playersOnField, setPlayersOnField, halfDuration, setHalfDuration,
    halves, setHalves, subInterval, setSubInterval,
    homeTeam, setHomeTeam, awayTeam, setAwayTeam,
    totalMatchTime, showPaste, setShowPaste,
    clipboardNames, setClipboardNames, showClipBanner, setShowClipBanner,
    clipDismissed, setClipDismissed, pasteText, setPasteText,
    pasteResult, setPasteResult,
    addPlayer, removePlayer, movePlayer, toggleKeeper, startMatch,
  } = state;

  const parsePastedNames = () => {
    if (!pasteText.trim()) return;
    const names = parseNames(pasteText);
    const newN = names.filter(n => !players.includes(n));
    if (newN.length > 0) {
      setPlayers(p => [...p, ...newN]);
      setPasteResult({ count: newN.length, names: newN });
    } else if (names.length > 0) {
      setPasteResult({ count: 0, names });
    } else {
      setPasteResult({ count: -1 });
    }
    setPasteText("");
    setTimeout(() => setShowPaste(false), 1500);
  };

  const tryReadClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text === clipDismissed) return;
      const found = parseNames(text);
      const newFound = found.filter(n => !players.includes(n));
      if (newFound.length >= 2) {
        setClipboardNames(newFound);
        setShowClipBanner(true);
      }
    } catch(e) {}
  };

  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") tryReadClipboard(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  });

  const canStart = players.length > playersOnField;

  return (
    <div style={base}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px" }}>
        <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
          <DilliLogo size={72} />
          <div style={{ fontSize: 13, fontWeight: 600, color: T.accent, letterSpacing: 3, textTransform: "uppercase", marginTop: 8, marginBottom: 4 }}>Dilli Wissel App</div>
          <p style={{ color: T.textDim, fontSize: 14, marginTop: 6 }}>Jeugdvoetbal wisselmanager</p>
        </div>

        <div style={{ ...card, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textDim, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Wedstrijd</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Stepper label="In veld" value={playersOnField} set={setPlayersOnField} min={3} step={1} />
            <Stepper label="Helften" value={halves} set={setHalves} min={1} step={1} />
            <Stepper label="Min / helft" value={halfDuration} set={setHalfDuration} min={5} step={5} />
            <Stepper label="Wissel elke" value={subInterval} set={setSubInterval} min={2} step={1} />
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>Thuis</div>
              <input type="text" value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Thuisploeg" style={{ width: "100%", padding: "9px 12px", background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 10, color: T.text, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>Uit</div>
              <input type="text" value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Tegenstander" style={{ width: "100%", padding: "9px 12px", background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 10, color: T.text, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}`, fontSize: 13, color: T.textDim }}>
            {halves}×{halfDuration}min = {totalMatchTime}min
            {keeper && <span style={{ color: T.keeper }}> · {Icons.glove(12, T.keeper)} {keeper}</span>}
          </div>
        </div>

        <div style={{ ...card, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Selectie <span style={{ color: T.text }}>{players.length}</span></div>
            {players.length > 0 && <div style={{ fontSize: 12, color: T.textMuted }}>{Math.min(playersOnField, players.length)} veld · {Math.max(0, players.length - playersOnField)} bank</div>}
          </div>

          {showClipBanner && clipboardNames.length > 0 && (
            <div style={{ marginBottom: 12, padding: 14, borderRadius: 12, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>{clipboardNames.length} spelers op klembord gevonden</div>
              <div style={{ fontSize: 12, color: T.textDim }}>{clipboardNames.join(", ")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setPlayers(p => [...p, ...clipboardNames]); setShowClipBanner(false); vibrate([100]); }} style={{ ...btnP, flex: 1, padding: "8px 0", fontSize: 13 }}>Toevoegen</button>
                <button onClick={() => { setClipDismissed(clipboardNames.join(",")); setShowClipBanner(false); setClipboardNames([]); }} style={{ ...btnS, flex: 1, padding: "8px 0", fontSize: 13 }}>Nee, bedankt</button>
              </div>
            </div>
          )}

          <div onClick={() => { setShowPaste(true); setPasteResult(null); }} style={{ marginBottom: 12, padding: 16, borderRadius: 12, border: `2px dashed ${T.cardBorder}`, textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: T.glass }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; }}>
            <div style={{ marginBottom: 4, opacity: 0.6 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
            <p style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>Spelers plakken</p>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Kopieer de lijst uit WhatsApp</p>
          </div>

          {showPaste && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, animation: "slideIn .25s", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Spelers plakken</h3>
                <p style={{ color: T.textMuted, fontSize: 12, marginBottom: 12 }}>Plak een genummerde lijst, bv. uit WhatsApp:</p>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={"1. Luuk\n2. Daan\n3. Morris\n4. Nolan\n..."} rows={7} style={{ width: "100%", padding: 12, background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} autoFocus />
                {pasteResult && (
                  <p style={{ fontSize: 13, marginTop: 8, fontWeight: 500, color: pasteResult.count > 0 ? T.accent : pasteResult.count === 0 ? T.textDim : T.warn }}>
                    {pasteResult.count > 0 ? `✓ ${pasteResult.count} speler${pasteResult.count !== 1 ? "s" : ""} toegevoegd: ${pasteResult.names.join(", ")}` : pasteResult.count === 0 ? "Alle namen stonden er al in" : "Geen namen herkend — probeer een genummerde lijst"}
                  </p>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => { setShowPaste(false); setPasteText(""); setPasteResult(null); }} style={{ ...btnS, flex: 1, padding: "10px 0" }}>Annuleer</button>
                  <button onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setPasteText(t); } catch(e) {} }} style={{ ...btnS, padding: "10px 12px" }}>📋</button>
                  <button onClick={parsePastedNames} disabled={!pasteText.trim()} style={{ ...btnP, flex: 1, padding: "10px 0", opacity: pasteText.trim() ? 1 : 0.4 }}>Herken namen</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input type="text" value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()} placeholder="Naam toevoegen..." style={{ flex: 1, padding: "10px 14px", background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 12, color: T.text, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
            <button onClick={addPlayer} style={{ ...btnP, padding: "10px 18px" }}>+</button>
          </div>

          {players.length > 0 && <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 10, textAlign: "center" }}>Tik {Icons.glove(11, T.textMuted)} voor keeper</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {players.map((p, i) => {
              const isK = keeper === p;
              const isField = isK || (keeper ? players.filter((pl, idx) => idx < i && pl !== keeper).length + 1 < playersOnField : i < playersOnField);
              return (
                <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: isK ? "rgba(217,119,6,0.06)" : isField ? "rgba(22,163,74,0.04)" : "rgba(217,119,6,0.04)", border: isK ? `1px solid ${T.keeperDim}` : `1px solid ${T.glassBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <button onClick={() => movePlayer(i, -1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>{Icons.chevUp(10, T.textMuted)}</button>
                      <button onClick={() => movePlayer(i, 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, display: "flex" }}>{Icons.chevDown(10, T.textMuted)}</button>
                    </div>
                    <button onClick={() => toggleKeeper(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: isK ? 1 : 0.3, transition: "opacity 0.2s", display: "flex" }}>{Icons.glove(16, isK ? T.keeper : T.textMuted)}</button>
                    <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{p}</span>
                    {isK ? <Badge variant="keeper">Keeper</Badge> : isField ? <Badge variant="field">Veld</Badge> : <Badge variant="bench">Bank</Badge>}
                  </div>
                  <button onClick={() => removePlayer(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", opacity: 0.4, transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>{Icons.x(14, T.danger)}</button>
                </div>
              );
            })}
          </div>
          {players.length > 0 && <button onClick={() => { setPlayers([]); setKeeper(null); }} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", marginTop: 12, fontFamily: "'DM Sans',sans-serif" }}>Alles wissen</button>}
        </div>

        <button onClick={startMatch} disabled={!canStart} style={{ ...btnP, width: "100%", padding: "16px 0", fontSize: 16, opacity: canStart ? 1 : 0.3, cursor: canStart ? "pointer" : "not-allowed", boxShadow: canStart ? "0 4px 16px rgba(22,163,74,0.25)" : "none" }}>
          {!canStart ? `Nog ${Math.max(1, playersOnField - players.length + 1)} speler${playersOnField - players.length + 1 !== 1 ? "s" : ""} nodig` : "Start wedstrijd →"}
        </button>
      </div>
    </div>
  );
}
