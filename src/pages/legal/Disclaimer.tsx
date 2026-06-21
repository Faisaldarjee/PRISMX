import React from 'react';
import { AlertTriangle, Award, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-[#05070C] text-[#F0F4FF] font-body py-12 px-6 relative overflow-hidden">
      {/* Ambient glass glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[rgba(212,168,67,0.02)] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[rgba(0,208,132,0.02)] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        {/* Navigation Link */}
        <div>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-[#8892A4] hover:text-[#E8C070] text-xs font-mono transition-colors border border-[rgba(255,255,255,0.04)] hover:border-[#D4A843]/20 bg-white/[0.01] px-3.5 py-2' rounded-lg"
          >
            <ArrowLeft size={13} /> Return to Terminal
          </Link>
        </div>

        {/* Content Box */}
        <div className="glass-card p-8 md:p-12 space-y-8 backdrop-blur-md border border-white/[0.04] rounded-2xl">
          <div className="flex items-center gap-3 pb-6 border-b border-white/[0.05]">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="font-data text-[10px] text-[#4A5568] tracking-widest uppercase block">STATUTORY DISCLOSURE</span>
              <h1 className="text-2xl font-black uppercase text-white font-display tracking-tight mt-0.5">SEBI Risk Index</h1>
            </div>
          </div>

          <div className="space-y-6 text-[#8892A4] text-[13.5px] leading-relaxed">
            <p>
              In accordance with SEBI compliance directives for educational software systems, <strong className="text-white">PRISMX</strong> provides the following standard trade safety notices:
            </p>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">01. Not SEBI Registered</h3>
              <p>
                PRISMX is <strong className="text-white">NOT registered</strong> with the Securities and Exchange Board of India (SEBI) under any portfolio allocation, advisory, investment advisory, or research analyst license schemes. No signals, predictions, consensus indexes, or AI morning briefings constitute legal, fiscal, or SEBI-sanctioned actionable trading material.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">02. Volatility and Losses</h3>
              <p>
                Equities swing trading involves substantial risk of capital loss. Past performances or backtested mock returns modeled in our calculations are absolutely <strong className="text-white">NOT indicative</strong> of prospective actual market performances. Stock price technical behaviors are highly volatile, unstable, and prone to extreme fluctuations.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">03. Friction Modelling Limitations</h3>
              <p>
                While our built-in friction engine simulates STT, stamp duty, GST, brokerages, and transaction charges to ensure quantitative realism, simulated figures are estimated averages only. Real-time slippages and unexpected terminal access speeds can vary considerably in actual market trading.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/[0.02] flex items-start gap-3">
              <Award className="text-rose-400 mt-0.5 shrink-0 animate-pulse" size={16} />
              <div className="space-y-1 font-mono text-[11.5px] leading-relaxed">
                <p className="text-rose-450 font-bold uppercase">⚠️ STATUTORY CHASTISEMENT NOTICE</p>
                <p className="text-[#8892A4]">
                  More than 9 out of 10 individual equity traders lose money in active options and high-leverage intraday/swing trades. Ensure you fully practice with safe capital constraints.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-[10px] font-mono text-[#4A5568]">
          Last revised: June 2026 · Protected by Supabase Identity Protocol
        </div>
      </div>
    </div>
  );
}
