import React from 'react';

interface SignalBadgeProps {
  signal: 'BUY' | 'SELL' | 'HOLD' | 'MIXED' | string;
  size?: 'sm' | 'lg';
}

export function SignalBadge({ signal, size = 'sm' }: SignalBadgeProps) {
  const norm = (signal || 'HOLD').toUpperCase();
  
  let bgClass = 'bg-gray-800 text-gray-400 border-gray-700';
  let textClass = 'text-gray-400';
  let pulseDot = 'bg-gray-400';

  if (norm === 'BUY' || norm === 'BULLISH' || norm === 'STRONG_BULLISH' || norm === 'POSITIVE' || norm === 'UP') {
    bgClass = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80';
    textClass = 'text-emerald-400';
    pulseDot = 'bg-emerald-400';
  } else if (norm === 'SELL' || norm === 'BEARISH' || norm === 'STRONG_BEARISH' || norm === 'NEGATIVE' || norm === 'DOWN') {
    bgClass = 'bg-rose-950/60 text-rose-400 border-rose-800/80';
    textClass = 'text-rose-400';
    pulseDot = 'bg-rose-400';
  } else if (norm === 'HOLD' || norm === 'NEUTRAL' || norm === 'SIDEYS') {
    bgClass = 'bg-amber-950/60 text-amber-400 border-amber-800/80';
    textClass = 'text-amber-400';
    pulseDot = 'bg-amber-400';
  } else if (norm === 'MIXED') {
    bgClass = 'bg-slate-900 border-slate-700 text-slate-400';
    textClass = 'text-slate-400';
    pulseDot = 'bg-slate-500';
  }

  const pxClass = size === 'lg' ? 'px-5 py-2.5 text-base rounded-xl border' : 'px-3 py-1.5 text-xs rounded-lg border';

  return (
    <span id={`signal-badge-${norm.toLowerCase()}`} className={`inline-flex items-center gap-2 font-mono font-bold uppercase tracking-wider ${bgClass} ${pxClass}`}>
      <span className={`w-2 h-2 rounded-full animate-pulse ${pulseDot}`} />
      <span className={textClass}>{norm === 'MIXED' ? 'MIXED' : norm}</span>
    </span>
  );
}
