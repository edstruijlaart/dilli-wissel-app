// Team config per coachcode
// Leest eerst uit Redis (coach_teams key), fallback naar COACH_TEAMS env var
import { redis } from '../_lib/redis.js';

const TEAMS_KEY = 'coach_teams';

async function getTeams() {
  // Probeer Redis eerst
  try {
    const teams = await redis.get(TEAMS_KEY);
    if (teams) {
      return typeof teams === 'string' ? JSON.parse(teams) : teams;
    }
  } catch { /* Redis fout, probeer env var */ }

  // Fallback: COACH_TEAMS env var
  const teamsEnv = process.env.COACH_TEAMS;
  if (teamsEnv) {
    try { return JSON.parse(teamsEnv); } catch { /* ignore */ }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const input = code.trim().toUpperCase();
  const teams = await getTeams();

  if (teams) {
    // Lookup by code (case-insensitive keys)
    const entry = Object.entries(teams).find(([k]) => k.toUpperCase() === input);
    if (entry) {
      const [, config] = entry;
      return res.status(200).json({ valid: true, team: config.team || null, players: config.players || [] });
    }
    return res.status(200).json({ valid: false });
  }

  // Fallback: simple comma-separated codes (no team data)
  const codesEnv = process.env.COACH_CODES || '';
  const validCodes = codesEnv.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  if (validCodes.length === 0) {
    return res.status(200).json({ valid: true });
  }

  const valid = validCodes.includes(input);
  return res.status(200).json({ valid });
}
