import React, { useState, useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { T, btnP, btnS, btnD } from '../theme';
import Icons from './Icons';

/**
 * LiveAudio component - LiveKit audio streaming
 *
 * @param {string} matchCode - 4-letter match code
 * @param {boolean} isCoach - true = broadcaster (mic on), false = listener (mic off)
 * @param {function} onError - callback when error occurs
 */
export default function LiveAudio({ matchCode, isCoach = false, onError }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [participants, setParticipants] = useState(0);
  const [muted, setMuted] = useState(false);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const startLiveAudio = async () => {
    try {
      setStatus('connecting');

      // Generate access token
      const identity = isCoach ? `coach-${Date.now()}` : `viewer-${Date.now()}`;
      const res = await fetch(`/api/match/audio-token/${matchCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, isCoach }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to get access token');
      }

      const { token, url, roomName } = await res.json();

      // Create room instance
      const newRoom = new Room({
        adaptiveStream: true, // Optimize bandwidth
        dynacast: true, // Dynamic broadcasting
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Event listeners
      newRoom
        .on(RoomEvent.Connected, () => {
          console.log('Connected to LiveKit room');
          setStatus('connected');
          updateParticipantCount(newRoom);
        })
        .on(RoomEvent.ParticipantConnected, () => {
          updateParticipantCount(newRoom);
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          updateParticipantCount(newRoom);
        })
        .on(RoomEvent.Disconnected, () => {
          setStatus('idle');
          setParticipants(0);
        })
        .on(RoomEvent.Reconnecting, () => {
          console.log('Reconnecting to LiveKit...');
        })
        .on(RoomEvent.Reconnected, () => {
          console.log('Reconnected to LiveKit');
        });

      // Connect to room
      await newRoom.connect(url, token);

      // Enable microphone for coach
      if (isCoach) {
        await newRoom.localParticipant.setMicrophoneEnabled(true);
      }

      setRoom(newRoom);
    } catch (err) {
      console.error('LiveKit connection error:', err);
      setStatus('error');
      onError?.(err.message);
    }
  };

  const stopLiveAudio = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
    }
    setStatus('idle');
    setParticipants(0);
  };

  const toggleMute = async () => {
    if (room && isCoach) {
      const newMuted = !muted;
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setMuted(newMuted);
    }
  };

  const updateParticipantCount = (r) => {
    // LiveKit uses remoteParticipants (Map), not participants
    const count = (r.remoteParticipants?.size || 0) + 1; // +1 for local participant
    setParticipants(count);
  };

  // Coach view
  if (isCoach) {
    if (status === 'idle') {
      return (
        <button
          onClick={startLiveAudio}
          style={{
            ...btnS,
            width: '100%',
            padding: '12px 0',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderColor: T.accentDim,
            color: T.accent,
          }}
        >
          {Icons.microphone(16, T.accent)}
          Start live audio
        </button>
      );
    }

    if (status === 'connecting') {
      return (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 10,
            background: T.glass,
            border: `1px solid ${T.glassBorder}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: T.warn,
              animation: 'pulse 1.5s ease infinite',
            }}
          />
          <span style={{ fontSize: 13, color: T.textMuted }}>Verbinden...</span>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 10,
            background: 'rgba(220,38,38,0.06)',
            border: `1px solid ${T.dangerDim}`,
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#DC2626',
                  animation: 'pulse 2s ease infinite',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>LIVE AUDIO</span>
            </div>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {Icons.eye(12, T.textMuted)} {participants} {participants === 1 ? 'luisteraar' : 'luisteraars'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={toggleMute}
              style={{
                ...btnS,
                flex: 1,
                padding: '8px 0',
                fontSize: 12,
                borderColor: muted ? T.dangerDim : T.glassBorder,
                color: muted ? T.danger : T.text,
              }}
            >
              {muted ? '🔇 Gedempt' : '🎙️ Aan'}
            </button>
            <button onClick={stopLiveAudio} style={{ ...btnD, padding: '8px 16px', fontSize: 12 }}>
              Stop
            </button>
          </div>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 10,
            background: 'rgba(220,38,38,0.06)',
            border: `1px solid ${T.dangerDim}`,
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 12, color: T.danger, margin: '0 0 8px' }}>Live audio mislukt</p>
          <button onClick={startLiveAudio} style={{ ...btnS, width: '100%', padding: '8px 0', fontSize: 12 }}>
            Opnieuw proberen
          </button>
        </div>
      );
    }
  }

  // Viewer view
  if (status === 'idle') {
    return (
      <button
        onClick={startLiveAudio}
        style={{
          ...btnP,
          width: '100%',
          padding: '14px 0',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {Icons.microphone(16, '#FFF')}
        Luister live mee
      </button>
    );
  }

  if (status === 'connecting') {
    return (
      <div
        style={{
          padding: '14px 16px',
          marginBottom: 16,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: T.accent,
            animation: 'pulse 1.5s ease infinite',
          }}
        />
        <span style={{ fontSize: 14, color: T.textMuted }}>Verbinden met live audio...</span>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div
        style={{
          padding: '14px 16px',
          marginBottom: 16,
          background: 'rgba(22,163,74,0.06)',
          border: `1px solid ${T.accentDim}`,
          borderRadius: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: T.accent,
                animation: 'pulse 2s ease infinite',
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>Live audio actief</span>
          </div>
          <button onClick={stopLiveAudio} style={{ ...btnS, padding: '6px 12px', fontSize: 12 }}>
            Stop
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        style={{
          padding: '14px 16px',
          marginBottom: 16,
          background: 'rgba(220,38,38,0.06)',
          border: `1px solid ${T.dangerDim}`,
          borderRadius: 14,
        }}
      >
        <p style={{ fontSize: 13, color: T.danger, margin: '0 0 10px' }}>Kan niet verbinden met live audio</p>
        <button onClick={startLiveAudio} style={{ ...btnS, width: '100%', padding: '10px 0', fontSize: 13 }}>
          Opnieuw proberen
        </button>
      </div>
    );
  }

  return null;
}
