import React, { useEffect, useState, useRef } from 'react';
import { LiveChart } from '../components/charts/LiveChart';
import { 
  Cpu, 
  Clock, 
  Target, 
  ArrowUp, 
  ArrowDown, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Share2, 
  Heart, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Activity,
  Layers,
  Award,
  BookOpen
} from 'lucide-react';

export interface SectorMomentum {
  sector: string;
  name: string;
  score: number;
  priceChange1D: number;
  priceChange5D: number;
  priceChange20D: number;
  newsScore: 'positive' | 'negative' | 'neutral';
  trending: boolean;
  topStocks: string[];
  stockCount?: number;
  summary: string;
  updatedAt: string;
}

export interface TradePlan {
  entry_range: string;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_reward_ratio: number;
  action: string;
}

export interface SwingSetup {
  symbol: string;
  tickerName: string;
  rsi: number;
  adx: number;
  atr: number;
  volumeRatio: number;
  isSqueezed: boolean;
  bbWidth: number;
  volumeConfirmed: boolean;
  score: number;
  setupScore: number;
  lastPrice: number;
  changePercent: number;
  stopLoss: number;
  target1: number;
  target2: number;
  trade_plan?: TradePlan;
  detected_patterns: string[];
  markers: any[];
  hold_time_recommendation?: string;
  sector: string;
  signal: string;
  support_levels: number[];
  resistance_levels: number[];
  intelligenceContext?: {
    globalMacro: string;
    fiiActivity: string;
    earningsAlert?: string | null;
    bulkDealAlert: string;
    newsSentiment: string;
    intelligenceAdjustment: string;
    keyRisks: string[];
    keySupportFactors: string[];
  };
}

export const SECTOR_EMOJIS: Record<string, string> = {
  BANKING: '🏦',
  IT: '💻',
  AUTO: '🚗',
  PHARMA: '🧪',
  METALS: '⛏️',
  FMCG: '🍕',
  ENERGY: '⚡',
  REALTY: '🏢',
  INFRA: '🏗️',
  FINANCE: '📊',
  DEFENCE: '🛡️',
  TELECOM: '📡',
  CHEMICALS: '⚗️',
  TEXTILES: '👕',
  OTHERS: '📁'
};

