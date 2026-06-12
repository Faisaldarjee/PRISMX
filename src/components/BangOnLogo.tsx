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
      {/* High fidelity premium 3D brushed gold monogram-B candlestick breakout logo */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_4px_16px_rgba(245,196,83,0.45)]"
      >
        <defs>
          {/* Metallic Gold linear & radial gradients for premium shine */}
          <linearGradient id="solidGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF7D6" />
            <stop offset="20%" stopColor="#F5C453" />
            <stop offset="50%" stopColor="#D89E23" />
            <stop offset="80%" stopColor="#FEEA98" />
            <stop offset="100%" stopColor="#96690B" />
          </linearGradient>

          <linearGradient id="shinyBevel" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#96690B" />
            <stop offset="30%" stopColor="#F5C453" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#FFDF79" />
            <stop offset="100%" stopColor="#4A2F03" />
          </linearGradient>

          <radialGradient id="innerBgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#121B2E" />
            <stop offset="60%" stopColor="#080D1A" />
            <stop offset="100%" stopColor="#03050C" />
          </radialGradient>
        </defs>

        {/* Premium high-contrast dark circular base with double metallic gold border */}
        <circle cx="100" cy="100" r="92" fill="url(#innerBgGlow)" stroke="url(#solidGold)" strokeWidth="6" />
        <circle cx="100" cy="100" r="84" stroke="#4A3610" strokeWidth="2" fill="none" opacity="0.8" />

        {/* Candlesticks integrated in the background inside the "B" layout */}
        {/* Short Candle */}
        <line x1="88" y1="62" x2="88" y2="108" stroke="url(#solidGold)" strokeWidth="3" />
        <rect x="83" y="72" width="10" height="26" fill="url(#solidGold)" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

        {/* Medium Candle */}
        <line x1="106" y1="50" x2="106" y2="102" stroke="url(#shinyBevel)" strokeWidth="3" />
        <rect x="101" y="60" width="10" height="32" fill="url(#shinyBevel)" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

        {/* Tall Candle */}
        <line x1="124" y1="38" x2="124" y2="92" stroke="#FFFDF5" strokeWidth="3" />
        <rect x="119" y="46" width="10" height="36" fill="#FFFDF5" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

        {/* Outer Premium Golden Monogram "B" Curve & Frame */}
        {/* Elegant top bar, outer loops, and strong vertical backbone */}
        <path 
          d="M 60 45 
             L 115 45 
             C 145 45, 150 72, 126 92 
             C 152 100, 146 142, 110 145 
             L 60 145 
             Z" 
          fill="none" 
          stroke="url(#solidGold)" 
          strokeWidth="13" 
          strokeLinejoin="round" 
          strokeLinecap="round" 
        />
        {/* Inner white-gold glossy reflection core */}
        <path 
          d="M 60 45 
             L 115 45 
             C 145 45, 150 72, 126 92 
             C 152 100, 146 142, 110 145 
             L 60 145 
             Z" 
          fill="none" 
          stroke="url(#shinyBevel)" 
          strokeWidth="4" 
          strokeLinejoin="round" 
          strokeLinecap="round" 
          opacity="0.95"
        />

        {/* Iconic Golden Breakout Zigzag Arrow slicing through center */}
        {/* Underlying shadow trail for arrow */}
        <path 
          d="M 42 125 
             L 78 90 
             L 100 110 
             L 155 52" 
          fill="none" 
          stroke="#000000" 
          strokeWidth="20" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Bright gold trend line */}
        <path 
          d="M 42 125 
             L 78 90 
             L 100 110 
             L 155 52" 
          fill="none" 
          stroke="url(#solidGold)" 
          strokeWidth="13" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Core highlight line */}
        <path 
          d="M 42 125 
             L 78 90 
             L 100 110 
             L 155 52" 
          fill="none" 
          stroke="#FFFDF5" 
          strokeWidth="4.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* 3D Multi-faceted Arrow Head */}
        <g transform="translate(155, 52) rotate(-42)">
          {/* Shaded bottom-right facet */}
          <polygon 
            points="0,0 -22,13 -13,3" 
            fill="#B08323" 
            stroke="#1E1602" 
            strokeWidth="1" 
          />
          {/* Highlighted top-left facet */}
          <polygon 
            points="0,0 -13,-3 -22,-13" 
            fill="#FFFDF5" 
            stroke="#F5C453" 
            strokeWidth="1" 
          />
          {/* Center reflection ridge */}
          <line x1="0" y1="0" x2="-13" y2="0" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.95" />
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col select-none leading-none pt-0.5">
          <div className="flex items-center">
            <span className="font-sans text-sm font-black uppercase tracking-[0.14em] text-white">
              BANG ON <span className="gradient-text-gold font-black">AI</span>
            </span>
          </div>
          <span className="text-[7.5px] font-mono tracking-[0.25em] text-[#8892A4] uppercase mt-1 block">
            TRADING ANALYSIS PLATFORM
          </span>
        </div>
      )}
    </div>
  );
};
