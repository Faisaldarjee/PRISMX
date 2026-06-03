import React from 'react';

interface ConfidenceBarProps {
  confidence: number;
  label?: string;
}

export function ConfidenceBar({ confidence, label }: ConfidenceBarProps) {
  const normVal = Math.max(0, Math.min(100, confidence));

  let colorClass = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
  if (normVal >= 70) {
    colorClass = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  } else if (normVal >= 50) {
    colorClass = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
  }

  return (
    <div id="confidence-bar-container" className="space-y-2">
      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-slate-400 capitalize">{label || 'Agent Confidence'}</span>
        <span className="font-bold text-white">{normVal.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`}
          style={{ width: `${normVal}%` }}
        />
      </div>
    </div>
  );
}
