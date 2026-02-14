import React, { useState, useEffect } from 'react';
import { T, card } from '../theme';

export default function AudioTimeline({ matchCode }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchCode) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/match/audio/${matchCode}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Fetch audio messages error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [matchCode]);

  if (loading || messages.length === 0) return null;

  return (
    <div style={{ ...card, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🎙️</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>
          Coach Updates ({messages.length})
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>
                {msg.matchTime || '--:--'}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted }}>H{msg.half}</span>
            </div>
            <audio src={msg.url} controls style={{ width: '100%', height: 32 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
