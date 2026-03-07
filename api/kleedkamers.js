import { redis } from './_lib/redis.js';

const CONFIG_KEY = 'config:kleedkamers';

function verifyAuth(req) {
  const code = req.headers['x-secretariaat-code'] || req.headers['x-admin-code'];
  const secretariaatCode = process.env.SECRETARIAAT_CODE || '';
  const adminCode = process.env.ADMIN_CODE || '';
  if (!code) return false;
  return code === secretariaatCode || code === adminCode;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: haal kleedkamers op voor een datum
  if (req.method === 'GET') {
    try {
      const date = req.query.date; // YYYY-MM-DD
      const config = await redis.get(CONFIG_KEY) || { rooms: [] };
      const rooms = typeof config === 'string' ? JSON.parse(config) : config;

      let assignments = [];
      if (date) {
        const dayData = await redis.get(`kleedkamers:${date}`);
        if (dayData) {
          const parsed = typeof dayData === 'string' ? JSON.parse(dayData) : dayData;
          assignments = parsed.assignments || [];
        }
      }

      return res.status(200).json({ rooms: rooms.rooms || [], assignments });
    } catch (err) {
      console.error('Kleedkamers GET error:', err);
      return res.status(500).json({ error: 'Failed to get kleedkamers' });
    }
  }

  // POST: sla kleedkamertoewijzingen op voor een datum
  if (req.method === 'POST') {
    try {
      const { date, assignments } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Date is required' });

      await redis.set(`kleedkamers:${date}`, JSON.stringify({ assignments: assignments || [] }), { ex: 60 * 60 * 48 }); // TTL 48 uur

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Kleedkamers POST error:', err);
      return res.status(500).json({ error: 'Failed to save kleedkamers' });
    }
  }

  // PUT: configureer beschikbare kleedkamers (admin)
  if (req.method === 'PUT') {
    try {
      const { rooms } = req.body || {};
      if (!rooms || !Array.isArray(rooms)) return res.status(400).json({ error: 'Rooms array required' });

      await redis.set(CONFIG_KEY, JSON.stringify({ rooms }));

      return res.status(200).json({ ok: true, rooms });
    } catch (err) {
      console.error('Kleedkamers PUT error:', err);
      return res.status(500).json({ error: 'Failed to save config' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
