import React, { useState, useRef, useCallback } from 'react';
import { T } from '../theme';

/**
 * SVG voetbalveld met spelerposities (top-down view).
 * Coördinatensysteem: x: 0-100 (links→rechts), y: 0-100 (eigen doel→tegenstander).
 *
 * Props:
 * - onField: string[] — spelers op het veld
 * - playerPositions: { [name]: { x, y } } — genormaliseerde posities
 * - squadNumbers: { [name]: number } — rugnummers
 * - matchKeeper: string — keeper naam
 * - interactive: boolean — coach kan spelers verplaatsen
 * - onPositionChange: (name, { x, y }) => void — drag callback
 * - onPlayerTap: (name) => void — tap callback (voor wissel)
 * - selectedPlayer: string|null — geselecteerde speler (highlight)
 * - goalScorers: { [name]: number } — doelpuntscorers
 */

const W = 340; // SVG viewport width
const H = 500; // SVG viewport height
const MARKER_R = 20;

function firstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

function posToSvg(pos) {
  if (!pos) return { cx: W / 2, cy: H / 2 };
  return {
    cx: (pos.x / 100) * W,
    cy: (1 - pos.y / 100) * H, // y flip: 0=onderaan (eigen doel), 100=bovenaan (tegenstander)
  };
}

function svgToPos(svgX, svgY) {
  return {
    x: Math.max(2, Math.min(98, (svgX / W) * 100)),
    y: Math.max(2, Math.min(98, (1 - svgY / H) * 100)),
  };
}

// Veld markeringen als SVG elementen (puur statisch, nooit herrenderen)
const PitchMarkings = React.memo(function PitchMarkings() {
  const pw = W; // pitch width = full SVG
  const ph = H;
  const cx = pw / 2;
  const cy = ph / 2;

  // Strafschopgebied afmetingen (geschaald naar SVG)
  const penW = pw * 0.55; // breedte strafschopgebied
  const penH = ph * 0.16; // hoogte strafschopgebied
  const goalW = pw * 0.26; // breedte doelgebied
  const goalH = ph * 0.06; // hoogte doelgebied
  const cornerR = 12;

  return (
    <g stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} fill="none">
      {/* Buitenlijnen */}
      <rect x={2} y={2} width={pw - 4} height={ph - 4} rx={3} />
      {/* Middenlijn */}
      <line x1={2} y1={cy} x2={pw - 2} y2={cy} />
      {/* Middencirkel */}
      <circle cx={cx} cy={cy} r={pw * 0.14} />
      {/* Middenstip */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.35)" />

      {/* Strafschopgebied onder (eigen doel) */}
      <rect x={(pw - penW) / 2} y={ph - 2 - penH} width={penW} height={penH} />
      {/* Doelgebied onder */}
      <rect x={(pw - goalW) / 2} y={ph - 2 - goalH} width={goalW} height={goalH} />
      {/* Penaltystip onder */}
      <circle cx={cx} cy={ph - 2 - penH * 0.7} r={3} fill="rgba(255,255,255,0.35)" />

      {/* Strafschopgebied boven (tegenstander) */}
      <rect x={(pw - penW) / 2} y={2} width={penW} height={penH} />
      {/* Doelgebied boven */}
      <rect x={(pw - goalW) / 2} y={2} width={goalW} height={goalH} />
      {/* Penaltystip boven */}
      <circle cx={cx} cy={2 + penH * 0.7} r={3} fill="rgba(255,255,255,0.35)" />

      {/* Hoekbogen */}
      <path d={`M ${2} ${ph - 2 - cornerR} A ${cornerR} ${cornerR} 0 0 0 ${2 + cornerR} ${ph - 2}`} />
      <path d={`M ${pw - 2 - cornerR} ${ph - 2} A ${cornerR} ${cornerR} 0 0 0 ${pw - 2} ${ph - 2 - cornerR}`} />
      <path d={`M ${2 + cornerR} ${2} A ${cornerR} ${cornerR} 0 0 0 ${2} ${2 + cornerR}`} />
      <path d={`M ${pw - 2} ${2 + cornerR} A ${cornerR} ${cornerR} 0 0 0 ${pw - 2 - cornerR} ${2}`} />
    </g>
  );
});

