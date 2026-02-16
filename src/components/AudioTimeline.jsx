import React, { useState, useEffect } from 'react';
import { T, card } from '../theme';

export default function AudioTimeline({ matchCode, isCoach = false, maxItems = null }) {
  const [messages, setMessages] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  useEffect(() => {
    if (!matchCode) return;

    const fetchUpdates = async () => {
      try {
        // Fetch audio messages
        const audioRes = await fetch(`/api/match/audio/${matchCode}`);
        if (audioRes.ok) {
          const audioData = await audioRes.json();
          setMessages(audioData.messages || []);
        }

        // Fetch events (for photos)
        const eventsRes = await fetch(`/api/match/events/${matchCode}`);
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          // eventsData is the array directly, not { events: [...] }
          const photoEvents = Array.isArray(eventsData) ? eventsData.filter(ev => ev.type === 'photo') : [];
          setPhotos(photoEvents);
        }
      } catch (err) {
        console.error('Fetch updates error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpdates();
    const interval = setInterval(fetchUpdates, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [matchCode]);

  const handleDeleteAudio = async (url) => {
    if (!confirm('Audio update verwijderen?')) return;

    setDeleting(url);
    try {
      const res = await fetch(`/api/match/audio/${matchCode}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setMessages(messages.filter(msg => msg.url !== url));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Verwijderen mislukt');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeletePhoto = async (url) => {
    if (!confirm('Foto verwijderen?')) return;

    setDeleting(url);
    try {
      const res = await fetch('/api/match/photo/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setPhotos(photos.filter(photo => photo.url !== url));
      }
    } catch (err) {
      console.error('Delete photo error:', err);
      alert('Verwijderen mislukt');
    } finally {
      setDeleting(null);
    }
  };

  // Combine audio + photos into single feed
  const allUpdates = [
    ...messages.map(msg => ({ ...msg, type: 'audio', timestamp: new Date(msg.timestamp || 0).getTime() })),
    ...photos.map(photo => ({ ...photo, type: 'photo', timestamp: new Date(photo.timestamp || 0).getTime() })),
  ].sort((a, b) => b.timestamp - a.timestamp); // Most recent first

  // Apply maxItems limit (for viewers: show only latest)
  const displayUpdates = maxItems ? allUpdates.slice(0, maxItems) : allUpdates;

  if (loading || displayUpdates.length === 0) return null;

  return (
    <>
      <div style={{ ...card, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>📢</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1 }}>
            {maxItems === 1 ? 'Laatste Update' : `Updates (${allUpdates.length})`}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayUpdates.map((item, i) => (
            <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: T.glass, border: `1px solid ${T.glassBorder}`, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>
                  {item.time || item.matchTime || '--:--'}
                </span>
                <span style={{ fontSize: 11, color: T.textMuted }}>H{item.half}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>
                  {item.type === 'audio' ? '🎙️ Audio' : '📷 Foto'}
                </span>
                {isCoach && (
                  <button
                    onClick={() => item.type === 'audio' ? handleDeleteAudio(item.url) : handleDeletePhoto(item.url)}
                    disabled={deleting === item.url}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      cursor: deleting === item.url ? 'wait' : 'pointer',
                      padding: '4px 8px',
                      color: T.danger,
                      fontSize: 18,
                      lineHeight: 1,
                      opacity: deleting === item.url ? 0.5 : 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              {item.type === 'audio' ? (
                <>
                  {item.message && (
                    <p style={{ fontSize: 13, color: T.text, marginBottom: 8, fontStyle: 'italic' }}>
                      "{item.message}"
                    </p>
                  )}
                  <audio src={item.url} controls style={{ width: '100%', height: 32 }} />
                </>
              ) : (
                <>
                  {item.caption && (
                    <p style={{ fontSize: 13, color: T.text, marginBottom: 8, fontStyle: 'italic' }}>
                      "{item.caption}"
                    </p>
                  )}
                  <img
                    src={item.url}
                    alt="Wedstrijd foto"
                    onClick={() => setFullscreenPhoto(item.url)}
                    style={{
                      width: '100%',
                      maxHeight: 200,
                      objectFit: 'cover',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen photo viewer */}
      {fullscreenPhoto && (
        <div
          onClick={() => setFullscreenPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'pointer',
          }}
        >
          <img
            src={fullscreenPhoto}
            alt="Wedstrijd foto"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 12,
            }}
          />
        </div>
      )}
    </>
  );
}
