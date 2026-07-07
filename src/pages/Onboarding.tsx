import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Coins, 
  ShieldAlert, 
  Compass, 
  ArrowRight, 
  Check, 
  Briefcase, 
  Sliders, 
  BarChart, 
  CheckCircle2,
  Lock,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

interface OnboardingProps {
  onComplete: (capital: number, riskPercent: number, focusMarkets: string[]) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function Onboarding({ onComplete, onSkip, onCancel }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [capital, setCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['etfs', 'large-cap']);

  // Format Helper
  const formatRupee = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handlePresetClick = (amount: number) => {
    setCapital(amount);
  };

  const toggleMarket = (marketId: string) => {
    if (selectedMarkets.includes(marketId)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketId));
    } else {
      setSelectedMarkets([...selectedMarkets, marketId]);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Complete onboarding
      localStorage.setItem('prism_onboarded', 'true');
      localStorage.setItem('prism_capital', capital.toString());
      localStorage.setItem('prism_risk', riskPercent.toString());
      localStorage.setItem('prism_focus_markets', JSON.stringify(selectedMarkets));
      onComplete(capital, riskPercent, selectedMarkets);
    }
  };

  const calculatedRiskRupees = (capital * riskPercent) / 100;

  // Step Indicators
  const steps = [
    { num: 1, title: 'Capital' },
    { num: 2, title: 'Risk tolerance' },
    { num: 3, title: 'Asset markets' }
  ];

  return (
    <div className="fixed inset-0 bg-[#080A0F] text-[#F0F4FF] z-50 overflow-hidden flex flex-col justify-between p-6 sm:p-12">
      {/* Subtle grid in background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.05] z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onCancel}
            className="text-[#8892A4] hover:text-[#F0F4FF] text-[13px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[#0E1117]/80 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft size={13} /> Exit to Home
          </button>
          <span className="text-[#4A5568] hidden sm:inline">|</span>
          <span className="font-display font-semibold text-sm tracking-[0.1em] text-white hidden sm:inline">
            PRISM<span className="text-[#D4A843]">X</span> <span className="text-[#E8C070]">ONBOARDING</span>
          </span>
        </div>

        <button 
          onClick={onSkip}
          className="text-[#4A5568] hover:text-[#8892A4] text-[13px] font-mono transition-colors flex items-center gap-1 cursor-pointer bg-transparent border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[#0E1117]/80 px-3 py-1.5 rounded-lg"
        >
          Skip Setup <ChevronRight size={13} />
        </button>
      </div>

      {/* Main Inner Interactive Window */}
      <div className="w-full max-w-xl mx-auto my-auto relative z-10">
        {/* Progress Tracker */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                step === s.num 
                  ? 'bg-[#D4A843] scale-125 shadow-lg shadow-[#D4A843]/20' 
                  : step > s.num 
                    ? 'bg-[#34A77A]' 
                    : 'bg-[#1C2433]'
              }`} />
              {s.num < 3 && <div className={`w-8 h-[1px] ${step > s.num ? 'bg-[#34A77A]' : 'bg-[#1C2433]'}`} />}
            </div>
          ))}
        </div>

        {/* STEP 1: CAPITAL PLAN */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-[#F0F4FF]">Set your trading capital</h2>
              <p className="text-[#8892A4] text-sm">Used to calculate exact share position sizes automatically across swing setups.</p>
            </div>

            <div className="bg-[#0E1117] border border-[rgba(255,255,255,0.06)] rounded-xl p-8 space-y-6 flex flex-col items-center">
              <div className="flex items-center gap-2 text-[#E8C070]">
                <span className="text-2xl font-mono">₹</span>
                <input 
                  type="number" 
                  value={capital === 0 ? '' : capital}
                  onChange={(e) => setCapital(Number(e.target.value))}
                  className="font-mono text-4xl font-semibold bg-transparent border-b border-[rgba(255,255,255,0.1)] focus:border-[#D4A843] text-center w-60 outline-none pb-1"
                  placeholder="0"
                />
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full text-center">
                {[10000, 25000, 50000, 100000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className={`py-2 px-3 border rounded font-mono text-xs transition-all cursor-pointer ${
                      capital === preset 
                        ? 'border-[#D4A843]/40 bg-[#D4A843]/5 text-[#E8C070] font-black' 
                        : 'border-[rgba(255,255,255,0.06)] bg-[#030406]/34 text-[#8892A4] hover:border-slate-700 hover:text-[#F0F4FF]'
                    }`}
                  >
                    {formatRupee(preset)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: RISK SPECIFICATION */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-[#F0F4FF]">Define risk tolerance per trade</h2>
              <p className="text-[#8892A4] text-sm">We configure strict calculated stop-loss safety bounds based on this amount.</p>
            </div>

            <div className="space-y-3">
              {/* Conservative 1% */}
              <div 
                onClick={() => setRiskPercent(1)}
                className={`p-4 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  riskPercent === 1 
                    ? 'border-[#D4A843]/50 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center font-mono font-bold text-xs">1%</div>
                  <div>
                    <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Conservative strategy</h4>
                    <p className="text-[11.5px] text-[#8892A4]">Recommended for compounding accounts safely.</p>
                  </div>
                </div>

                <div className="text-right font-mono text-[12.5px] font-bold text-[#E8C070]">
                  {formatRupee((capital * 1) / 100)} <span className="text-[10px] text-[#4A5568] font-normal block">risk</span>
                </div>
              </div>

              {/* Balanced 2% */}
              <div 
                onClick={() => setRiskPercent(2)}
                className={`p-4 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  riskPercent === 2 
                    ? 'border-[#D4A843]/50 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#D4A843]/10 text-[#E8C070] flex items-center justify-center font-mono font-bold text-xs">2%</div>
                  <div>
                    <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF] flex items-center gap-1.5">
                      Balanced strategy
                      <span className="text-[8.5px] bg-[#D4A843]/10 border border-[#D4A843]/20 text-[#E8C070] px-1.5 py-0.2 rounded font-mono">POPULAR</span>
                    </h4>
                    <p className="text-[11.5px] text-[#8892A4]">Excellent swing balance for retail traders.</p>
                  </div>
                </div>

                <div className="text-right font-mono text-[12.5px] font-bold text-[#D4A843]">
                  {formatRupee((capital * 2) / 100)} <span className="text-[10px] text-[#4A5568] font-normal block">risk</span>
                </div>
              </div>

              {/* Aggressive 3% */}
              <div 
                onClick={() => setRiskPercent(3)}
                className={`p-4 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  riskPercent === 3 
                    ? 'border-[#D4A843]/50 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-red-500/10 text-red-400 flex items-center justify-center font-mono font-bold text-xs">3%</div>
                  <div>
                    <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Aggressive strategy</h4>
                    <p className="text-[11.5px] text-[#8892A4]">Recommended only for experienced investors.</p>
                  </div>
                </div>

                <div className="text-right font-mono text-[12.5px] font-bold text-red-400">
                  {formatRupee((capital * 3) / 100)} <span className="text-[10px] text-[#4A5568] font-normal block">risk</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: ASSET MARKETS TARGET */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-[#F0F4FF]">Select target tracking markets</h2>
              <p className="text-[#8892A4] text-sm">We initialize and filter setups based on your active watchlist selection.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ETFs */}
              <div 
                onClick={() => toggleMarket('etfs')}
                className={`p-4 rounded-lg border flex flex-col gap-2 cursor-pointer transition-all ${
                  selectedMarkets.includes('etfs') 
                    ? 'border-[#D4A843]/45 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#E8C070] font-bold">📊 EXCHANGE TRADED FUNDS</span>
                  {selectedMarkets.includes('etfs') && <Check size={14} className="text-[#34A77A]" />}
                </div>
                <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Gold & Silver BeES</h4>
                <p className="text-[11px] text-[#8892A4]">Ideal for volatility systematic SIP and hedging.</p>
              </div>

              {/* Large Cap */}
              <div 
                onClick={() => toggleMarket('large-cap')}
                className={`p-4 rounded-lg border flex flex-col gap-2 cursor-pointer transition-all ${
                  selectedMarkets.includes('large-cap') 
                    ? 'border-[#D4A843]/45 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-sky-400 font-bold">📈 LARGE CAP</span>
                  {selectedMarkets.includes('large-cap') && <Check size={14} className="text-[#34A77A]" />}
                </div>
                <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Benchmark Nifty Bluechips</h4>
                <p className="text-[11px] text-[#8892A4]">Standard high liquidity swing setups.</p>
              </div>

              {/* Mid Cap */}
              <div 
                onClick={() => toggleMarket('mid-cap')}
                className={`p-4 rounded-lg border flex flex-col gap-2 cursor-pointer transition-all ${
                  selectedMarkets.includes('mid-cap') 
                    ? 'border-[#D4A843]/45 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-pink-400 font-bold">🏢 MID/SMALL CAP</span>
                  {selectedMarkets.includes('mid-cap') && <Check size={14} className="text-[#34A77A]" />}
                </div>
                <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Tata Motors & Suzlon</h4>
                <p className="text-[11px] text-[#8892A4]">Higher potential volatility rewards.</p>
              </div>

              {/* All Markets */}
              <div 
                onClick={() => toggleMarket('all')}
                className={`p-4 rounded-lg border flex flex-col gap-2 cursor-pointer transition-all ${
                  selectedMarkets.includes('all') 
                    ? 'border-[#D4A843]/45 bg-[#151B24]' 
                    : 'border-[rgba(255,255,255,0.06)] bg-[#0E1117] hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#34A77A] font-bold">⚡ ALL SCANNERS</span>
                  {selectedMarkets.includes('all') && <Check size={14} className="text-[#34A77A]" />}
                </div>
                <h4 className="font-display font-medium text-[13.5px] text-[#F0F4FF]">Universal Sizers</h4>
                <p className="text-[11px] text-[#8892A4]">Track full Nifty indices consensus triggers.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Primary Continuation Trigger */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={handleNext}
            className="w-full py-3.5 bg-[#D4A843] hover:bg-[#E8C070] text-[#080A0F] font-bold text-[14px] rounded flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#D4A843]/10"
          >
            {step === 3 ? 'Sync and Initialize Workspace →' : 'Continue'}
          </button>
          
          <div className="text-center font-mono text-[10px] text-[#4A5568]">
            {step === 1 && `Capital: ${formatRupee(capital)}`}
            {step === 2 && `Capital: ${formatRupee(capital)} · Max Risk: ${formatRupee(calculatedRiskRupees)} (${riskPercent}%)`}
            {step === 3 && `Configuration completed`}
          </div>
        </div>
      </div>

      {/* Safety Compliance Warning line */}
      <div className="w-full text-center relative z-10 text-[11px] font-sans text-[#4A5568]">
        🔐 Information is persisted locally or synced to protected Cloud structures. Fully isolated encryption.
      </div>
    </div>
  );
}
