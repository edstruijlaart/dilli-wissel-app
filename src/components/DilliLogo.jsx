import React from 'react';

const DilliLogo = ({ size = 72 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="98" fill="white" stroke="#222" strokeWidth="3"/>
    <circle cx="100" cy="100" r="82" fill="white" stroke="#222" strokeWidth="2"/>
    <clipPath id="dilli-clip"><circle cx="100" cy="100" r="60"/></clipPath>
    <g clipPath="url(#dilli-clip)">
      <rect x="40" y="40" width="120" height="120" fill="white"/>
      <rect x="52" y="40" width="14" height="120" fill="#CC0000"/>
      <rect x="78" y="40" width="14" height="120" fill="#CC0000"/>
      <rect x="104" y="40" width="14" height="120" fill="#CC0000"/>
      <rect x="130" y="40" width="14" height="120" fill="#CC0000"/>
    </g>
    <circle cx="100" cy="100" r="60" fill="none" stroke="#222" strokeWidth="2"/>
    <defs>
      <path id="dilli-top" d="M 25,100 a 75,75 0 0,1 150,0"/>
      <path id="dilli-bot" d="M 175,100 a 75,75 0 0,1 -150,0"/>
    </defs>
    <text fontSize="15" fontWeight="700" fontFamily="Arial,sans-serif" fill="#222" letterSpacing="2">
      <textPath href="#dilli-top" startOffset="50%" textAnchor="middle">v.v. DILETTANT</textPath>
    </text>
    <text fontSize="13" fontWeight="700" fontFamily="Arial,sans-serif" fill="#222" letterSpacing="1.5">
      <textPath href="#dilli-bot" startOffset="50%" textAnchor="middle">KRIMPEN A/D LEK</textPath>
    </text>
  </svg>
);

export default DilliLogo;
