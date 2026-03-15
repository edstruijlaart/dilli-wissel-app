import { sendPush } from '../_lib/push.js';
import { redis } from '../_lib/redis.js';

/**
 * POST /api/push/test — Send a test push notification.
 * Body: { matchCode, role: 'coach'|'viewer' }
 *
 * GET /api/push/test?matchCode=XXXX — Debug: show subscription status.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({});

  if (req.method === 'GET') {
    const code = (req.query.matchCode || '').toUpperCase();
    if (!code) return res.status(400).json({ error: 'Missing matchCode' });

    try {
      const coachRaw = await redis.get(`push:${code}:coach`);
      const viewerRaw = await redis.get(`push:${code}:viewer`);
      const coachSubs = coachRaw ? (typeof coachRaw === 'string' ? JSON.parse(coachRaw) : coachRaw) : [];
      const viewerSubs = viewerRaw ? (typeof viewerRaw === 'string' ? JSON.parse(viewerRaw) : viewerRaw) : [];

      return res.status(200).json({
        matchCode: code,
        coach: {
          count: coachSubs.length,
          endpoints: coachSubs.map(s => s.endpoint?.substring(0, 80)),
        },
        viewer: {
          count: viewerSubs.length,
          endpoints: viewerSubs.map(s => s.endpoint?.substring(0, 80)),
        },
        vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        vapidPublicKeyLength: (process.env.VAPID_PUBLIC_KEY || '').trim().length,
        vapidPrivateKeyLength: (process.env.VAPID_PRIVATE_KEY || '').trim().length,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { matchCode, role } = req.body;
      if (!matchCode || !role) {
        return res.status(400).json({ error: 'Missing matchCode or role' });
      }

      const code = matchCode.toUpperCase();

      // Check subscriptions exist
      const subsKey = `push:${code}:${role}`;
      const raw = await redis.get(subsKey);
      const subs = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];

      if (subs.length === 0) {
        return res.status(200).json({
          ok: false,
          reason: 'no_subscriptions',
          message: `Geen push subscriptions gevonden voor ${role} bij match ${code}`,
        });
      }

      // Send test push — one at a time for detailed feedback
      const payload = {
        title: '🔔 Test Push',
        body: `Push notificaties werken! (${role})`,
        vibrate: [200, 100, 200],
        tag: 'test',
        matchCode: code,
        url: '/',
      };

      const results = [];
      const alive = [];
      for (const sub of subs) {
        const result = await sendPush(sub, payload);
        const endpoint = sub.endpoint || 'unknown';
        const isApple = endpoint.includes('apple') || endpoint.includes('push.apple.com');
        results.push({
          endpoint: endpoint.substring(0, 80),
          isApple,
          result: result === true ? 'sent' : result === 'expired' ? 'expired' : 'failed',
        });
        if (result !== 'expired') alive.push(sub);
      }

      // Clean up expired
      if (alive.length !== subs.length) {
        if (alive.length > 0) {
          await redis.set(subsKey, JSON.stringify(alive), { ex: 86400 });
        } else {
          await redis.del(subsKey);
        }
      }

      const sent = results.filter(r => r.result === 'sent').length;
      const expired = results.filter(r => r.result === 'expired').length;
      const failed = results.filter(r => r.result === 'failed').length;

      return res.status(200).json({
        ok: sent > 0,
        sent,
        expired,
        failed,
        total: subs.length,
        details: results,
        message: sent > 0
          ? `Push verstuurd naar ${sent} device(s)`
          : `Push mislukt voor alle ${subs.length} device(s)`,
      });
    } catch (err) {
      console.error('Test push error:', err);
      return res.status(500).json({ error: 'Push test failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
