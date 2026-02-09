import React, { useState, useEffect, useCallback } from 'react';
import { T, base, card, mono, btnP, btnS, btnD } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

const ADMIN_KEY = 'dilli_admin';

export default function AdminView({ onBack }) {
  const [adminCode, setAdminCode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Check saved admin session
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY);
    if (saved) setAdminCode(saved);
  }, []);

  const login = async () => {
    if (!adminCode.trim()) return;
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem(ADMIN_KEY, adminCode.trim());
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
    localStorage.removeItem(ADMIN_KEY);
    setAuthenticated(false);
    setAdminCode('');
  };

  // Auto-login als code opgeslagen is
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY);
    if (saved && !authenticated) {
      setAdminCode(saved);
      fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: saved }),
      })
        .then(r => r.json())
        .then(d => { if (d.valid) setAuthenticated(true); else localStorage.removeItem(ADMIN_KEY); })
        .catch(() => {});
    }
  }, []);

  if (!authenticated) {
    return (
      <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
        <DilliLogo size={48} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 16, marginBottom: 20 }}>Admin</h2>
        <div style={{ ...card, padding: 24, width: "100%", maxWidth: 340 }}>
          <input
            type="password"
            value={adminCode}
            onChange={e => setAdminCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Admin code"
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

  return <AdminDashboard adminCode={adminCode} onLogout={logout} onBack={onBack} />;
}

