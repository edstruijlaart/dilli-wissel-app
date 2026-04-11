import { redis } from '../_lib/redis.js';

// Sla een afgeronde wedstrijd op in team historie (permanent, geen TTL)
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { teamName, match } = req.body || {};
  if (!teamName || !match) return res.status(400).json({ error: 'teamName and match are required' });

  try {
    const key = `history:${teamName}`;
    const existing = await redis.get(key);
    const history = Array.isArray(existing) ? existing : [];

    // Voeg nieuwe wedstrijd toe (nieuwste eerst) — volledige data voor terugkijken
    const entry = {
      id: `m_${Date.now()}`,
      date: new Date().toISOString(),
      homeTeam: match.homeTeam || '',
      awayTeam: match.awayTeam || '',
      homeScore: match.homeScore || 0,
      awayScore: match.awayScore || 0,
      playTime: match.playTime || {},
      goalScorers: match.goalScorers || {},
      subCount: (match.subHistory || []).length,
      subHistory: match.subHistory || [],
      events: match.events || [],
      excludedPlayers: match.excludedPlayers || [],
      players: match.players || [],
      halves: match.halves || 2,
      halfDuration: match.halfDuration || 20,
      matchLog: match.matchLog || [],
    };

    history.unshift(entry);

    // Max 100 wedstrijden per team bewaren
    if (history.length > 100) history.length = 100;

    await redis.set(key, history);
    return res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    console.error('Save match error:', err);
    return res.status(500).json({ error: 'Failed to save match' });
  }
}