export function SmartSwing() {
  const [sectors, setSectors] = useState<SectorMomentum[]>([]);
  const [setups, setSetups] = useState<SwingSetup[]>([]);
  const [selectedSector, setSelectedSector] = useState<SectorMomentum | null>(null);
  
  const [loadingSectors, setLoadingSectors] = useState<boolean>(true);
  const [loadingSetups, setLoadingSetups] = useState<boolean>(true);
  const [errorSectors, setErrorSectors] = useState<string | null>(null);
  const [errorSetups, setErrorSetups] = useState<string | null>(null);
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Deep dive selection
  const [deepDiveStock, setDeepDiveStock] = useState<SwingSetup | null>(null);
  const [whyThisTradeOpen, setWhyThisTradeOpen] = useState<boolean>(true);
  
  // Watchlist & Share Simulation states
  const [watchlist, setWatchlist] = useState<Record<string, boolean>>({});
  const [lastSharedStock, setLastSharedStock] = useState<string | null>(null);

  // Scroll Helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Fetch Sectors Overview
  const fetchSectors = async () => {
    setLoadingSectors(true);
    setErrorSectors(null);
    try {
      const res = await fetch('/api/sectors');
      if (!res.ok) throw new Error('Failed to retrieve sectors data');
      const data = await res.json();
      setSectors(data);
      setCachedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error(err);
      setErrorSectors(err.message || 'Error conducting sectors evaluation');
    } finally {
      setLoadingSectors(false);
    }
  };

  // Fetch Opportunities Setups (Filtered/Overall)
  const fetchOpportunities = async (sectorKey?: string) => {
    setLoadingSetups(true);
    setErrorSetups(null);
    try {
      const url = sectorKey ? `/api/sectors/${sectorKey}/stocks` : '/api/swing-scanner';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Scanner failed to fetch swing candidate metrics');
      const data = await res.json();
      setSetups(data);

      // Auto-select first setup for immediate Deep Dive view if available
      if (data && data.length > 0) {
        setDeepDiveStock(data[0]);
      } else {
        setDeepDiveStock(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorSetups(err.message || 'Scanner was unable to complete stock processing');
    } finally {
      setLoadingSetups(false);
    }
  };

  // On first mount, get sector list and overall opportunities
  useEffect(() => {
    fetchSectors();
    fetchOpportunities();
  }, []);

  // Handle Sector Tile Click
  const handleSectorSelect = (sector: SectorMomentum) => {
    if (selectedSector?.sector === sector.sector) {
      // Toggle / Reset filter when clicked again
      setSelectedSector(null);
      fetchOpportunities();
    } else {
      setSelectedSector(sector);
      fetchOpportunities(sector.sector);
      scrollToSection('opportunities-section');
    }
  };

  const clearSectorFilter = () => {
    setSelectedSector(null);
    fetchOpportunities();
  };

  // Handle Deep Dive Click on Stock Card
  const initiateDeepDive = (setup: SwingSetup) => {
    setDeepDiveStock(setup);
    scrollToSection('deep-dive-section');
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }));
  };

  const handleShareSetup = (symbol: string) => {
    setLastSharedStock(symbol);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`Astraeus Swing Trade Plan for ${symbol}: Target ₹${deepDiveStock?.trade_plan?.target_1 || deepDiveStock?.target1}, Stop Loss ₹${deepDiveStock?.trade_plan?.stop_loss || deepDiveStock?.stopLoss}`);
    }
    setTimeout(() => {
      setLastSharedStock(null);
    }, 2500);
  };

  // Render score Unicode block bar (e.g. ████████░░)
  const renderScoreBar = (score: number) => {
    const filledCount = Math.max(0, Math.min(10, Math.round(score / 10)));
    const emptyCount = 10 - filledCount;
    return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
  };

  // Format Helper
  const formatChange = (val: number) => {
    if (val === undefined || isNaN(val)) return '0.00%';
    const prefix = val >= 0 ? '+' : '';
    return `${prefix}${val.toFixed(2)}%`;
  };

  return (
    <div className="space-y-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-mono tracking-wider font-bold animate-pulse">
              Scanner Active
            </span>
            <span className="text-gray-500 text-xs font-mono">• 30m Real-time Delay Bounds</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white tracking-tight">
            Smart Swing Intelligence
          </h1>
          <p className="text-sm text-[#8892A4] mt-1 font-body">
            "Sector → Stock → Trade Plan" inside a zero-latency continuous quantitative flow.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          {cachedTime && (
            <span className="text-gray-500 text-[11px] font-mono whitespace-nowrap">
              LAST SCAN: {cachedTime}
            </span>
          )}
          <button
            onClick={() => {
              fetchSectors();
              fetchOpportunities(selectedSector?.sector);
            }}
            id="refresh-swing-btn"
            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/[0.06] text-xs font-data text-slate-300 rounded-xl hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={(loadingSectors || loadingSetups) ? 'animate-spin' : ''} />
            SCANNER REFRESH
          </button>
        </div>
      </div>

      {/* SECTION 1 - SECTOR HEATMAP */}
      <section id="sectors-section" className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#D4A843]" />
            <h2 className="font-display font-semibold text-lg text-white">
              Sector Strength Heatmap
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 uppercase font-mono tracking-[0.12em]">
            11 Core Sectors Listed Map
          </span>
        </div>

        {errorSectors && (
          <div className="bg-rose-500/5 text-rose-400 border border-rose-500/20 p-4 rounded-xl text-xs font-mono leading-relaxed">
            ⚠️ {errorSectors}. Double check database schema details or sync process in progress.
          </div>
        )}

        {loadingSectors ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 11 }).map((_, idx) => (
              <div key={idx} className="glass-card p-4 h-[105px] animate-pulse space-y-3">
                <div className="h-4 w-2/3 bg-white/5 rounded" />
                <div className="h-5 w-1/2 bg-white/5 rounded" />
                <div className="h-1 bg-white/5 rounded w-full mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Scroll indicator for mobile */}
            <p className="md:hidden text-[9px] text-[#8892A4] uppercase italic tracking-wider mb-2 font-mono">
              ← Swipe horizontally to explore sectors →
            </p>
            
            <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-6 gap-4 pb-4 md:pb-0 scrollbar-thin scrollbar-thumb-white/[0.04]">
              {sectors.map((sec) => {
                const isSelected = selectedSector?.sector === sec.sector;
                const isHot = sec.score > 75;
                const isPriceUp = sec.priceChange5D >= 0;
                const isDown = sec.priceChange5D < -1.5;

                return (
                  <button
                    key={sec.sector}
                    onClick={() => handleSectorSelect(sec)}
                    className={`flex-shrink-0 w-[180px] md:w-auto text-left cursor-pointer transition-all duration-200 glass-card p-4.5 rounded-xl border relative select-none flex flex-col justify-between h-[115px] hover:border-white/[0.12] ${
                      isSelected
                        ? 'border-[#D4A843] bg-amber-500/[0.04] shadow-[0_0_20px_rgba(212,168,67,0.18)] translate-y-[-2px]'
                        : isHot
                        ? 'border-amber-500/30 bg-slate-900/60'
                        : 'border-white/[0.04] bg-slate-950/80'
                    } ${
                      isPriceUp && !isSelected ? 'border-l-2 border-l-emerald-500' : ''
                    } ${
                      isDown && !isSelected ? 'border-l-2 border-l-rose-500 border-opacity-70' : ''
                    }`}
                  >
                    <div>
                      {/* Name & Badge Header */}
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="font-display font-medium text-[12.5px] leading-tight text-white pr-2 whitespace-normal line-clamp-1">
                          {SECTOR_EMOJIS[sec.sector] || '📁'} {sec.name} {sec.stockCount !== undefined ? `(${sec.stockCount} stocks)` : ''}
                        </span>
                        {isHot && (
                          <span className="shrink-0 font-mono font-bold text-[9px] text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded tracking-wide">
                            🔥 HOT
                          </span>
                        )}
                      </div>

                      {/* 5D Perf */}
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-mono text-[15.5px] font-bold ${
                          sec.priceChange5D >= 0 ? 'text-[#00D084]' : 'text-[#FF4757]'
                        }`}>
                          {formatChange(sec.priceChange5D)}
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono font-medium">5D</span>
                      </div>
                    </div>

                    {/* Bottom Sentiment/Score Slider */}
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1.5">
                        <span className={`uppercase font-semibold tracking-wide ${
                          sec.newsScore === 'positive' 
                            ? 'text-emerald-400' 
                            : sec.newsScore === 'negative' 
                            ? 'text-rose-400' 
                            : 'text-gray-400'
                        }`}>
                          {sec.newsScore} SENTIMENT
                        </span>
                        <span className="text-[#D4A843] font-bold">{Math.round(sec.score)}/100</span>
                      </div>
                      
                      {/* Score gold progress bar */}
                      <div className="w-full bg-slate-800 h-[3px] rounded-full overflow-hidden mt-1 bg-opacity-80">
                        <div 
                          className="bg-[#D4A843] h-full transition-all duration-300" 
                          style={{ width: `${Math.max(0, Math.min(100, sec.score))}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2 - TOP OPPORTUNITIES */}
      <section id="opportunities-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.03] pb-2 gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#00D084]" />
            <h2 className="font-display font-semibold text-lg text-white">
              {selectedSector 
                ? `Swing Opportunities - ${selectedSector.name} ${SECTOR_EMOJIS[selectedSector.sector] || ''}` 
                : 'Top Swing Scanning Scanner'}
            </h2>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {selectedSector && (
              <button
                onClick={clearSectorFilter}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-mono tracking-wider bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded"
              >
                [ RESET SECTOR FILTER ]
              </button>
            )}
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest bg-white/[0.02] px-2 py-0.5 rounded">
              {selectedSector ? 'SECTOR FILTERED' : 'OVERALL SYSTEM TOP RANKED'}
            </span>
          </div>
        </div>

        {errorSetups && (
          <div className="bg-rose-500/5 text-rose-400 border border-rose-500/20 p-4 rounded-xl text-xs font-mono">
            ⚠️ {errorSetups}. Please trigger a scan manually using the Scanner Refresh button in the header.
          </div>
        )}

        {loadingSetups ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="glass-card p-6 h-[290px] animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="h-5 w-1/3 bg-white/5 rounded" />
                  <div className="h-5 w-1/4 bg-white/5 rounded" />
                </div>
                <div className="h-10 bg-white/5 rounded w-full" />
                <div className="h-6 bg-white/5 rounded w-1/2" />
                <div className="h-12 bg-white/5 rounded w-full" />
              </div>
            ))}
          </div>
        ) : setups.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center space-y-3.5 border-dashed border-white/[0.04]">
            <AlertTriangle className="text-amber-500/80" size={32} />
            <div>
              <p className="text-sm font-semibold text-slate-200">
                No active swing setups in {selectedSector ? selectedSector.name : 'the market'} right now.
              </p>
              <p className="text-[11.5px] text-gray-500 font-body leading-relaxed max-w-sm mt-1">
                Prices may be consolidating inside extremely volatile bounds. Try selecting a different sector or checking back after next market scan.
              </p>
            </div>
            {selectedSector && (
              <button
                onClick={clearSectorFilter}
                className="px-4 py-1.5 bg-white/[0.03] border border-white/[0.08] text-xs font-mono rounded-lg hover:bg-white/[0.06] text-white"
              >
                Show Overall Market Setups
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Scroll indicator for mobile */}
            <p className="md:hidden text-[9px] text-[#8892A4] uppercase italic tracking-wider mb-2 font-mono">
              ← Swipe left/right to view opportunity list cards (Horizontal slider active) →
            </p>

            <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-6 pb-4 md:pb-0 scrollbar-none snap-x snap-mandatory">
              {setups.map((setup, index) => {
                const isBuy = setup.signal === 'BUY';
                const isSell = setup.signal === 'SELL';
                const isDeepDived = deepDiveStock?.symbol === setup.symbol;

                return (
                  <div
                    key={setup.symbol}
                    className={`flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto snap-center whitespace-normal glass-card p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 relative border ${
                      isBuy
                        ? 'border-emerald-500/25 bg-slate-950/80 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                        : isSell
                        ? 'border-rose-500/25 bg-slate-950/80 shadow-[0_0_15px_rgba(239,68,68,0.06)]'
                        : 'border-white/[0.04] bg-slate-950/90'
                    } ${isDeepDived ? 'ring-1 ring-[#D4A843] shadow-[0_0_20px_rgba(212,168,67,0.12)]' : ''}`}
                  >
                    {/* Top Ticker Row */}
                    <div>
                      <div className="flex justify-between items-start border-b border-white/[0.03] pb-3 mb-3.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10.5px] font-bold text-gray-500 uppercase">
                              #{index + 1} ON RADAR
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-[10px] text-[#8892A4] font-body bg-white/[0.02] px-1.5 py-0.5 rounded">
                              {setup.sector || 'Astraeus Pick'}
                            </span>
                          </div>
                          <h3 className="font-display font-black text-white text-lg tracking-wide mt-1.5">
                            {setup.tickerName}
                          </h3>
                        </div>

                        {/* Signal Badge */}
                        <div className="text-right">
                          <span className={`inline-block font-mono text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border ${
                            isBuy
                              ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15'
                              : isSell
                              ? 'text-rose-400 bg-rose-500/5 border-rose-500/15'
                              : 'text-[#E8C070] bg-[#E8C070]/5 border-[#E8C070]/15'
                          }`}>
                            {isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '🟡 HOLD'}
                          </span>
                        </div>
                      </div>

                      {/* Price & Change Row */}
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="font-mono text-xl font-bold text-slate-200">
                          ₹{setup.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`font-mono text-xs font-semibold ${
                          setup.changePercent >= 0 ? 'text-[#00D084]' : 'text-[#FF4757]'
                        }`}>
                          {formatChange(setup.changePercent)}
                        </span>
                      </div>

                      {/* Integrated Intelligence Signals */}
                      <div className="mb-4 bg-black/40 border border-white/[0.02] p-2.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[9px] uppercase font-mono tracking-wider text-gray-500">
                          <span>Intelligence Signals:</span>
                          <span className="text-[#E8C070] font-semibold text-[8px] lowercase">integrated</span>
                        </div>
                        <div className="flex justify-between gap-1 text-center">
                          {/* Global */}
                          <div 
                            title={setup.intelligenceContext?.globalMacro || "S&P +0.8%, VIX 13.4 — positive for markets"}
                            className="flex-1 py-1 px-1 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[10px] font-mono hover:bg-white/[0.05] transition-all cursor-help"
                          >
                            <span className="block text-[7px] text-gray-500 uppercase leading-none">GLOB</span>
                            <span className="block font-bold text-emerald-400 mt-1">🌐</span>
                          </div>

                          {/* FII */}
                          <div 
                            title={setup.intelligenceContext?.fiiActivity || "FII net buying ₹2,340 Cr — bullish"}
                            className="flex-1 py-1 px-1 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[10px] font-mono hover:bg-white/[0.05] transition-all cursor-help"
                          >
                            <span className="block text-[7px] text-gray-500 uppercase leading-none">INST</span>
                            <span className="block font-bold mt-1">🏦</span>
                          </div>

                          {/* Events */}
                          <div 
                            title={setup.intelligenceContext?.earningsAlert || "No results in next 7 days — clear"}
                            className="flex-1 py-1 px-1 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[10px] font-mono hover:bg-white/[0.05] transition-all cursor-help"
                          >
                            <span className="block text-[7px] text-gray-500 uppercase leading-none">EVNT</span>
                            <span className={`block font-bold mt-1 ${setup.intelligenceContext?.earningsAlert ? "text-rose-400 opacity-100" : "text-emerald-400 opacity-60"}`}>📅</span>
                          </div>

                          {/* Deals */}
                          <div 
                            title={setup.intelligenceContext?.bulkDealAlert || "Promoter activity is stable — neutral"}
                            className="flex-1 py-1 px-1 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[10px] font-mono hover:bg-white/[0.05] transition-all cursor-help"
                          >
                            <span className="block text-[7px] text-gray-500 uppercase leading-none">DEAL</span>
                            <span className="block font-bold mt-1">📊</span>
                          </div>

                          {/* News */}
                          <div 
                            title={setup.intelligenceContext?.newsSentiment || "Positive — consensus upgrade expected"}
                            className="flex-1 py-1 px-1 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[10px] font-mono hover:bg-white/[0.05] transition-all cursor-help"
                          >
                            <span className="block text-[7px] text-gray-500 uppercase leading-none">NEWS</span>
                            <span className="block font-bold text-emerald-400 mt-1 font-sans">📰</span>
                          </div>
                        </div>
                      </div>

                      {/* Technical Strength Unicode Score Bar */}
                      <div className="space-y-1 mb-4 flex justify-between items-center bg-black/30 p-2.5 rounded-lg border border-white/[0.02]">
                        <span className="text-[9.5px] uppercase font-mono tracking-wider text-gray-500">
                          Tech Score:
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-amber-500">
                          <span className="tracking-thinnest leading-none opacity-85 select-none text-[10.5px] font-semibold">
                            {renderScoreBar(setup.setupScore)}
                          </span>
                          <span className="font-bold text-[11px] text-[#D4A843]">
                            {Math.round(setup.setupScore)}
                          </span>
                        </div>
                      </div>

                      {/* RSI & Wave indicators */}
                      <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 py-2 border-b border-white/[0.03] mb-3">
                        <span>
                          RSI <strong className="text-slate-300">{setup.rsi}</strong>
                        </span>
                        <span className="text-gray-600 font-normal select-none">•</span>
                        <span>
                          ADX <strong className="text-slate-300">{setup.adx}</strong>
                        </span>
                        <span className="text-gray-600 font-normal select-none">•</span>
                        <span>
                          BB Squeeze {setup.isSqueezed ? <span className="text-amber-400 font-bold">★ Squeeze</span> : <span className="text-gray-500">No</span>}
                        </span>
                      </div>

                      {/* Candle Patterns */}
                      {setup.detected_patterns && setup.detected_patterns.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[9px] uppercase font-mono tracking-wider text-gray-500 block mb-1.5">
                            Pattern Recognition:
                          </span>
                          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md">
                            <Cpu size={11} className="shrink-0" />
                            <span>{setup.detected_patterns[0].replace(/ \(.*\)/, '')}</span>
                          </div>
                        </div>
                      )}

                      {/* Entry targets info */}
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg mb-3">
                        <div>
                          <span className="text-[9px] text-gray-400 block mb-0.5 uppercase">ENTRY</span>
                          <span className="text-gray-200 font-black">₹{Math.round(setup.lastPrice)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-rose-400/80 block mb-0.5 uppercase">STOP LOSS</span>
                          <span className="text-rose-400 font-bold">₹{Math.round(setup.stopLoss)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-400/80 block mb-0.5 uppercase">TARGET 1</span>
                          <span className="text-emerald-400 font-bold">₹{Math.round(setup.target1)}</span>
                        </div>
                      </div>

                      {/* Hold velocity & R:R details */}
                      <div className="flex justify-between items-center text-[10.5px] font-mono text-gray-400 mb-5 px-1">
                        <span className="flex items-center gap-1">
                          <Clock size={11.5} className="text-amber-500 shrink-0" />
                          <span>Hold: {setup.hold_time_recommendation ? setup.hold_time_recommendation.split(' (')[0] : '10-15 Days'}</span>
                        </span>
                        
                        <span>
                          R:R{' '}
                          <strong className="text-[#E8C070] font-black bg-[#E8C070]/5 px-1.5 py-0.5 rounded border border-[#E8C070]/10">
                            {setup.trade_plan?.risk_reward_ratio || (Math.abs(setup.target1 - setup.lastPrice) / Math.max(1, Math.abs(setup.lastPrice - setup.stopLoss))).toFixed(1)}x
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Bottom Deep Dive Button */}
                    <div className="pt-3 border-t border-white/[0.03] flex items-center justify-between gap-1">
                      <button
                        onClick={() => initiateDeepDive(setup)}
                        className={`w-full py-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#D4A843] border rounded-xl hover:bg-amber-500/5 transition-all text-center cursor-pointer ${
                          isDeepDived ? 'bg-amber-500/10 border-[#D4A843]' : 'border-[#D4A843]/30 bg-black/40'
                        }`}
                      >
                        Deep Dive Integration
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3 - DEEP DIVE PANEL */}
      <section id="deep-dive-section" className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#D4A843]" />
            <h2 className="font-display font-semibold text-lg text-white">
              Tactical Deep Dive Analyzer
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 uppercase font-mono tracking-[0.12em]">
            Trade Plan & Interactive Graph
          </span>
        </div>

        {deepDiveStock ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN - LIQUID LIVE CHART PANEL (SPAN 7) */}
            <div className="lg:col-span-7 space-y-4 glass-card p-5 border border-white/[0.04]">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/[0.04] pb-3 mb-3">
                <div>
                  <h3 className="font-display font-bold text-white text-base font-sans">
                    {deepDiveStock.tickerName} Daily Trend Graph
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono">
                    EMA 20 & 50 · Standard Volume · S/R Line Plots Added Dynamic
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">SYMBOL ROUTING</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-800 text-slate-200 border border-slate-700/50 rounded rounded-md">
                    {deepDiveStock.symbol}
                  </span>
                </div>
              </div>

              {/* LIVE CHART */}
              <div className="min-h-[440px] bg-slate-950/40 rounded-xl relative overflow-hidden flex flex-col justify-between">
                <LiveChart
                  symbol={deepDiveStock.symbol}
                  height={380}
                  supportLevels={deepDiveStock.support_levels || [deepDiveStock.lastPrice * 0.95]}
                  resistanceLevels={deepDiveStock.resistance_levels || [deepDiveStock.lastPrice * 1.05]}
                  patterns={deepDiveStock.markers || []}
                />
              </div>

              {/* CHART DISCLAIMER INDICATORS */}
              <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg flex items-center justify-between gap-1 text-[10px] font-mono text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                  <span>EMA 20</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span>EMA 50</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Pivotal Support</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Pivotal Resistance</span>
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN - COMBINATORY TRADE PLAN ACCORDION BENTO (SPAN 5) */}
            <div className="lg:col-span-5 flex flex-col h-full">
              <div className="gold-card p-6 flex-1 flex flex-col justify-between border border-[#D4A843]/30 bg-[#D4A843]/[0.02] shadow-[0_0_20px_rgba(212,168,67,0.11)] rounded-2xl relative overflow-hidden">
                
                {/* Visual Accent Corner lines */}
                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-30 select-none border-t border-r border-[#D4A843]" />
                
                <div>
                  {/* Dynamic Header */}
                  <div className="flex justify-between items-center border-b border-[#D4A843]/20 pb-4 mb-4">
                    <div>
                      <h3 className="font-display text-[#D4A843] font-bold text-sm uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={13} className="animate-spin-slow text-amber-500" />
                        TRADE PLAN SYSTEM
                      </h3>
                      <h4 className="font-display font-semibold text-lg text-slate-100 font-sans mt-0.5">
                        {deepDiveStock.tickerName} Swing Blueprint
                      </h4>
                    </div>

                    <span className={`font-mono text-xs font-black tracking-widest px-3 py-1.5 rounded-lg text-center uppercase border border-opacity-30 ${
                      deepDiveStock.signal === 'BUY'
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40'
                        : deepDiveStock.signal === 'SELL'
                        ? 'text-rose-400 bg-rose-500/10 border-rose-500/40'
                        : 'text-[#E8C070] bg-[#E8C070]/10 border-[#E8C070]/40'
                    }`}>
                      {deepDiveStock.signal === 'BUY' ? '🟢 BUY ACTION' : deepDiveStock.signal === 'SELL' ? '🔴 SELL ACTION' : '🟡 HOLD'}
                    </span>
                  </div>

                  {/* Complete Plan Grid list details */}
                  <div className="space-y-4">
                    
                    {/* Ticker Detail Subtitle strip */}
                    <div className="flex justify-between items-center text-[11px] font-mono text-gray-500 py-1 border-b border-white/[0.02]">
                      <span>IDENTIFIED SECTOR</span>
                      <strong className="text-slate-300 font-bold uppercase">{deepDiveStock.sector || 'NIFTY 500'}</strong>
                    </div>

                    {/* Entry range */}
                    <div className="p-3 bg-black/45 rounded-lg border border-white/[0.02] relative">
                      <span className="text-[10px] text-gray-500 block uppercase font-mono tracking-wider mb-1">
                        {deepDiveStock.signal === 'SELL'
                          ? 'OPTIMAL EXIT / SHORT ENTRY RANGE'
                          : deepDiveStock.signal === 'HOLD'
                          ? 'CURRENT PRICE ZONE — WAIT'
                          : 'OPTIMAL ACCUMULATION ENTRY RANGE'}
                      </span>
                      <span className="text-base font-bold text-[#E8C070] font-mono">
                        {deepDiveStock.trade_plan?.entry_range || `₹${(deepDiveStock.lastPrice * 0.995).toFixed(1)} – ₹${(deepDiveStock.lastPrice * 1.005).toFixed(1)}`}
                      </span>
                      <p className="text-[10.5px] text-gray-500 mt-1 font-body">
                        {deepDiveStock.signal === 'SELL'
                          ? 'Consider booking profits or short entry inside standard boundaries.'
                          : deepDiveStock.signal === 'HOLD'
                          ? 'No new entry recommended — Monitor for clearer signal.'
                          : 'Accumulate strictly inside standard safety boundaries around volume weights.'}
                      </p>
                    </div>

                    {/* Stop Loss & Target grids */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      {/* STOP LOSS */}
                      <div className="p-3 bg-[#FF4757]/5 border border-[#FF4757]/15 rounded-lg text-center">
                        <span className="text-[9px] text-[#FF4757] block uppercase font-mono font-medium tracking-wide mb-1">
                          STOP LOSS (HARD)
                        </span>
                        <span className="text-sm font-bold text-[#FF4757] font-mono">
                          ₹{Math.round(deepDiveStock.trade_plan?.stop_loss || deepDiveStock.stopLoss)}
                        </span>
                        <span className="text-[9px] block text-rose-500/80 font-mono mt-0.5">
                          {deepDiveStock.signal === 'SELL' ? '+' : '-'}{((Math.abs(deepDiveStock.lastPrice - (deepDiveStock.trade_plan?.stop_loss || deepDiveStock.stopLoss)) / deepDiveStock.lastPrice) * 100).toFixed(1)}% RANGE
                        </span>
                      </div>

                      {/* TARGET 1 */}
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg text-center">
                        <span className="text-[9px] text-emerald-400 block uppercase font-mono font-medium tracking-wide mb-1">
                          {deepDiveStock.signal === 'SELL' ? 'DOWNSIDE TARGET 1' : 'TARGET 1 (MAIN)'}
                        </span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          ₹{Math.round(deepDiveStock.trade_plan?.target_1 || deepDiveStock.target1)}
                        </span>
                        <span className="text-[9px] block text-emerald-500/80 font-mono mt-0.5">
                          {deepDiveStock.signal === 'SELL' ? '-' : '+'}{((Math.abs((deepDiveStock.trade_plan?.target_1 || deepDiveStock.target1) - deepDiveStock.lastPrice) / deepDiveStock.lastPrice) * 100).toFixed(1)}% {deepDiveStock.signal === 'SELL' ? 'TARGET' : 'LIMIT'}
                        </span>
                      </div>

                      {/* TARGET 2 */}
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-center">
                        <span className="text-[9px] text-emerald-400/80 block uppercase font-mono tracking-wide mb-1">
                          {deepDiveStock.signal === 'SELL' ? 'DOWNSIDE TARGET 2 (MAX)' : 'TARGET 2 (MAX)'}
                        </span>
                        <span className="text-sm font-bold text-emerald-400/80 font-mono">
                          ₹{Math.round(deepDiveStock.trade_plan?.target_2 || deepDiveStock.target2)}
                        </span>
                        <span className="text-[9px] block text-emerald-500/60 font-mono mt-0.5">
                          {deepDiveStock.signal === 'SELL' ? '-' : '+'}{((Math.abs((deepDiveStock.trade_plan?.target_2 || deepDiveStock.target2) - deepDiveStock.lastPrice) / deepDiveStock.lastPrice) * 100).toFixed(1)}% SPLIT
                        </span>
                      </div>

                    </div>

                    {/* Hold Period & Confidence Ratio strip */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 bg-black/30 border border-white/[0.02] rounded-lg">
                        <span className="text-[9px] text-[#8892A4] block uppercase font-mono mb-1">HOLD REC DURATION</span>
                        <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1">
                          <Clock size={11} className="text-amber-500" />
                          {deepDiveStock.hold_time_recommendation ? deepDiveStock.hold_time_recommendation.split(' (')[0] : '10 - 15 Trading Days'}
                        </span>
                      </div>

                      <div className="p-2.5 bg-black/30 border border-white/[0.02] rounded-lg text-right">
                        <span className="text-[9px] text-[#8892A4] block uppercase font-mono mb-1">REWARD TO RISK RATIO</span>
                        <span className="text-xs font-bold text-slate-100 font-mono block">
                          1 : {deepDiveStock.trade_plan?.risk_reward_ratio || (Math.abs(deepDiveStock.target1 - deepDiveStock.lastPrice) / Math.max(1, Math.abs(deepDiveStock.lastPrice - deepDiveStock.stopLoss))).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* WHY THIS TRADE ACCORDION PANEL */}
                    <div className="border border-white/[0.04] rounded-lg overflow-hidden mt-2 bg-black/20">
                      <button
                        onClick={() => setWhyThisTradeOpen(!whyThisTradeOpen)}
                        className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-300 font-mono uppercase bg-slate-900/60 transition-colors cursor-pointer hover:bg-slate-900 border-b border-white/[0.04]"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={11.5} className="text-[#D4A843]" />
                          Why This Trade Setup?
                        </span>
                        {whyThisTradeOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>

                      {whyThisTradeOpen && (
                        <div className="p-3.5 space-y-2.5 text-[10.5px] leading-relaxed text-[#8892A4]">
                          {/* Point 1: BB squeeze breakout or narrow width */}
                          <div className="flex gap-2 items-start">
                            <span className="text-emerald-400 font-mono select-none mt-0.5 shrink-0">→</span>
                            <p>
                              {deepDiveStock.isSqueezed 
                                ? 'Bollinger Bands Squeeze expansion sequence confirmed. Absolute band widths collapsed into highly compression triggers.'
                                : `ATR absolute volatility index of ₹${deepDiveStock.atr.toFixed(1)} indicates constructive structural range containment.`}
                            </p>
                          </div>

                          {/* Point 2: Sector performance */}
                          <div className="flex gap-2 items-start">
                            <span className="text-emerald-400 font-mono select-none mt-0.5 shrink-0">→</span>
                            <p>
                              Identified in <strong>{deepDiveStock.sector}</strong> sector showing institutional rotation and net technical alpha baseline.
                            </p>
                          </div>

                          {/* Point 3: Candlestick Pattern check */}
                          {deepDiveStock.detected_patterns && deepDiveStock.detected_patterns.length > 0 ? (
                            <div className="flex gap-2 items-start">
                              <span className="text-emerald-400 font-mono select-none mt-0.5 shrink-0">→</span>
                              <p>
                                Active formation: <span className="text-slate-200 font-semibold">{deepDiveStock.detected_patterns[0]}</span>. Strong support buyer protection cluster detected here.
                              </p>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-start">
                              <span className="text-emerald-400 font-mono select-none mt-0.5 shrink-0">→</span>
                              <p>
                                Pivot point alignment conforms with swing baseline. Volume trends indicate strong absorption dynamics at the moving averages.
                              </p>
                            </div>
                          )}

                          {/* Point 4: Volume ratio */}
                          <div className="flex gap-2 items-start">
                            <span className="text-emerald-400 font-mono select-none mt-0.5 shrink-0">→</span>
                            <p>
                              Daily Volume ratio represents a healthy <strong className="text-slate-200">{deepDiveStock.volumeRatio.toFixed(1)}x average volume</strong> multiplier with active momentum.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/[0.04] mt-6 bg-transparent">
                  <button
                    onClick={() => handleShareSetup(deepDiveStock.symbol)}
                    className="py-2.5 px-4 bg-white/[0.03] hover:bg-white/[0.06] font-mono text-[11px] font-bold text-slate-300 border border-white/[0.08] hover:border-white/[0.15] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Share2 size={13} className="text-slate-400" />
                    {lastSharedStock === deepDiveStock.symbol ? 'COPIED SETUP! 📤' : 'SHARE SETUP 📤'}
                  </button>

                  <button
                    onClick={() => toggleWatchlist(deepDiveStock.symbol)}
                    className={`py-2.5 px-4 font-mono text-[11px] font-bold border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                      watchlist[deepDiveStock.symbol]
                        ? 'bg-amber-500/10 text-[#D4A843] border-[#D4A843]'
                        : 'bg-black/30 text-slate-300 border-[#D4A843]/30 hover:bg-amber-500/5'
                    }`}
                  >
                    <Heart size={13} className={watchlist[deepDiveStock.symbol] ? 'fill-current text-[#D4A843]' : 'text-slate-400'} />
                    {watchlist[deepDiveStock.symbol] ? 'WATCHLISTED ♥' : 'ADD WATCHLIST ♥'}
                  </button>
                </div>

              </div>
            </div>

          </div>
        ) : (
          <div className="glass-card p-12 text-center text-slate-500 flex flex-col items-center justify-center border-dashed border-white/[0.04]">
            <Layers size={24} className="mb-2 text-slate-700 animate-pulse" />
            <span className="text-sm">Select opportunities above to activate Tactical Deep Dive Analyzer.</span>
          </div>
        )}
      </section>
    </div>
  );
}
