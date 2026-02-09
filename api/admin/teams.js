// Lees/schrijf coach teams configuratie
// GET: huidige teams ophalen
// PUT: teams bijwerken (schrijft naar Vercel env var via Vercel API, of geeft instructies)

function checkAdmin(req) {
  const auth = req.headers['x-admin-code'] || '';
  const adminCode = process.env.ADMIN_CODE || '';
  return adminCode && auth.trim() === adminCode.trim();
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const teamsEnv = process.env.COACH_TEAMS;
    let teams = {};
    if (teamsEnv) {
      try { teams = JSON.parse(teamsEnv); } catch { /* ignore */ }
    }
    return res.status(200).json({ teams });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
