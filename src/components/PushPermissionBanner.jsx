import { useState, useEffect } from 'react';
import { T, card } from '../theme.js';
import {
  isPushSupported,
  isIOS,
  isInstalledPWA,
  getNotificationPermission,
  subscribeToPush,
  isSubscribedForMatch,
  markSubscribed,
} from '../utils/pushNotifications.js';

/**
 * Compact banner requesting push notification permission.
 * Shows different messages for coach vs viewer.
 * Handles iOS "install to homescreen" prompt.
 *
 * @param {{ matchCode: string, role: 'coach'|'viewer' }} props
 */
export default function PushPermissionBanner({ matchCode, role }) {
  const [state, setState] = useState('loading'); // loading | show | ios-install | hidden
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Already subscribed this session
    if (isSubscribedForMatch(matchCode, role)) {
      setState('hidden');
      return;
    }

    // Permission already denied — nothing we can do
    if (getNotificationPermission() === 'denied') {
      setState('hidden');
      return;
    }

    // Permission already granted — auto-subscribe silently
    if (getNotificationPermission() === 'granted' && isPushSupported()) {
      subscribeToPush(matchCode, role).then(ok => {
        if (ok) markSubscribed(matchCode, role);
        setState('hidden');
      });
      return;
    }

    // iOS but not installed as PWA — show install prompt
    if (isIOS() && !isInstalledPWA()) {
      setState('ios-install');
      return;
    }

    // Push not supported at all
    if (!isPushSupported()) {
      setState('hidden');
      return;
    }

    // Need to ask permission
    setState('show');
  }, [matchCode, role]);

  async function handleSubscribe() {
    setSubscribing(true);
    const ok = await subscribeToPush(matchCode, role);
    if (ok) {
      markSubscribed(matchCode, role);
    }
    setState('hidden');
    setSubscribing(false);
  }

  function handleDismiss() {
    setState('hidden');
  }

  if (state === 'hidden' || state === 'loading') return null;

  const isCoach = role === 'coach';
  const message = state === 'ios-install'
    ? 'Voeg de app toe aan je beginscherm voor meldingen'
    : isCoach
      ? 'Ontvang meldingen bij wisselmomenten en rust'
      : 'Ontvang meldingen bij goals en wedstrijdupdates';

  const iosMessage = 'Tik op het deel-icoon (⬆️) → "Zet op beginscherm"';

  return (
    <div style={{
      ...card,
      padding: '12px 16px',
      margin: '0 0 12px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      animation: 'slideIn 0.3s ease-out',
    }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>
          {message}
        </div>
        {state === 'ios-install' && (
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
            {iosMessage}
          </div>
        )}
      </div>
      {state === 'show' && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none', color: T.textMuted,
              fontSize: 12, cursor: 'pointer', padding: '6px 8px',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >Later</button>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            style={{
              background: T.accent, color: '#fff', border: 'none',
              borderRadius: 10, padding: '6px 14px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
              opacity: subscribing ? 0.7 : 1,
            }}
          >{subscribing ? '...' : 'Aan'}</button>
        </div>
      )}
      {state === 'ios-install' && (
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', color: T.textMuted,
            fontSize: 18, cursor: 'pointer', padding: '4px 8px',
            flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  );
}
