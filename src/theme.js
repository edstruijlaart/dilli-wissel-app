export const T = {
  bg: "#F5F5F7", card: "#FFFFFF", cardBorder: "#E2E5EA",
  text: "#1A1D23", textDim: "#6B7280", textMuted: "#9CA3AF",
  accent: "#16A34A", accentDim: "#DCFCE7",
  warn: "#D97706", warnDim: "#FEF3C7",
  danger: "#DC2626", dangerDim: "#FEE2E2",
  keeper: "#D97706", keeperDim: "#FEF3C7",
  glass: "rgba(0,0,0,0.03)", glassBorder: "rgba(0,0,0,0.08)",
};

export const base = { fontFamily: "'DM Sans',sans-serif", color: T.text, background: T.bg, minHeight: "100vh", width: "100%", margin: 0, padding: 0 };
export const card = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
export const mono = { fontFamily: "'JetBrains Mono',monospace" };
export const btnP = { background: T.accent, color: "#FFFFFF", border: "none", borderRadius: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 15, transition: "all 0.2s" };
export const btnS = { background: T.glass, color: T.textDim, border: `1px solid ${T.glassBorder}`, borderRadius: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 14, transition: "all 0.2s" };
export const btnD = { ...btnS, color: T.danger, borderColor: T.dangerDim };

export const globalStyles = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;min-height:100vh;margin:0;padding:0;background:#F5F5F7}body{overflow-x:hidden;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;color:#1A1D23;font-family:"DM Sans",sans-serif}body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}input,textarea,button{-webkit-appearance:none}@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes slideIn{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}`;
