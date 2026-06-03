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
      {/* High fidelity SVG of the Bang On target arrow combo logo */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Ticks of Crosshair (White) */}
        {/* Top tick */}
        <line x1="100" y1="25" x2="100" y2="55" stroke="white" strokeWidth="6" strokeLinecap="round" />
        {/* Bottom tick */}
        <line x1="100" y1="145" x2="100" y2="175" stroke="white" strokeWidth="6" strokeLinecap="round" />
        {/* Left tick */}
        <line x1="25" y1="100" x2="55" y2="100" stroke="white" strokeWidth="6" strokeLinecap="round" />
        {/* Right tick */}
        <line x1="145" y1="100" x2="175" y2="100" stroke="white" strokeWidth="6" strokeLinecap="round" />

        {/* Circular Target Ring (Vibrant Orange) */}
        <circle cx="100" cy="100" r="48" stroke="#FF5500" strokeWidth="6.5" fill="none" />

        {/* Candlesticks inside (White & Dark Orange/Red) */}
        
        {/* Candle 1 (Orange/Red decrease, lower left overlaying the ring) */}
        <line x1="68" y1="110" x2="68" y2="150" stroke="#FF5500" strokeWidth="2.5" />
        <rect x="63" y="120" width="10" height="22" fill="#FF5500" rx="2" />

        {/* Candle 2 (White increase) */}
        <line x1="82" y1="85" x2="82" y2="135" stroke="white" strokeWidth="2.5" />
        <rect x="77" y="95" width="10" height="28" fill="white" rx="2" />

        {/* Candle 3 (White increase) */}
        <line x1="97" y1="75" x2="97" y2="125" stroke="white" strokeWidth="2.5" />
        <rect x="92" y="85" width="10" height="28" fill="white" rx="2" />

        {/* Candle 4 (Orange/Red decrease) */}
        <line x1="112" y1="80" x2="112" y2="115" stroke="#FF5500" strokeWidth="2.5" />
        <rect x="107" y="88" width="10" height="18" fill="#FF5500" rx="2" />

        {/* Candle 5 (White increase / arrow pivot source) */}
        <line x1="127" y1="62" x2="127" y2="110" stroke="white" strokeWidth="2.5" />
        <rect x="122" y="70" width="10" height="22" fill="white" rx="2" />

        {/* Breakout Arrow (Vibrant Orange, breaking out of target at 45 degree angle) */}
        {/* Diagonal thick arrow shaft */}
        <path 
          d="M 125 105 L 142 80 L 175 42" 
          stroke="#FF5500" 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        
        {/* Dynamic Arrowhead pointing upper-right */}
        <path 
          d="M 150 42 L 176 41 L 175 67" 
          fill="none"
          stroke="#FF5500" 
          strokeWidth="10" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>

      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#FF5500]">
              BANG ON
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 font-mono rounded-md font-bold border border-emerald-900/20">
              AI
            </span>
          </div>
          <span className="text-[9px] font-black tracking-widest text-slate-450 uppercase -mt-0.5">
            SYSTEMATIC WEALTH
          </span>
        </div>
      )}
    </div>
  );
};
