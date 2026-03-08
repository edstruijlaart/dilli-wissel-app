import React from 'react';
import { T } from '../theme';
import { FORMATION_KEYS } from '../data/formations';

/**
 * Horizontaal scrollbare rij formatie-knoppen.
 * Props:
 * - value: string — huidige formatie key ("4-3-3" | "custom" | null)
 * - onChange: (key) => void
 */
export default function FormationPicker({ value, onChange }) {
  const options = [...FORMATION_KEYS, "custom"];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '4px 0',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {options.map(key => {
        const active = value === key;
        const label = key === "custom" ? "Vrij" : key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 10,
              border: active ? `2px solid ${T.accent}` : `1px solid ${T.glassBorder}`,
              background: active ? `${T.accent}12` : T.glass,
              color: active ? T.accent : T.textDim,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              fontFamily: "'DM Sans',sans-serif",
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
