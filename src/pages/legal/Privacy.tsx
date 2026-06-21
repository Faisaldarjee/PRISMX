import React from 'react';
import { ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
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
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="font-data text-[10px] text-[#4A5568] tracking-widest uppercase block">PRISMX SECURITY</span>
              <h1 className="text-2xl font-black uppercase text-white font-display tracking-tight mt-0.5">Privacy Directive</h1>
            </div>
          </div>

          <div className="space-y-6 text-[#8892A4] text-[13.5px] leading-relaxed">
            <p>
              At <strong className="text-white">PRISMX</strong>, we believe data sovereignty and confidentiality are paramount. This privacy statement outlines the specific metrics we collect, store, and utilize.
            </p>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">01. Information Collection</h3>
              <p>
                We collect only minimal identifiable information necessary to run persistent user configurations:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 font-normal mt-2">
                <li><strong className="text-slate-350 font-medium">Account credentials:</strong> Email ID, name, and encrypted passwords upon signup to synchronize your custom mock watchlists.</li>
                <li><strong className="text-slate-350 font-medium">Usage statistics:</strong> Basic client settings such as capital size inputs, selected risk metrics, and notification targets stored securely in database logs.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">02. Data Usage and Security</h3>
              <p>
                We do NOT sell, rent, license, or disclose your email address or account telemetry to any third-party marketing brokers. All your preferences are completely stored client-side in your local workspace cache. When syncing is initialized, details are secured within Google Firebase Firestore datastores under robust role-based security rules.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-semibold text-[15px] text-white uppercase tracking-wider">03. Cookies</h3>
              <p>
                Our infrastructure uses secure temporary client-side storage mechanisms (localStorage) strictly to preserve your configurations and session state across logins. No invasive tracking cookies are used.
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/[0.03]">
              <h4 className="font-display font-medium text-xs text-[#E8C070] uppercase">Contact Security Officer</h4>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mt-2">
                <Mail size={12} className="text-[#D4A843]" />
                <span>faisaldarjee9@gmail.com</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-[10px] font-mono text-[#4A5568]">
          Last revised: June 2026 · Protected by Firebase Identity Protocol
        </div>
      </div>
    </div>
  );
}
