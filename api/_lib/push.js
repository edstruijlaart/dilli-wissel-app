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

/**
 * Server-side push checks for coach notifications.
 * Detects timer milestones (sub overdue, half end, match end, injury time)
 * and sends push notifications to coach.
 * Used by: GET/PUT /api/match/[code] + cron job.
 */
export async function checkCoachPush(code, match) {
  try {
    // Only check when timer is actively running
    if (!match.timerStartedAt || match.isPaused || match.halfBreak) return;
    if (match.status === 'ended' || match.status === 'setup') return;

    const now = Date.now();
    const halfElapsed = Math.floor((now - new Date(match.timerStartedAt).getTime()) / 1000);
    const halfDurationSec = (match.halfDuration || 10) * 60;
    const subIntervalSec = (match.subInterval || 4) * 60;
    const currentHalf = match.currentHalf || 1;
    const totalHalves = match.halves || 2;
    const score = `${match.homeScore || 0} - ${match.awayScore || 0}`;

    // 1. Wisseladvies — autoSubs aan + subInterval overdue + bankspelers beschikbaar
    if (match.autoSubs && match.subInterval > 0 && match.subTimerStartedAt && match.onBench && match.onBench.length > 0) {
      const subElapsed = Math.floor((now - new Date(match.subTimerStartedAt).getTime()) / 1000);
      if (subElapsed >= subIntervalSec) {
        const slotId = Math.floor(halfElapsed / subIntervalSec);
        const dedupKey = `push:sub:${code}:${currentHalf}:${slotId}`;
        const alreadySent = await checkDedup(dedupKey, 300);
        if (!alreadySent) {
          await sendPushToAll(code, 'coach', {
            title: '🔄 Tijd om te wisselen!',
            body: 'Wisselmoment bereikt — open de app',
            vibrate: [200, 100, 200, 100, 200],
            tag: `sub-${code}`,
            matchCode: code,
            url: '/',
          });
        }
      }
    }

    // 2. Helft voorbij / einde wedstrijd
    if (halfElapsed >= halfDurationSec) {
      if (currentHalf >= totalHalves) {
        // Einde wedstrijd
        const endDedupKey = `push:end:${code}`;
        const endAlreadySent = await checkDedup(endDedupKey, 3600);
        if (!endAlreadySent) {
          await sendPushToAll(code, 'coach', {
            title: '🏁 Einde wedstrijd!',
            body: `Uitslag: ${score}`,
            vibrate: [300, 100, 300, 100, 300],
            tag: `end-${code}`,
            matchCode: code,
            url: '/',
          });
        }

        // Blessuretijd voorbij (als ingesteld)
        const injuryTimeSec = (match.injuryTime || 0) * 60;
        if (injuryTimeSec > 0 && halfElapsed >= halfDurationSec + injuryTimeSec) {
          const injuryDedupKey = `push:injury:${code}`;
          const injuryAlreadySent = await checkDedup(injuryDedupKey, 3600);
          if (!injuryAlreadySent) {
            await sendPushToAll(code, 'coach', {
              title: '⏱️ Blessuretijd voorbij!',
              body: `Stand: ${score}`,
              vibrate: [300, 100, 300],
              tag: `injury-${code}`,
              matchCode: code,
              url: '/',
            });
          }
        }
      } else {
        // Rust — helft voorbij, niet de laatste
        const halfDedupKey = `push:half:${code}:${currentHalf}`;
        const halfAlreadySent = await checkDedup(halfDedupKey, 3600);
        if (!halfAlreadySent) {
          await sendPushToAll(code, 'coach', {
            title: `⏸️ Rust! Helft ${currentHalf} is voorbij`,
            body: `Stand: ${score}`,
            vibrate: [200, 100, 200],
            tag: `half-${code}`,
            matchCode: code,
            url: '/',
          });
        }
      }
    }
  } catch (err) {
    console.error('checkCoachPush error:', err);
  }
}
