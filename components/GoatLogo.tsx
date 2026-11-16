import React from 'react';

interface GoatLogoProps {
  className?: string;
  size?: number;
}

export default function GoatLogo({ className = 'w-6 h-6', size }: GoatLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      {/* Background circle badge accent (subtle dark mint) */}
      <circle cx="32" cy="32" r="30" fill="#121314" stroke="#5eead4" strokeWidth="2.5" />

      {/* Left Horn - Curved back */}
      <path
        d="M23 23C21 15 15 11 8 13C12 19 18 25 21 27"
        stroke="#5eead4"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left Horn Ridges */}
      <path d="M15 16L18 19" stroke="#1a1b1d" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 20L21 23" stroke="#1a1b1d" strokeWidth="1.5" strokeLinecap="round" />

      {/* Right Horn - Curved back */}
      <path
        d="M41 23C43 15 49 11 56 13C52 19 46 25 43 27"
        stroke="#5eead4"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Horn Ridges */}
      <path d="M49 16L46 19" stroke="#1a1b1d" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M46 20L43 23" stroke="#1a1b1d" strokeWidth="1.5" strokeLinecap="round" />

      {/* Left Ear */}
      <path
        d="M20 28C14 28 9 32 10 35C13 36 18 33 21 31"
        fill="#222326"
        stroke="#5eead4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Ear */}
      <path
        d="M44 28C50 28 55 32 54 35C51 36 46 33 43 31"
        fill="#222326"
        stroke="#5eead4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Goat Head / Face Shape */}
      <path
        d="M22 25C22 25 25 23 32 23C39 23 42 25 42 25C44 32 44 40 39 46C36 49.5 34 51 32 51C30 51 28 49.5 25 46C20 40 20 32 22 25Z"
        fill="#1e1f23"
        stroke="#5eead4"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Goatee Beard */}
      <path
        d="M29 51L32 58L35 51Z"
        fill="#5eead4"
      />

      {/* Eyes (Horizontal goat pupils with friendly cartoon sparkle) */}
      {/* Left Eye */}
      <circle cx="27" cy="33" r="3.2" fill="#5eead4" />
      <rect x="25" y="32" width="4" height="2" rx="0.8" fill="#121314" />
      <circle cx="28" cy="32" r="0.8" fill="#ffffff" />

      {/* Right Eye */}
      <circle cx="37" cy="33" r="3.2" fill="#5eead4" />
      <rect x="35" y="32" width="4" height="2" rx="0.8" fill="#121314" />
      <circle cx="38" cy="32" r="0.8" fill="#ffffff" />

      {/* Snout Muzzle */}
      <ellipse cx="32" cy="43" rx="5" ry="3.5" fill="#2a2b30" />

      {/* Nostrils */}
      <ellipse cx="30.5" cy="42" rx="0.8" ry="1.2" fill="#5eead4" />
      <ellipse cx="33.5" cy="42" rx="0.8" ry="1.2" fill="#5eead4" />

      {/* Subtle Smirk Smile */}
      <path
        d="M30 45C31.5 46 33.5 46 35 44.5"
        stroke="#5eead4"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
