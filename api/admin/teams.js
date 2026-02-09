import { redis } from '../_lib/redis.js';

const TEAMS_KEY = 'coach_teams';

function checkAdmin(req) {
  const auth = req.headers['x-admin-code'] || '';
  const adminCode = process.env.ADMIN_CODE || '';
  return adminCode && auth.trim() === adminCode.trim();
}

// Haal teams op uit Redis, seed vanuit env var als Redis leeg is
async function getTeams() {
  let teams = await redis.get(TEAMS_KEY);
  if (teams) {
    return typeof teams === 'string' ? JSON.parse(teams) : teams;
  }
  // Seed vanuit COACH_TEAMS env var (eenmalig)
  const teamsEnv = process.env.COACH_TEAMS;
  if (teamsEnv) {
    try {
      teams = JSON.parse(teamsEnv);
      await redis.set(TEAMS_KEY, JSON.stringify(teams));
      return teams;
    } catch { /* ignore parse errors */ }
  }
  return {};
}

async function saveTeams(teams) {
  await redis.set(TEAMS_KEY, JSON.stringify(teams));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET: alle teams ophalen
  if (req.method === 'GET') {
    try {
      const teams = await getTeams();
      return res.status(200).json({ teams });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to get teams', detail: err.message });
    }
  }

  // POST: team toevoegen of bijwerken
  if (req.method === 'POST') {
    try {
      const { code, team, players } = req.body || {};
      if (!code || !code.trim()) return res.status(400).json({ error: 'Code is verplicht' });
      if (!team || !team.trim()) return res.status(400).json({ error: 'Teamnaam is verplicht' });

      const teams = await getTeams();
      const upperCode = code.trim().toUpperCase();
      teams[upperCode] = {
        team: team.trim(),
        players: Array.isArray(players) ? players.map(p => p.trim()).filter(Boolean) : [],
      };
      await saveTeams(teams);
      return res.status(200).json({ ok: true, teams });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save team', detail: err.message });
    }
  }

  // DELETE: team verwijderen
  if (req.method === 'DELETE') {
    try {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Code is verplicht' });

      const teams = await getTeams();
      const upperCode = code.trim().toUpperCase();
      if (!teams[upperCode]) return res.status(404).json({ error: 'Team niet gevonden' });

      delete teams[upperCode];
      await saveTeams(teams);
      return res.status(200).json({ ok: true, teams });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete team', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
