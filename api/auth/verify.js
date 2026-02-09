export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  // COACH_CODES format: "007,TEAM9,JO82" (comma-separated)
  // Falls back to single COACH_CODE for backwards compat
  const codesEnv = process.env.COACH_CODES || process.env.COACH_CODE || '';
  const validCodes = codesEnv.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  if (validCodes.length === 0) {
    // No codes configured = open access
    return res.status(200).json({ valid: true });
  }

  const valid = validCodes.includes(code.trim().toUpperCase());
  return res.status(200).json({ valid });
}
