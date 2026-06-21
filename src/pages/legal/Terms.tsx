import React from 'react';
import { Layers, HelpCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
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
            <div className="w-12 h-12 rounded-xl bg-[#D4A843]/10 flex items-center justify-center text-[#E8C070] border border-[#D4A843]/20">
              <Layers size={24} />
            </div>
            <div>
              <span className="font-data text-[10px] text-[#4A5568] tracking-widest uppercase block">CONTRACT CONFORMANCE</span>
              <h1 className="text-2xl font-black uppercase text-white font-display tracking-tight mt-0.5">Terms of Service</h1>
            </div>
          </div>

          <div className="space-y-6 text-[#8892A4] text-[13.5px] leading-relaxed">
            <p>
              Please read these Terms of Service carefully before utilizing <strong className="text-white">PRISMX</strong>. Access to this platform is conditioned on your strict acceptance of and compliance with these terms.
            </p>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">01. Platform Definition</h3>
              <p>
                PRISMX is purely an <strong className="text-white">educational study and research simulation playground</strong>. All signals, consensus indices, ATR position allocations, and technical indicators are generated for demonstration, research, and learning purposes only.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">02. No Financial Advice</h3>
              <p>
                We do NOT provide financial planning or investment management advice. We are not brokers, financial advisers, or analysts. No content or calculation on our workspace shall be construed as a recommendation to buy, sell, or hold financial assets in any live trading desk environment.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">03. User Responsibility</h3>
              <p>
                You assume full responsibility for any trading activities you conduct in external trading environments. We are not liable or responsible, directly or indirectly, for any losses, damages, margin calls, or financial friction suffered as a result of using this platform. Play responsibly and study carefully.
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/[0.03] flex items-start gap-2.5">
              <HelpCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-amber-500 font-mono italic leading-normal">
                By entering or configuring settings, you explicitly acknowledge that past market volatility behaves completely independently from prospective predictions, and simulation models are never guarantee systems.
              </p>
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
