import { useState, useEffect } from 'react';
import { T, card } from '../theme.js';
import {
  isPushSupported,
  isIOS,
  isInstalledPWA,
  getNotificationPermission,
  subscribeToPush,
  forceResubscribe,
  sendTestPush,
  getPushDiagnostics,
  getPushDebugLog,
  isSubscribedForMatch,
  markSubscribed,
  shouldShowIOSLockScreenTip,
  dismissIOSLockScreenTip,
} from '../utils/pushNotifications.js';

/**
 * Compact banner requesting push notification permission.
 * Shows different messages for coach vs viewer.
 * Handles iOS "install to homescreen" prompt.
 * Now with diagnostic feedback, test push button, and force re-subscribe.
 *
 * @param {{ matchCode: string, role: 'coach'|'viewer' }} props
 */
export default function PushPermissionBanner({ matchCode, role }) {
  const [state, setState] = useState('loading'); // loading | show | ios-install | subscribed | error | hidden
  const [subscribing, setSubscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [subInfo, setSubInfo] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [diag, setDiag] = useState(null);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // Already subscribed this session
    if (isSubscribedForMatch(matchCode, role)) {
      setState('subscribed');
      return;
    }

    // Permission already denied — nothing we can do
    if (getNotificationPermission() === 'denied') {
      setState('hidden');
      return;
    }

    // Permission already granted — auto-subscribe silently
    if (getNotificationPermission() === 'granted' && isPushSupported()) {
      subscribeToPush(matchCode, role).then(result => {
        if (result.ok) {
          markSubscribed(matchCode, role);
          setSubInfo(result);
          setState('subscribed');
          if (shouldShowIOSLockScreenTip()) setShowIOSTip(true);
        } else {
          setErrorMsg(result.error);
          setState('error');
        }
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
    setErrorMsg(null);
    const result = await subscribeToPush(matchCode, role);
    if (result.ok) {
      markSubscribed(matchCode, role);
      setSubInfo(result);
      setState('subscribed');
      if (shouldShowIOSLockScreenTip()) setShowIOSTip(true);
    } else {
      setErrorMsg(result.error);
      setState('error');
    }
    setSubscribing(false);
  }

  async function handleForceResubscribe() {
    setSubscribing(true);
    setErrorMsg(null);
    setTestResult(null);
    const result = await forceResubscribe(matchCode, role);
    if (result.ok) {
      markSubscribed(matchCode, role);
      setSubInfo(result);
      setState('subscribed');
      if (shouldShowIOSLockScreenTip()) setShowIOSTip(true);
    } else {
      setErrorMsg(result.error);
      setState('error');
    }
    setSubscribing(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await sendTestPush(matchCode, role);
    setTestResult(result);
    setTesting(false);
  }

  async function handleDiag() {
    setShowDiag(!showDiag);
    if (!showDiag) {
      const d = await getPushDiagnostics();
      setDiag(d);
    }
  }

  function handleDismiss() {
    setState('hidden');
  }

  if (state === 'hidden' || state === 'loading') return null;

  const isCoach = role === 'coach';

  // Subscribed state — compact success with test + re-subscribe buttons
  if (state === 'subscribed') {
    return (
      <div style={{
        ...card,
        padding: '10px 16px',
        margin: '0 0 12px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, fontSize: 12, color: T.textDim }}>
            Meldingen actief
            {subInfo?.endpoint && (
              <span style={{ fontSize: 10, opacity: 0.6 }}>
                {' '}({subInfo.endpoint.includes('apple') ? '🍎 Apple' : '🤖 Google'})
              </span>
            )}
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              background: 'none', border: `1px solid ${T.border}`, color: T.text,
              borderRadius: 8, padding: '4px 10px', fontSize: 11,
              fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
              opacity: testing ? 0.5 : 1,
            }}
          >{testing ? '...' : 'Test'}</button>
          <button
            onClick={handleDiag}
            style={{
              background: 'none', border: 'none', color: T.textMuted,
              fontSize: 11, cursor: 'pointer', padding: '4px 4px',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >ℹ️</button>
        </div>
        {testResult && (
          <div style={{
            marginTop: 6, fontSize: 11, padding: '4px 8px',
            background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            borderRadius: 6, color: testResult.ok ? '#22c55e' : T.warn,
          }}>
            {testResult.ok
              ? `✓ Push verstuurd naar ${testResult.sent} device(s)${testResult.expired > 0 ? ` (${testResult.expired} verlopen)` : ''}`
              : `✗ ${testResult.error || testResult.message || testResult.reason}`
            }
          </div>
        )}
        {showIOSTip && (
          <div style={{
            marginTop: 8, padding: '10px 12px',
            background: 'rgba(59,130,246,0.08)',
            borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>
              Meldingen op je vergrendelscherm
            </div>
            <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5 }}>
              Om meldingen te zien als je telefoon vergrendeld is:
            </div>
            <div style={{ fontSize: 11, color: T.text, lineHeight: 1.6, marginTop: 4 }}>
              Instellingen → Meldingen → Dilli Wissel → zet <strong>Toegangsscherm</strong> aan
            </div>
            <button
              onClick={() => { dismissIOSLockScreenTip(); setShowIOSTip(false); }}
              style={{
                marginTop: 8, background: 'none', border: `1px solid ${T.border}`,
                color: T.text, borderRadius: 8, padding: '5px 14px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
                width: '100%',
              }}
            >Begrepen</button>
          </div>
        )}
        {showDiag && (
          <div style={{ marginTop: 8 }}>
            <DiagPanel diag={diag} onRefresh={handleDiag} />
            <button
              onClick={handleForceResubscribe}
              disabled={subscribing}
              style={{
                marginTop: 6, background: 'none', border: `1px solid ${T.border}`,
                color: T.textDim, borderRadius: 8, padding: '4px 10px', fontSize: 11,
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                width: '100%',
              }}
            >{subscribing ? '...' : '🔄 Herregistreer push'}</button>
          </div>
        )}
      </div>
    );
  }

  // Error state — show what went wrong + retry
  if (state === 'error') {
    return (
      <div style={{
        ...card,
        padding: '12px 16px',
        margin: '0 0 12px 0',
        borderColor: T.warn,
        borderWidth: 1,
        borderStyle: 'solid',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.text }}>
            Push notificaties niet gelukt
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.warn, marginBottom: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {errorMsg}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            style={{
              background: T.accent, color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 14px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >{subscribing ? '...' : 'Opnieuw'}</button>
          <button
            onClick={handleForceResubscribe}
            disabled={subscribing}
            style={{
              background: 'none', border: `1px solid ${T.border}`, color: T.text,
              borderRadius: 8, padding: '6px 10px', fontSize: 11,
              cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
            }}
          >Herregistreer</button>
          <button
            onClick={handleDiag}
            style={{
              background: 'none', border: `1px solid ${T.border}`, color: T.textDim,
              borderRadius: 8, padding: '6px 10px', fontSize: 11,
              cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
            }}
          >Diagnostiek</button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none', color: T.textMuted,
              fontSize: 11, cursor: 'pointer', padding: '6px 8px',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >Sluiten</button>
        </div>
        {showDiag && <DiagPanel diag={diag} onRefresh={handleDiag} />}
      </div>
    );
  }

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

/**
 * Diagnostic panel showing push notification status details.
 */
function DiagPanel({ diag, onRefresh }) {
  const debugLog = getPushDebugLog();

  if (!diag) return (
    <div style={{ marginTop: 8, fontSize: 11, color: T.textDim }}>
      Laden...
    </div>
  );

  const statusColor = (v) => {
    if (v === true || v === 'active' || v === 'loaded' || v === 'granted') return '#22c55e';
    if (v === false || v === 'denied' || v === 'failed' || v === 'none' || v === 'error') return '#ef4444';
    if (v === 'waiting' || v === 'installing' || v === 'default') return '#f59e0b';
    return T.text;
  };

  return (
    <div style={{
      marginTop: 8, padding: 8, background: T.bg, borderRadius: 6,
      fontSize: 10, fontFamily: 'monospace', color: T.textDim, lineHeight: 1.7,
    }}>
      {Object.entries(diag).filter(([k]) => k !== 'debugLog').map(([k, v]) => (
        <div key={k}>
          {k}: <span style={{ color: statusColor(v) }}>
            {typeof v === 'string' && v.length > 60 ? v.substring(0, 60) + '...' : JSON.stringify(v)}
          </span>
        </div>
      ))}
      {debugLog.length > 0 && (
        <>
          <div style={{ marginTop: 6, fontWeight: 700, color: T.text }}>SW Debug Log:</div>
          {debugLog.map((l, i) => (
            <div key={i} style={{ color: '#22c55e' }}>{l.time}: {l.message}</div>
          ))}
        </>
      )}
      <button
        onClick={onRefresh}
        style={{
          marginTop: 6, background: 'none', border: `1px solid ${T.border}`,
          color: T.textDim, borderRadius: 4, padding: '2px 8px', fontSize: 10,
          cursor: 'pointer', fontFamily: 'monospace',
        }}
      >↻ Ververs</button>
    </div>
  );
}
