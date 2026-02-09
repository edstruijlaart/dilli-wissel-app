import React from 'react';
import { T, base, card, btnP, btnS, mono } from '../theme';
import DilliLogo from '../components/DilliLogo';
import Icons from '../components/Icons';

export default function ShareView({ code, onContinue }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const joinUrl = `${baseUrl}/join/${code}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(code);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(joinUrl);
  };

  const shareWhatsApp = () => {
    const text = `Kijk mee met de wedstrijd! Open: ${joinUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dilli Wissel — Meekijken', text: `Kijk mee met de wedstrijd!`, url: joinUrl });
      } catch (e) { /* user cancelled */ }
    }
  };

  return (
    <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" }}>
      <DilliLogo size={60} />
      <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 16, marginBottom: 4, color: T.text }}>Wedstrijd aangemaakt!</h2>
      <p style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>Deel de code zodat anderen kunnen meekijken</p>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Code kaart */}
        <div style={{ ...card, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Wedstrijdcode</p>
          <button onClick={copyCode} style={{ ...mono, fontSize: 48, fontWeight: 800, color: T.accent, letterSpacing: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {code}
          </button>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>Tik om te kopiëren</p>
        </div>

        {/* Link kopiëren */}
        <button onClick={copyLink} style={{ ...btnS, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", fontSize: 13 }}>
          Link kopiëren
        </button>

        {/* WhatsApp delen */}
        <button onClick={shareWhatsApp} style={{ ...btnS, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", fontSize: 13, color: "#25D366", borderColor: "#25D366" }}>
          Delen via WhatsApp
        </button>

        {/* Native share (als beschikbaar) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={shareNative} style={{ ...btnS, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", fontSize: 13 }}>
            Meer deelmogelijkheden...
          </button>
        )}

        {/* Door naar wedstrijd */}
        <button onClick={onContinue} style={{ ...btnP, padding: "16px 24px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", marginTop: 8 }}>
          {Icons.football(22, "#FFF")}
          Door naar de wedstrijd
        </button>
      </div>
    </div>
  );
}
