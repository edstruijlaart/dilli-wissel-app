import React from 'react';

const Icons = {
  football: (size = 24, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
      <path d="M12 2c2.5 3.2 4 6.5 4 10s-1.5 6.8-4 10" />
      <path d="M12 2c-2.5 3.2-4 6.5-4 10s1.5 6.8 4 10" />
    </svg>
  ),
  glove: (size = 18, color = "#D97706") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 20V15.5C6.5 14.4 5.6 13.5 4.5 13.5V9.5C4.5 8.4 5.4 7.5 6.5 7.5V4C6.5 3.2 7.2 2.5 8 2.5S9.5 3.2 9.5 4V7" />
      <path d="M9.5 7V3.5C9.5 2.7 10.2 2 11 2S12.5 2.7 12.5 3.5V7" />
      <path d="M12.5 7V3C12.5 2.2 13.2 1.5 14 1.5S15.5 2.2 15.5 3V7" />
      <path d="M15.5 7V4.5C15.5 3.7 16.2 3 17 3S18.5 3.7 18.5 4.5V13" />
      <path d="M18.5 13L19 14.5C19.3 15.5 19.5 16.5 19.5 17.5V18C19.5 20.2 17.7 22 15.5 22H11C8.8 22 6.5 20.5 6.5 18" />
    </svg>
  ),
  timer: (size = 20, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="9" />
      <path d="M12 9V13L15 15" />
      <path d="M9 1H15" />
      <path d="M12 1V4" />
    </svg>
  ),
  swap: (size = 24, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4L3 8L7 12" />
      <path d="M3 8H17" />
      <path d="M17 20L21 16L17 12" />
      <path d="M21 16H7" />
    </svg>
  ),
  arrowDown: (size = 16, color = "#DC2626") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5V19" /><path d="M5 12L12 19L19 12" />
    </svg>
  ),
  arrowUp: (size = 16, color = "#16A34A") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="M5 12L12 5L19 12" />
    </svg>
  ),
  whistle: (size = 28, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9C2 9 4 7 8 7H12L17 4" />
      <circle cx="16" cy="13" r="6" />
      <path d="M12 7V11" />
      <path d="M18 10L20 6" />
      <circle cx="16" cy="13" r="2" fill={color} opacity="0.3" />
    </svg>
  ),
  flag: (size = 32, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V2" />
      <path d="M4 2C4 2 6 1 10 1C14 1 16 3 20 3V13C16 13 14 11 10 11C6 11 4 12 4 12" />
    </svg>
  ),
  pause: (size = 14, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="5" y="3" width="5" height="18" rx="1" /><rect x="14" y="3" width="5" height="18" rx="1" /></svg>
  ),
  play: (size = 14, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M6 3L20 12L6 21V3Z" /></svg>
  ),
  check: (size = 18, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13L9 17L19 7" />
    </svg>
  ),
  x: (size = 14, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M6 6L18 18M6 18L18 6" /></svg>
  ),
  chevUp: (size = 10, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><path d="M6 16L12 10L18 16" /></svg>
  ),
  chevDown: (size = 10, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><path d="M6 8L12 14L18 8" /></svg>
  ),
  share: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  ),
  eye: (size = 16, color = "currentColor") => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export default Icons;
