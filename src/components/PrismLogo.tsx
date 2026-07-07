import React, { useId, useState } from 'react';

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
  const [imgError, setImgError] = useState(false);
  
  // Gradient IDs for SVG fallback
  const goldMetallic = `goldMetallic-${uniqueId}`;
  const silverMetallic = `silverMetallic-${uniqueId}`;
  const facetLeft = `facetLeft-${uniqueId}`;
  const facetRight = `facetRight-${uniqueId}`;
  const facetBottom = `facetBottom-${uniqueId}`;
  const neonGlowCore = `neonGlowCore-${uniqueId}`;
  const radiantSpot = `radiantSpot-${uniqueId}`;

  const renderSvgFallback = () => (
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
        <linearGradient id={goldMetallic} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2A1" />
          <stop offset="25%" stopColor="#D4A843" />
          <stop offset="50%" stopColor="#9A7010" />
          <stop offset="75%" stopColor="#F5D061" />
          <stop offset="100%" stopColor="#854D00" />
        </linearGradient>

        <linearGradient id={silverMetallic} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="75%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

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

      <circle cx="100" cy="107" r="85" fill="#030712" opacity="0.4" filter={`url(#${radiantSpot})`} />
      <polygon points="100,32 35,145 165,145" fill="#030712" />

      {/* 3D Glass Facet Layers */}
      <polygon points="100,32 35,145 100,107" fill={`url(#${facetLeft})`} />
      <polygon points="100,32 165,145 100,107" fill={`url(#${facetRight})`} />
      <polygon points="35,145 165,145 100,107" fill={`url(#${facetBottom})`} />

      {/* Central Luminous Core */}
      <circle cx="100" cy="107" r="50" fill={`url(#${neonGlowCore})`} opacity="0.95" />
      <circle cx="100" cy="107" r="12" fill="#FFFFFF" opacity="0.9" filter={`url(#${radiantSpot})`} />
      <circle cx="100" cy="107" r="6" fill="#FFFFFF" />

      {/* Outer Gold Frame */}
      <polygon 
        points="100,32 35,145 165,145" 
        fill="none" 
        stroke={`url(#${goldMetallic})`} 
        strokeWidth="7" 
        strokeLinejoin="round" 
      />

      {/* Inner Silver Accent */}
      <polygon 
        points="100,39 42,139 158,139" 
        fill="none" 
        stroke={`url(#${silverMetallic})`} 
        strokeWidth="1.8" 
        strokeLinejoin="round" 
        opacity="0.8"
      />

      {/* Struts */}
      <line x1="100" y1="32" x2="100" y2="107" stroke={`url(#${goldMetallic})`} strokeWidth="4" strokeLinecap="round" />
      <line x1="100" y1="36" x2="100" y2="104" stroke={`url(#${silverMetallic})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.95" />
      <line x1="35" y1="145" x2="100" y2="107" stroke={`url(#${goldMetallic})`} strokeWidth="4" strokeLinecap="round" />
      <line x1="40" y1="142" x2="97" y2="109" stroke={`url(#${silverMetallic})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.95" />
      <line x1="165" y1="145" x2="100" y2="107" stroke={`url(#${goldMetallic})`} strokeWidth="4" strokeLinecap="round" />
      <line x1="160" y1="142" x2="103" y2="109" stroke={`url(#${silverMetallic})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.95" />

      {/* Vertices Highlights */}
      <circle cx="100" cy="32" r="4.5" fill="#FFFFFF" />
      <circle cx="35" cy="145" r="4" fill="#FFFFFF" />
      <circle cx="165" cy="145" r="4" fill="#FFFFFF" />
    </svg>
  );

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Logo Icon — tries generated PNG first, falls back to SVG */}
      {!imgError ? (
        <img 
          src="/prismx-icon.png" 
          alt="PRISMX" 
          width={size} 
          height={size}
          className="shrink-0 drop-shadow-[0_4px_20px_rgba(212,168,67,0.25)] rounded-lg"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        renderSvgFallback()
      )}

      {showText && (
        <div className="flex flex-col select-none pt-0.5 justify-center">
          <div className="flex items-center">
            <span 
              className="font-bold uppercase tracking-[0.3em] bg-gradient-to-r from-[#FFF5C0] via-[#E5BF5E] to-[#B58B24] bg-clip-text text-transparent leading-none"
              style={{ 
                fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
                fontSize: '21px',
                fontWeight: 600,
                letterSpacing: '0.28em'
              }}
            >
              PRISMX
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
