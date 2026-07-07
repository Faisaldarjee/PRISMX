import React, { useId } from 'react';

interface PrismLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const PrismLogo: React.FC<PrismLogoProps> = ({ 
  className = '', 
  size = 40,
  showText = false
}) => {
  const uniqueId = useId().replace(/:/g, '');
  
  // Gradient IDs for the original SVG icon
  const goldMetallic = `goldMetallic-${uniqueId}`;
  const silverMetallic = `silverMetallic-${uniqueId}`;
  const facetLeft = `facetLeft-${uniqueId}`;
  const facetRight = `facetRight-${uniqueId}`;
  const facetBottom = `facetBottom-${uniqueId}`;
  const neonGlowCore = `neonGlowCore-${uniqueId}`;
  const radiantSpot = `radiantSpot-${uniqueId}`;

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Precision 3D Gold & Silver Beveled Prism with Neon Core */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        style={{ overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_8px_25px_rgba(56,189,248,0.2)]"
      >
        <defs>
          {/* Luxury gold metallic gradient for outer bezel */}
          <linearGradient id={goldMetallic} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2A1" />
            <stop offset="25%" stopColor="#D4A843" />
            <stop offset="50%" stopColor="#9A7010" />
            <stop offset="75%" stopColor="#F5D061" />
            <stop offset="100%" stopColor="#854D00" />
          </linearGradient>

          {/* Luxury silver metallic gradient for inner bevel and struts */}
          <linearGradient id={silverMetallic} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="30%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Deep cybernetic navy-blue & cobalt glass facet base */}
          <linearGradient id={facetLeft} x1="35" y1="145" x2="100" y2="32">
            <stop offset="0%" stopColor="#030C24" />
            <stop offset="40%" stopColor="#0B1C47" />
            <stop offset="80%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          <linearGradient id={facetRight} x1="165" y1="145" x2="100" y2="32">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="45%" stopColor="#0F1E3D" />
            <stop offset="80%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          <linearGradient id={facetBottom} x1="100" y1="107" x2="100" y2="145">
            <stop offset="0%" stopColor="#010411" />
            <stop offset="55%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* High-intensity blue & cyan radial glow for the core */}
          <radialGradient id={neonGlowCore} cx="100" cy="107" r="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="15%" stopColor="#E0F2FE" />
            <stop offset="35%" stopColor="#38BDF8" />
            <stop offset="65%" stopColor="#0284C7" />
            <stop offset="90%" stopColor="#0A192F" opacity="0.3" />
            <stop offset="100%" stopColor="#020813" opacity="0" />
          </radialGradient>
          
          <filter id={radiantSpot} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Ambient atmospheric backdrop shadow and slight blue bloom */}
        <circle cx="100" cy="107" r="85" fill="#030712" opacity="0.4" filter={`url(#${radiantSpot})`} />

        {/* Outer background backing shadow panel inside the triangle */}
        <polygon points="100,32 35,145 165,145" fill="#030712" />

        {/* 3D Glass Facet Layers */}
        {/* Left Facet */}
        <polygon points="100,32 35,145 100,107" fill={`url(#${facetLeft})`} />
        {/* Right Facet */}
        <polygon points="100,32 165,145 100,107" fill={`url(#${facetRight})`} />
        {/* Bottom Facet */}
        <polygon points="35,145 165,145 100,107" fill={`url(#${facetBottom})`} />

        {/* Central Luminous High-Intensity Blue Glow Core */}
        <circle cx="100" cy="107" r="50" fill={`url(#${neonGlowCore})`} opacity="0.95" />
        <circle cx="100" cy="107" r="12" fill="#FFFFFF" opacity="0.9" filter={`url(#${radiantSpot})`} />
        <circle cx="100" cy="107" r="6" fill="#FFFFFF" />

        {/* Outer Gold Beveled Triangle Frame */}
        <polygon 
          points="100,32 35,145 165,145" 
          fill="none" 
          stroke={`url(#${goldMetallic})`} 
          strokeWidth="7" 
          strokeLinejoin="round" 
        />

        {/* Inner Silver Accent Triangle Frame */}
        <polygon 
          points="100,39 42,139 158,139" 
          fill="none" 
          stroke={`url(#${silverMetallic})`} 
          strokeWidth="1.8" 
          strokeLinejoin="round" 
          opacity="0.8"
        />

        {/* Connecting 3D Corner Bevel Struts */}
        {/* Apex to Center */}
        <line 
          x1="100" y1="32" 
          x2="100" y2="107" 
          stroke={`url(#${goldMetallic})`} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
        <line 
          x1="100" y1="36" 
          x2="100" y2="104" 
          stroke={`url(#${silverMetallic})`} 
          strokeWidth="1.5" 
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Bottom-Left to Center */}
        <line 
          x1="35" y1="145" 
          x2="100" y2="107" 
          stroke={`url(#${goldMetallic})`} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
        <line 
          x1="40" y1="142" 
          x2="97" y2="109" 
          stroke={`url(#${silverMetallic})`} 
          strokeWidth="1.5" 
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Bottom-Right to Center */}
        <line 
          x1="165" y1="145" 
          x2="100" y2="107" 
          stroke={`url(#${goldMetallic})`} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
        <line 
          x1="160" y1="142" 
          x2="103" y2="109" 
          stroke={`url(#${silverMetallic})`} 
          strokeWidth="1.5" 
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Vertices Specular Highlights */}
        <circle cx="100" cy="32" r="4.5" fill="#FFFFFF" />
        <circle cx="35" cy="145" r="4" fill="#FFFFFF" />
        <circle cx="165" cy="145" r="4" fill="#FFFFFF" />
      </svg>

      {showText && (
        <div className="flex flex-col select-none pt-0.5 justify-center">
          <div className="flex items-center">
            <span 
              className="font-bold uppercase tracking-[0.3em] text-white leading-none"
              style={{ 
                fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
                fontSize: '21px',
                fontWeight: 700,
                letterSpacing: '0.28em'
              }}
            >
              PRISM<span className="inline-block bg-gradient-to-b from-[#F5D061] via-[#D4A843] to-[#854D00] bg-clip-text text-transparent">X</span>
            </span>
          </div>
          {/* Thin, elegant horizontal gold/bronze separator line */}
          <div className="w-[125px] h-[0.5px] bg-gradient-to-r from-transparent via-[#E5BF5E]/40 to-transparent my-1.5" />
          <span 
            className="block uppercase whitespace-nowrap text-[#D4A843]/90"
            style={{ 
              fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
              fontSize: '7.5px',
              letterSpacing: '0.21em',
              lineHeight: '1.0'
            }}
          >
            EVERY ANGLE. ONE SIGNAL.
          </span>
        </div>
      )}
    </div>
  );
};
