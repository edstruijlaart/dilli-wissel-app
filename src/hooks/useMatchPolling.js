import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 5000;

export function useMatchPolling(code) {
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const lastEventCount = useRef(0);

  const fetchMatch = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/match/${code.toUpperCase()}`);
      if (!res.ok) { setError('Wedstrijd niet gevonden'); setLoading(false); return; }
      const data = await res.json();
      setMatch(data);
      setError(null);
      setLoading(false);

      // Events ophalen als er iets veranderd kan zijn
      const evRes = await fetch(`/api/match/events/${code.toUpperCase()}`);
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
    return () => clearInterval(intervalRef.current);
  }, [code, fetchMatch]);

  // Timer berekening: lokaal berekenen op basis van server timestamps
  const getElapsed = useCallback(() => {
    if (!match) return 0;
    if (!match.isRunning || match.isPaused || match.halfBreak) return match.elapsedAtPause || 0;
    if (!match.timerStartedAt) return match.elapsedAtPause || 0;
    const started = new Date(match.timerStartedAt).getTime();
    const now = Date.now();
    return (match.elapsedAtPause || 0) + Math.floor((now - started) / 1000);
  }, [match]);

  const getSubElapsed = useCallback(() => {
    if (!match) return 0;
    if (!match.isRunning || match.isPaused || match.halfBreak) return match.subElapsedAtPause || 0;
    if (!match.subTimerStartedAt) return match.subElapsedAtPause || 0;
    const started = new Date(match.subTimerStartedAt).getTime();
    const now = Date.now();
    return (match.subElapsedAtPause || 0) + Math.floor((now - started) / 1000);
  }, [match]);

  return { match, events, error, loading, getElapsed, getSubElapsed, refetch: fetchMatch };
}
