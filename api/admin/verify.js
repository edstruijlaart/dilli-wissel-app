// Admin login verificatie
export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const adminCode = process.env.ADMIN_CODE || '';
  if (!adminCode) return res.status(500).json({ error: 'Admin not configured' });

  const valid = code.trim() === adminCode.trim();
  return res.status(200).json({ valid });
}
