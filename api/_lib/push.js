import webpush from 'web-push';
import { redis } from './redis.js';

// Trim VAPID keys — Vercel env vars often contain trailing newlines
const vapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:ed@edstruijlaart.nl').trim();

if (vapidPublic && vapidPrivate) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (err) {
    console.error('VAPID setup failed:', err.message);
    console.error('Public key length:', vapidPublic.length, 'Private key length:', vapidPrivate.length);
  }
} else {
  console.error('VAPID keys missing! Public:', !!vapidPublic, 'Private:', !!vapidPrivate);
}

/**
 * Send push notification to a single subscription.
 * Returns true (success), 'expired' (subscription gone), or false (error).
 */
export async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.error('Push send error:', err.statusCode || err.message);
    return false;
  }
}

/**
 * Send push notification to all subscriptions for a match+role.
 * Automatically cleans up expired subscriptions.
 */
export async function sendPushToAll(matchCode, role, payload) {
  const subsKey = `push:${matchCode}:${role}`;
  try {
    const raw = await redis.get(subsKey);
    if (!raw) return;
    const subscriptions = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) return;

    const alive = [];
    for (const sub of subscriptions) {
      const result = await sendPush(sub, payload);
      if (result !== 'expired') alive.push(sub);
    }

    // Clean up expired subscriptions
    if (alive.length !== subscriptions.length) {
      if (alive.length > 0) {
        await redis.set(subsKey, JSON.stringify(alive), { ex: 86400 });
      } else {
        await redis.del(subsKey);
      }
    }
  } catch (err) {
    console.error('sendPushToAll error:', err);
  }
}

/**
 * Check dedup key — returns true if this notification was already sent.
 * If not sent yet, sets the dedup key with given TTL.
 */
export async function checkDedup(dedupKey, ttl = 300) {
  const exists = await redis.get(dedupKey);
  if (exists) return true; // already sent
  await redis.set(dedupKey, '1', { ex: ttl });
  return false; // first time
}
