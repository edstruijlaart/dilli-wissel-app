// Team config per coachcode
// Env var COACH_TEAMS format: JSON object {"007":{"team":"JO8-2","players":[...]},"006":{...}}
// Falls back to simple COACH_CODES (comma-separated) if COACH_TEAMS not set

function getTeams() {
  const teamsEnv = process.env.COACH_TEAMS;
  if (teamsEnv) {
    try {
      return JSON.parse(teamsEnv);
    } catch { /* ignore parse errors */ }
  }
  return null;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const input = code.trim().toUpperCase();
  const teams = getTeams();

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