const PlayerMarker = React.memo(function PlayerMarker({ name, pos, num, isKeeper, isSelected, interactive, onTap }) {
  const { cx, cy } = posToSvg(pos);
  const fill = isKeeper ? T.keeper : T.accent;
  const strokeColor = isSelected ? T.danger : '#fff';
  const strokeW = isSelected ? 3 : 2;

  return (
    <g
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      onClick={interactive && onTap ? (e) => { e.stopPropagation(); onTap(name); } : undefined}
    >
      {/* Schaduw */}
      <circle cx={cx + 1} cy={cy + 2} r={MARKER_R} fill="rgba(0,0,0,0.15)" />
      {/* Marker cirkel */}
      <circle cx={cx} cy={cy} r={MARKER_R} fill={fill} stroke={strokeColor} strokeWidth={strokeW} />
      {/* Rugnummer */}
      <text
        x={cx} y={cy + 5}
        fill="#fff" fontSize={14} fontWeight={800}
        textAnchor="middle"
        style={{ fontFamily: "'DM Sans',sans-serif", pointerEvents: 'none' }}
      >
        {num || '?'}
      </text>
      {/* Naam */}
      <text
        x={cx} y={cy + MARKER_R + 13}
        fill="#fff" fontSize={10} fontWeight={600}
        textAnchor="middle"
        style={{
          fontFamily: "'DM Sans',sans-serif",
          pointerEvents: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          paintOrder: 'stroke',
          stroke: 'rgba(0,0,0,0.4)',
          strokeWidth: 2,
          strokeLinejoin: 'round',
        }}
      >
        {firstName(name)}
      </text>
    </g>
  );
});

export default function FieldView({
  onField = [],
  playerPositions = {},
  squadNumbers = {},
  matchKeeper = null,
  interactive = false,
  onPositionChange = null,
  onPlayerTap = null,
  selectedPlayer = null,
  goalScorers = {},
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null); // player name die gesleept wordt
  const dragStartRef = useRef(null);

  const getSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const handleTouchStart = useCallback((e, playerName) => {
    if (!interactive || !onPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, name: playerName, moved: false };
  }, [interactive, onPositionChange]);

  const handleTouchMove = useCallback((e) => {
    if (!dragStartRef.current || !interactive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    // Alleen als voldoende bewogen (voorkom accidentele drag)
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      dragStartRef.current.moved = true;
      setDragging(dragStartRef.current.name);
      const pt = getSvgPoint(touch.clientX, touch.clientY);
      const pos = svgToPos(pt.x, pt.y);
      onPositionChange(dragStartRef.current.name, pos);
    }
  }, [interactive, onPositionChange, getSvgPoint]);

  const handleTouchEnd = useCallback((e) => {
    if (!dragStartRef.current) return;
    if (!dragStartRef.current.moved && onPlayerTap) {
      // Geen drag, was een tap
      onPlayerTap(dragStartRef.current.name);
    }
    dragStartRef.current = null;
    setDragging(null);
  }, [onPlayerTap]);

  return (
    <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #1B7A3A 0%, #228B3B 30%, #1B7A3A 50%, #228B3B 70%, #1B7A3A 100%)',
          display: 'block',
          touchAction: interactive ? 'none' : 'auto',
          userSelect: 'none',
        }}
        onTouchMove={interactive ? handleTouchMove : undefined}
        onTouchEnd={interactive ? handleTouchEnd : undefined}
      >
        {/* Grasbanen effect */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <rect
            key={i}
            x={0} y={i * (H / 8)}
            width={W} height={H / 8}
            fill={i % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)'}
          />
        ))}

        <PitchMarkings />

        {/* Doelen */}
        <rect x={(W - 60) / 2} y={H - 2} width={60} height={6} rx={2} fill="rgba(255,255,255,0.2)" />
        <rect x={(W - 60) / 2} y={-4} width={60} height={6} rx={2} fill="rgba(255,255,255,0.2)" />

        {/* Richtingspijl */}
        <text
          x={W - 16} y={22}
          fill="rgba(255,255,255,0.25)" fontSize={18}
          textAnchor="middle"
          style={{ fontFamily: "'DM Sans',sans-serif" }}
        >
          ▲
        </text>

        {/* Spelers */}
        {onField.map(player => {
          const pos = playerPositions[player];
          if (!pos) return null;
          return (
            <g
              key={player}
              onTouchStart={interactive ? (e) => handleTouchStart(e, player) : undefined}
            >
              <PlayerMarker
                name={player}
                pos={pos}
                num={squadNumbers[player]}
                isKeeper={player === matchKeeper}
                isSelected={player === selectedPlayer || player === dragging}
                interactive={interactive}
                onTap={!interactive && onPlayerTap ? onPlayerTap : (interactive && !onPositionChange ? onPlayerTap : null)}
              />
              {/* Doelpunt indicator */}
              {goalScorers[player] > 0 && (
                <text
                  x={posToSvg(pos).cx + MARKER_R - 4}
                  y={posToSvg(pos).cy - MARKER_R + 6}
                  fontSize={12}
                  style={{ pointerEvents: 'none' }}
                >
                  ⚽
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
