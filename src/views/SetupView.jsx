import React, { useEffect, useState, useRef, useCallback } from 'react';
import { T, base, card, btnP, btnS, mono } from '../theme';
import { parseNames } from '../utils/format';
import { vibrate } from '../utils/audio';
import Icons from '../components/Icons';
import DilliLogo from '../components/DilliLogo';
import Badge from '../components/Badge';
import Stepper from '../components/Stepper';
import FormationPicker from '../components/FormationPicker';
import FieldView from '../components/FieldView';
import { assignPlayersToFormation } from '../data/formations';

export default function SetupView({ state, onStartMatch, onBack }) {
  const {
    players, setPlayers, keeper, setKeeper, newPlayer, setNewPlayer,
    playersOnField, setPlayersOnField, halfDuration, setHalfDuration,
    halves, setHalves, subInterval, setSubInterval,
    homeTeam, setHomeTeam, awayTeam, setAwayTeam,
    setHomeLogo, setAwayLogo,
    team, setTeam, isOnline,
    totalMatchTime, showPaste, setShowPaste,
    clipboardNames, setClipboardNames, showClipBanner, setShowClipBanner,
    clipDismissed, setClipDismissed, pasteText, setPasteText,
    pasteResult, setPasteResult,
    addPlayer, removePlayer, movePlayer, toggleKeeper,
    matchMode, autoSubs, formation, setFormation, playerPositions, setPlayerPositions,
    updatePlayerPosition, squadNumbers,
    keeperRotation, setKeeperRotation, keeperQueue, setKeeperQueue,
  } = state;

  const showFieldView = playersOnField >= 7;

  // Drag & drop state voor spelersvolgorde
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragStartY = useRef(0);
  const dragItemHeight = useRef(0);
  const listRef = useRef(null);

  const handleDragStart = useCallback((i, e) => {
    e.preventDefault();
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    const row = e.currentTarget.closest('[data-player-row]');
    if (row) dragItemHeight.current = row.offsetHeight + 4; // gap = 4
    setDragIdx(i);
    setDragOverIdx(i);
    vibrate([10]);
  }, []);

  const handleDragMove = useCallback((e) => {
    if (dragIdx === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const diff = touch.clientY - dragStartY.current;
    const offset = Math.round(diff / (dragItemHeight.current || 40));
    const newIdx = Math.max(0, Math.min(players.length - 1, dragIdx + offset));
    setDragOverIdx(newIdx);
  }, [dragIdx, players.length]);

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const updated = [...players];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(dragOverIdx, 0, moved);
      setPlayers(updated);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, dragOverIdx, players, setPlayers]);

  // Bereken veldspelers voor FieldView preview
  const fieldPlayers = (() => {
    if (!showFieldView || players.length === 0) return [];
    const kp = keeper;
    const others = players.filter(p => p !== kp);
    const onField = kp ? [kp, ...others.slice(0, playersOnField - 1)] : others.slice(0, playersOnField);
    return onField;
  })();

  // Herbereken posities wanneer formatie of spelers wijzigen in tactiek modus
  const handleFormationChange = (key) => {
    setFormation(key);
    if (key !== "custom" && fieldPlayers.length > 0) {
      const positions = assignPlayersToFormation(key, fieldPlayers, keeper);
      setPlayerPositions(positions);
    }
  };

  // Initialiseer posities als er nog geen zijn maar wel een formatie
  useEffect(() => {
    if (!showFieldView || !formation || formation === "custom") return;
    if (fieldPlayers.length === 0) return;
    // Alleen herberekenen als er spelers zijn zonder positie
    const hasPositions = fieldPlayers.some(p => playerPositions[p]);
    if (!hasPositions) {
      const positions = assignPlayersToFormation(formation, fieldPlayers, keeper);
      setPlayerPositions(positions);
    }
  }, [showFieldView, formation, players.length, keeper]);

  // Schedule: volgende wedstrijd ophalen
  const [schedule, setSchedule] = useState({ loading: false, match: null, error: null });

  useEffect(() => {
    if (!team) return;
    setSchedule(s => ({ ...s, loading: true }));
    fetch(`/api/schedule?team=${encodeURIComponent(team)}&weken=4`)
      .then(r => r.ok ? r.json() : Promise.reject('API error'))
      .then(matches => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Vind eerstvolgende wedstrijd (vandaag of later, geen uitslag)
        const upcoming = matches.find(m => {
          const matchDay = new Date(m.datum);
          matchDay.setHours(0, 0, 0, 0);
          return matchDay >= today && !m.uitslag && !m.afgelast;
        });
        setSchedule({ loading: false, match: upcoming || null, error: null });
        // Auto-fill tegenstander als het veld nog leeg is
        if (upcoming && !awayTeam) {
          const opponent = upcoming.isThuiswedstrijd ? upcoming.uit : upcoming.thuis;
          // Verwijder "JM" suffix en club prefix voor mooiere naam
          const cleanName = opponent?.replace(/JM$/, '').trim();
          setAwayTeam(cleanName || opponent);
        }
        // Logo's opslaan: homeLogo = Ed's team, awayLogo = tegenstander
        // Bij uitwedstrijd zijn thuis/uit omgedraaid in de API data
        if (upcoming) {
          if (upcoming.isThuiswedstrijd) {
            setHomeLogo(upcoming.thuisLogo || null);
            setAwayLogo(upcoming.uitLogo || null);
          } else {
            setHomeLogo(upcoming.uitLogo || null);
            setAwayLogo(upcoming.thuisLogo || null);
          }
        }
      })
      .catch(() => setSchedule({ loading: false, match: null, error: 'Kon programma niet laden' }));
  }, [team]);

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

  const canStart = players.length >= playersOnField && !!keeper;

  return (
    <div style={base}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px" }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center", gap: 6, color: T.textDim, fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Terug
          </button>
        )}
        <div style={{ textAlign: "center", padding: "24px 0 20px" }}>
          <DilliLogo size={72} />
          <div style={{ fontSize: 13, fontWeight: 600, color: T.accent, letterSpacing: 3, textTransform: "uppercase", marginTop: 8, marginBottom: 4 }}>Dilli Wissel App</div>
          <p style={{ color: T.textDim, fontSize: 14, marginTop: 6 }}>Jeugdvoetbal wisselmanager</p>
        </div>

        <div style={{ ...card, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textDim, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Wedstrijd</div>
          {isOnline && team && (
            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: `${T.accent}15`, border: `1px solid ${T.accent}30` }}>
              <div style={{ fontSize: 11, color: T.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Jouw team</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{team}</div>
            </div>
          )}

          {/* Volgende wedstrijd uit programma */}
          {schedule.match && (() => {
            const m = schedule.match;
            const d = new Date(m.datum);
            const dag = ['zo','ma','di','wo','do','vr','za'][d.getDay()];
            const maand = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getMonth()];
            const tijd = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const thuisLogo = m.thuisLogo;
            const uitLogo = m.uitLogo;
            return (
              <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, background: "linear-gradient(135deg, rgba(22,163,74,0.04) 0%, rgba(22,163,74,0.08) 100%)", border: `1px solid ${T.accent}20` }}>
                <div style={{ fontSize: 11, color: T.accent, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>📅 Volgende wedstrijd</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                    {thuisLogo ? (
                      <img src={thuisLogo} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6 }} onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: T.glass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚽</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.2 }}>{m.thuis?.replace(/JM$/, '').trim()}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.textMuted }}>vs</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                    {uitLogo ? (
                      <img src={uitLogo} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6 }} onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: T.glass, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚽</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.2 }}>{m.uit?.replace(/JM$/, '').trim()}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 12, color: T.textDim }}>
                  <span>{dag} {d.getDate()} {maand} · {tijd}</span>
                  {m.veld && <span>· {m.veld}</span>}
                  {m.isThuiswedstrijd && <span style={{ color: T.accent }}>🏠 Thuis</span>}
                </div>
              </div>
            );
          })()}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Stepper label="In veld" value={playersOnField} set={setPlayersOnField} min={3} step={1} />
            <Stepper label="Helften" value={halves} set={setHalves} min={1} step={1} />
            <Stepper label="Min / helft" value={halfDuration} set={setHalfDuration} min={5} step={5} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>Tegenstander</div>
            <input type="text" value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Tegenstander" style={{ width: "100%", padding: "9px 12px", background: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 10, color: T.text, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
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

          <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 4 }} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}>
            {players.map((p, i) => {
              const isK = keeper === p;
              const isField = isK || (keeper ? players.filter((pl, idx) => idx < i && pl !== keeper).length + 1 < playersOnField : i < playersOnField);
              const isDragging = dragIdx === i;
              const isDropTarget = dragOverIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <div key={p} data-player-row style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: isK ? "rgba(217,119,6,0.06)" : isField ? "rgba(22,163,74,0.04)" : "rgba(217,119,6,0.04)", border: isDragging ? `2px solid ${T.accent}` : isDropTarget ? `2px dashed ${T.accent}` : isK ? `1px solid ${T.keeperDim}` : `1px solid ${T.glassBorder}`, opacity: isDragging ? 0.6 : 1, transition: isDragging ? "none" : "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div onTouchStart={(e) => handleDragStart(i, e)} style={{ cursor: "grab", padding: "4px 2px", display: "flex", alignItems: "center", touchAction: "none", color: T.textMuted, fontSize: 16, lineHeight: 1, userSelect: "none" }}>
                      ≡
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

        {/* Keeper roulatie (v3.30.0) — optioneel wisselende keeper per helft */}
        {keeper && halves >= 2 && (
          <div style={{ ...card, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: keeperRotation ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {Icons.glove(16, T.keeper)}
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Wisselende keeper</span>
              </div>
              <button onClick={() => {
                const next = !keeperRotation;
                setKeeperRotation(next);
                if (next && keeperQueue.length === 0) {
                  // Start queue met huidige keeper als H1
                  setKeeperQueue([keeper]);
                }
                if (!next) setKeeperQueue([]);
              }} style={{ width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: keeperRotation ? T.accent : T.glass, position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: keeperRotation ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
              </button>
            </div>
            {keeperRotation && (
              <div>
                <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Tik een speler om keeper per helft in te stellen</p>
                {/* Queue per helft */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {Array.from({ length: halves }, (_, h) => {
                    const assignedKeeper = keeperQueue[h] || null;
                    return (
                      <div key={h} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: assignedKeeper ? "rgba(217,119,6,0.06)" : T.glass, border: `1px solid ${assignedKeeper ? T.keeperDim : T.glassBorder}` }}>
                        <span style={{ ...mono, fontSize: 12, color: T.textMuted, minWidth: 24 }}>H{h + 1}</span>
                        {assignedKeeper ? (
                          <span style={{ fontSize: 14, fontWeight: 600, color: T.keeper, flex: 1 }}>{Icons.glove(12, T.keeper)} {assignedKeeper}</span>
                        ) : (
                          <span style={{ fontSize: 13, color: T.textMuted, flex: 1, fontStyle: "italic" }}>Nog geen keeper</span>
                        )}
                        {assignedKeeper && h > 0 && (
                          <button onClick={() => {
                            const q = [...keeperQueue];
                            q[h] = null;
                            // Trim trailing nulls
                            while (q.length > 1 && !q[q.length - 1]) q.pop();
                            setKeeperQueue(q);
                          }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5, display: "flex" }}>{Icons.x(12, T.danger)}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Speler-chips om toe te wijzen */}
                {(() => {
                  // Vind eerste lege helft
                  const emptyIdx = Array.from({ length: halves }, (_, h) => h).find(h => !keeperQueue[h]);
                  if (emptyIdx == null) return null;
                  return (
                    <div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Kies keeper voor helft {emptyIdx + 1}:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {players.map(p => (
                          <button key={p} onClick={() => {
                            const q = [...keeperQueue];
                            // Pad met nulls tot emptyIdx
                            while (q.length <= emptyIdx) q.push(null);
                            q[emptyIdx] = p;
                            setKeeperQueue(q);
                          }} style={{ padding: "6px 12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.glassBorder}`, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans',sans-serif", color: T.text, transition: "all 0.15s" }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Opstelling preview in tactiek modus */}
        {showFieldView && fieldPlayers.length > 0 && (
          <div style={{ ...card, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Opstelling</div>
            <FormationPicker value={formation} onChange={handleFormationChange} />
            <div style={{ marginTop: 12 }}>
              <FieldView
                onField={fieldPlayers}
                playerPositions={playerPositions}
                squadNumbers={squadNumbers}
                matchKeeper={keeper}
                interactive={true}
                onPositionChange={updatePlayerPosition}
              />
            </div>
            {formation && (
              <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: T.textMuted }}>
                {formation === "custom" ? "Vrije opstelling — sleep spelers" : `Formatie ${formation} — sleep om aan te passen`}
              </div>
            )}
          </div>
        )}

        <button onClick={onStartMatch} disabled={!canStart} style={{ ...btnP, width: "100%", padding: "16px 0", fontSize: 16, opacity: canStart ? 1 : 0.3, cursor: canStart ? "pointer" : "not-allowed", boxShadow: canStart ? "0 4px 16px rgba(22,163,74,0.25)" : "none" }}>
          {!canStart ? (players.length >= playersOnField && !keeper ? "Wijs eerst een keeper aan" : `Nog ${Math.max(1, playersOnField - players.length)} speler${playersOnField - players.length !== 1 ? "s" : ""} nodig`) : "Start wedstrijd →"}
        </button>
      </div>
    </div>
  );
}
