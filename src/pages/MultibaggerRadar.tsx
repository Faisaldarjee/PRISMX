import React, { useEffect, useState } from 'react';
import { fetchWithRetry, SectionSkeleton } from '../utils/apiHelpers';
import { MultibaggerCandidate } from '../services/multibaggerScanner';
import { useProStatus } from '../hooks/useProStatus';
import ProGate from '../components/ProGate';
import { 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  Target, 
  Clock, 
  Flame, 
  Layers, 
  ChevronRight,
  Info,
  Zap,
  BarChart2
} from 'lucide-react';

export function MultibaggerRadar() {
  const { isPro } = useProStatus();
  const [candidates, setCandidates] = useState<MultibaggerCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<MultibaggerCandidate | null>(null);

  const loadRadar = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithRetry('/api/multibagger-radar', signal);
      if (Array.isArray(data)) {
        setCandidates(data);
        if (data.length > 0) {
          setSelectedCandidate(data[0]);
        }
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      console.error('[MultibaggerRadar] Error loading data:', err);
      setError(err.message || 'Failed to connect to Multibagger Radar scanner.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadRadar(controller.signal);
    return () => controller.abort();
  }, []);

  const displayedCandidates = isPro ? candidates : candidates.slice(0, 2);

  // Compute aggregate stats
  const avgPotential = candidates.length > 0 
    ? (candidates.reduce((s, c) => s + c.potentialGain, 0) / candidates.length).toFixed(1)
    : '72.4';
  const avgDelivery = candidates.length > 0
    ? (candidates.reduce((s, c) => s + c.deliveryPct, 0) / candidates.length).toFixed(1)
    : '68.5';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
          <RefreshCw size={16} className="text-[#D4A843] animate-spin" />
          <span>Scanning NSE universe for institutional accumulation footprints...</span>
        </div>
        <SectionSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#090C12] border border-red-500/20 text-center max-w-md mx-auto space-y-4">
        <AlertCircle size={40} className="text-red-400" />
        <h3 className="text-sm font-display font-semibold text-white">Radar Scanner Offline</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        <button
          onClick={() => loadRadar()}
          className="px-4 py-2 bg-[#D4A843]/10 border border-[#D4A843]/30 text-[#D4A843] text-xs font-mono font-bold rounded-lg uppercase tracking-wider hover:bg-[#D4A843]/20 transition-all"
        >
          Retry Scan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#D4A843]">
              <Rocket size={20} className="animate-pulse" />
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
              Multibagger Radar 🚀
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/30 text-[#D4A843] text-[9px] font-mono font-black uppercase tracking-wider">
              PRO EXCLUSIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed font-sans">
            AI-powered institutional accumulation engine. Detects tight base consolidations, silent NSE delivery spikes, and weekly Smart Money order blocks before multi-fold expansions.
          </p>
        </div>

        <button
          onClick={() => loadRadar()}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-[#D4A843]/30 text-slate-350 hover:text-white rounded-lg text-xs font-mono transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={13} /> Reload Radar
        </button>
      </div>

      {/* KPI TILES ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#090C12] border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Active Radar Signals</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-mono font-bold text-white">{candidates.length}</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">Setups Found</span>
          </div>
        </div>

        <div className="bg-[#090C12] border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Avg Target Potential</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-mono font-bold text-[#D4A843]">+{avgPotential}%</span>
            <span className="text-[10px] text-slate-400 font-mono">(3 - 6 Months)</span>
          </div>
        </div>

        <div className="bg-[#090C12] border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Avg Delivery Threshold</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl md:text-2xl font-mono font-bold text-emerald-400">{avgDelivery}%</span>
            <span className="text-[10px] text-emerald-500 font-mono">Silent Buying</span>
          </div>
        </div>

        <div className="bg-[#090C12] border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 font-bold">Primary Sector Focus</span>
          <div className="mt-2">
            <span className="text-xs font-display font-bold text-slate-200 block truncate">
              {candidates[0]?.sector || 'Metals & Mining ⛏️'}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">Leading Accumulation</span>
          </div>
        </div>
      </div>

      {/* PRO GATE SECTION WRAPPER */}
      <ProGate feature="Multibagger Radar" isPro={isPro}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN RADAR TABLE (2 COLS) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-[#D4A843]" />
                Institutional Accumulation Candidates
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Ranked by Multibagger Score</span>
            </div>

            <div className="space-y-3">
              {displayedCandidates.map((candidate) => (
                <div
                  key={candidate.symbol}
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`bg-[#090C12] border rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#D4A843]/40 ${
                    selectedCandidate?.symbol === candidate.symbol
                      ? 'border-[#D4A843] bg-amber-500/[0.02] shadow-lg shadow-amber-500/5'
                      : 'border-slate-850'
                  }`}
                >
                  {/* Left Column: Symbol & Details */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] font-mono font-bold text-[#D4A843] flex items-center justify-center">
                        #{candidate.rank}
                      </span>
                      <h4 className="text-base font-display font-bold text-white">{candidate.tickerName}</h4>
                      <span className="text-[10px] font-mono text-slate-500 border border-slate-800 px-2 py-0.5 rounded bg-slate-950">
                        {candidate.sector}
                      </span>
                    </div>

                    <p className="text-[11.5px] text-slate-400 line-clamp-1 font-sans">
                      {candidate.aiReason}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <BarChart2 size={11} /> Delivery: {candidate.deliveryPct}%
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> Base: {candidate.consolidationWeeks} Weeks Squeeze
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Score & Target */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-slate-850 pt-2 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[8.5px] font-mono text-slate-500 block uppercase font-bold">Multibagger Score</span>
                        <span className="text-lg font-mono font-black text-[#D4A843]">{candidate.score}/100</span>
                      </div>
                    </div>

                    <div className="text-right mt-1">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        +{candidate.potentialGain}% Upside
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI BREAKDOWN MODAL / PANEL (1 COL) */}
          <div className="space-y-4">
            <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap size={14} className="text-[#D4A843]" />
              AI Conviction Breakdown
            </h3>

            {selectedCandidate ? (
              <div className="bg-[#090C12] border border-slate-850 rounded-xl p-5 space-y-5 sticky top-6">
                {/* Header */}
                <div className="border-b border-slate-850 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-[#D4A843] uppercase font-bold tracking-wider">Selected Setup</span>
                    <span className="text-[10px] font-mono text-slate-400">Horizon: {selectedCandidate.timeframe}</span>
                  </div>
                  <h3 className="text-xl font-display font-black text-white">{selectedCandidate.tickerName}</h3>
                  <span className="text-xs text-slate-400 font-mono block mt-0.5">{selectedCandidate.stage}</span>
                </div>

                {/* Price & Target Grid */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                    <span className="text-[8.5px] text-slate-500 uppercase block">Current Price</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">₹{selectedCandidate.lastPrice}</span>
                  </div>
                  <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/20">
                    <span className="text-[8.5px] text-emerald-400 uppercase block font-bold">3-6M Target</span>
                    <span className="text-sm font-bold text-emerald-400 mt-0.5 block">₹{selectedCandidate.targetPrice}</span>
                  </div>
                </div>

                {/* Quantitative Footprint Indicators */}
                <div className="space-y-3 pt-2">
                  <h5 className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">Accumulation Metrics</h5>
                  
                  {/* Delivery Volume Bar */}
                  <div className="space-y-1 font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">NSE Delivery Concentration</span>
                      <span className="text-emerald-400 font-bold">{selectedCandidate.deliveryPct}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedCandidate.deliveryPct}%` }} />
                    </div>
                  </div>

                  {/* Multibagger Score Bar */}
                  <div className="space-y-1 font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Multibagger Probability Score</span>
                      <span className="text-[#D4A843] font-bold">{selectedCandidate.score}/100</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                      <div className="bg-gradient-to-r from-amber-500 to-[#D4A843] h-full rounded-full" style={{ width: `${selectedCandidate.score}%` }} />
                    </div>
                  </div>
                </div>

                {/* AI Summary Statement */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-850 space-y-1.5">
                  <span className="text-[9px] font-mono text-[#D4A843] uppercase font-bold flex items-center gap-1">
                    <Info size={10} /> Institutional Analysis
                  </span>
                  <p className="text-[11.5px] text-slate-300 font-sans leading-relaxed">
                    {selectedCandidate.aiReason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#090C12] border border-dashed border-slate-850 rounded-xl p-8 text-center text-xs text-slate-500 font-mono">
                Select a candidate on the left to view detailed conviction metrics.
              </div>
            )}
          </div>
        </div>
      </ProGate>
    </div>
  );
}
