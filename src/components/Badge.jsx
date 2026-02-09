import React from 'react';
import { T } from '../theme';

const Badge = ({ children, variant = "field" }) => {
  const c = {
    field: { bg: T.accentDim, c: T.accent },
    bench: { bg: "#FEF3C7", c: T.warn },
    keeper: { bg: T.keeperDim, c: T.keeper },
    manual: { bg: "#DBEAFE", c: "#2563EB" }
  }[variant];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.c, letterSpacing: 0.3 }}>
      {children}
    </span>
  );
};

export default Badge;
