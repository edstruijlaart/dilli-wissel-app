import React, { useState, useRef, useEffect } from 'react';
import { T, btnP, btnS, btnD, mono } from '../theme';
import Icons from './Icons';

export default function AudioRecorder({ matchCode, matchTime, currentHalf, onClose, onUploaded }) {
  const [state, setState] = useState('idle'); // idle | recording | stopped | uploading
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('stopped');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setState('recording');
      setDuration(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('MediaRecorder error:', err);
      setError('Microfoon toegang geweigerd');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  const uploadAudio = async () => {
    setState('uploading');
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      const res = await fetch(`/api/match/audio/${matchCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/webm',
          'X-Match-Time': matchTime,
          'X-Half': currentHalf.toString(),
        },
        body: blob,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      onUploaded(data);
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload mislukt');
      setState('stopped');
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div style={{ background: T.bg, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', position: 'relative' }}>
        {/* Close button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontSize: 20, lineHeight: 1 }}>
          ×
        </button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Audio Update</h3>
          <p style={{ fontSize: 12, color: T.textDim }}>
            {state === 'idle' && 'Druk op opnemen om te starten'}
            {state === 'recording' && 'Opname loopt...'}
            {state === 'stopped' && 'Beluister je opname'}
            {state === 'uploading' && 'Bezig met uploaden...'}
          </p>
        </div>

        {state === 'recording' && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: T.accent, fontFamily: mono.fontFamily }}>{formatDuration(duration)}</div>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: T.danger, margin: '12px auto', animation: 'pulse 1.5s ease infinite' }} />
          </div>
        )}

        {state === 'stopped' && audioUrl && (
          <div style={{ marginBottom: 20 }}>
            <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 8 }} />
            <div style={{ textAlign: 'center', fontSize: 12, color: T.textDim }}>
              Duur: {formatDuration(duration)} · {matchTime} (H{currentHalf})
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: `${T.danger}15`, border: `1px solid ${T.danger}30`, marginBottom: 16, textAlign: 'center', fontSize: 13, color: T.danger, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {state === 'idle' && (
            <>
              <button onClick={onClose} style={{ ...btnS, flex: 1, padding: '12px 16px' }}>Annuleren</button>
              <button onClick={startRecording} style={{ ...btnP, flex: 1, padding: '12px 16px' }}>Opnemen</button>
            </>
          )}

          {state === 'recording' && (
            <button onClick={stopRecording} style={{ ...btnD, width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ⏹️ Stop
            </button>
          )}

          {state === 'stopped' && (
            <>
              <button onClick={() => { setState('idle'); setAudioUrl(null); setDuration(0); }} style={{ ...btnS, flex: 1, padding: '12px 16px' }}>Opnieuw</button>
              <button onClick={uploadAudio} style={{ ...btnP, flex: 1, padding: '12px 16px' }}>Verstuur</button>
            </>
          )}

          {state === 'uploading' && (
            <button disabled style={{ ...btnP, width: '100%', padding: '12px 16px', opacity: 0.5 }}>Uploaden...</button>
          )}
        </div>
      </div>
    </div>
  );
}
