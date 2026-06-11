import React from 'react';

interface BangOnLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const BangOnLogo: React.FC<BangOnLogoProps> = ({ 
  className = '', 
  size = 40,
  showText = false
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* High fidelity SVG of the Bang On metal gold target & candlestick breakout logo */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-lg"
      >
        {/* 1. Base Plate (Deep black/obsidian matte container with a brilliant polished gold border) */}
        <circle cx="100" cy="100" r="95" fill="#060913" stroke="#D4A843" strokeWidth="5" />
        <circle cx="100" cy="100" r="88" stroke="#1E293B" strokeWidth="2" fill="none" />

        {/* 2. Concentric Target Rings (Silver & Gold nested details) */}
        {/* Outer Silver Ring */}
        <circle cx="100" cy="100" r="64" stroke="#64748B" strokeWidth="8" fill="none" />
        <circle cx="100" cy="100" r="68" stroke="#92400E" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="60" stroke="#92400E" strokeWidth="1" fill="none" />
        
        {/* Inner Silver Ring */}
        <circle cx="100" cy="100" r="42" stroke="#475569" strokeWidth="4" fill="none" />
        <circle cx="100" cy="100" r="44" stroke="#D4A843" strokeWidth="0.75" fill="none" opacity="0.8" />

        {/* 3. Crosshair Target Ticks */}
        {/* Top Tick */}
        <rect x="95" y="16" width="10" height="26" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="97" y="18" width="2.5" height="22" fill="#FDE047" rx="0.5" />

        {/* Bottom Tick */}
        <rect x="95" y="158" width="10" height="26" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="97" y="160" width="2.5" height="22" fill="#FDE047" rx="0.5" />

        {/* Left Tick */}
        <rect x="16" y="95" width="26" height="10" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="18" y="97" width="22" height="2.5" fill="#FDE047" rx="0.5" />

        {/* Right Tick */}
        <rect x="158" y="95" width="26" height="10" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="160" y="97" width="22" height="2.5" fill="#FDE047" rx="0.5" />

        {/* Center Target Core Bullseye */}
        <circle cx="100" cy="100" r="14" fill="#64748B" stroke="#D4A843" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="7" fill="#FDE047" />

        {/* 4. Candlesticks (Overlapping right side) */}
        {/* Short Candlestick (Left) */}
        {/* Wick */}
        <line x1="112" y1="56" x2="112" y2="106" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
        <line x1="112" y1="56" x2="112" y2="106" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" />
        {/* Real Body */}
        <rect x="106" y="65" width="12" height="32" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="108" y="67" width="2.5" height="28" fill="#FDE047" rx="0.5" />

        {/* Tall Candlestick (Right) */}
        {/* Wick */}
        <line x1="128" y1="42" x2="128" y2="92" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
        <line x1="128" y1="42" x2="128" y2="92" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" />
        {/* Real Body */}
        <rect x="122" y="50" width="12" height="34" fill="#D4A843" stroke="#92400E" strokeWidth="1.5" rx="1.5" />
        <rect x="124" y="52" width="2.5" height="30" fill="#FDE047" rx="0.5" />

        {/* 5. Breakout Zig-Zag and Arrow */}
        {/* Heavy Underlay/Shadow for the trend arrow path */}
        <path 
          d="M 52 148 L 92 108 L 108 118 L 150 63" 
          stroke="#412904" 
          strokeWidth="15" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          opacity="0.9"
        />
        {/* Foreground dynamic gold trend path */}
        <path 
          d="M 52 148 L 92 108 L 108 118 L 150 63" 
          stroke="#D4A843" 
          strokeWidth="10" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M 52 148 L 92 108 L 108 118 L 150 63" 
          stroke="#FDE047" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* 3D Faceted Arrowhead */}
        {/* Shaded bottom-right facet */}
        <polygon 
          points="174,38 143,65 152,56" 
          fill="#D4A843" 
          stroke="#92400E" 
          strokeWidth="0.5" 
        />
        {/* Highlighted top-left facet */}
        <polygon 
          points="174,38 152,56 142,46" 
          fill="#FDE047" 
          stroke="#D4A843" 
          strokeWidth="0.5" 
        />
        {/* Core highlight line */}
        <line x1="174" y1="38" x2="152" y2="56" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      </svg>

      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#E8C070]">
              BANG ON <span className="text-emerald-400">AI</span>
            </span>
          </div>
          <span className="text-[9px] font-black tracking-widest text-[#8892A4] uppercase -mt-0.5">
            SYSTEMATIC WEALTH
          </span>
        </div>
      )}
    </div>
  );
};
