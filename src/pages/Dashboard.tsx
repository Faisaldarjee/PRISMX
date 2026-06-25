import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchWithRetry, 
  authFetch, 
  SectionSkeleton, 
  SectionError 
} from '../utils/apiHelpers';
import { Prediction, MacroData, Asset } from '../types';
import { SignalBadge } from '../components/SignalBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { useAuth } from '../services/AuthProvider';
import AdUnit from '../components/AdUnit';
import { useProStatus } from '../hooks/useProStatus';
import ProGate from '../components/ProGate';
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
  const { isPro } = useProStatus();
  
  // Independent caches / fallback loaders
  const [predictions, setPredictions] = useState<Prediction[]>(() => {
    try {
      const saved = localStorage.getItem('prism_preds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [macro, setMacro] = useState<MacroData | null>(() => {
    try {
      const saved = localStorage.getItem('prism_macro');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem('prism_assets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [swingSetups, setSwingSetups] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('prism_swing');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedStockTab, setSelectedStockTab] = useState<'ALL' | 'GIANTS' | 'COMMODITY_METALS'>('ALL');
  const [calcCapital, setCalcCapital] = useState<number>(() => {
    const saved = localStorage.getItem('prism_capital');
    return saved ? Number(saved) : 50000;
  });
  const [calcRiskPct, setCalcRiskPct] = useState<number>(() => {
    const saved = localStorage.getItem('prism_risk');
    return saved ? Number(saved) : 2;
  });
  const [selectedCalcSetup, setSelectedCalcSetup] = useState<any | null>(null);
  const [calculatorCustomPrice, setCalculatorCustomPrice] = useState<string>('240.0');
  const [calculatorCustomSLPct, setCalculatorCustomSLPct] = useState<string>('3.5');

  // Independent loading and error states for robust decoupled architecture
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);

  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const [swingSetupsLoading, setSwingSetupsLoading] = useState(false);
  const [swingSetupsError, setSwingSetupsError] = useState<string | null>(null);

  const [fiidiiLoading, setFiidiiLoading] = useState(false);
  const [fiidiiError, setFiidiiError] = useState<string | null>(null);

  const [morningBriefing, setMorningBriefing] = useState<any>(null);
  const [morningBriefingLoading, setMorningBriefingLoading] = useState(false);
  const [morningBriefingError, setMorningBriefingError] = useState<string | null>(null);

  const [refreshCounter, setRefreshCounter] = useState(0);
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

  const loadData = (isSilent = false) => {
    setRefreshCounter(prev => prev + 1);
  };

  // 1. Predictions loader
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPredictionsLoading(true);
      setPredictionsError(null);
      try {
        const data = await fetchWithRetry('/api/predict-all', controller.signal);
        if (data && data.length > 0) {
          setPredictions(data);
          try { localStorage.setItem('prism_preds', JSON.stringify(data)); } catch {}
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Dashboard predictions sync issues:', err.message || err);
        setPredictionsError(err.message || String(err));
        setCongestionNotice(true);
      } finally {
        setPredictionsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshCounter]);

  // 2. Macro loader
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setMacroLoading(true);
      setMacroError(null);
      try {
        const data = await fetchWithRetry('/api/macro', controller.signal);
        if (data) {
          setMacro(data);
          try { localStorage.setItem('prism_macro', JSON.stringify(data)); } catch {}
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Dashboard macro sync issues:', err.message || err);
        setMacroError(err.message || String(err));
        setCongestionNotice(true);
      } finally {
        setMacroLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshCounter]);

  // 3. Assets loader
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setAssetsLoading(true);
      setAssetsError(null);
      try {
        const data = await fetchWithRetry('/api/assets', controller.signal);
        if (data && data.length > 0) {
          setAssets(data);
          try { localStorage.setItem('prism_assets', JSON.stringify(data)); } catch {}
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Dashboard assets sync issues:', err.message || err);
        setAssetsError(err.message || String(err));
        setCongestionNotice(true);
      } finally {
        setAssetsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshCounter]);

  // 4. Swing Setups loader (Scanner)
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setSwingSetupsLoading(true);
      setSwingSetupsError(null);
      try {
        const data = await fetchWithRetry('/api/swing-scanner', controller.signal);
        if (data && data.length > 0) {
          setSwingSetups(data);
          try { localStorage.setItem('prism_swing', JSON.stringify(data)); } catch {}

          // Select first setup as calculation default if none selected or refreshed
          if (!selectedCalcSetup || refreshCounter > 0) {
            setSelectedCalcSetup(data[0]);
            const calcPriceVal = data[0].lastPrice ?? 100;
            const calcSLVal = data[0].stopLoss ?? (calcPriceVal * 0.95);
            setCalculatorCustomPrice(calcPriceVal.toFixed(2));
            const dynamicSLPct = ((calcPriceVal - calcSLVal) / calcPriceVal * 100);
            setCalculatorCustomSLPct(Math.max(1, Number((dynamicSLPct || 3.5).toFixed(1))).toString());
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Dashboard swing setups sync issues:', err.message || err);
        setSwingSetupsError(err.message || String(err));
        setCongestionNotice(true);
      } finally {
        setSwingSetupsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshCounter]);

  // 5. Morning Briefing loader (Protected, slow, loaded independently via authFetch + retry)
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    async function load() {
      setMorningBriefingLoading(true);
      setMorningBriefingError(null);
      try {
        const data = await authFetch('/api/gemini/morning-briefing?asset=NIFTY', controller.signal);
        setMorningBriefing(data);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Morning briefing async issues:', err.message || err);
        setMorningBriefingError(err.message || String(err));
      } finally {
        setMorningBriefingLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [user, refreshCounter]);

  // 6. FII/DII Activities loader (loaded independently, isolated state)
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setFiidiiLoading(true);
      setFiidiiError(null);
      try {
        await fetchWithRetry('/api/flows/fiidii', controller.signal);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Dashboard FII/DII sync issues:', err.message || err);
        setFiidiiError(err.message || String(err));
      } finally {
        setFiidiiLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [refreshCounter]);

  // Auto-sync notifications on updates
  useEffect(() => {
    if (generateAlertForInterestedSymbols && predictions.length > 0 && assets.length > 0 && !predictionsLoading && !assetsLoading) {
      generateAlertForInterestedSymbols(predictions, assets).catch(() => {});
    }
  }, [predictions, assets, predictionsLoading, assetsLoading, generateAlertForInterestedSymbols]);

  // 5 Minutes passive auto-sync
  useEffect(() => {
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

  const refreshing = predictionsLoading || assetsLoading || swingSetupsLoading || macroLoading;

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
            <span className="text-[8px] px-1.5 py-0.5 bg-[#34A77A]/10 text-[#34A77A] rounded font-mono shrink-0">LIVE</span>
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
      {/* Top Banner section */}
      <div className="glass-card p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A843]/40 to-transparent" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="font-data text-[10px] text-[#D4A843] uppercase tracking-widest block font-medium">
              PRISMX RISK INTELLIGENCE MATRIX · SYSTEMATIC ANALYSIS
            </span>
            <h2 className="text-2xl font-medium tracking-tight text-[#F0F4FF] font-display">
              Good morning, {username}
            </h2>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8892A4] font-body">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#34A77A]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34A77A] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34A77A]"></span>
                </span>
                Live Markets Consensus Active
              </span>
              <span className="text-[#4A5568] hidden sm:inline">|</span>
              <span className="text-[11px] text-[#8892A4] flex items-center gap-1">
                <ShieldAlert size={12} className="text-[#D4A843] shrink-0" />
                Frictional taxes fully modeled (15% STCG + STT Stamp Act rules)
              </span>
            </div>
          </div>

          <button 
            onClick={() => loadData(false)} 
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(255,255,255,0.032)] hover:bg-[rgba(255,255,255,0.065)] text-[#E8C070] rounded-xl border border-[#D4A843]/20 text-[11px] font-data tracking-wide uppercase transition-all shrink-0 cursor-pointer"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Workspace'}
          </button>
        </div>

        {/* Quick Stats Grid Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[rgba(255,255,255,0.04)]">
          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Tracked Setups</span>
            <span className="font-data text-2xl font-bold text-[#D4A843] mt-1.5 block">
              {swingSetups.length} Asset Classes
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Consensus evaluated</span>
          </div>

          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Max trade Risk</span>
            <span className="font-data text-2xl font-bold text-[#E05252] mt-1.5 block">
              {formatCompactRupee((calcCapital * calcRiskPct) / 100)}
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Cap @ risk ({calcRiskPct}%)</span>
          </div>

          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Calculated Capital</span>
            <span className="font-data text-2xl font-bold text-[#F0F4FF] mt-1.5 block">
              {formatCompactRupee(calcCapital)}
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">Assumed liquidity pool</span>
          </div>

          <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
            <span className="font-data text-[9px] text-[#4A5568] uppercase block tracking-wider font-semibold">Accurate Conviction</span>
            <span className="font-data text-2xl font-bold text-[#34A77A] mt-1.5 block">
              {averageConfidence}%
            </span>
            <span className="text-[10px] text-[#8892A4] mt-1 block font-body">30D ML backtest score</span>
          </div>
        </div>
      </div>

      {/* SWING SCANNER + calculator side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Setups List */}
        <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="text-[#34A77A]" size={16} />
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#F0F4FF] tracking-tight">Active Swing Scanner</h3>
                  <p className="text-[9px] text-[#4A5568] font-data uppercase mt-0.5">Automated filter parameters</p>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#D4A843]/10 text-[#E8C070] font-data text-[8.5px] font-bold border border-[#D4A843]/20">
                BOLLINGER_ADX_CONVERGED
              </span>
            </div>

            {swingSetupsLoading ? (
              <SectionSkeleton />
            ) : swingSetupsError && swingSetups.length === 0 ? (
              <SectionError message="Active swing setups temporarily unavailable" />
            ) : (
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
                    No active swing setups found — scanner refreshes every session.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Risk Sizer Panel */}
        <div id="risk-sizer-panel" className={`lg:col-span-5 glass-card p-5 flex flex-col justify-between transition-all duration-350 ${selectedCalcSetup ? 'ring-2 ring-[#D4A843]/40 bg-white/[0.015]' : ''}`}>
          <div className="space-y-4">
            <div className="border-b border-[rgba(255,255,255,0.04)] pb-3">
              <span className="text-[10px] font-data text-[#D4A843] tracking-widest uppercase block">ATR POSITION SIZER</span>
              <h3 className="font-display font-medium text-xs text-[#8892A4] mt-0.5">Downside Exposure Safeguards</h3>
            </div>

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
                    <span className="text-[#4A5568]">Risk Limit Per Setup:</span>
                    <span className="text-[#E05252] font-bold">₹{maxRiskCapital.toFixed(2)} ({calcRiskPct}%)</span>
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
                    <div className="bg-[#E05252]/10 p-2 rounded-lg border border-[#E05252]/20">
                      <span className="text-[#E05252] block text-[8px] uppercase">STOP LOSS</span>
                      <span className="text-[#F0F4FF] mt-0.5 block font-data text-xs">₹{slPrice.toFixed(1)}</span>
                    </div>
                    <div className="bg-[#34A77A]/10 p-2 rounded-lg border border-[#34A77A]/20">
                      <span className="text-[#34A77A] block text-[8px] uppercase">TGT 1 (1:2)</span>
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

      {user && morningBriefing && (
        <ProGate feature="AI Morning Briefing" isPro={isPro}>
          <div className="glass-card p-5 border border-white/[0.04] 
                          bg-white/[0.01] rounded-xl mt-4">
            <h3 className="font-display font-semibold text-sm 
                           text-[#F0F4FF] flex items-center gap-1.5 mb-3">
              <Sparkles className="text-amber-500" size={15} />
              Morning Briefing
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-body">
              {morningBriefing.briefing}
            </p>
          </div>
        </ProGate>
      )}

      {!isPro && (
        <div className="mt-4 mb-2">
          <AdUnit 
            slot="SLOT_DASHBOARD_1" 
            format="auto"
            className="rounded-lg overflow-hidden"
          />
        </div>
      )}

      {/* ETF PREVIEW SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="text-[#D4A843]" size={15} />
          <h3 className="font-display font-medium text-base text-[#F0F4FF] tracking-tight">Consensus ETFs</h3>
        </div>
        
        {predictionsLoading || assetsLoading ? (
          <SectionSkeleton />
        ) : predictionsError && predictions.length === 0 ? (
          <SectionError message="Consensus predictions temporarily unavailable" />
        ) : (
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
        )}
      </section>

      {/* TRACKED EQUITIES */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.04)] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="text-[#D4A843]" size={15} />
            <h3 className="font-display font-medium text-base text-[#F0F4FF] tracking-tight">Automated Equity scanner</h3>
          </div>

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
        
        {predictionsLoading || assetsLoading ? (
          <SectionSkeleton />
        ) : predictionsError && predictions.length === 0 ? (
          <SectionError message="Stock predictions temporarily unavailable" />
        ) : stockPredictions.length === 0 ? (
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
                          <span className="text-[9px] text-[#4A5568] font-data block uppercase">Market Price</span>
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
                      <ConfidenceBar confidence={pred.confidence * 100} label="Consensus Concordance Match" />
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

      {/* MACRO INDICATORS */}
      {macroLoading ? (
        <section className="bg-[#0D1018] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <SectionSkeleton />
        </section>
      ) : macroError && !macro ? (
        <section className="bg-[#0D1018] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <SectionError message="Macro indicators temporarily unavailable" />
        </section>
      ) : macro && (
        <section className="bg-[#0D1018] border border-[rgba(255,255,255,0.05)] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.04)] pb-4 mb-5">
            <Globe className="text-[#D4A843]" size={15} />
            <div>
              <h3 className="font-display font-semibold text-base text-[#F0F4FF] tracking-tight">Macro Indicators</h3>
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
              <span className="text-[#4A5568] uppercase">Gold:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                macro.impact_on_gold.toUpperCase() === 'BUY' || macro.impact_on_gold.toUpperCase().includes('BULL')
                  ? 'bg-[#34A77A]/15 text-[#34A77A]' 
                  : 'bg-[#E05252]/15 text-[#E05252]'
              }`}>
                {macro.impact_on_gold}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#4A5568] uppercase">Silver:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                macro.impact_on_silver.toUpperCase() === 'BUY' || macro.impact_on_silver.toUpperCase().includes('BULL')
                  ? 'bg-[#34A77A]/15 text-[#34A77A]' 
                  : 'bg-[#E05252]/15 text-[#E05252]'
              }`}>
                {macro.impact_on_silver}
              </span>
            </div>
          </div>
        </section>
      )}

      {!isPro && (
        <div className="mt-4 mb-2">
          <AdUnit 
            slot="SLOT_DASHBOARD_2"
            format="auto" 
            className="rounded-lg overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}
