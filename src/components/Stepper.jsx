import React from 'react';
import { T, btnS, mono } from '../theme';

const Stepper = ({ label, value, set, min, step }) => (
  <div>
    <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => set(Math.max(min, value - step))} style={{ ...btnS, width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, borderRadius: 10 }}>−</button>
      <span style={{ ...mono, fontSize: 24, fontWeight: 700, width: 36, textAlign: "center" }}>{value}</span>
      <button onClick={() => set(value + step)} style={{ ...btnS, width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, borderRadius: 10 }}>+</button>
    </div>
  </div>
);

export default Stepper;
