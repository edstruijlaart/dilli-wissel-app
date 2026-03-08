export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID key not configured' });
  }

  return res.status(200).json({ publicKey });
}
