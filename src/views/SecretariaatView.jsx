import React, { useState, useEffect, useCallback, useRef } from 'react';
import { T, base, card, mono, btnP, btnS } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

const SEC_KEY = 'dilli_secretariaat';

export default function SecretariaatView({ onBack }) {
  const [secCode, setSecCode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Check saved session
  useEffect(() => {
    const saved = localStorage.getItem(SEC_KEY);
    if (saved) setSecCode(saved);
  }, []);

  const login = async () => {
    if (!secCode.trim()) return;
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/secretariaat/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: secCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem(SEC_KEY, secCode.trim());
        setAuthenticated(true);
      } else {
        setError('Ongeldige code');
      }
    } catch {
      setError('Fout bij inloggen');
    }
    setChecking(false);
  };

  const logout = () => {
    localStorage.removeItem(SEC_KEY);
    setAuthenticated(false);
    setSecCode('');
  };

  // Auto-login
  useEffect(() => {
    const saved = localStorage.getItem(SEC_KEY);
    if (saved && !authenticated) {
      setSecCode(saved);
      fetch('/api/secretariaat/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: saved }),
      })
        .then(r => r.json())
        .then(d => { if (d.valid) setAuthenticated(true); else localStorage.removeItem(SEC_KEY); })
        .catch(() => {});
    }
  }, []);

  if (!authenticated) {
    return (
      <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
        <DilliLogo size={48} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 16, marginBottom: 4 }}>Secretariaat</h2>
        <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 20 }}>v.v. Dilettant wedstrijdsecretariaat</p>
        <div style={{ ...card, padding: 24, width: "100%", maxWidth: 340 }}>
          <input
            type="password"
            value={secCode}
            onChange={e => setSecCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Secretariaat code"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${T.glassBorder}`, fontSize: 16, fontFamily: "'DM Sans',sans-serif", textAlign: "center", letterSpacing: 4, boxSizing: "border-box" }}
            autoFocus
          />
          {error && <p style={{ fontSize: 13, color: T.danger, textAlign: "center", marginTop: 8 }}>{error}</p>}
          <button onClick={login} disabled={checking} style={{ ...btnP, width: "100%", padding: "12px 0", marginTop: 12 }}>
            {checking ? 'Checken...' : 'Inloggen'}
          </button>
        </div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 13, marginTop: 16, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          Terug
        </button>
      </div>
    );
  }

  return <SecretariaatDashboard secCode={secCode} onLogout={logout} onBack={onBack} />;
}

/* ─── Dashboard ─── */