function AdminDashboard({ adminCode, onLogout, onBack }) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('matches'); // 'matches' | 'teams'
  const [deleting, setDeleting] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copyMatchLink = (code) => {
    const url = `${baseUrl}/join/${code}`;
    navigator.clipboard?.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const headers = { 'Content-Type': 'application/json', 'x-admin-code': adminCode };

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/teams', { headers });
      const data = await res.json();
      setTeams(data.teams || {});
    } catch { /* ignore */ }
  }, [adminCode]);

  const loadMatches = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/admin/matches', { headers, signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch { /* timeout or error, keep existing data */ }
  }, [adminCode]);

  useEffect(() => {
    Promise.allSettled([loadTeams(), loadMatches()]).then(() => setLoading(false));
  }, [loadTeams, loadMatches]);

  // Auto-refresh matches elke 15 seconden
  useEffect(() => {
    const iv = setInterval(loadMatches, 15000);
    return () => clearInterval(iv);
  }, [loadMatches]);

  const deleteMatch = async (code) => {
    setDeleting(code);
    try {
      await fetch('/api/admin/delete-match', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ code }),
      });
      setMatches(m => m.filter(x => x.code !== code));
    } catch { /* ignore */ }
    setDeleting(null);
  };

  const statusColors = {
    live: T.accent, paused: T.warn, halftime: T.warn, setup: T.textMuted, ended: T.textDim,
  };
  const statusLabels = {
    live: 'Live', paused: 'Gepauzeerd', halftime: 'Rust', setup: 'Opstellen', ended: 'Afgelopen',
  };

  return (
    <div style={{ ...base, padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>{Icons.x(18, T.textMuted)}</button>
          <DilliLogo size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Dilli Admin</div>
          </div>
          <button onClick={onLogout} style={{ ...btnS, padding: "6px 14px", fontSize: 12 }}>Uitloggen</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[['matches', 'Wedstrijden'], ['teams', 'Teams']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              ...btnS, padding: "8px 18px", fontSize: 13,
              ...(tab === key ? { background: T.accent, color: '#fff', borderColor: T.accent } : {}),
            }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: 20 }}>Laden...</p>}

        {/* Wedstrijden tab */}
        {!loading && tab === 'matches' && (
          <div>
            {matches.length === 0 && (
              <div style={{ ...card, padding: 24, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: T.textMuted }}>Geen actieve wedstrijden</p>
              </div>
            )}
            {matches.map(m => (
              <div key={m.code} style={{ ...card, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ ...mono, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: 2 }}>{m.code}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#fff', padding: "2px 8px", borderRadius: 8,
                    background: statusColors[m.status] || T.textMuted,
                  }}>
                    {statusLabels[m.status] || m.status}
                  </span>
                  {m.viewers > 0 && (
                    <span style={{ fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                      {Icons.eye(12, T.textMuted)} {m.viewers}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 16, fontSize: 13, color: T.textDim, marginBottom: 8 }}>
                  <span><strong>{m.team || m.homeTeam || '?'}</strong></span>
                  <span style={{ ...mono }}>{m.homeScore ?? 0} - {m.awayScore ?? 0}</span>
                  {m.awayTeam && <span>vs {m.awayTeam}</span>}
                </div>

                <div style={{ display: "flex", gap: 8, fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
                  <span>{m.players?.length || 0} spelers</span>
                  <span>•</span>
                  <span>Helft {m.currentHalf}/{m.halves}</span>
                  {m.createdAt && (
                    <>
                      <span>•</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => copyMatchLink(m.code)}
                  style={{
                    ...btnS, padding: "6px 14px", fontSize: 12,
                    ...(copiedCode === m.code ? { borderColor: T.accent, color: T.accent } : {}),
                  }}
                >
                  {copiedCode === m.code ? '✓ Gekopieerd!' : 'Link kopiëren'}
                </button>
                <button
                  onClick={() => deleteMatch(m.code)}
                  disabled={deleting === m.code}
                  style={{ ...btnD, padding: "6px 14px", fontSize: 12 }}
                >
                  {deleting === m.code ? 'Verwijderen...' : 'Verwijderen'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Teams tab */}
        {!loading && tab === 'teams' && (
          <TeamsManager teams={teams} setTeams={setTeams} headers={headers} />
        )}
      </div>
    </div>
  );
}

/* ─── Teams Manager Component ─── */

function TeamsManager({ teams, setTeams, headers }) {
  const [editingCode, setEditingCode] = useState(null); // code van team dat we bewerken
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState(null);
  const [feedback, setFeedback] = useState('');

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 2500);
  };

  const saveTeam = async (code, team, players) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, team, players }),
      });
      const data = await res.json();
      if (data.ok) {
        setTeams(data.teams);
        setEditingCode(null);
        setShowAdd(false);
        showFeedback('Team opgeslagen!');
      } else {
        showFeedback(data.error || 'Fout bij opslaan');
      }
    } catch {
      showFeedback('Fout bij opslaan');
    }
    setSaving(false);
  };

  const deleteTeam = async (code) => {
    setDeletingCode(code);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        setTeams(data.teams);
        showFeedback('Team verwijderd');
      } else {
        showFeedback(data.error || 'Fout bij verwijderen');
      }
    } catch {
      showFeedback('Fout bij verwijderen');
    }
    setDeletingCode(null);
  };

  const entries = Object.entries(teams);

  return (
    <div>
      {/* Feedback toast */}
      {feedback && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: T.accent, color: "#fff", padding: "10px 20px", borderRadius: 12,
          fontSize: 14, fontWeight: 700, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {feedback}
        </div>
      )}

      {/* Team toevoegen knop */}
      {!showAdd && !editingCode && (
        <button onClick={() => setShowAdd(true)} style={{ ...btnP, width: "100%", padding: "12px 0", marginBottom: 16, fontSize: 14 }}>
          + Nieuw team
        </button>
      )}

      {/* Nieuw team formulier */}
      {showAdd && (
        <TeamForm
          onSave={saveTeam}
          onCancel={() => setShowAdd(false)}
          saving={saving}
          existingCodes={Object.keys(teams)}
          existingTeams={teams}
        />
      )}

      {/* Bestaande teams */}
      {entries.length === 0 && !showAdd && (
        <div style={{ ...card, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: T.textMuted }}>Geen teams geconfigureerd</p>
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Voeg een team toe met de knop hierboven</p>
        </div>
      )}

      {entries.map(([code, config]) => (
        <div key={code}>
          {editingCode === code ? (
            <TeamForm
              initialCode={code}
              initialTeam={config.team}
              initialPlayers={config.players}
              onSave={saveTeam}
              onCancel={() => setEditingCode(null)}
              saving={saving}
              isEdit
              existingTeams={teams}
            />
          ) : (
            <div style={{ ...card, padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ ...mono, fontSize: 16, fontWeight: 800, color: T.accent, letterSpacing: 2 }}>{code}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{config.team || 'Onbekend'}</span>
                <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
                  {config.players?.length || 0} spelers
                </span>
              </div>

              {config.players && config.players.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                  {config.players.map(p => (
                    <span key={p} style={{
                      fontSize: 12, fontWeight: 600, color: T.textDim,
                      background: T.glass, padding: "4px 10px", borderRadius: 8,
                      border: `1px solid ${T.glassBorder}`,
                    }}>{p}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setEditingCode(code)}
                  style={{ ...btnS, padding: "6px 14px", fontSize: 12 }}
                >
                  Bewerken
                </button>
                <button
                  onClick={() => deleteTeam(code)}
                  disabled={deletingCode === code}
                  style={{ ...btnD, padding: "6px 14px", fontSize: 12 }}
                >
                  {deletingCode === code ? 'Verwijderen...' : 'Verwijderen'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Team Form Component ─── */

function TeamForm({ initialCode = '', initialTeam = '', initialPlayers = [], onSave, onCancel, saving, isEdit, existingCodes = [], existingTeams = {} }) {
  const [code, setCode] = useState(initialCode);
  const [team, setTeam] = useState(initialTeam);
  const [playerText, setPlayerText] = useState(initialPlayers.join(', '));
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!code.trim()) return setError('Code is verplicht');
    if (!team.trim()) return setError('Teamnaam is verplicht');
    // Check dubbele code (alleen bij nieuw team)
    if (!isEdit && existingCodes.map(c => c.toUpperCase()).includes(code.trim().toUpperCase())) {
      return setError('Deze code bestaat al');
    }
    // Check dubbele teamnaam (bij nieuw team of als naam gewijzigd is bij bewerken)
    const teamLower = team.trim().toLowerCase();
    const duplicate = Object.entries(existingTeams).find(([k, v]) => {
      if (isEdit && k.toUpperCase() === initialCode.toUpperCase()) return false; // eigen team overslaan
      return (v.team || '').toLowerCase() === teamLower;
    });
    if (duplicate) {
      return setError(`Teamnaam "${team.trim()}" bestaat al (code: ${duplicate[0]})`);
    }
    setError('');
    const players = playerText
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(Boolean);
    onSave(code.trim().toUpperCase(), team.trim(), players);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1px solid ${T.glassBorder}`, fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box",
  };

  return (
    <div style={{ ...card, padding: 16, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
        {isEdit ? `Team ${initialCode} bewerken` : 'Nieuw team toevoegen'}
      </div>

      {/* Coach code */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
          Coach code
        </label>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="bijv. 007"
          disabled={isEdit}
          style={{
            ...inputStyle,
            ...mono,
            letterSpacing: 3,
            textAlign: "center",
            marginTop: 4,
            ...(isEdit ? { background: "#f0f0f0", color: T.textMuted } : {}),
          }}
          autoFocus={!isEdit}
        />
      </div>

      {/* Teamnaam */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
          Teamnaam
        </label>
        <input
          type="text"
          value={team}
          onChange={e => setTeam(e.target.value)}
          placeholder="bijv. JO8-2"
          style={{ ...inputStyle, marginTop: 4 }}
          autoFocus={isEdit}
        />
      </div>

      {/* Spelers */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
          Spelers <span style={{ fontWeight: 400, textTransform: "none" }}>(komma of nieuwe regel gescheiden)</span>
        </label>
        <textarea
          value={playerText}
          onChange={e => setPlayerText(e.target.value)}
          placeholder="Bobby, Dora, Luuk, Mees..."
          rows={3}
          style={{ ...inputStyle, marginTop: 4, resize: "vertical", minHeight: 60 }}
        />
        {playerText.trim() && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            {playerText.split(/[,\n]/).map(p => p.trim()).filter(Boolean).length} spelers
          </div>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{ ...btnP, padding: "10px 20px", fontSize: 13, flex: 1 }}>
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button onClick={onCancel} style={{ ...btnS, padding: "10px 20px", fontSize: 13 }}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
