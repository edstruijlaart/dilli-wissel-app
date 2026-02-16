import React, { useState, useRef, useEffect } from 'react';
import { T, btnP, btnS, btnD } from '../theme';
import Icons from './Icons';

/**
 * PhotoCapture component - Camera access + photo upload
 *
 * @param {string} matchCode - 4-letter match code
 * @param {function} onClose - Close modal callback
 * @param {function} onPhotoUploaded - Callback with photo URL after successful upload
 */
export default function PhotoCapture({ matchCode, onClose, onPhotoUploaded }) {
  const [status, setStatus] = useState('idle'); // idle | camera | captured | uploading | error
  const [photoData, setPhotoData] = useState(null); // Base64 image data
  const [error, setError] = useState(null);
  const [caption, setCaption] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setStatus('camera');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera toegang geweigerd');
      setStatus('error');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Max dimensions for upload (keep reasonable size)
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;

    let width = video.videoWidth;
    let height = video.videoHeight;

    // Scale down if needed
    if (width > MAX_WIDTH) {
      height = (height * MAX_WIDTH) / width;
      width = MAX_WIDTH;
    }
    if (height > MAX_HEIGHT) {
      width = (width * MAX_HEIGHT) / height;
      height = MAX_HEIGHT;
    }

    // Set canvas size to scaled dimensions
    canvas.width = width;
    canvas.height = height;

    // Draw video frame to canvas (scaled)
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    // Convert to JPEG base64 (quality: 0.8 for smaller file size)
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Captured photo size:', Math.round(imageData.length / 1024), 'KB');

    setPhotoData(imageData);

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setStatus('captured');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Max dimensions (same as camera)
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        let width = img.width;
        let height = img.height;

        // Scale down if needed
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        console.log('Library photo size:', Math.round(imageData.length / 1024), 'KB');

        setPhotoData(imageData);
        setStatus('captured');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setPhotoData(null);
    setStatus('idle');
  };

  const uploadPhoto = async () => {
    if (!photoData) return;

    setStatus('uploading');
    setError(null);

    try {
      console.log('Uploading photo to:', '/api/match/photo/upload');
      console.log('Match code:', matchCode);
      console.log('Image size:', Math.round(photoData.length / 1024), 'KB');

      const res = await fetch('/api/match/photo/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchCode,
          image: photoData,
          timestamp: Date.now(),
          caption: caption.trim(),
        }),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error('Upload error response:', text);
        let errorMsg = 'Upload failed';
        try {
          const data = JSON.parse(text);
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      console.log('Upload success:', data);
      onPhotoUploaded({ url: data.url, caption: caption.trim() });
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload mislukt');
      setStatus('error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.5)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FFF', margin: 0 }}>Foto maken</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          {Icons.x(24, '#FFF')}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <p style={{ fontSize: 14, color: '#FFF', marginBottom: 20 }}>Maak een foto van het veld</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
              <button onClick={startCamera} style={{ ...btnP, padding: '14px 28px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {Icons.camera(18, '#FFF')}
                <span>Open camera</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} style={{ ...btnS, padding: '14px 28px', fontSize: 15, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.3)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {Icons.image(18, '#FFF')}
                <span>Kies uit bibliotheek</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {status === 'camera' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}>
              <button
                onClick={capturePhoto}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#FFF',
                  border: '4px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
            </div>
          </>
        )}

        {status === 'captured' && photoData && (
          <>
            <img src={photoData} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 12, width: 'calc(100% - 40px)', maxWidth: 400 }}>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optioneel: beschrijving (bijv. 'Assist van Luuk')"
                maxLength={80}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(255,255,255,0.95)',
                  fontSize: 13,
                  color: '#000',
                  fontFamily: "'DM Sans',sans-serif",
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={retake} style={{ ...btnS, flex: 1, padding: '12px 24px', fontSize: 14, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: '#FFF' }}>
                  Opnieuw
                </button>
                <button onClick={uploadPhoto} style={{ ...btnP, flex: 1, padding: '12px 32px', fontSize: 14 }}>
                  {Icons.check(16, '#FFF')}
                  <span style={{ marginLeft: 6 }}>Gebruik foto</span>
                </button>
              </div>
            </div>
          </>
        )}

        {status === 'uploading' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)', borderTop: '4px solid #FFF', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 14, color: '#FFF' }}>Uploaden...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <p style={{ fontSize: 14, color: T.danger, marginBottom: 20 }}>{error || 'Er ging iets mis'}</p>
            <button onClick={onClose} style={{ ...btnS, padding: '12px 24px' }}>Sluiten</button>
          </div>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
