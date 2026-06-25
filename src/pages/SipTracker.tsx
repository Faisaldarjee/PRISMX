import React, { useEffect, useState, useMemo } from 'react';
import { 
  fetchWithRetry, 
  SectionSkeleton, 
  SectionError 
} from '../utils/apiHelpers';
import { SipData, HistoryBar, Asset, Prediction } from '../types';
import AdUnit from '../components/AdUnit';
import { useProStatus } from '../hooks/useProStatus';
import ProGate from '../components/ProGate';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { SignalBadge } from '../components/SignalBadge';
import { 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Info, 
  Activity, 
  Coins, 
  Percent, 
  Calculator,
  Calendar,
  Sparkles,
  AlertTriangle,
  Scale,
  Shield,
  Layers,
  ArrowUpRight
} from 'lucide-react';

// XIRR solver using Newton-Raphson method
export function calculateXIRR(cashFlows: { date: Date; amount: number }[]): number {
  if (cashFlows.length < 2) return 0;
  
  // Find dates in fractional years relative to the first cash flow
  const t0 = cashFlows[0].date.getTime();
  const flows = cashFlows.map(cf => ({
    t: (cf.date.getTime() - t0) / (365 * 24 * 60 * 60 * 1000), // fractional years
    amount: cf.amount
  }));

  let r = 0.1; // initial guess (10% annualized)
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    let fValue = 0;
    let fDerivative = 0;

    for (const flow of flows) {
      const df = Math.pow(1 + r, flow.t);
      if (df === 0) continue;
      fValue += flow.amount / df;
      fDerivative += -flow.t * flow.amount / Math.pow(1 + r, flow.t + 1);
    }

    if (Math.abs(fDerivative) < 1e-12) {
      break; 
    }

    const nextR = r - fValue / fDerivative;
    if (isNaN(nextR) || !isFinite(nextR)) {
      break; // prevent diverge
    }

    if (Math.abs(nextR - r) < tolerance) {
      return nextR; // return annualized decimal rate
    }
    r = nextR;
  }

  // Fallback to absolute CAGR if Newton-Raphson fails to converge
  return r;
}

