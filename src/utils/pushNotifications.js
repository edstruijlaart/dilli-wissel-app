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
    if (!res.ok) throw new Error(`VAPID key fetch failed: ${res.status}`);
    const data = await res.json();
    vapidKeyCache = data.publicKey;
    return vapidKeyCache;
  } catch (err) {
    console.error('[Push] getVapidKey error:', err);
    return null;
  }
}

/**
 * Push debug log — collects messages from SW via postMessage.
 * Accessible via getPushDebugLog().
 */
const pushDebugLog = [];
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'push-debug') {
      pushDebugLog.push({
        time: new Date().toLocaleTimeString(),
        message: event.data.message,
      });
      console.log('[Push SW]', event.data.message);
    }
  });
}

/**
 * Get push debug log from service worker messages.
 */
export function getPushDebugLog() {
  return [...pushDebugLog];
}

/**
 * Get detailed push support diagnostics.
 * Returns object with status of each requirement.
 */
export async function getPushDiagnostics() {
  const diag = {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unavailable',
    isIOS: isIOS(),
    isPWA: isInstalledPWA(),
    standalone: window.navigator.standalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches,
    swRegistered: false,
    swState: null,
    swScope: null,
    pushSubscription: null,
    pushEndpoint: null,
    isApplePush: false,
    vapidKey: null,
    userAgent: navigator.userAgent.substring(0, 80),
  };

  try {
    if (diag.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      diag.swRegistered = !!reg;
      if (reg) {
        diag.swState = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'unknown';
        diag.swScope = reg.scope;
        if (reg.pushManager) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            diag.pushSubscription = 'active';
            diag.pushEndpoint = sub.endpoint?.substring(0, 80) + '...';
            diag.isApplePush = sub.endpoint?.includes('apple') || sub.endpoint?.includes('push.apple.com');
          } else {
            diag.pushSubscription = 'none';
          }
        } else {
          diag.pushSubscription = 'no pushManager';
        }
      }
      // Also check controller
      diag.swController = !!navigator.serviceWorker.controller;
    }
  } catch (e) {
    diag.swError = e.message;
  }

  try {
    diag.vapidKey = await getVapidKey() ? 'loaded' : 'failed';
  } catch {
    diag.vapidKey = 'error';
  }

  // Add debug log
  if (pushDebugLog.length > 0) {
    diag.debugLog = pushDebugLog.map(l => `${l.time}: ${l.message}`).join(' | ');
  }

  return diag;
}

/**
 * Subscribe to push notifications for a specific match and role.
 * Returns { ok: boolean, error?: string, step?: string } with detailed feedback.
 *
 * @param {string} matchCode - 4-letter match code
 * @param {'coach'|'viewer'} role - subscription role
 */
export async function subscribeToPush(matchCode, role) {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push niet ondersteund in deze browser', step: 'support_check' };
  }

  try {
    // Step 1: Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: `Notificatie permissie: ${permission}`, step: 'permission' };
    }

    // Step 2: Get service worker registration
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (swErr) {
      return { ok: false, error: `Service Worker niet beschikbaar: ${swErr.message}`, step: 'sw_ready' };
    }

    // Verify SW is active
    if (!registration.active) {
      return { ok: false, error: 'Service Worker niet actief (state: ' + (registration.installing ? 'installing' : registration.waiting ? 'waiting' : 'none') + ')', step: 'sw_active' };
    }

    // Step 3: Get VAPID public key
    const vapidKey = await getVapidKey();
    if (!vapidKey) {
      return { ok: false, error: 'VAPID key niet opgehaald van server', step: 'vapid_key' };
    }

    // Step 4: Subscribe to push manager
    let subscription;
    try {
      // First check existing subscription
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        subscription = existing;
      } else {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
    } catch (subErr) {
      return { ok: false, error: `Push subscribe mislukt: ${subErr.message}`, step: 'push_subscribe' };
    }

    // Step 5: Send subscription to server
    const subJSON = subscription.toJSON();
    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchCode: matchCode.toUpperCase(),
        role,
        subscription: subJSON,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: `Server registratie mislukt: ${errData.error || res.status}`, step: 'server_register' };
    }

    const serverResult = await res.json();

    return {
      ok: true,
      endpoint: subJSON.endpoint?.substring(0, 60),
      serverCount: serverResult.count,
    };
  } catch (err) {
    return { ok: false, error: err.message, step: 'unknown' };
  }
}

/**
 * Force re-subscribe: unsubscribe existing, then re-subscribe fresh.
 * Useful when the subscription seems stale or iOS needs a fresh registration.
 */
export async function forceResubscribe(matchCode, role) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.pushManager) {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }
    }
  } catch (e) {
    console.warn('[Push] unsubscribe failed:', e);
  }

  // Clear session marker so it re-subscribes
  sessionStorage.removeItem(`push:${matchCode}:${role}`);

  return subscribeToPush(matchCode, role);
}

/**
 * Send a test push notification to verify the pipeline.
 * @returns {{ ok: boolean, message?: string, error?: string }}
 */
export async function sendTestPush(matchCode, role) {
  try {
    const res = await fetch(`${API_BASE}/api/push/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchCode: matchCode.toUpperCase(), role }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
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

/**
 * iOS lock screen notification tip — shown once after first subscribe.
 * iOS requires users to manually enable "Toegangsscherm" in Settings > Notifications.
 * Without this, notifications only appear when the phone is unlocked.
 */
const IOS_TIP_KEY = 'push:ios-lockscreen-tip-dismissed';

export function isIOSLockScreenTipDismissed() {
  return localStorage.getItem(IOS_TIP_KEY) === '1';
}

export function dismissIOSLockScreenTip() {
  localStorage.setItem(IOS_TIP_KEY, '1');
}

/**
 * Check if we should show the iOS lock screen tip.
 * Only on iOS + installed PWA + not yet dismissed.
 */
export function shouldShowIOSLockScreenTip() {
  return isIOS() && isInstalledPWA() && !isIOSLockScreenTipDismissed();
}