function SecretariaatDashboard({ secCode, onLogout, onBack }) {
  const [tab, setTab] = useState('programma'); // 'programma' | 'live' | 'kleedkamers'
  const [schedule, setSchedule] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const headers = { 'Content-Type': 'application/json', 'x-secretariaat-code': secCode };

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // Haal programma op van VoetbalAssist (alle teams)
  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule?weken=2');
      const data = await res.json();
      setSchedule(data || []);
    } catch { /* ignore */ }
  }, []);

  // Haal live wedstrijden op
  const loadLive = useCallback(async () => {
    try {
      const res = await fetch('/api/match/live');
      const data = await res.json();
      setLiveMatches(data.matches || []);
    } catch { /* ignore */ }
  }, []);

  // Haal kleedkamers op
  const loadKleedkamers = useCallback(async () => {
    try {
      const res = await fetch(`/api/kleedkamers?date=${selectedDate}`, { headers });
      const data = await res.json();
      setRooms(data.rooms || []);
      setAssignments(data.assignments || []);
    } catch { /* ignore */ }
  }, [selectedDate, secCode]);

  // Initieel laden
  useEffect(() => {
    Promise.allSettled([loadSchedule(), loadLive(), loadKleedkamers()]).then(() => setLoading(false));
  }, [loadSchedule, loadLive, loadKleedkamers]);

  // Auto-refresh live elke 10s
  useEffect(() => {
    const iv = setInterval(loadLive, 10000);
    return () => clearInterval(iv);
  }, [loadLive]);

  // Herlaad kleedkamers bij datum wijziging
  useEffect(() => {
    loadKleedkamers();
  }, [selectedDate]);

  // Filter programma op geselecteerde datum
  const daySchedule = schedule.filter(m => {
    if (!m.datum) return false;
    const matchDate = m.datum.split('T')[0];
    return matchDate === selectedDate;
  }).sort((a, b) => new Date(a.datum) - new Date(b.datum));

  // Beschikbare datums uit programma
  const availableDates = [...new Set(schedule.map(m => m.datum?.split('T')[0]).filter(Boolean))].sort();

  // Datum navigatie
  const goToDate = (offset) => {
    const idx = availableDates.indexOf(selectedDate);
    const newIdx = idx + offset;
    if (newIdx >= 0 && newIdx < availableDates.length) {
      setSelectedDate(availableDates[newIdx]);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };

  const tabBtnStyle = (active) => ({
    ...btnS,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 700,
    flex: 1,
    textAlign: "center",
    ...(active ? { background: T.accent, color: '#fff', borderColor: T.accent } : {}),
  });

  return (
    <div style={{ ...base, padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(18, T.textMuted)}</button>
          <DilliLogo size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Wedstrijdsecretariaat</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>v.v. Dilettant</div>
          </div>
          <button onClick={onLogout} style={{ ...btnS, padding: "6px 14px", fontSize: 12 }}>Uitloggen</button>
        </div>

        {/* Datum selector */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => goToDate(-1)} disabled={availableDates.indexOf(selectedDate) <= 0}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: T.textMuted, opacity: availableDates.indexOf(selectedDate) <= 0 ? 0.3 : 1 }}>
            ‹
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{formatDate(selectedDate)}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{daySchedule.length} wedstrijden</div>
          </div>
          <button onClick={() => goToDate(1)} disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: T.textMuted, opacity: availableDates.indexOf(selectedDate) >= availableDates.length - 1 ? 0.3 : 1 }}>
            ›
          </button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => setTab('programma')} style={tabBtnStyle(tab === 'programma')}>
            Programma
          </button>
          <button onClick={() => setTab('live')} style={tabBtnStyle(tab === 'live')}>
            Live {liveMatches.length > 0 && <span style={{ marginLeft: 4, background: tab === 'live' ? 'rgba(255,255,255,0.3)' : T.accentDim, color: tab === 'live' ? '#fff' : T.accent, padding: "1px 6px", borderRadius: 8, fontSize: 11, fontWeight: 800 }}>{liveMatches.length}</span>}
          </button>
          <button onClick={() => setTab('kleedkamers')} style={tabBtnStyle(tab === 'kleedkamers')}>
            Kleedkamers
          </button>
        </div>

        {loading && <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: 20 }}>Laden...</p>}

        {/* Programma tab */}
        {!loading && tab === 'programma' && (
          <ProgrammaTab matches={daySchedule} formatTime={formatTime} liveMatches={liveMatches} />
        )}

        {/* Live tab */}
        {!loading && tab === 'live' && (
          <LiveTab matches={liveMatches} />
        )}

        {/* Kleedkamers tab */}
        {!loading && tab === 'kleedkamers' && (
          <KleedkamersTab
            rooms={rooms}
            assignments={assignments}
            setAssignments={setAssignments}
            daySchedule={daySchedule}
            selectedDate={selectedDate}
            headers={headers}
            showToast={showToast}
            formatTime={formatTime}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: T.text, color: "#FFF", padding: "10px 20px", borderRadius: 12,
          fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 10000,
          animation: "fadeIn 0.2s ease-out"
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ─── Programma Tab ─── */

function ProgrammaTab({ matches, formatTime, liveMatches }) {
  if (matches.length === 0) {
    return (
      <div style={{ ...card, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <p style={{ fontSize: 14, color: T.textMuted }}>Geen wedstrijden op deze dag</p>
      </div>
    );
  }

  // Groepeer per aanvangstijd
  const byTime = {};
  matches.forEach(m => {
    const time = formatTime(m.datum);
    if (!byTime[time]) byTime[time] = [];
    byTime[time].push(m);
  });

  // Check of een wedstrijd live is in Dilli
  const isLive = (match) => {
    return liveMatches.some(lm => {
      const thuisMatch = match.thuisClubEnTeamNaamFriendly?.toLowerCase().includes('dilettant');
      const uitMatch = match.uitClubEnTeamNaamFriendly?.toLowerCase().includes('dilettant');
      if (!thuisMatch && !uitMatch) return false;
      // Vergelijk team namen (fuzzy)
      const dilliTeam = thuisMatch ? match.thuisClubEnTeamNaamFriendly : match.uitClubEnTeamNaamFriendly;
      return lm.homeTeam && dilliTeam?.toLowerCase().includes(lm.homeTeam.toLowerCase());
    });
  };

  return (
    <div>
      {Object.entries(byTime).map(([time, timeMatches]) => (
        <div key={time} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ ...mono, fontSize: 14, fontWeight: 800, color: T.accent }}>{time}</span>
            <div style={{ flex: 1, height: 1, background: T.glassBorder }} />
            <span style={{ fontSize: 11, color: T.textMuted }}>{timeMatches.length} wedstrijd{timeMatches.length !== 1 ? 'en' : ''}</span>
          </div>
          {timeMatches.map((m, i) => {
            const live = isLive(m);
            const isDilettantThuis = m.thuisClubEnTeamNaamFriendly?.toLowerCase().includes('dilettant');
            const isDilettantUit = m.uitClubEnTeamNaamFriendly?.toLowerCase().includes('dilettant');
            const isDilettant = isDilettantThuis || isDilettantUit;

            return (
              <div key={i} style={{
                ...card,
                padding: "12px 14px",
                marginBottom: 6,
                borderLeft: isDilettant ? `3px solid ${T.accent}` : `3px solid transparent`,
                ...(live ? { background: `${T.accentDim}` } : {}),
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isDilettantThuis ? 700 : 400, color: T.text }}>
                      {m.thuisClubEnTeamNaamFriendly || m.thuis || '?'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: isDilettantUit ? 700 : 400, color: T.text, marginTop: 2 }}>
                      {m.uitClubEnTeamNaamFriendly || m.uit || '?'}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {live && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: T.accent, padding: "2px 8px", borderRadius: 6 }}>
                        LIVE
                      </span>
                    )}
                    {m.veld && (
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                        Veld {m.veld}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── Live Tab ─── */

function LiveTab({ matches }) {
  if (matches.length === 0) {
    return (
      <div style={{ ...card, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
        <p style={{ fontSize: 14, color: T.textMuted }}>Geen live wedstrijden op dit moment</p>
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Wedstrijden verschijnen hier zodra een coach de app gebruikt</p>
      </div>
    );
  }

  const statusColors = {
    live: T.accent, paused: T.warn, halftime: T.warn, setup: T.textMuted,
  };
  const statusLabels = {
    live: 'Live', paused: 'Gepauzeerd', halftime: 'Rust', setup: 'Opstellen',
  };

  return (
    <div>
      {matches.map(m => (
        <div key={m.code} style={{ ...card, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fff', padding: "3px 10px", borderRadius: 8,
              background: statusColors[m.status] || T.textMuted,
              animation: m.status === 'live' ? 'pulse 2s infinite' : 'none',
            }}>
              {statusLabels[m.status] || m.status}
            </span>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
              {m.viewers > 0 ? `👀 ${m.viewers}` : ''}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{m.homeTeam || 'Dilettant'}</div>
              <div style={{ fontSize: 15, fontWeight: 400, color: T.textDim, marginTop: 2 }}>{m.awayTeam || 'Tegenstander'}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...mono, fontSize: 28, fontWeight: 800, color: T.accent }}>
                {m.homeScore} - {m.awayScore}
              </span>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                Helft {m.currentHalf}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Kleedkamers Tab ─── */

function KleedkamersTab({ rooms, assignments, setAssignments, daySchedule, selectedDate, headers, showToast, formatTime }) {
  const [saving, setSaving] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [editTeam, setEditTeam] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNote, setEditNote] = useState('');

  if (rooms.length === 0) {
    return (
      <div style={{ ...card, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚿</div>
        <p style={{ fontSize: 14, color: T.textMuted }}>Geen kleedkamers geconfigureerd</p>
        <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Configureer kleedkamers via het admin panel</p>
      </div>
    );
  }

  // Maak een map van room → assignments
  const roomAssignments = {};
  rooms.forEach(r => { roomAssignments[r] = []; });
  assignments.forEach(a => {
    if (roomAssignments[a.room]) roomAssignments[a.room].push(a);
  });

  // Teams uit het dagprogramma voor auto-suggest
  const dayTeams = daySchedule.flatMap(m => {
    const teams = [];
    if (m.thuisClubEnTeamNaamFriendly) teams.push(m.thuisClubEnTeamNaamFriendly);
    if (m.uitClubEnTeamNaamFriendly) teams.push(m.uitClubEnTeamNaamFriendly);
    return teams;
  });
  const uniqueTeams = [...new Set(dayTeams)].sort();

  const addAssignment = (room) => {
    setEditRoom(room);
    setEditTeam('');
    setEditTime('');
    setEditNote('');
  };

  const saveAssignment = async () => {
    if (!editRoom || !editTeam.trim()) return;
    const newAssignment = {
      room: editRoom,
      team: editTeam.trim(),
      time: editTime.trim(),
      note: editNote.trim(),
    };
    const updated = [...assignments, newAssignment];
    setAssignments(updated);
    setEditRoom(null);

    setSaving(true);
    try {
      await fetch('/api/kleedkamers', {
        method: 'POST',
        headers,
        body: JSON.stringify({ date: selectedDate, assignments: updated }),
      });
      showToast('Opgeslagen!');
    } catch {
      showToast('Fout bij opslaan');
    }
    setSaving(false);
  };

  const removeAssignment = async (index) => {
    const updated = assignments.filter((_, i) => i !== index);
    setAssignments(updated);

    try {
      await fetch('/api/kleedkamers', {
        method: 'POST',
        headers,
        body: JSON.stringify({ date: selectedDate, assignments: updated }),
      });
      showToast('Verwijderd');
    } catch {
      showToast('Fout bij verwijderen');
    }
  };

  return (
    <div>
      {rooms.map(room => {
        const roomA = roomAssignments[room] || [];
        return (
          <div key={room} style={{ ...card, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: roomA.length > 0 || editRoom === room ? 10 : 0 }}>
              <span style={{ fontSize: 16 }}>🚿</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1 }}>{room}</span>
              {roomA.length === 0 && editRoom !== room && (
                <span style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>vrij</span>
              )}
              <button onClick={() => addAssignment(room)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: T.accent, padding: "2px 6px" }}>
                +
              </button>
            </div>

            {/* Bestaande toewijzingen */}
            {roomA.map((a, i) => {
              const globalIdx = assignments.indexOf(a);
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: T.glass, borderRadius: 10, marginBottom: 4,
                }}>
                  {a.time && <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.accent, minWidth: 42 }}>{a.time}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{a.team}</span>
                  {a.note && <span style={{ fontSize: 11, color: T.textMuted }}>{a.note}</span>}
                  <button onClick={() => removeAssignment(globalIdx)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: T.danger, padding: "2px 4px" }}>
                    ×
                  </button>
                </div>
              );
            })}

            {/* Toewijzing formulier */}
            {editRoom === room && (
              <div style={{ background: T.glass, borderRadius: 12, padding: 12, marginTop: 4 }}>
                <div style={{ marginBottom: 8 }}>
                  <input
                    list={`teams-${room}`}
                    value={editTeam}
                    onChange={e => setEditTeam(e.target.value)}
                    placeholder="Team naam"
                    autoFocus
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 14,
                      border: `1px solid ${T.glassBorder}`, fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
                    }}
                  />
                  <datalist id={`teams-${room}`}>
                    {uniqueTeams.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    placeholder="Tijd (bijv. 08:30)"
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 14,
                      border: `1px solid ${T.glassBorder}`, fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="text"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="Notitie"
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 14,
                      border: `1px solid ${T.glassBorder}`, fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditRoom(null)} style={{ ...btnS, flex: 1, padding: "8px 0", fontSize: 13 }}>Annuleer</button>
                  <button onClick={saveAssignment} disabled={saving || !editTeam.trim()} style={{ ...btnP, flex: 1, padding: "8px 0", fontSize: 13, opacity: saving || !editTeam.trim() ? 0.5 : 1 }}>
                    {saving ? 'Opslaan...' : 'Toewijzen'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
