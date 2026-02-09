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

  const headers = { 'Content-Type': 'application/json', 'x-admin-code': adminCode };

  const loadData = useCallback(async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        fetch('/api/admin/matches', { headers }),
        fetch('/api/admin/teams', { headers }),
      ]);
      const mData = await mRes.json();
      const tData = await tRes.json();
      setMatches(mData.matches || []);
      setTeams(tData.teams || {});
    } catch { /* ignore */ }
    setLoading(false);
  }, [adminCode]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh elke 15 seconden
  useEffect(() => {
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

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
          <div>
            {Object.keys(teams).length === 0 && (
              <div style={{ ...card, padding: 24, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: T.textMuted }}>Geen teams geconfigureerd</p>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Stel COACH_TEAMS in via Vercel env vars</p>
              </div>
            )}
            {Object.entries(teams).map(([code, config]) => (
              <div key={code} style={{ ...card, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ ...mono, fontSize: 16, fontWeight: 800, color: T.accent, letterSpacing: 2 }}>{code}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{config.team || 'Onbekend'}</span>
                </div>
                {config.players && config.players.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {config.players.map(p => (
                      <span key={p} style={{
                        fontSize: 12, fontWeight: 600, color: T.textDim,
                        background: T.glass, padding: "4px 10px", borderRadius: 8,
                        border: `1px solid ${T.glassBorder}`,
                      }}>{p}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: T.textMuted }}>Geen spelers ingesteld</p>
                )}
              </div>
            ))}

            <div style={{ ...card, padding: 16, marginTop: 16, background: "rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Teams wijzigen</div>
              <p style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>
                Teams worden beheerd via de <strong>COACH_TEAMS</strong> env var in Vercel.
                Ga naar het Vercel dashboard om teams toe te voegen of te wijzigen.
              </p>
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 8, ...mono }}>
                Format: {`{"code":{"team":"Naam","players":["..."]}}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
