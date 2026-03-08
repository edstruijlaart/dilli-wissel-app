const API_BASE = import.meta.env.PROD ? '' : '';

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/**
 * Check if running as installed PWA (standalone mode).
 */
export function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

/**
 * Check if iOS device.
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Get current notification permission state.
 * Returns 'granted', 'denied', or 'default'.
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Convert VAPID public key from base64url to Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Fetch VAPID public key from server. Cached after first fetch.
 */
let vapidKeyCache = null;
async function getVapidKey() {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-key`);
    if (!res.ok) throw new Error('Failed to fetch VAPID key');
    const data = await res.json();
    vapidKeyCache = data.publicKey;
    return vapidKeyCache;
  } catch (err) {
    console.error('getVapidKey error:', err);
    return null;
  }
}

/**
 * Subscribe to push notifications for a specific match and role.
 * Returns true if successfully subscribed, false otherwise.
 *
 * @param {string} matchCode - 4-letter match code
 * @param {'coach'|'viewer'} role - subscription role
 */
export async function subscribeToPush(matchCode, role) {
  if (!isPushSupported()) return false;

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key
    const vapidKey = await getVapidKey();
    if (!vapidKey) return false;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to server
    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchCode: matchCode.toUpperCase(),
        role,
        subscription: subscription.toJSON(),
      }),
    });

    if (!res.ok) throw new Error('Failed to register subscription');
    return true;
  } catch (err) {
    console.error('subscribeToPush error:', err);
    return false;
  }
}

/**
 * Check if already subscribed to push for this session.
 * Uses sessionStorage to avoid re-subscribing on every render.
 */
export function isSubscribedForMatch(matchCode, role) {
  return sessionStorage.getItem(`push:${matchCode}:${role}`) === '1';
}

/**
 * Mark as subscribed for this match session.
 */
export function markSubscribed(matchCode, role) {
  sessionStorage.setItem(`push:${matchCode}:${role}`, '1');
}
