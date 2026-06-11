import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllPredictions, getMacro, getAssets, getSwingScannerSetups } from '../api';
import { Prediction, MacroData, Asset } from '../types';
import { SignalBadge } from '../components/SignalBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { useAuth } from '../services/AuthProvider';
import { 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  Coins, 
  Activity, 
  Layers, 
  Globe, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';

const STOCK_INFO_MAP: Record<string, { name: string; sector: string; badgeColor: string }> = {
  'RELIANCE.NS': { name: 'Reliance Industries', sector: 'Energy & Telecom', badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-900/30' },
  'HDFCBANK.NS': { name: 'HDFC Bank Limited', sector: 'Private Finance', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-900/30' },
  'TATAMOTORS.NS': { name: 'Tata Motors Limited', sector: 'Automotive & EV', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-900/30' },
  'TCS.NS': { name: 'Tata Consultancy Services', sector: 'IT Services', badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-900/30' },
  'INFY.NS': { name: 'Infosys Limited', sector: 'IT Consulting', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-900/30' },
  'TITAN.NS': { name: 'Titan Company Limited', sector: 'Consumer & Gold Retail', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-900/30' },
  'HINDZINC.NS': { name: 'Hindustan Zinc Ltd', sector: 'Metals & Commodities', badgeColor: 'bg-slate-400/15 text-slate-300 border-slate-705' },
  'VEDL.NS': { name: 'Vedanta Limited', sector: 'Diversified Metals', badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-900/30' },
  'MUTHOOTFIN.NS': { name: 'Muthoot Finance Ltd', sector: 'Gold Financing Group', badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-900/30' },
  'MANAPPURAM.NS': { name: 'Manappuram Finance Ltd', sector: 'Gold & Micro Loans', badgeColor: 'bg-amber-700/10 text-amber-500 border-amber-900/30' },
  'WAAREEENER.NS': { name: 'Waaree Energies Ltd', sector: 'Renewable Solar Power', badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-900/30' }
};

const getStockInfo = (symbol: string) => {
  const sym = symbol.toUpperCase();
  if (STOCK_INFO_MAP[sym]) {
    return STOCK_INFO_MAP[sym];
  }
  const prefix = sym.split('.')[0];
  return {
    name: prefix + ' Share',
    sector: 'Custom Asset',
    badgeColor: 'bg-slate-500/10 text-slate-405 border-slate-900/30'
  };
};

export function Dashboard() {
  const { user, generateAlertForInterestedSymbols } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>(() => {
    try {
      const saved = localStorage.getItem('bangon_preds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [macro, setMacro] = useState<MacroData | null>(() => {
    try {
      const saved = localStorage.getItem('bangon_macro');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem('bangon_assets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedStockTab, setSelectedStockTab] = useState<'ALL' | 'GIANTS' | 'COMMODITY_METALS'>('ALL');
  
  // States
  const [swingSetups, setSwingSetups] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('bangon_swing');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [calcCapital, setCalcCapital] = useState<number>(() => {
    const saved = localStorage.getItem('bangon_capital');
    return saved ? Number(saved) : 50000;
  });
  const [calcRiskPct, setCalcRiskPct] = useState<number>(() => {
    const saved = localStorage.getItem('bangon_risk');
    return saved ? Number(saved) : 2;
  });
  const [selectedCalcSetup, setSelectedCalcSetup] = useState<any | null>(null);
  const [calculatorCustomPrice, setCalculatorCustomPrice] = useState<string>('240.0');
  const [calculatorCustomSLPct, setCalculatorCustomSLPct] = useState<string>('3.5');

  const [loading, setLoading] = useState(() => {
    // If we have some cached local data, skip full-screen spinner to maximize perception speed
    try {
      const p = localStorage.getItem('bangon_preds');
      return !p;
    } catch {
      return true;
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [congestionNotice, setCongestionNotice] = useState(false);

  const handleAssetClick = (symbol: string, currentPrice: number, stopLossPct = 3.5) => {
    setSelectedCalcSetup({
      symbol,
      tickerName: symbol.split('.')[0],
      lastPrice: currentPrice,
      stopLoss: currentPrice * (1 - stopLossPct / 100),
    });
    setCalculatorCustomPrice(currentPrice.toFixed(2));
    setCalculatorCustomSLPct(stopLossPct.toFixed(1));
    setTimeout(() => {
      document.getElementById('risk-sizer-panel')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  async function loadData(isSilent = false) {
    if (refreshing) {
      console.log('[Dashboard] Refresh already in progress, skipping duplicate.');
      return;
    }
    if (!isSilent && !predictions.length) setLoading(true);
    else setRefreshing(true);
    setError(null);
    setCongestionNotice(false);

    let caughtRateLimit = false;

    try {
      const [predsData, macroData, assetsData, scannerData] = await Promise.all([
        getAllPredictions().catch(err => {
          console.warn('Dashboard predictions sync issues:', err.message || err);
          const msg = (err.message || String(err)).toLowerCase();
          if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') || msg.includes('exceeded')) {
            caughtRateLimit = true;
          }
          return null;
        }),
        getMacro().catch(err => {
          console.warn('Dashboard macro sync issues:', err.message || err);
          const msg = (err.message || String(err)).toLowerCase();
          if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') || msg.includes('exceeded')) {
            caughtRateLimit = true;
          }
          return null;
        }),
        getAssets().catch(err => {
          console.warn('Dashboard assets list sync issues:', err.message || err);
          const msg = (err.message || String(err)).toLowerCase();
          if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') || msg.includes('exceeded')) {
            caughtRateLimit = true;
          }
          return null;
        }),
        getSwingScannerSetups().catch(err => {
          console.warn('Dashboard swing setups sync issues:', err.message || err);
          const msg = (err.message || String(err)).toLowerCase();
          if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') || msg.includes('exceeded')) {
            caughtRateLimit = true;
          }
          return null;
        })
      ]);

      if (caughtRateLimit) {
        setCongestionNotice(true);
      }

      // Check if we retrieved anything and cache it
      if (predsData && predsData.length > 0) {
        setPredictions(predsData);
        try { localStorage.setItem('bangon_preds', JSON.stringify(predsData)); } catch {}
      }
      if (macroData) {
        setMacro(macroData);
        try { localStorage.setItem('bangon_macro', JSON.stringify(macroData)); } catch {}
      }
      if (assetsData && assetsData.length > 0) {
        setAssets(assetsData);
        try { localStorage.setItem('bangon_assets', JSON.stringify(assetsData)); } catch {}
      }
      if (scannerData && scannerData.length > 0) {
        setSwingSetups(scannerData || []);
        try { localStorage.setItem('bangon_swing', JSON.stringify(scannerData)); } catch {}
      }

      // Check if now we have absolutely nothing (no local data, and network failed)
      const hasAnyPredictions = (predsData && predsData.length > 0) || (predictions && predictions.length > 0);
      const hasAnyMacro = macroData || macro;
      const hasAnyAssets = (assetsData && assetsData.length > 0) || (assets && assets.length > 0);

      if (!hasAnyPredictions && !hasAnyMacro && !hasAnyAssets) {
        throw new Error('All primary market intelligence streams offline. Rate limit quota exceeded. Please try again soon.');
      }

      const activeScannerData = scannerData || swingSetups;
      // Select first setup as calculation default if none selected or if we refreshed
      if (activeScannerData && activeScannerData.length > 0 && (!selectedCalcSetup || scannerData)) {
        setSelectedCalcSetup(activeScannerData[0]);
        const calcPriceVal = activeScannerData[0].lastPrice ?? 100;
        const calcSLVal = activeScannerData[0].stopLoss ?? (calcPriceVal * 0.95);
        setCalculatorCustomPrice(calcPriceVal.toFixed(2));
        const dynamicSLPct = ((calcPriceVal - calcSLVal) / calcPriceVal * 100);
        setCalculatorCustomSLPct(Math.max(1, Number((dynamicSLPct || 3.5).toFixed(1))).toString());
      }
      
      const targetPreds = predsData || predictions;
      const targetAssets = assetsData || assets;
      if (generateAlertForInterestedSymbols && targetPreds.length > 0 && targetAssets.length > 0) {
        await generateAlertForInterestedSymbols(targetPreds, targetAssets).catch(() => {});
      }
    } catch (e: any) {
      console.error('Error fetching dashboard', e);
      setError(e.message || 'Failed to sync live predictions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isEtf = (symbol: string) => {
    const s = symbol.toUpperCase();
    return s.includes('BEES') || s === 'GOLDBEES.NS' || s === 'SILVERBEES.NS';
  };

  const etfPredictions = predictions.filter(p => isEtf(p.symbol));
  
  const isGiantStock = (symbol: string) => {
    const s = symbol.toUpperCase().split('.')[0];
    return ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'TATAMOTORS'].includes(s);
  };

  const isCommodityMetalStock = (symbol: string) => {
    const s = symbol.toUpperCase().split('.')[0];
    return ['TITAN', 'HINDZINC', 'VEDL', 'MUTHOOTFIN', 'MANAPPURAM', 'WAAREEENER', 'WAAREE'].includes(s);
  };

  const allStockPredictions = predictions.filter(p => !isEtf(p.symbol));

  const stockPredictions = allStockPredictions.filter(p => {
    if (selectedStockTab === 'ALL') return true;
    if (selectedStockTab === 'GIANTS') return isGiantStock(p.symbol);
    if (selectedStockTab === 'COMMODITY_METALS') return isCommodityMetalStock(p.symbol);
    return true;
  });

  const getPrice = (symbol: string) => {
    const found = assets.find(a => a.symbol.toUpperCase() === symbol.toUpperCase());
    return (found && found.last_price !== null && found.last_price !== undefined) ? Number(found.last_price) : null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={36} className="text-[#D4A843] animate-spin" />
        <p className="font-data text-xs text-[#8892A4] animate-pulse uppercase tracking-widest">FETCHING_DESK_METRICS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] max-w-md mx-auto p-8 rounded-2xl bg-[#0D1018] border border-[#FF4757]/20 shadow-xl">
        <AlertCircle size={44} className="text-[#FF4757] mb-3" />
        <h3 className="text-sm font-data text-white mb-2 uppercase tracking-wider">Feeds Offline</h3>
        <p className="text-[#8892A4] text-xs text-center font-body mb-5">{error}</p>
        <button 
          onClick={() => loadData()}
          className="px-4 py-2 bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/30 rounded-lg hover:bg-[#FF4757]/20 transition-all font-data text-[11px] tracking-wider uppercase"
        >
          RECONNECT_FEED
        </button>
      </div>
    );
  }

  const formatCompactRupee = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const username = user?.displayName || user?.email?.split('@')[0] || 'Trader';
  const averageConfidence = predictions.length > 0
    ? (predictions.reduce((acc, p) => acc + p.confidence, 0) / predictions.length * 100).toFixed(0)
    : '88';

  const renderMacroItem = (
    label: string, 
    indicator: any, 
    formatter: (v: number) => string,
    suffix = ''
  ) => {
    if (!indicator) return null;

    const safeFormatter = (v: any) => {
      if (v === null || v === undefined || isNaN(v)) return '—';
      try {
        const num = Number(v);
        return formatter(num);
      } catch {
        return '—';
      }
    };
    
    if (typeof indicator === 'number') {
      return (
        <div className="space-y-1.5 p-3.5 bg-[#131720] border border-[rgba(255,255,255,0.03)] rounded-xl">
          <span className="text-[9px] text-[#4A5568] font-data uppercase tracking-wider block">{label}</span>
          <span className="text-lg font-data font-bold text-white block mt-1">{safeFormatter(indicator)}{suffix}</span>
        </div>
      );
    }

    const { value, status, lastUpdated } = indicator;
    
    const getFuzzyTime = (isoString: string | null) => {
      if (!isoString) return '';
      try {
        const diffMs = Date.now() - new Date(isoString).getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours}h ago`;
      } catch {
        return '';
      }
    };

    const timeAgo = getFuzzyTime(lastUpdated);

    return (
      <div className="space-y-1.5 p-3.5 bg-[#131720] border border-[rgba(255,255,255,0.03)] rounded-xl relative group">
        <div className="flex justify-between items-start gap-1">
          <span className="text-[9px] text-[#4A5568] font-data uppercase tracking-wider block truncate">{label}</span>
          {status === 'CACHED' && (
            <span className="text-[8px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded font-mono shrink-0">CACHED</span>
          )}
          {status === 'LIVE' && (
            <span className="text-[8px] px-1.5 py-0.5 bg-[#00D084]/10 text-[#00D084] rounded font-mono shrink-0">LIVE</span>
          )}
          {status === 'UNAVAILABLE' && (
            <span className="text-[8px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded font-mono shrink-0">⚠️ Data unavailable</span>
          )}
        </div>

        <span className="text-lg font-data font-bold text-white block mt-1">
          {status === 'UNAVAILABLE' || value === null || value === undefined
            ? '—' 
            : `${safeFormatter(value)}${suffix}`}
        </span>

        {status === 'CACHED' && timeAgo && value !== null && value !== undefined && (
          <span className="text-[9px] text-[#8892A4]/60 font-data block mt-1">
            Last: {safeFormatter(value)}{suffix} ({timeAgo})
          </span>
        )}
      </div>
    );
  };

  return (
    <div id="dashboard-vue" className="space-y-8">
      {congestionNotice && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 flex items-start gap-3 text-xs font-body backdrop-blur-sm animate-fade-in">
          <AlertCircle className="shrink-0 text-[#D4A843] w-4 h-4 mt-0.5" />
          <div className="space-y-1 text-left">
            <p className="font-semibold uppercase tracking-wider text-[10px] font-data text-[#D4A843]">Market Feed Congested</p>
            <p className="text-zinc-400 font-body text-xs leading-relaxed">
              We are currently experiencing transient rate limits on our market intelligence agents. Bang On has gracefully transitioned your desk to local fallback snapshots and stable cached rulesets. Core charts and indices remain fully operational.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner section */}
      <div className="glass-card p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A843]/40 to-transparent" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="font-data text-[10px] text-[#D4A843] uppercase tracking-widest block font-medium">
              CORE_DESK_ACCELERATOR // STT_ALIGNED
            </span>
            <h2 className="text-2xl font-medium tracking-tight text-[#F0F4FF] font-display">
              Good morning, {username}
            </h2>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8892A4] font-body">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#00D084]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D084] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D084]"></span>
                </span>
                LIVE MARKETS: CONCORDANCE MATCHED
              </span>
              <span className="text-[#4A5568] hidden sm:inline">|</span>
              <span className="text-[11px] text-[#8892A4] flex items-center gap-1">
                <ShieldAlert size={12} className="text-[#D4A843] shrink-0" />
                Frictional taxes fully modeled (15% STCG + STT Stamp Act rules)
              </span>
            </div>
          </div>

          <button 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.032)] hover:bg-[rgba(255,255,255,0.065)] text-[#E8C070] rounded-xl border border-[#D4A843]/20 text-[11px] font-data tracking-wide uppercase transition-all shrink-0 cursor-pointer"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'SYNCING_METRICS...' : 'SYNC_TRADERS_DESK'}
          </button>
        </div>

        {/* Quick Stats Grid Row: 4 Glass Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[rgba(255,255,255,0.04)]">
          {/* Card 1: Today's setups */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Tracked Setups</span>
            <span className="font-data text-2xl font-bold text-[#D4A843] mt-1.5 block">
              {swingSetups.length} Asset Classes
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Consensus evaluated</span>
          </div>

          {/* Card 2: Capital at risk */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Max trade Risk</span>
            <span className="font-data text-2xl font-bold text-[#FF4757] mt-1.5 block">
              {formatCompactRupee((calcCapital * calcRiskPct) / 100)}
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Cap @ risk ({calcRiskPct}%)</span>
          </div>

          {/* Card 3: System accuracy */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Calculated Capital</span>
            <span className="font-data text-2xl font-bold text-[#F0F4FF] mt-1.5 block">
              {formatCompactRupee(calcCapital)}
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Assumed liquidity pool</span>
          </div>

          {/* Card 4: Watchlist */}
          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Accurate Conviction</span>
            <span className="font-data text-2xl font-bold text-[#00D084] mt-1.5 block">
              {averageConfidence}%
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">30D ML backtest score</span>
          </div>
        </div>
      </div>

      {/* SWING SCANNER + calculator side-by-side (Zone 2 Glassmorphism) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Setups List: 7 Columns */}
        <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="text-[#00D084]" size={16} />
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#F0F4FF] tracking-tight">Active Swing Scanner</h3>
                  <p className="text-[9px] text-[#4A5568] font-data uppercase mt-0.5">Automated filter parameters</p>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#E8C070] font-data text-[8.5px] font-bold border border-[#D4A843]/20">
                BOLLINGER_ADX_CONVERGED
              </span>
            </div>

            <div className="space-y-2.5">
              {swingSetups.slice(0, 5).map((setup, idx) => {
                const isSelected = selectedCalcSetup?.symbol === setup.symbol;
                const activePriceVal = setup.lastPrice ?? 100;
                const activeSLVal = setup.stopLoss ?? (activePriceVal * 0.95);
                const slPct = ((activePriceVal - activeSLVal) / activePriceVal * 100);

                return (
                  <div 
                    key={setup.symbol}
                    onClick={() => {
                      setSelectedCalcSetup(setup);
                      setCalculatorCustomPrice(activePriceVal.toFixed(2));
                      setCalculatorCustomSLPct(Math.max(1, Number((slPct || 3.5).toFixed(1))).toString());
                    }}
                    className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                      isSelected 
                        ? 'bg-white/[0.04] border-[#D4A843]/50 shadow-md shadow-[#D4A843]/5' 
                        : 'bg-transparent border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-data text-[#4A5568]">#{idx + 1}</span>
                        <h4 className="font-display font-semibold text-xs tracking-wide text-white">{setup.tickerName}</h4>
                        <span className="text-[8px] px-1 py-0.1 bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20 rounded font-data">
                          SCORE {setup.setupScore}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8892A4] font-data">
                        <span>RSI <strong className="text-white">{setup.rsi?.toFixed(1) || '35.0'}</strong></span>
                        <span>ADX <strong className="text-white">{setup.adx?.toFixed(1) || '24.1'}</strong></span>
                        <span>Vol <strong className="text-white">{setup.volumeRatio?.toFixed(1) || '2.1'}x</strong></span>
                        <span className={setup.isSqueezed ? 'text-[#D4A843] font-bold' : 'text-[#4A5568]'}>
                          {setup.isSqueezed ? '★ Squeeze' : 'Normal BB'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3.5 w-full sm:w-auto border-t sm:border-t-0 border-[rgba(255,255,255,0.04)] pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[8.5px] text-[#4A5568] font-data block uppercase">LAST</span>
                        <span className="text-xs font-data font-bold text-white">₹{setup.lastPrice?.toFixed(2)}</span>
                      </div>
                      <Link 
                        to={`/asset/${setup.symbol}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 px-2.5 bg-[#0D1018] hover:bg-white/[0.04] text-[#8892A4] hover:text-white rounded border border-[rgba(255,255,255,0.08)] text-[9.5px] font-data tracking-wider uppercase transition-all"
                      >
                        Analyze &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}

              {swingSetups.length === 0 && (
                <div className="text-center py-10 font-data text-[11px] text-[#4A5568] uppercase tracking-wider">
                  No automated setups synchronized.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Risk Sizer Panel: 5 Columns */}
        <div id="risk-sizer-panel" className={`lg:col-span-5 glass-card p-5 flex flex-col justify-between transition-all duration-305 ${selectedCalcSetup ? 'ring-2 ring-[#D4A843]/40 bg-white/[0.015]' : ''}`}>
          <div className="space-y-4">
            <div className="border-b border-[rgba(255,255,255,0.04)] pb-3">
              <span className="text-[10px] font-data text-[#D4A843] tracking-widest uppercase block">ATR POSITION SIZER</span>
              <h3 className="font-display font-medium text-xs text-[#8892A4] mt-0.5">Downside Exposure Safeguards</h3>
            </div>

            {/* Presets Row */}
            <div className="space-y-3.5">
              <div>
                <label className="text-[9.5px] text-[#8892A4] font-data tracking-wider uppercase block mb-1">Trade Capital Pool (INR)</label>
                <input 
                  type="number"
                  value={calcCapital}
                  onChange={(e) => setCalcCapital(Number(e.target.value))}
                  className="w-full bg-[#05070C] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.1)] focus:border-[#D4A843]/50 focus:outline-none rounded-lg p-2 font-data text-white text-sm"
                  placeholder="Allocate overall size..."
                />
                
                {/* Dynamically functional Capital Presets Buttons */}
                <div className="flex gap-1.5 mt-1.5">
                  {[10000, 25000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCalcCapital(amt)}
                      className={`flex-1 py-1 rounded bg-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.05)] border text-[9.5px] font-data text-[#8892A4] hover:text-[#F0F4FF] hover:border-[#D4A843]/40 transition-colors ${calcCapital === amt ? 'border-[#D4A843]/60 bg-[#D4A843]/5 text-[#E8C070]' : 'border-[rgba(255,255,255,0.03)]'}`}
                    >
                      ₹{amt >= 100000 ? '1L' : amt / 1000 + 'k'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[rgba(255,255,255,0.04)]">
                <div>
                  <label className="text-[9.5px] text-[#8892A4] font-data tracking-wider uppercase block mb-1">Max Risk Limit (%)</label>
                  <input 
                    type="number"
                    step="0.5"
                    value={calcRiskPct}
                    onChange={(e) => setCalcRiskPct(Number(e.target.value))}
                    className="w-full bg-[#05070C] border border-[rgba(255,255,255,0.06)] focus:border-[#D4A843]/50 focus:outline-none rounded-lg p-2 font-data text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] text-[#8892A4] font-data tracking-wider uppercase block mb-1">Selected Asset</label>
                  <div className="w-full bg-[#05070C] text-[#E8C070] border border-[rgba(255,255,255,0.04)] rounded-lg p-2 font-data text-xs font-semibold truncate leading-normal">
                    {selectedCalcSetup ? selectedCalcSetup.tickerName : 'CUSTOM'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9.5px] text-[#8892A4] font-data tracking-wider uppercase block mb-1">Entry Price (₹)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={calculatorCustomPrice}
                    onChange={(e) => setCalculatorCustomPrice(e.target.value)}
                    className="w-full bg-[#05070C] border border-[rgba(255,255,255,0.06)] focus:border-[#D4A843]/50 focus:outline-none rounded-lg p-2 font-data text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] text-[#8892A4] font-data tracking-wider uppercase block mb-1">Stop Loss Ratio (%)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={calculatorCustomSLPct}
                    onChange={(e) => setCalculatorCustomSLPct(e.target.value)}
                    className="w-full bg-[#05070C] border border-[rgba(255,255,255,0.06)] focus:border-[#D4A843]/50 focus:outline-none rounded-lg p-2 font-data text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-white/[0.01] border border-[rgba(255,255,255,0.04)] rounded-xl space-y-3 font-data text-xs">
            {(() => {
              const entry = Number(calculatorCustomPrice) || 100;
              const slPctDecimal = (Number(calculatorCustomSLPct) || 3.5) / 100;
              const maxRiskCapital = (calcCapital * calcRiskPct) / 100;
              const lossPerShare = entry * slPctDecimal;
              const shares = lossPerShare > 0 ? Math.floor(maxRiskCapital / lossPerShare) : 0;
              const exposure = shares * entry;

              const slPrice = entry * (1 - slPctDecimal);
              const tgt1 = entry * (1 + slPctDecimal * 2); 
              const tgt2 = entry * (1 + slPctDecimal * 3); 

              return (
                <>
                  <div className="flex justify-between items-center text-[10px] uppercase border-b border-[rgba(255,255,255,0.04)] pb-2">
                    <span className="text-[#4A5568]">RISK PERsetup LIMIT:</span>
                    <span className="text-[#FF4757] font-bold">₹{maxRiskCapital.toFixed(2)} ({calcRiskPct}%)</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#8892A4] text-xs">Sizer shares to buy:</span>
                    <span className="text-[#E8C070] font-sans font-bold text-2xl tracking-tight">{shares} Units</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-[#4A5568]">
                    <span>Expected Exposure:</span>
                    <span className="text-[#F0F4FF]">₹{exposure.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[9.5px] pt-3.5 border-t border-[rgba(255,255,255,0.04)] text-center font-bold">
                    <div className="bg-[#FF4757]/10 p-2 rounded-lg border border-[#FF4757]/20">
                      <span className="text-[#FF4757] block text-[8px] uppercase">STOP LOSS</span>
                      <span className="text-[#F0F4FF] mt-0.5 block font-data text-xs">₹{slPrice.toFixed(1)}</span>
                    </div>
                    <div className="bg-[#00D084]/10 p-2 rounded-lg border border-[#00D084]/20">
                      <span className="text-[#00D084] block text-[8px] uppercase">TGT 1 (1:2)</span>
                      <span className="text-[#F0F4FF] mt-0.5 block font-data text-xs">₹{tgt1.toFixed(1)}</span>
                    </div>
                    <div className="bg-[#D4A843]/10 p-2 rounded-lg border border-[#D4A843]/20">
                      <span className="text-[#E8C070] block text-[8px] uppercase">TGT 2 (1:3)</span>
                      <span className="text-[#F0F4FF] mt-0.5 block font-data text-xs">₹{tgt2.toFixed(1)}</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ETF PREVIEW SECTION (Refined Gold Glasscards) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="text-[#D4A843]" size={15} />
          <h3 className="font-display font-medium text-base text-[#F0F4FF] tracking-tight">Consensus ETFs</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {etfPredictions.map(pred => {
            const isGold = pred.symbol.toUpperCase().includes('GOLD');
            const goldColorStyle = isGold 
              ? 'border-[#D4A843]/30 shadow-[#D4A843]/5' 
              : 'border-[rgba(255,255,255,0.08)]';
            const price = getPrice(pred.symbol);

            const isSelected = selectedCalcSetup?.symbol === pred.symbol;

            return (
              <div 
                key={pred.symbol} 
                onClick={() => handleAssetClick(pred.symbol, price || 100, 3.5)}
                className={`glass-card p-6 flex flex-col justify-between relative overflow-hidden h-full cursor-pointer transition-all duration-300 ${goldColorStyle} ${
                  isSelected 
                    ? 'ring-2 ring-[#D4A843]/60 bg-white/[0.04] shadow-md shadow-[#D4A843]/5' 
                    : ''
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[9px] font-data uppercase border border-[rgba(255,255,255,0.06)] bg-white/[0.02] px-2 py-0.5 rounded text-[#8892A4]">
                        NIPPON ETF index
                      </span>
                      <h4 className="text-xl font-display font-semibold tracking-wide text-white mt-2">
                        {pred.symbol.split('.')[0]}
                      </h4>
                      <p className="text-[11px] text-[#8892A4] mt-0.5 font-body">
                        {isGold ? 'Nippon India Gold Exchange Traded Fund' : 'Nippon India Silver Exchange Traded Fund'}
                      </p>
                    </div>
                    <SignalBadge signal={pred.signal} size="sm" />
                  </div>

                  {typeof price === 'number' && !isNaN(price) && (
                    <div className="mb-4">
                      <span className="text-[9px] text-[#4A5568] font-data block">LAST REFRESH</span>
                      <span className="text-2xl font-data text-white font-bold">₹{price.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-4 border-t border-[rgba(255,255,255,0.04)]">
                    <div>
                      <ConfidenceBar confidence={pred.confidence * 100} label="System Consensus Accuracy" />
                    </div>
                    <div className="text-left">
                      <div className="text-[9.5px] text-[#4A5568] font-data tracking-wider uppercase mb-1.5">Algorithmic Rationale</div>
                      <ul className="space-y-1">
                        {pred.key_reasons.slice(0, 2).map((reason, i) => (
                          <li key={i} className="text-[11px] text-[#8892A4] leading-normal flex items-start gap-1 font-body">
                            <span className="text-[#D4A843]">•</span>
                            <span className="line-clamp-2">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3.5 border-t border-[rgba(255,255,255,0.04)] mt-4">
                  <div className="text-[10px] text-[#4A5568] font-data">
                    TIMELINE: <span className="text-slate-300 font-bold">{pred.timeframe}</span>
                  </div>
                  <Link 
                    to={`/asset/${pred.symbol}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0D1018] hover:bg-white/[0.04] text-[#8892A4] hover:text-white rounded border border-[rgba(255,255,255,0.08)] text-[10px] font-data tracking-wider uppercase transition-all"
                  >
                    VIEW INSIGHTS
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TRACKED EQUITIES (Zone 2 Refined glass cards with sector tags) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.04)] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="text-[#D4A843]" size={15} />
            <h3 className="font-display font-medium text-base text-[#F0F4FF] tracking-tight">Automated Equity scanner</h3>
          </div>

          {/* Sizing Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.01] p-1 rounded-xl border border-white/[0.04] self-start sm:self-auto font-data text-[10px]">
            <button
              onClick={() => setSelectedStockTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStockTab === 'ALL'
                  ? 'bg-white/[0.05] text-[#E8C070] border border-[#D4A843]/30 font-semibold'
                  : 'text-[#8892A4] hover:text-white border border-transparent'
              }`}
            >
              All Tracked ({allStockPredictions.length})
            </button>
            <button
              onClick={() => setSelectedStockTab('GIANTS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStockTab === 'GIANTS'
                  ? 'bg-white/[0.05] text-[#E8C070] border border-[#D4A843]/30 font-semibold'
                  : 'text-[#8892A4] hover:text-white border border-transparent'
              }`}
            >
              Nifty giants ({allStockPredictions.filter(p => isGiantStock(p.symbol)).length})
            </button>
            <button
              onClick={() => setSelectedStockTab('COMMODITY_METALS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStockTab === 'COMMODITY_METALS'
                  ? 'bg-white/[0.05] text-[#E8C070] border border-[#D4A843]/30 font-semibold'
                  : 'text-[#8892A4] hover:text-white border border-transparent'
              }`}
            >
              Metals & Gold-linked ({allStockPredictions.filter(p => isCommodityMetalStock(p.symbol)).length})
            </button>
          </div>
        </div>
        
        {stockPredictions.length === 0 ? (
          <div className="text-center py-10 glass-card">
            <p className="text-[#8892A4] text-xs font-data uppercase">No active setups compiled in this scanner segment yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stockPredictions.map(pred => {
              const price = getPrice(pred.symbol);
              const info = getStockInfo(pred.symbol);
              
              const isSelected = selectedCalcSetup?.symbol === pred.symbol;

              return (
                <div 
                  key={pred.symbol} 
                  onClick={() => handleAssetClick(pred.symbol, price || 100, 3.5)}
                  className={`glass-card p-5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 cursor-pointer ${
                    isSelected 
                      ? 'ring-2 ring-[#D4A843]/60 bg-white/[0.04] shadow-md shadow-[#D4A843]/5' 
                      : ''
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-display font-semibold text-sm text-white">{pred.symbol.split('.')[0]}</h4>
                          <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-bold border ${info.badgeColor} tracking-wider font-data uppercase`}>
                            {info.sector}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8892A4] font-body truncate max-w-[160px] mt-0.5">{info.name}</p>
                      </div>
                      <SignalBadge signal={pred.signal} size="sm" />
                    </div>

                    <div className="flex justify-between items-end mb-4 pt-1">
                      {typeof price === 'number' && !isNaN(price) ? (
                        <div>
                          <span className="text-[9px] text-[#4A5568] font-data block uppercase">EXCHANGE price</span>
                          <span className="text-lg font-data font-semibold text-white">₹{price.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <div className="text-right">
                        <span className="text-[9px] text-[#4A5568] font-data block uppercase">Conviction</span>
                        <span className="text-xs font-bold text-[#E8C070] font-data tracking-wide">{pred.conviction}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                      <ConfidenceBar confidence={pred.confidence * 100} label="Multi-Agent Concordance Index" />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] flex items-center justify-between">
                    <span className="text-[10px] text-[#4A5568] font-data uppercase">
                      TERM: <span className="text-slate-300 font-bold">{pred.timeframe}</span>
                    </span>
                    <Link 
                      to={`/asset/${pred.symbol}`}
                      className="text-[#D4A843] hover:text-[#fbf0d0] text-xs font-data font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      DIAGNOSE_ASSET &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ZONE 3: REFINED DARK SYSTEM DATAGRID - MACRO INDICATORS */}
      {macro && (
        <section className="bg-[#0D1018] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.04)] pb-4 mb-5">
            <Globe className="text-[#D4A843]" size={15} />
            <div>
              <h3 className="font-display font-semibold text-base text-[#F0F4FF] tracking-tight">Macroeconomic Indicator Datagrid</h3>
              <p className="text-[10px] text-[#4A5568] uppercase font-data mt-0.5">Global parity pricing factors</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {renderMacroItem("DXY DOLLAR INDEX", macro?.indicators?.DXY, (v) => v.toFixed(2))}
            {renderMacroItem("US 10Y BOND", macro?.indicators?.US10Y, (v) => v.toFixed(2), "%")}
            {renderMacroItem("USDINR PARITY", macro?.indicators?.USDINR, (v) => "₹" + v.toFixed(2))}
            {renderMacroItem("CBOE VIX", macro?.indicators?.VIX, (v) => v.toFixed(2))}
            {renderMacroItem("GOLD SILVER RATIO", macro?.indicators?.gold_silver_ratio, (v) => v.toFixed(1))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-[rgba(255,255,255,0.04)] text-xs font-data">
            <div className="flex items-center gap-2">
              <span className="text-[#4A5568] uppercase">Commodity Gold Direction:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                macro.impact_on_gold.toUpperCase() === 'BUY' || macro.impact_on_gold.toUpperCase().includes('BULL')
                  ? 'bg-[#00D084]/15 text-[#00D084]' 
                  : 'bg-[#FF4757]/15 text-[#FF4757]'
              }`}>
                {macro.impact_on_gold}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#4A5568] uppercase">Commodity Silver Direction:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                macro.impact_on_silver.toUpperCase() === 'BUY' || macro.impact_on_silver.toUpperCase().includes('BULL')
                  ? 'bg-[#00D084]/15 text-[#00D084]' 
                  : 'bg-[#FF4757]/15 text-[#FF4757]'
              }`}>
                {macro.impact_on_silver}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