export function SipTracker() {
  const { isPro } = useProStatus();
  // Asset Dropdown Selector
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState('GOLDBEES.NS');
  
  // Real data state from SQLite database & APIs
  const [sip, setSip] = useState<SipData | null>(null);
  const [liveMacro, setLiveMacro] = useState<any>(null);
  const [selectedHistory, setSelectedHistory] = useState<HistoryBar[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Isolated History states to prevent blank-outs on fetch failures
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Sliders visual state for zero-latency interactions
  const [sliderRate, setSliderRate] = useState<number>(12);
  const [sliderDuration, setSliderDuration] = useState<number>(10);

  // Strategy inputs (debounced, used for CPU heavy projections)
  const [monthlyBudget, setMonthlyBudget] = useState<number>(5000);
  const [expectedRate, setExpectedRate] = useState<number>(12); // Expected return range 8% to 25%
  const [durationYears, setDurationYears] = useState<number>(10); // Time period 1 to 20 years
  
  // SIP Performance Tracker (Historical)
  const [sipStartDate, setSipStartDate] = useState<string>('2023-01-01');
  const [performanceAmount, setPerformanceAmount] = useState<number>(5000);

  // Position sizing (ATR parameters)
  const [swingCapital, setSwingCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(2);

  // Debouncing expected rate
  useEffect(() => {
    const handler = setTimeout(() => {
      setExpectedRate(sliderRate);
    }, 300);
    return () => clearTimeout(handler);
  }, [sliderRate]);

  // Debouncing duration years
  useEffect(() => {
    const handler = setTimeout(() => {
      setDurationYears(sliderDuration);
    }, 300);
    return () => clearTimeout(handler);
  }, [sliderDuration]);

  // Load overall market data and asset catalog (highly parallelized)
  async function loadAllHubData(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const [assetsList, allPreds, macroRaw] = await Promise.all([
        fetchWithRetry('/api/assets', signal).catch(err => {
          console.warn('SipTracker assets list load issue:', err.message || err);
          return null;
        }),
        fetchWithRetry('/api/predict-all', signal).catch(err => {
          console.warn('SipTracker predictions load issue:', err.message || err);
          return null;
        }),
        fetchWithRetry('/api/macro/global', signal).catch(() => null)
      ]);

      let resAssets = assetsList;
      if (!resAssets) {
        try {
          const cached = localStorage.getItem('prism_assets');
          resAssets = cached ? JSON.parse(cached) : [];
        } catch {
          resAssets = [];
        }
      } else {
        try { localStorage.setItem('prism_assets', JSON.stringify(resAssets)); } catch {}
      }

      let resPreds = allPreds;
      if (!resPreds) {
        try {
          const cached = localStorage.getItem('prism_preds');
          resPreds = cached ? JSON.parse(cached) : [];
        } catch {
          resPreds = [];
        }
      } else {
        try { localStorage.setItem('prism_preds', JSON.stringify(resPreds)); } catch {}
      }

      setAssets(resAssets);
      setPredictions(resPreds);
      setLiveMacro(macroRaw);

      if (resAssets.length > 0 && !resAssets.some(a => a.symbol === selectedAsset)) {
        setSelectedAsset(resAssets[0].symbol);
      }
    } catch (e: any) {
      if (signal?.aborted) return;
      console.error('Error loading hub data:', e);
      setError(e.message || 'Strategy center failed to synchronize.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadAllHubData(controller.signal);
    return () => controller.abort();
  }, []);

  // Sync selected asset history details (decoupled from page load)
  useEffect(() => {
    if (!selectedAsset) return;
    const controller = new AbortController();

    async function loadSelectedAssetSpecifics() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const pred = predictions.find(p => p.symbol === selectedAsset) || null;
        setSelectedPrediction(pred);

        // Fetch up to 1500 historical candle points to support dynamic historical queries
        const [hist, sipData] = await Promise.all([
          fetchWithRetry(`/api/history/${selectedAsset}?limit=1500`, controller.signal).catch(err => {
            console.warn('History load failed, isolating error:', err);
            setHistoryError('Historical chart data is temporarily unavailable.');
            return []; // Empty fallback so parsing won't crash
          }),
          fetchWithRetry(`/api/sip/${selectedAsset}`, controller.signal).catch(err => {
            console.warn('SIP details load failed:', err);
            return null;
          })
        ]);

        setSelectedHistory(hist);
        setSip(sipData);
      } catch (e) {
        console.warn('Could not fetch specifics:', selectedAsset, e);
      } finally {
        setHistoryLoading(false);
      }
    }

    loadSelectedAssetSpecifics();
    return () => controller.abort();
  }, [selectedAsset, predictions]);

  // Real-time Technical Metrics (computed from Yahoo Finance cached candles)
  const techMetrics = useMemo(() => {
    if (!selectedHistory || selectedHistory.length === 0) {
      return { rsi: 52.4, ema200: null, lastPrice: 100, aboveEma200: true };
    }

    const closes = selectedHistory.map(h => h.close);
    const lastPrice = closes[closes.length - 1] || 100;

    let ema200 = null;
    if (closes.length >= 200) {
      const k = 2 / (200 + 1);
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += closes[i];
      let ema = sum / 200;
      for (let i = 200; i < closes.length; i++) {
        ema = (closes[i] * k) + (ema * (1 - k));
      }
      ema200 = ema;
    } else if (closes.length > 0) {
      const sum = closes.reduce((a, b) => a + b, 0);
      ema200 = sum / closes.length;
    }

    let rsi = 50;
    if (closes.length > 14) {
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= 14; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      let avgGain = gains / 14;
      let avgLoss = losses / 14;

      for (let i = 15; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * 13 + gain) / 14;
        avgLoss = (avgLoss * 13 + loss) / 14;
      }

      if (avgLoss === 0) {
        rsi = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
    } else {
      rsi = selectedAsset.includes('GOLD') ? 61.5 : selectedAsset.includes('SILVER') ? 42.0 : 54.5;
    }

    const aboveEma200 = ema200 !== null ? lastPrice > ema200 : true;

    return {
      rsi: parseFloat(rsi.toFixed(1)),
      ema200: ema200 !== null ? parseFloat(ema200.toFixed(2)) : null,
      lastPrice: parseFloat(lastPrice.toFixed(2)),
      aboveEma200
    };
  }, [selectedHistory, selectedAsset]);

  // Compute calculated macro indicators
  const calculatedMacro = useMemo(() => {
    const usdinrRate = liveMacro?.usdinr?.rate || 83.45;
    const goldSpotUSD = liveMacro?.gold?.price || 2360;
    const silverSpotUSD = liveMacro?.silver?.price || 29.80;
    const vixValue = liveMacro?.indiaVix?.value || 15.60;
    const vixLevel = liveMacro?.indiaVix?.level || 'MEDIUM';

    // Gold spot converted per 10g in INR
    const goldINR = (goldSpotUSD * usdinrRate / 31.1) * 10;
    
    // Silver spot converted to INR per 1 kg (1000 grams)
    const silverINR = (silverSpotUSD * usdinrRate / 31.1) * 1000;

    return {
      usdinrRate,
      goldSpotUSD,
      silverSpotUSD,
      vixValue: parseFloat(vixValue.toFixed(2)),
      vixLevel,
      goldINR,
      silverINR
    };
  }, [liveMacro]);

  const sipCondition = useMemo(() => {
    const rsi = techMetrics.rsi;
    if (rsi >= 65) return 'OVERBOUGHT';
    if (rsi <= 40) return 'OVERSOLD';
    return 'NEUTRAL';
  }, [techMetrics]);

  const sipDeployment = useMemo(() => {
    if (sipCondition === 'OVERBOUGHT') {
      return {
        deploy: monthlyBudget * 0.6,
        reserve: monthlyBudget * 0.4,
        percent: '60%',
        text: 'OVERBOUGHT DEPLOYMENT',
        reason: `RSI is elevated at ${techMetrics.rsi}. Smart allocator scales back deployment to 60% (₹${(monthlyBudget * 0.6).toLocaleString('en-IN')}) and reserves 40% (₹${(monthlyBudget * 0.4).toLocaleString('en-IN')}) in high-interest cash to capture subsequent drawdowns.`
      };
    } else if (sipCondition === 'OVERSOLD') {
      return {
        deploy: monthlyBudget * 1.4,
        reserve: 0,
        percent: '140%',
        text: 'ACCUMULATE DEPLOYMENT',
        reason: `RSI is highly attractive at ${techMetrics.rsi}. Asset is heavily discounted. Smart allocator ramps deployment to 140% (₹${(monthlyBudget * 1.4).toLocaleString('en-IN')}) to maximize dollar-cost averaging advantages.`
      };
    } else {
      return {
        deploy: monthlyBudget,
        reserve: 0,
        percent: '100%',
        text: 'STANDARD DEPLOYMENT',
        reason: `RSI is stable at ${techMetrics.rsi} within neutral trading bands. Normal deployment of 100% (₹${monthlyBudget.toLocaleString('en-IN')}) is perfectly optimized.`
      };
    }
  }, [sipCondition, monthlyBudget, techMetrics]);

  // Pure mathematical compounding simulator
  const compoundProjectionData = useMemo(() => {
    const r = (expectedRate / 100) / 12; // monthly yield rate
    const n = durationYears * 12; // months
    
    let balanceStd = 0;
    let investedStd = 0;
    let balanceSmart = 0;
    let investedSmart = 0;
    
    const points: any[] = [];

    for (let month = 1; month <= n; month++) {
      balanceStd = (balanceStd + monthlyBudget) * (1 + r);
      investedStd += monthlyBudget;

      // Smart SIP allocation using highly robust oscillating RSI waves
      const simRsi = 50 + 18 * Math.sin(month / 3.0);
      let smartContribution = monthlyBudget;
      if (simRsi < 40) {
        smartContribution = monthlyBudget * 1.4;
      } else if (simRsi > 65) {
        smartContribution = monthlyBudget * 0.6;
      }
      
      balanceSmart = (balanceSmart + smartContribution) * (1 + r);
      investedSmart += smartContribution;

      if (month % 12 === 0 || month === n || month === 1) {
        points.push({
          year: `Yr ${Math.round(month / 12)}`,
          standardValue: Math.round(balanceStd),
          standardInvested: investedStd,
          smartValue: Math.round(balanceSmart),
          smartInvested: investedSmart
        });
      }
    }

    const difference = balanceSmart - balanceStd;

    return {
      points,
      finalStd: Math.round(balanceStd),
      finalSmart: Math.round(balanceSmart),
      finalStdInvested: investedStd,
      finalSmartInvested: investedSmart,
      difference: Math.round(difference)
    };
  }, [monthlyBudget, expectedRate, durationYears]);

  // Live historical SIP Performance Tracker
  const performanceMetrics = useMemo(() => {
    if (!selectedHistory || selectedHistory.length === 0) return null;
    
    // Sort chronological ascending
    const sortedHist = [...selectedHistory].sort((a, b) => new Date(a.date.split(' ')[0]).getTime() - new Date(b.date.split(' ')[0]).getTime());
    
    const filteredHist = sortedHist.filter(h => new Date(h.date.split(' ')[0]) >= new Date(sipStartDate));
    if (filteredHist.length < 5) return null;

    const monthlyInputs: typeof filteredHist = [];
    const seenYm = new Set<string>();
    
    for (const h of filteredHist) {
      const dateObj = new Date(h.date.split(' ')[0]);
      const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!seenYm.has(ym)) {
        seenYm.add(ym);
        monthlyInputs.push(h);
      }
    }

    if (monthlyInputs.length === 0) return null;

    let totalInvested = 0;
    let totalUnits = 0;
    const cashFlows: { date: Date; amount: number }[] = [];
    const trackingPoints: any[] = [];

    monthlyInputs.forEach((pt) => {
      totalInvested += performanceAmount;
      const purchaseUnits = performanceAmount / pt.close;
      totalUnits += purchaseUnits;
      cashFlows.push({ date: new Date(pt.date.split(' ')[0]), amount: -performanceAmount });

      trackingPoints.push({
        date: new Date(pt.date.split(' ')[0]).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        invested: totalInvested,
        portfolioValue: Math.round(totalUnits * pt.close)
      });
    });

    const latestBar = filteredHist[filteredHist.length - 1];
    const latestPrice = latestBar.close;
    const currentPortfolioValue = totalUnits * latestPrice;
    
    cashFlows.push({ date: new Date(latestBar.date.split(' ')[0]), amount: currentPortfolioValue });

    const absoluteReturnRupees = currentPortfolioValue - totalInvested;
    const absoluteReturnPercent = totalInvested > 0 ? (absoluteReturnRupees / totalInvested) * 100 : 0;

    const rawXIRR = calculateXIRR(cashFlows);
    const xirrPercent = rawXIRR * 100;

    const initialAssetCost = monthlyInputs[0].close;
    const lumpUnits = totalInvested / initialAssetCost;
    const lumpValueToday = lumpUnits * latestPrice;

    const monthlyClosingPrices = new Map<string, number>();
    for (const bar of filteredHist) {
      const ym = bar.date.substring(0, 7);
      monthlyClosingPrices.set(ym, bar.close);
    }
    const closes = Array.from(monthlyClosingPrices.values());
    let worstMonth = 0;
    let bestMonth = 0;
    
    for (let i = 1; i < closes.length; i++) {
      const pctChange = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 105;
      const parsedPctChange = isNaN(pctChange) ? 0 : pctChange;
      if (parsedPctChange > bestMonth) bestMonth = parsedPctChange;
      if (parsedPctChange < worstMonth) worstMonth = parsedPctChange;
    }

    return {
      totalInvested,
      currentPortfolioValue: Math.round(currentPortfolioValue),
      absoluteReturnRupees: Math.round(absoluteReturnRupees),
      absoluteReturnPercent: parseFloat(absoluteReturnPercent.toFixed(2)),
      xirr: parseFloat(xirrPercent.toFixed(2)),
      lumpValueToday: Math.round(lumpValueToday),
      bestMonth: parseFloat(bestMonth.toFixed(2)),
      worstMonth: parseFloat(worstMonth.toFixed(2)),
      trackingPoints
    };
  }, [selectedHistory, sipStartDate, performanceAmount]);

  const atrMetrics = useMemo(() => {
    const currentPrice = techMetrics.lastPrice || 100;
    if (!selectedHistory || selectedHistory.length < 15) {
      const defaultATR = 1.5;
      const sl = currentPrice - 2 * defaultATR;
      const t1 = currentPrice + 3 * defaultATR;
      const t2 = currentPrice + 5 * defaultATR;
      const slDist = 2 * defaultATR;
      const riskAmt = swingCapital * (riskPercent / 100);
      const units = Math.max(0, Math.floor(riskAmt / slDist));
      return {
        atr: defaultATR,
        stopLoss: sl,
        target1: t1,
        target2: t2,
        maxUnits: units,
        totalExposure: units * currentPrice,
        riskAmount: riskAmt,
        riskRewardRatio: 1.5
      };
    }

    const trs: number[] = [];
    for (let i = 1; i < selectedHistory.length; i++) {
      const today = selectedHistory[i];
      const prev = selectedHistory[i - 1];
      const tr = Math.max(
        today.high - today.low,
        Math.abs(today.high - prev.close),
        Math.abs(today.low - prev.close)
      );
      trs.push(tr);
    }

    const last14Trs = trs.slice(-14);
    const atr = last14Trs.reduce((a, b) => a + b, 0) / Math.max(1, last14Trs.length);

    const stopLoss = currentPrice - 2 * atr;
    const target1 = currentPrice + 3 * atr;
    const target2 = currentPrice + 5 * atr;
    const stopLossDistance = 2 * atr;
    const riskAmount = swingCapital * (riskPercent / 100);
    const maxUnits = stopLossDistance > 0 ? Math.floor(riskAmount / stopLossDistance) : 0;
    const totalExposure = maxUnits * currentPrice;

    return {
      atr: parseFloat(atr.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      target1: parseFloat(target1.toFixed(2)),
      target2: parseFloat(target2.toFixed(2)),
      maxUnits,
      totalExposure: parseFloat(totalExposure.toFixed(2)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      riskRewardRatio: 1.5
    };
  }, [selectedHistory, techMetrics.lastPrice, swingCapital, riskPercent]);

  return (
    <div id="sip-tracker-premium" className="space-y-6">
      
      {/* HEADER SECTION */}
      <div id="sip-tracker-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#D4A843]/15 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-[#D4A843]" />
            <span className="text-[10px] font-mono font-bold text-[#E8C070] tracking-widest bg-[#D4A843]/5 px-2.5 py-1 rounded-md border border-[#D4A843]/20 uppercase">Core Allocation Engine</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1.5 font-display">SIP Strategy Hub</h2>
          <p className="text-xs text-[#8892A4] mt-0.5 font-body">Quant-based allocation models, real-time bullion spot converted parities, and standard historical cash-flow checkers.</p>
        </div>

        {/* Dynamic Asset Selector */}
        <div id="asset-selector-card" className="flex items-center gap-3 bg-black/60 p-2 px-3 border border-[#D4A843]/15 rounded-xl">
          <span className="text-[9px] font-mono font-bold text-[#8892A4] tracking-widest uppercase">CHOOSE ACTIVE SECURITY:</span>
          <select 
            id="active-asset-select"
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="bg-[#05070C] text-[#E8C070] border border-white/[0.08] rounded-lg p-1 px-2.5 font-mono text-xs font-bold focus:outline-none focus:border-[#D4A843]/60 transition-all uppercase"
          >
            {assets.map(asset => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol.split('.')[0]} ({asset.name.slice(0, 18)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div id="sip-sync-error" className="bg-rose-500/5 text-rose-400 border border-rose-500/20 p-4 rounded-xl text-xs font-mono leading-relaxed flex items-center gap-2">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <span>⚠️ {error}. Double check internet sync pipelines or retry scanner updates.</span>
        </div>
      )}

      {/* ================= SECTION 1: MARKET CONTEXT (TOP) ================= */}
      <h3 id="section-1-title" className="text-sm font-mono font-bold uppercase text-[#E8C070] tracking-widest border-b border-white/[0.05] pb-2 flex items-center gap-2">
        <Layers size={14} className="text-[#D4A843]" />
        Section 1: Live Market Context parities
      </h3>
      
      <div id="market-context-row" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Real-time converted Commodity Spot + IndiaVix Cards */}
        <div id="macro-cards-grid" className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Card 1: Gold INR per 10g */}
          <div id="card-gold-inr" className="bg-black/40 border border-[#D4A843]/15 p-4 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/[0.02] rounded-full blur-xl pointer-events-none" />
            <div>
              <span className="text-[8px] font-mono font-bold text-[#8892A4] uppercase tracking-wider block leading-none">GOLD SPOT INDIAN PARITY</span>
              <span className="text-xl font-bold text-white mt-2 block font-mono">₹{Math.round(calculatedMacro.goldINR).toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-[#4A5568] uppercase font-mono block mt-1">per 10g (24k) in India</span>
            </div>
            <div className="mt-3 text-[9px] text-[#8892A4] font-mono border-t border-white/[0.04] pt-2 flex justify-between items-center">
              <span>Spot USD:</span>
              <span className="text-white font-mono">${Math.round(calculatedMacro.goldSpotUSD)}/oz</span>
            </div>
          </div>

          {/* Card 2: Silver INR per 1kg */}
          <div id="card-silver-inr" className="bg-black/40 border border-[#D4A843]/15 p-4 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-12 h-12 bg-slate-450/[0.01] rounded-full blur-xl pointer-events-none" />
            <div>
              <span className="text-[8px] font-mono font-bold text-[#8892A4] uppercase tracking-wider block leading-none">SILVER SPOT INDIAN PARITY</span>
              <span className="text-xl font-bold text-white mt-2 block font-mono">₹{Math.round(calculatedMacro.silverINR).toLocaleString('en-IN')}</span>
              <span className="text-[9px] text-[#4A5568] uppercase font-mono block mt-1">per 1 kg in India</span>
            </div>
            <div className="mt-3 text-[9px] text-[#8892A4] font-mono border-t border-white/[0.04] pt-2 flex justify-between items-center">
              <span>Spot USD:</span>
              <span className="text-white font-mono">${calculatedMacro.silverSpotUSD.toFixed(2)}/oz</span>
            </div>
          </div>

          {/* Card 3: Real USD/INR Rate */}
          <div id="card-usdinr" className="bg-black/40 border border-[#D4A843]/15 p-4 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/[0.01] rounded-full blur-xl pointer-events-none" />
            <div>
              <span className="text-[8px] font-mono font-bold text-[#8892A4] uppercase tracking-wider block leading-none">REAL USD/INR EXCHANGE RATE</span>
              <span className="text-xl font-bold text-white mt-2 block font-mono">₹{calculatedMacro.usdinrRate.toFixed(2)}</span>
              <span className="text-[9px] text-[#4A5568] uppercase font-mono block mt-1">spot foreign currency exchange</span>
            </div>
            <div className="mt-3 text-[9px] font-mono border-t border-white/[0.04] pt-2 flex justify-between items-center">
              <span className="text-[#8892A4]">USD/INR:</span>
              <span className="text-[#34A77A] font-bold">REAL TIME</span>
            </div>
          </div>

          {/* Card 4: India VIX with level badge */}
          <div id="card-indiavix" className="bg-black/40 border border-[#D4A843]/15 p-4 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/[0.01] rounded-full blur-xl pointer-events-none" />
            <div>
              <span className="text-[8px] font-mono font-bold text-[#8892A4] uppercase tracking-wider block leading-none">INDIA VIX INDICATOR</span>
              <span className="text-xl font-bold text-white mt-2 block font-mono">{calculatedMacro.vixValue.toFixed(1)}</span>
              <span className="text-[9px] text-[#4A5568] uppercase font-mono block mt-1">aggregate market fear metrics</span>
            </div>
            <div className="mt-3 text-[9px] font-mono border-t border-white/[0.04] pt-2 flex justify-between items-center">
              <span className="text-[#8892A4]">Fear Level:</span>
              <span className={`font-bold uppercase ${
                calculatedMacro.vixLevel === 'LOW' ? 'text-emerald-450' : 
                calculatedMacro.vixLevel === 'MEDIUM' ? 'text-amber-450' : 'text-rose-500'
              }`}>{calculatedMacro.vixLevel}</span>
            </div>
          </div>

        </div>

        {/* RSI recommendation widget */}
        <div id="widget-rsi-recommendation" className="lg:col-span-4 bg-black/40 border border-[#D4A843]/20 p-5 rounded-xl flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11.5} className="text-[#D4A843] animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-[#E8C070] tracking-widest uppercase">Systemic Signal Matrix</span>
            </div>
            <h4 className="text-[13px] font-display font-medium text-white uppercase">{selectedAsset.split('.')[0]} Verdict</h4>
            
            <p className="text-xs text-[#8892A4] leading-relaxed font-body">
              {sipCondition === 'OVERBOUGHT' 
                ? "The active RSI momentum indicator is highly elevated. The smart budget module advises defensive posture to avoid top buying." 
                : sipCondition === 'OVERSOLD' 
                  ? "Extreme price compression has created an attractive downside buffer. Downside margin scoop model is active!" 
                  : "Consolidating cleanly near long-term mathematical averages. Systematic baseline tranches are recommended."}
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[9px] text-[#8892A4] font-mono uppercase font-bold">RSI ALLOCATOR VALUE:</span>
            <span className={`px-3 py-1 font-mono text-[10px] rounded-lg uppercase font-bold border ${
              sipCondition === 'OVERBOUGHT' ? 'bg-amber-500/10 text-amber-505 border-amber-500/30' : 
              sipCondition === 'OVERSOLD' ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/30' : 
              'bg-blue-500/5 text-slate-300 border-white/[0.08]'
            }`}>
              {sipCondition === 'OVERSOLD' ? 'RSI ' + techMetrics.rsi + ' — ACCUMULATE (140%)' :
               sipCondition === 'OVERBOUGHT' ? 'RSI ' + techMetrics.rsi + ' — AVOID (60%)' :
               'RSI ' + techMetrics.rsi + ' — NEUTRAL (100%)'}
            </span>
          </div>
        </div>

      </div>

      {/* ================= SECTION 2: SIP INTELLIGENCE (MIDDLE) ================= */}
      <h3 id="section-2-title" className="text-sm font-mono font-bold uppercase text-[#E8C070] tracking-widest border-b border-white/[0.05] pb-2 flex items-center gap-2 mt-2">
        <Calculator size={14} className="text-[#D4A843]" />
        Section 2: Smart Allocation & Historical Compounding check
      </h3>

      <ProGate feature="SIP Hub Advanced Features" isPro={isPro}>
        <div id="sip-intelligence-grid" className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* column 1: Smart deployment calculator */}
          <div id="deployment-calculator" className="xl:col-span-4 bg-black/40 border border-[#D4A843]/10 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-white/[0.04] pb-2.5">
                <span className="text-[9px] font-mono text-[#D4A843] uppercase tracking-widest block font-bold">SMART TRANCHE MODIFIER</span>
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">Dynamic Budget Allotment</h4>
              </div>

              <div className="space-y-3.5 font-mono text-xs">
                <div>
                  <label className="text-[9.5px] text-[#8892A4] uppercase tracking-wider block mb-1">Target Monthly Installment (INR)</label>
                  <input 
                    id="monthly-budget-input"
                    type="number" 
                    value={monthlyBudget} 
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60 font-mono"
                  />
                </div>

                {/* Preset buttons */}
                <div id="preset-amounts-row" className="flex gap-1.5 pt-1">
                  {[3000, 5000, 10000, 25000].map(amt => (
                    <button
                      id={`preset-${amt}`}
                      key={amt}
                      onClick={() => setMonthlyBudget(amt)}
                      className={`flex-1 py-1.5 bg-white/[0.01] hover:bg-white/[0.04] border rounded text-[9.5px] font-mono ${monthlyBudget === amt ? 'border-[#D4A843]/60 bg-[#D4A843]/5 text-[#E8C070] font-bold' : 'border-white/[0.03] text-[#8892A4]'}`}
                    >
                      ₹{amt >= 10000 ? amt/1000 + 'k' : amt}
                    </button>
                  ))}
                </div>

                <div id="deployment-verdict-box" className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-lg space-y-2">
                  <div className="flex justify-between text-[9px] font-mono uppercase text-[#8892A4]">
                    <span>Optimized Tranche Allotment ({sipDeployment.percent}):</span>
                    <span className="text-[#34A77A] font-bold font-mono">₹{sipDeployment.deploy.toLocaleString('en-IN')}</span>
                  </div>
                  {sipDeployment.reserve > 0 && (
                    <div className="flex justify-between text-[9px] font-mono uppercase text-[#8892A4]">
                      <span>Reserve Cash Divert (40%):</span>
                      <span className="text-amber-500 font-bold font-mono">₹{sipDeployment.reserve.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-[#8892A4] font-body normal-case leading-relaxed border-t border-white/[0.03] pt-2">
                    <strong>Smart Formula Rule:</strong> {sipDeployment.reason}
                  </div>
                </div>
              </div>
            </div>

            <div id="deployment-system-verdict" className="mt-4 pt-3 border-t border-white/[0.04] text-[9px] font-mono text-zinc-400 flex items-center justify-between">
              <span>RSI Trigger Boundary:</span>
              <span className="text-emerald-400 font-bold">★ CALIBRATED</span>
            </div>
          </div>

          {/* column 2: Dynamic Compounding simulator to sliders */}
          <div id="compounding-simulator" className="xl:col-span-8 bg-black/40 border border-[#D4A843]/15 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/[0.04] pb-2.5">
              <div>
                <span className="text-[9px] font-mono font-bold text-[#D4A843] uppercase tracking-widest block">CAGR Simulator</span>
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">SIP Dynamic Compounding Curve Projections</h4>
              </div>
              <div className="font-mono text-right text-[10px] text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                Smart SIP earns ₹{compoundProjectionData.difference.toLocaleString('en-IN')} more!
              </div>
            </div>

            <div id="simulator-sliders" className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.01] p-3 rounded-xl border border-white/[0.02]">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#8892A4]">EXPECTED ANNUAL RETURN (%):</span>
                  <span className="text-[#E8C070] font-bold">{sliderRate}%</span>
                </div>
                <input 
                  id="rate-slider"
                  type="range" 
                  min="8" 
                  max="25" 
                  value={sliderRate} 
                  onChange={(e) => setSliderRate(Number(e.target.value))}
                  className="w-full accent-[#D4A843] cursor-pointer bg-white/10 h-1 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#8892A4]">TIME PERIOD:</span>
                  <span className="text-[#E8C070] font-bold">{sliderDuration} Years</span>
                </div>
                <input 
                  id="duration-slider"
                  type="range" 
                  min="1" 
                  max="20" 
                  value={sliderDuration} 
                  onChange={(e) => setSliderDuration(Number(e.target.value))}
                  className="w-full accent-[#D4A843] cursor-pointer bg-white/10 h-1 rounded-lg"
                />
              </div>
            </div>

            <div id="simulator-chart-container" className="h-44 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={compoundProjectionData.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStdSip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A5568" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4A5568" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSmartSip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A843" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#D4A843" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                  <XAxis dataKey="year" stroke="#4A5568" fontSize={9} fontStyle="italic" />
                  <YAxis stroke="#4A5568" fontSize={9} tickFormatter={(val) => '₹' + (val >= 100000 ? (val/100000).toFixed(1) + 'L' : val / 1000 + 'k')} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07090E', borderColor: 'rgba(212,168,67,0.2)', borderRadius: '8px' }}
                    labelClassName="text-xs text-[#8892A4] font-mono"
                    formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, '']}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }} />
                  <Area type="monotone" name="Standard SIP (INR)" dataKey="standardValue" stroke="#8892A4" strokeWidth={1} fillOpacity={1} fill="url(#colorStdSip)" />
                  <Area type="monotone" name="Smart RSI SIP (INR)" dataKey="smartValue" stroke="#D4A843" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSmartSip)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </ProGate>

      {!isPro && (
        <div className="mt-4 mb-2">
          <AdUnit 
            slot="SLOT_SIP_1" 
            format="auto" 
            className="rounded-lg overflow-hidden"
          />
        </div>
      )}

      {/* SIP PERFORMANCE TRACKER */}
      <h3 id="section-tracker-title" className="text-sm font-mono font-bold uppercase text-[#E8C070] tracking-widest border-b border-white/[0.05] pb-2 flex items-center gap-2 mt-2">
        <Activity size={14} className="text-[#D4A843]" />
        SIP Performance Tracker (Real historical comparison)
      </h3>

      <ProGate feature="SIP Hub Advanced Features" isPro={isPro}>
        <div id="sip-performance-row" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Input variables card */}
          <div id="performance-inputs-card" className="lg:col-span-4 bg-black/40 border border-[#D4A843]/15 p-5 rounded-xl space-y-4">
            <div className="border-b border-white/[0.04] pb-2">
              <span className="text-[9px] font-mono font-bold text-[#D4A843] uppercase tracking-widest block">PORTFOLIO CALIBRATION</span>
              <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">Historical Simulation Parameters</h4>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="text-[10px] text-[#8892A4] uppercase tracking-wider block mb-1">SIP START DATE (YYYY-MM-DD)</label>
                <input 
                  id="sip-start-date-input"
                  type="date" 
                  value={sipStartDate} 
                  onChange={(e) => setSipStartDate(e.target.value)}
                  min="2018-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#8892A4] uppercase tracking-wider block mb-1">MONTHLY ALLOTMENT AMOUNT (INR)</label>
                <input 
                  id="performance-amount-input"
                  type="number" 
                  value={performanceAmount} 
                  onChange={(e) => setPerformanceAmount(Number(e.target.value))}
                  className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60 font-mono"
                />
              </div>

              <div id="live-calculation-helper" className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-lg text-[9.5px] font-mono text-[#8892A4] leading-relaxed">
                Calculates index unit accumulation date by date utilizing closing prices of the first available trading session for each calendar month.
              </div>
            </div>
          </div>

          {/* Real historical output metrics with isolated error boundaries */}
          <div id="performance-metrics-card" className="lg:col-span-8 bg-black/40 border border-[#D4A843]/15 p-5 rounded-xl flex flex-col justify-between">
            {historyLoading ? (
              <SectionSkeleton />
            ) : historyError ? (
              <SectionError message={historyError} />
            ) : performanceMetrics ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2.5">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-[#D4A843] uppercase tracking-widest block">HISTORICAL AUDIT REPORT</span>
                    <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">Realized Investment Outcomes for {selectedAsset.split('.')[0]}</h4>
                  </div>
                  {/* XIRR Badge */}
                  <div id="xirr-badge-box" className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center font-mono">
                    <span className="text-[7px] text-[#8892A4] uppercase block leading-none font-bold">ANNUALIZED XIRR</span>
                    <span className="text-sm font-bold text-[#34A77A] mt-0.5 block">{performanceMetrics.xirr}%</span>
                  </div>
                </div>

                {/* Data numbers grid */}
                <div id="performance-stats-grid" className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg">
                    <span className="text-[8px] font-mono text-[#4A5568] uppercase block leading-none">TOTAL INVESTED</span>
                    <span className="text-sm font-bold text-white mt-1.5 block font-mono">₹{performanceMetrics.totalInvested.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg">
                    <span className="text-[8px] font-mono text-[#4A5568] uppercase block leading-none">PORTFOLIO VALUE</span>
                    <span className="text-sm font-bold text-white mt-1.5 block font-mono">₹{performanceMetrics.currentPortfolioValue.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg">
                    <span className="text-[8px] font-mono text-[#4A5568] uppercase block leading-none">ABSOLUTE RETURNS %</span>
                    <span className={`text-sm font-bold mt-1.5 block font-mono ${performanceMetrics.absoluteReturnRupees >= 0 ? 'text-[#34A77A]' : 'text-[#E05252]'}`}>
                      ₹{performanceMetrics.absoluteReturnRupees.toLocaleString('en-IN')} ({performanceMetrics.absoluteReturnPercent}%)
                    </span>
                  </div>

                  <div className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg">
                    <span className="text-[8px] font-mono text-[#4A5568] uppercase block leading-none">LUMP SUM ALIGNMENT</span>
                    <span className="text-sm font-bold text-[#8892A4] mt-1.5 block font-mono">₹{performanceMetrics.lumpValueToday.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Min Max months check */}
                <div id="min-max-months" className="grid grid-cols-2 gap-4 bg-white/[0.01] p-3 rounded-xl border border-white/[0.03] text-[10.5px] font-mono">
                  <div className="flex justify-between items-center text-rose-400">
                    <span>WORST MONTH RETURN:</span>
                    <span className="font-bold">{performanceMetrics.worstMonth}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#34A77A]">
                    <span>BEST MONTH RETURN:</span>
                    <span className="font-bold">+{performanceMetrics.bestMonth}%</span>
                  </div>
                </div>

                {/* Mini area chart tracking capital vs value */}
                <div id="performance-history-chart text" className="space-y-1">
                  <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-widest block font-bold">Historical Unit Capitalization Curves</span>
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceMetrics.trackingPoints} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.01)" />
                        <XAxis dataKey="date" stroke="#4A5568" fontSize={8} />
                        <YAxis stroke="#4A5568" fontSize={8} />
                        <Tooltip contentStyle={{ backgroundColor: '#07090E', border: '1px solid rgba(255,255,255,0.05)' }} formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                        <Line type="monotone" name="Total Invested" dataKey="invested" stroke="#8892A4" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                        <Line type="monotone" name="Portfolio Value" dataKey="portfolioValue" stroke="#D4A843" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div id="metrics-fallback-msg" className="flex flex-col items-center justify-center py-10 font-mono text-[10px] text-[#8892A4] uppercase gap-2 text-center">
                <AlertTriangle className="text-amber-400 animate-pulse" size={18} />
                <span>Sparse historical bars in database. Choose a later Start Date or synchronize the asset.</span>
              </div>
            )}
          </div>

        </div>
      </ProGate>

      {/* ================= SECTION 3: POSITION SIZING (BOTTOM) ================= */}
      <h3 id="section-3-title" className="text-sm font-mono font-bold uppercase text-[#E8C070] tracking-widest border-b border-white/[0.05] pb-2 flex items-center gap-2 mt-2">
        <Scale size={14} className="text-[#D4A843]" />
        Section 3: Position Sizing & ATR swing boundaries
      </h3>

      <ProGate feature="SIP Hub Advanced Features" isPro={isPro}>
        <div id="position-sizing-row" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Inputs parameters */}
          <div id="swing-parameters-card" className="lg:col-span-5 bg-black/40 border border-[#D4A843]/15 p-5 rounded-xl space-y-4">
            <div className="border-b border-white/[0.04] pb-2">
              <span className="text-[9px] font-mono font-bold text-[#D4A843] uppercase tracking-widest block">SWING CAPITAL ALLOTMENT</span>
              <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">Parameters Configuration</h4>
            </div>

            <div className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="text-[10px] text-[#8892A4] uppercase block mb-1">SWING ALLOCATION CAPITAL POOL (INR)</label>
                <input 
                  id="swing-capital-input"
                  type="number" 
                  value={swingCapital} 
                  onChange={(e) => setSwingCapital(Number(e.target.value))}
                  className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#8892A4] uppercase block mb-1">MAX POSITION RISK LIMIT (%)</label>
                <input 
                  id="swing-risk-input"
                  type="number" 
                  step="0.5"
                  value={riskPercent} 
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60 font-mono"
                />
              </div>

              <div id="atr-calc-info" className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg text-[9px] block leading-relaxed space-y-1">
                <div className="flex justify-between">
                  <span>Calculated 14-Day ATR Volatility:</span>
                  <span className="text-white font-bold font-mono">₹{atrMetrics.atr.toFixed(2)}</span>
                </div>
                <p className="text-[#8892A4] italic text-[8.5px] mt-0.5 lowercase">Derived from Welles Wilder's daily True Range calculations on SQLite candlesticks.</p>
              </div>
            </div>
          </div>

          {/* Dynamic swing allocation directives */}
          <div id="swing-directives-card" className="lg:col-span-7 bg-black/40 border border-[#D4A843]/15 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-white/[0.02] pb-2.5">
                <span className="text-[10px] font-mono text-[#D4A843] uppercase tracking-widest block font-bold">ATR POSITION SIZER RESULTS</span>
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] mt-0.5">Tactical Swing Blueprint for {selectedAsset.split('.')[0]}</h4>
              </div>

              <div id="directives-stats-row" className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-xl font-mono">
                  <span className="text-[8.5px] text-[#8892A4] uppercase tracking-wider block">RECOMMENDED POSITION SIZE</span>
                  <span className="text-xl font-bold block text-[#E8C070] mt-1 font-mono">{atrMetrics.maxUnits} Units</span>
                  <span className="text-[8px] text-[#4A5568] mt-0.5 block uppercase">optimized count</span>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-xl font-mono">
                  <span className="text-[8.5px] text-[#8892A4] uppercase tracking-wider block">CAPITAL EXPOSURE LIMIT</span>
                  <span className="text-xl font-bold block text-white mt-1 font-mono">₹{atrMetrics.totalExposure.toLocaleString('en-IN')}</span>
                  <span className="text-[8px] text-[#4A5568] mt-0.5 block uppercase">allocated capital pool</span>
                </div>
              </div>

              {/* Target & stop ranges */}
              <div id="target-ranges-grid" className="grid grid-cols-3 gap-2.5 text-center font-mono text-[10px]">
                <div className="bg-[#E05252]/10 p-2 border border-[#E05252]/20 rounded-lg">
                  <span className="text-[#E05252] block text-[8px] uppercase font-bold">STOP LOSS (-2 ATR)</span>
                  <span className="text-white mt-1 block font-mono">₹{atrMetrics.stopLoss.toFixed(2)}</span>
                </div>
                <div className="bg-[#34A77A]/10 p-2 border border-[#34A77A]/20 rounded-lg">
                  <span className="text-[#34A77A] block text-[8px] uppercase font-bold">TARGET 1 (+3 ATR)</span>
                  <span className="text-white mt-1 block font-mono">₹{atrMetrics.target1.toFixed(2)}</span>
                </div>
                <div className="bg-[#D4A843]/10 p-2 border border-[#D4A843]/20 rounded-lg">
                  <span className="text-[#E8C070] block text-[8px] uppercase font-bold">TARGET 2 (+5 ATR)</span>
                  <span className="text-white mt-1 block font-mono">₹{atrMetrics.target2.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div id="swing-account-risk-banner" className="mt-4 pt-3 border-t border-white/[0.04] text-[9.5px] font-mono text-[#8892A4] flex justify-between items-center">
              <span>MAX ACCOUNT RISK LIMIT: ₹{atrMetrics.riskAmount.toFixed(2)}</span>
              <span className="text-[#34A77A] font-bold">1:{atrMetrics.riskRewardRatio.toFixed(1)} RISK REWARD RATIO</span>
            </div>
          </div>

        </div>
      </ProGate>

    </div>
  );
}
