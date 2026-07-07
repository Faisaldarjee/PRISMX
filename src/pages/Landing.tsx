import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Layers, 
  Award, 
  Coins, 
  ShieldCheck, 
  Activity, 
  ArrowRight, 
  Play, 
  Check, 
  X,
  ChevronRight,
  Menu,
  Sparkles
} from 'lucide-react';
import { PrismLogo } from '../components/PrismLogo';
import { useAuth } from '../services/AuthProvider';

interface LandingProps {
  onOpenAuth: () => void;
}

export default function Landing({ onOpenAuth }: LandingProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const [scannerData, setScannerData] = useState<any[]>([]);
  const [scannerLoading, setScannerLoading] = useState(true);

  useEffect(() => {
    const loadLiveScanner = async () => {
      try {
        const response = await fetch('/api/swing-scanner');
        if (!response.ok) throw new Error('API unstable or in process');
        const data = await response.json();
        setScannerData(data.slice(0, 3));
      } catch (err) {
        setScannerData([]);
      } finally {
        setScannerLoading(false);
      }
    };
    loadLiveScanner();
    const interval = setInterval(loadLiveScanner, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navHeight = 72; // px

  const scrollToId = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const top = element.getBoundingClientRect().top 
                  + window.scrollY 
                  - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#05070C] text-[#F0F4FF] overflow-x-hidden relative"
    >
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-grid opacity-[0.08] pointer-events-none z-0 mask-image-[linear-gradient(to_bottom,black_60%,transparent)]" />

      {/* Decorative Golden Ambient Glows */}
      <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,var(--gold-glow-lg),transparent_60%)] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(0,180,120,0.02),transparent_70%)] rounded-full pointer-events-none z-0" />

      {/* FIXED HEADER NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-[#05070C]/80 backdrop-blur-md border-b border-[rgba(255,255,255,0.06)] py-3' 
          : 'bg-transparent py-5 border-b border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo segment */}
          <div className="flex items-center cursor-pointer z-10 animate-fade-in" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <PrismLogo size={36} showText={true} />
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 font-body">
            <button onClick={() => scrollToId('features')} className="text-[#8892A4] hover:text-[#F0F4FF] text-[13px] tracking-wide transition-colors cursor-pointer">
              Features
            </button>
            <button onClick={() => scrollToId('how-it-works')} className="text-[#8892A4] hover:text-[#F0F4FF] text-[13px] tracking-wide transition-colors cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToId('active-setups')} className="text-[#8892A4] hover:text-[#F0F4FF] text-[13px] tracking-wide transition-colors cursor-pointer">
              Live Scans
            </button>
            <button onClick={() => scrollToId('pricing')} className="text-[#8892A4] hover:text-[#F0F4FF] text-[13px] tracking-wide transition-colors cursor-pointer">
              Pricing
            </button>
          </div>

          {/* Action trigger items */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <button 
                onClick={onOpenAuth}
                className="clay-badge-gold hover:opacity-90 tracking-wide text-xs flex items-center gap-1 cursor-pointer"
              >
                Enter Dashboard <ChevronRight size={13} />
              </button>
            ) : (
              <button 
                onClick={onOpenAuth}
                className="py-1.5 px-4 bg-transparent border border-[rgba(255,255,255,0.08)] hover:border-[#D4A843]/30 hover:bg-[#D4A843]/5 text-[#E8C070] text-xs font-mono rounded-lg transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
              >
                Try Free <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Mobile toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden text-[#8892A4] hover:text-[#F0F4FF] p-1 transition-colors z-10"
          >
            {mobileMenuOpen ? <X size={20} className="text-[#F0F4FF]" /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu container */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0D1018] border-b border-[rgba(255,255,255,0.08)] py-6 px-6 shadow-xl flex flex-col gap-4 z-45">
            <button onClick={() => scrollToId('features')} className="text-left text-[#8892A4] text-xs font-sans font-medium">
              Features
            </button>
            <button onClick={() => scrollToId('how-it-works')} className="text-left text-[#8892A4] text-xs font-sans font-medium">
              How It Works
            </button>
            <button onClick={() => scrollToId('active-setups')} className="text-left text-[#8892A4] text-xs font-sans font-medium">
              Live Scans
            </button>
            <button onClick={() => scrollToId('pricing')} className="text-left text-[#8892A4] text-xs font-sans font-medium">
              Pricing
            </button>
            <div className="pt-4 border-t border-[rgba(255,255,255,0.06)] flex flex-col gap-3">
              {user ? (
                <button 
                  onClick={onOpenAuth}
                  className="w-full py-2 bg-[#D4A843] text-[#080A0F] font-bold text-center text-xs rounded-lg cursor-pointer"
                >
                  Enter Dashboard
                </button>
              ) : (
                <button 
                  onClick={() => { setMobileMenuOpen(false); onOpenAuth(); }}
                  className="w-full py-2 bg-[#D4A843] text-black text-xs text-center font-bold rounded-lg cursor-pointer animate-pulse"
                >
                  Try Free
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ZONE 1: REDESIGNED SPLIT HERO SECTION */}
      <section className="pt-36 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 tracking-[0.25em] font-data text-[10.5px] text-[#E8C070] font-medium flex items-center gap-2 bg-[#D4A843]/5 border border-[#D4A843]/10 py-1.5 px-4 rounded-full"
        >
          <Sparkles size={11} className="text-[#D4A843]" />
          Live Market Intelligence · NSE/BSE
        </motion.div>

        {/* Dynamic Contrasting Split Headline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-5xl my-4 py-8 border-y border-[rgba(255,255,255,0.04)]"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 relative">
            {/* Left Wing: Objective Strategy */}
            <div className="flex-1 text-center md:text-right md:pr-10">
              <span className="font-data text-[9.5px] text-[#8892A4] tracking-widest block mb-2.5 font-bold select-none">OBJECTIVE PARADIGM</span>
              <h1 className="text-4.5xl sm:text-5xl md:text-6xl font-extrabold font-display tracking-tight text-white leading-[1.05] uppercase">
                TRADE WHAT <span className="text-white block sm:inline">YOU SEE.</span>
              </h1>
            </div>

            {/* Vertical divides with absolute center marker */}
            <div className="hidden md:flex w-[1px] h-20 bg-gradient-to-b from-[#D4A843]/40 via-[#D4A843]/15 to-transparent shrink-0 relative items-center justify-center">
              <div className="absolute w-1.5 h-1.5 rounded-full bg-[#D4A843] blur-[2px]" />
            </div>

            {/* Right Wing: Solution Mindset */}
            <div className="flex-1 text-center md:text-left md:pl-10">
              <span className="font-data text-[9.5px] text-[#E8C070] tracking-widest block mb-2.5 font-bold select-none">SYSTEMATIC SHIELD</span>
              <h1 className="text-4.5xl sm:text-5xl md:text-6xl font-black font-display tracking-tight text-[#E8C070] leading-[1.05] uppercase" style={{ textShadow: '0 0 35px rgba(212,168,67,0.18)' }}>
                NOT WHAT <span className="text-[#E8C070] block sm:inline">YOU FEEL.</span>
              </h1>
            </div>
          </div>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="font-body font-light text-base sm:text-[17px] text-[#8892A4] max-w-xl mx-auto leading-relaxed mt-6 mb-12"
        >
          Four agents. Real data. Indian markets. Replace gut-feeling guesswork with quantitative entry triggers, ATR position sizing, and systematic SIP buffers.
        </motion.p>

        {/* REDESIGNED MINI PROOF CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mb-14">
          <div className="clay-element p-6 text-left transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-2.5">
              <span className="font-data text-[9px] uppercase font-bold text-[#D4A843] tracking-widest">LAYER 01 · AGENTS</span>
              <span className="text-[10px] bg-[#D4A843]/15 text-[#E8C070] px-1.5 py-0.5 rounded font-data font-bold">X4 CORES</span>
            </div>
            <span className="font-display text-[16.5px] font-semibold text-[#F0F4FF] block leading-snug">4 Algo Agents</span>
            <span className="text-[12px] text-[#8892A4] block mt-1.5 font-body">Consensus signals derived from Technical momentum, ML, Macro indices, and Sentiment trackers.</span>
          </div>

          <div className="clay-element p-6 text-left transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-2.5">
              <span className="font-data text-[9px] uppercase font-bold text-[#D4A843] tracking-widest">LAYER 02 · SCANNER</span>
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded font-data">463 SCAN</span>
            </div>
            <span className="font-display text-[16.5px] font-semibold text-[#F0F4FF] block leading-snug">463 Stocks</span>
            <span className="text-[12px] text-[#8892A4] block mt-1.5 font-body">Nifty 500 scanned dynamically daily to find maximum setup compression indices.</span>
          </div>

          <div className="clay-element p-6 text-left transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-2.5">
              <span className="font-data text-[9px] uppercase font-bold text-[#D4A843] tracking-widest">LAYER 03 · FRICTION</span>
              <span className="text-[10px] bg-[#34A77A]/20 text-[#34A77A] px-1.5 py-0.5 rounded font-data font-bold">STT ACCURATE</span>
            </div>
            <span className="font-display text-[16.5px] font-semibold text-[#F0F4FF] block leading-snug">Real Backtest</span>
            <span className="text-[12px] text-[#8892A4] block mt-1.5 font-body">Calculations fully model STT, SEBI turnover fees, local stamp taxes, and 15% STCG.</span>
          </div>
        </div>

        {/* CTA Actions Wrapper */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-5">
          <button 
            onClick={onOpenAuth}
            className="bg-gradient-to-r from-[#D4A843] to-[#B8912E] hover:brightness-110 text-[#080A0F] font-bold text-sm tracking-widest py-3 px-6 rounded-xl shadow-[3px_3px_6px_rgba(0,0,0,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto text-center"
          >
            Launch Terminal <ArrowRight size={14} className="stroke-[3]" />
          </button>
          <button 
            onClick={() => scrollToId('how-it-works')}
            className="py-3 px-6 bg-transparent hover:bg-white/5 border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.14)] text-xs font-data rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto text-[#8892A4] hover:text-[#F0F4FF]"
          >
            <Play size={10} className="fill-[#8892A4] group-hover:fill-current" /> See how it works ↓
          </button>
        </div>

        {/* Anchor point / Smooth Scroll helper */}
        <button 
          onClick={() => scrollToId('active-setups')}
          className="group mt-4 text-[#4A5568] hover:text-white transition-colors duration-300 flex flex-col items-center gap-1 cursor-pointer"
        >
          <span className="font-data text-[9px] tracking-[0.2em] uppercase">VIEW LIVE ACTIVE CONFORMANCE SCANS</span>
          <motion.div 
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="text-[#D4A843]"
          >
            ↓
          </motion.div>
        </button>
      </section>

      {/* ZONE 2: TRANSITION TO GLASSMORPHISM PREVIEW */}
      <section id="active-setups" className="py-20 px-6 max-w-7xl mx-auto relative z-10 scroll-mt-20">
        <div className="glass-card p-6 md:p-8 relative overflow-hidden backdrop-blur-md">
          <div className="mb-8">
            <span className="font-data text-[10px] text-[#4A5568] uppercase tracking-widest block">Active consensus metrics</span>
            <h2 className="font-display font-medium text-2xl mt-1 text-[#F0F4FF]">Live Diagnostic Scanner</h2>
          </div>

          {/* Table representation with refined Zone 3 styling */}
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left min-w-[750px]">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-[10px] font-data text-[#4A5568] uppercase">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Ticker symbol</th>
                  <th className="py-3 px-3">Score index</th>
                  <th className="py-3 px-3">RSI</th>
                  <th className="py-3 px-3">Trend line</th>
                  <th className="py-3 px-3">Volatility</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Reference Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
                {scannerLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="py-4 px-3"><div className="h-4 bg-slate-900 rounded w-6" /></td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-5 bg-slate-900 rounded w-20" />
                          <div className="h-4 bg-slate-900 rounded w-24" />
                        </div>
                      </td>
                      <td className="py-4 px-3"><div className="h-2 bg-slate-900 rounded w-28 animate-pulse" /></td>
                      <td className="py-4 px-3"><div className="h-4 bg-slate-900 rounded-sm w-12" /></td>
                      <td className="py-4 px-3"><div className="h-4 bg-slate-900 rounded-sm w-12" /></td>
                      <td className="py-4 px-3"><div className="h-4 bg-slate-900 rounded w-16" /></td>
                      <td className="py-4 px-3"><div className="h-6 bg-slate-900 rounded-lg w-20" /></td>
                      <td className="py-4 px-3 text-right"><div className="h-4 bg-slate-900 rounded w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : scannerData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                      ⚠️ Scanner updating live Nifty500 confluences... Check back shortly.
                    </td>
                  </tr>
                ) : (
                  scannerData.map((setup, index) => {
                    const isBuy = setup.signal === 'BUY';
                    const isSell = setup.signal === 'SELL';
                    const scoreVal = Math.round(setup.setupScore || setup.score || 80);
                    return (
                      <tr key={setup.symbol} onClick={onOpenAuth} className="data-row hover:bg-[#111115]/80 transition-all duration-150 border-b border-white/[0.02] relative cursor-pointer">
                        <td className="py-4 px-3 font-data text-xs text-[#E8C070] relative">
                          #{index + 1}
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 flex h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" title="LIVE DATA" />
                        </td>
                        <td className="py-4 px-3 font-display font-medium text-[14px]">
                          {setup.symbol} <span className="text-[10px] text-[#8892A4] font-normal font-sans ml-1">{setup.sector || 'Nifty 500'}</span>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1 rounded-sm bg-black/40 overflow-hidden relative">
                              <div className="h-full bg-[#D4A843]" style={{ width: `${scoreVal}%` }} />
                            </div>
                            <span className="font-data text-xs text-[#E8C070] font-black">{scoreVal}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 font-data text-xs text-[#8892A4]">
                          {setup.rsi || 45} 
                          <span className={`text-[8px] border px-1 py-0.2 rounded ml-1 font-bold ${
                            setup.rsi < 35 
                              ? 'bg-emerald-950/45 border-emerald-500/30 text-emerald-400' 
                              : setup.rsi > 65 
                                ? 'bg-rose-950/45 border-rose-500/30 text-rose-400' 
                                : 'border-[rgba(255,255,255,0.06)] text-[#8892A4]'
                          }`}>
                            {setup.rsi < 35 ? 'OVERSOLD' : setup.rsi > 65 ? 'OVERBOUGHT' : 'STABLE'}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-data text-xs text-[#8892A4]">
                          {setup.adx || 20}{' '}
                          <span className={`text-[8px] border px-1 py-0.2 rounded ml-1 font-bold ${
                            setup.adx > 25 
                              ? 'bg-[#D4A843]/15 border-[#D4A843]/30 text-[#E8C070]' 
                              : 'border-[rgba(255,255,255,0.06)] text-slate-500'
                          }`}>
                            {setup.adx > 25 ? 'STRONG TREND' : 'CONSOLIDATING'}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-data text-xs text-[#E8C070]">
                          {setup.isSqueezed ? '★ BB Squeeze' : '★ Normal Vol'}
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 border font-data text-[9.5px] font-bold rounded ${
                            isBuy 
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' 
                              : isSell 
                                ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' 
                                : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
                          }`}>
                            {isBuy ? '🟢 BUY SETUP' : isSell ? '🔴 SELL SETUP' : '🟡 HOLD / PATIENT'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right font-data text-xs text-[#F0F4FF] font-medium">
                          ₹{setup.lastPrice ? setup.lastPrice.toLocaleString('en-IN') : '100.00'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6 pt-5 border-t border-[rgba(255,255,255,0.04)] flex-col sm:flex-row gap-4 font-data">
            <span className="text-[11px] text-[#4A5568]">
              Consensus scanner is powered by real-time multi-agent quantitative calculations.
            </span>
            <button 
              onClick={onOpenAuth}
              className="text-[#E8C070] hover:text-[#fbf0d0] text-[11px] font-bold flex items-center gap-1 cursor-pointer bg-transparent border border-[#D4A843]/20 py-1.5 px-3 rounded-lg"
            >
              Run All Scanners <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </section>

      {/* MODERN GLASS CARDS FOR ALL FEATURES */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center mb-16">
          <span className="font-data text-[10.5px] tracking-[0.2em] text-[#E8C070]">── SYSTEM ARCHITECTURE ──</span>
          <h2 className="font-display font-semibold text-3xl sm:text-4xl mt-2 text-[#F0F4FF]">Modern Systematic Intelligence</h2>
          <p className="text-[#8892A4] mt-3 max-w-md mx-auto text-sm leading-relaxed">
            Eliminate sentiment anomalies. Four specialized quant layers determine dynamic momentum, volatility targets, and index pricing rules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-[#D4A843]/5 mb-5">
                <TrendingUp size={18} />
              </div>
              <h3 className="font-display font-medium text-base mb-2 text-[#F0F4FF]">Swing Scanner Block</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Consolidates multiple timeframe trendlines, ADX thresholds, and volume multiples. Prevents entry into listless consolidation traps.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Swing Scanner</span>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-white/5 mb-5">
                <Layers size={18} />
              </div>
              <h3 className="font-display font-medium text-[14px] text-[#F0F4FF]">ATR Position Engine</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Enter target capital or custom account risk percentages. Evaluates the ATR volatility in real-time to compute conservative trading volumes.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Position Sizer</span>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-[#D4A843]/5 mb-5">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-display font-medium text-base mb-2 text-[#F0F4FF]">Multi-Agent Consensus Matrix</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Calculates weighted parameters from Technical indicators, AI brief diagnostics, and Macro trends to authorize a signal consensus.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Consensus Matrix</span>
          </div>

          {/* Card 4 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-white/5 mb-5">
                <Activity size={18} />
              </div>
              <h3 className="font-display font-medium text-base mb-2 text-[#F0F4FF]">Timeframe Concordance</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Integrates weekly long-term direction, daily setups, and hourly oscillator status so you only deploy when momentum aligns.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Timeframe Concordance</span>
          </div>

          {/* Card 5 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-[#D4A843]/5 mb-5">
                <Coins size={18} />
              </div>
              <h3 className="font-display font-medium text-base mb-2 text-[#F0F4FF]">Dynamic RSI SIP Planner</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Automatically calculates budget adjustments. Automatically scales up ETF allocations at oversold market floors and pauses at euphoric peaks.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Dynamic SIP Planner</span>
          </div>

          {/* Card 6 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center text-[#E8C070] bg-white/5 mb-5">
                <Award size={18} />
              </div>
              <h3 className="font-display font-medium text-base mb-2 text-[#F0F4FF]">Indian Friction Engine</h3>
              <p className="text-[#8892A4] text-[13px] leading-relaxed">
                Calculates actual post-friction returns. Automatically accounts for STT, SEBI turnover fees, local stamp taxes, and 15% STCG.
              </p>
            </div>
            <span className="font-data text-[10px] text-[#8892A4] mt-4 block tracking-widest font-medium">CORE MODULE · Friction Engine</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 bg-[#0D1018]/40 border-y border-[rgba(255,255,255,0.03)] px-6 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-semibold text-3xl text-[#F0F4FF]">Deterministic Workflow</h2>
            <p className="text-[#8892A4] text-sm mt-2 max-w-sm mx-auto">Follow a systematic design structured to preserve trading capital.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 relative">
            <div className="flex flex-col gap-3">
              <span className="font-data text-[11px] text-[#E8C070] font-black tracking-widest block">01 · INITIAL ACCESS</span>
              <h4 className="font-display font-medium text-[14px] text-[#F0F4FF]">Start Instantly</h4>
              <p className="text-[#8892A4] text-[12.5px] leading-relaxed font-body">No long sign-up barriers. Create a free account to unlock your personalized market workspace instantly.</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-data text-[11px] text-[#E8C070] font-black tracking-widest block">02 · ALGO SCANNING</span>
              <h4 className="font-display font-medium text-[14px] text-[#F0F4FF]">Review Active Setup</h4>
              <p className="text-[#8892A4] text-[12.5px] leading-relaxed font-body">Observe automated real-time algorithmic swing signals matching Bollinger squeeze metrics.</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-data text-[11px] text-[#E8C070] font-black tracking-widest block">03 · DYNAMIC SIZER</span>
              <h4 className="font-display font-medium text-[14px] text-[#F0F4FF]">Evaluate Risk Unit</h4>
              <p className="text-[#8892A4] text-[12.5px] leading-relaxed font-body">Input account size to get entry parameters, clear ATR stops, and quantities.</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-data text-[11px] text-[#E8C070] font-black tracking-widest block">04 · DIAGNOSE AGENTS</span>
              <h4 className="font-display font-medium text-[14px] text-[#F0F4FF]">Review Consensus</h4>
              <p className="text-[#8892A4] text-[12.5px] leading-relaxed font-body">Inspect multi-agent votes: technical scores, AI reports, and macro trends.</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-data text-[11px] text-[#E8C070] font-black tracking-widest block">05 · JOURNAL SYNC</span>
              <h4 className="font-display font-medium text-[14px] text-[#F0F4FF]">Activate Sync</h4>
              <p className="text-[#8892A4] text-[12.5px] leading-relaxed font-body">Optionally sign up for cloud synchronization to secure your mock logs and watchlist.</p>
            </div>
          </div>
        </div>
      </section>

      {/* REFINED PRICING CARDS */}
      <section id="pricing" className="py-20 px-6 max-w-5xl mx-auto scroll-mt-20">
        <div className="text-center mb-16">
          <span className="font-data text-[10.5px] tracking-[0.2em] text-[#E8C070]">── SYSTEM ACCESS ──</span>
          <h2 className="font-display font-semibold text-3xl sm:text-4xl mt-2 text-[#F0F4FF]">Honest Pricing Plan</h2>
          <p className="text-[#8892A4] mt-2 text-sm">Full predictive consensus terminal. Pure transparency.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {/* FREE Tier Card */}
          <div className="glass-card p-8 flex flex-col justify-between">
            <div>
              <span className="font-data text-[11px] text-[#8892A4] uppercase tracking-wider block mb-2">Standard Plan</span>
              <h3 className="font-display text-4.5xl font-semibold text-[#F0F4FF] mb-1">
                ₹0 <span className="text-xs font-data text-[#8892A4] font-normal">/ month</span>
              </h3>
              <p className="text-[12.5px] text-[#8892A4] mb-6 font-body">All core features available with standard limits and ad-support.</p>
              
              <ul className="space-y-3.5 text-[13px] border-t border-[rgba(255,255,255,0.04)] pt-6 mb-8 font-body">
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>5 Live Scanner Results</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>3 Watchlist Symbols Limit</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Interactive Basic Charts</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Fully Functional ATR Sizer</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={onOpenAuth}
              className="w-full py-3 px-6 border border-[rgba(255,255,255,0.08)] hover:border-[#D4A843]/30 text-[#8892A4] hover:text-[#F0F4FF] bg-transparent text-xs font-data rounded-xl transition-all cursor-pointer text-center"
            >
              Launch Free Workspace
            </button>
          </div>

          {/* PRO Tier Card */}
          <div className="gold-card p-8 flex flex-col justify-between relative border border-[#D4A843]/20">
            <div className="absolute -top-3.5 right-6 py-1 px-3 bg-[#D4A843] text-[#05070C] font-data text-[9px] font-black uppercase tracking-wider rounded-full select-none">
              EARLY ACCESS
            </div>

            <div>
              <span className="font-data text-[11px] text-[#E8C070] uppercase tracking-wider block mb-2">Pro Plan</span>
              <h3 className="font-display text-4.5xl font-semibold text-[#E8C070] mb-1">
                ₹199 <span className="text-xs font-data text-[#8892A4] font-normal">/ month</span>
              </h3>
              <p className="text-[12.5px] text-[#8892A4] mb-3 font-body">Full power of algorithms and unrestricted dashboard workstation capabilities.</p>
              <p className="text-[11px] font-semibold text-[#34A77A] mb-6">First 100 users get 1 month of premium Pro free! 🎉</p>
              
              <ul className="space-y-3.5 text-[13px] border-t border-[#D4A843]/15 pt-6 mb-8 font-body">
                <li className="flex items-start gap-2.5 text-slate-400">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Unlimited Scanner results scan</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-400">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Unlimited Cloud Watchlist symbols</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-400">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Consolidating SMC (Smart Money) Engines</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-400">
                  <Check size={14} className="text-[#34A77A] mt-0.5 shrink-0" />
                  <span>Morning Macro Summaries & AI signals</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={onOpenAuth}
              className="w-full py-3 px-6 bg-gradient-to-r from-[#D4A843] to-[#B8912E] hover:brightness-110 text-[#05070C] text-xs font-data rounded-xl transition-all cursor-pointer font-bold text-center"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* BOTTOM DISCLAIMER FOOTER */}
      <footer className="py-12 bg-[#05070C] text-[#4A5568] px-6 border-t border-[rgba(255,255,255,0.04)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 text-center md:text-left">
            <PrismLogo size={36} showText={true} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-data font-bold tracking-wider text-center md:text-left">
            <Link to="/privacy" className="hover:text-[#E8C070] transition-colors uppercase">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#E8C070] transition-colors uppercase">Terms of Use</Link>
            <Link to="/disclaimer" className="hover:text-[#E8C070] transition-colors uppercase text-[#E8C070]">Risk Disclosure</Link>
          </div>

          <div className="text-[10px] font-body text-center md:text-right max-w-sm leading-relaxed text-slate-500">
            <span className="text-[#E8C070] font-bold">DISCLAIMER:</span> PRISMX is an educational research and analytics suite, NOT a SEBI-registered investment advisor. All metrics and simulated models are provided for study purposes only.
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
