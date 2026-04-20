import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 5000;

export function useMatchPolling(code) {
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const lastEventCount = useRef(0);
  const lastFetchId = useRef(0); // Sequence check: negeer out-of-order responses

  const fetchMatch = useCallback(async () => {
    if (!code) return;
    const fetchId = ++lastFetchId.current;
    try {
      const res = await fetch(`/api/match/${code.toUpperCase()}`);
      if (fetchId !== lastFetchId.current) return; // Stale response, negeer
      if (!res.ok) { setError('Wedstrijd niet gevonden'); setLoading(false); return; }
      const data = await res.json();
      if (fetchId !== lastFetchId.current) return; // Stale response, negeer
      setMatch(data);
      setError(null);
      setLoading(false);

      // Events ophalen als er iets veranderd kan zijn
      const evRes = await fetch(`/api/match/events/${code.toUpperCase()}`);
      if (fetchId !== lastFetchId.current) return; // Stale response, negeer
      if (evRes.ok) {
        const evData = await evRes.json();
        if (evData.length !== lastEventCount.current) {
          setEvents(evData);
          lastEventCount.current = evData.length;
        }
      }
    } catch (err) {
      setError('Verbinding mislukt');
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    fetchMatch();
    intervalRef.current = setInterval(fetchMatch, POLL_INTERVAL);

    // visibilitychange: debounce 800ms zodat coach sync eerst kan propageren
    // Dit triggert ook checkCoachPush() op de server → push naar coach
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(fetchMatch, 800);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [code, fetchMatch]);

  // Timer berekening: lokaal berekenen op basis van server timestamps
  const getElapsed = useCallback(() => {
    if (!match) return 0;
    if (!match.isRunning || match.isPaused || match.halfBreak) return match.elapsedAtPause || 0;
    if (!match.timerStartedAt) return match.elapsedAtPause || 0;
    const started = new Date(match.timerStartedAt).getTime();
    const now = Date.now();
    // timerStartedAt encodeert al de volledige elapsed tijd (Date.now() - matchTimer * 1000)
    // Dus now - timerStartedAt = matchTimer. NIET elapsedAtPause erbij optellen (double counting).
    return Math.floor((now - started) / 1000);
  }, [match]);

  const getSubElapsed = useCallback(() => {
    if (!match) return 0;
    if (!match.isRunning || match.isPaused || match.halfBreak) return match.subElapsedAtPause || 0;
    if (!match.subTimerStartedAt) return match.subElapsedAtPause || 0;
    const started = new Date(match.subTimerStartedAt).getTime();
    const now = Date.now();
    return Math.floor((now - started) / 1000);
  }, [match]);

  return { match, events, error, loading, getElapsed, getSubElapsed, refetch: fetchMatch };
}
