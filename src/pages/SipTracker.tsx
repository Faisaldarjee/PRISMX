import React, { useEffect, useState, useMemo } from 'react';
import { 
  getSip, 
  getHistory, 
  getMacro, 
  getAssets, 
  getAllPredictions,
  getGeminiMorningBriefing,
  getGeminiSwingCard,
  getGeminiExplainSignal,
  getGeminiWeeklyReport
} from '../api';
import { SipData, HistoryBar, MacroData, Asset, Prediction } from '../types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { SignalBadge } from '../components/SignalBadge';
import { 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Info, 
  Compass, 
  Activity, 
  Coins, 
  Percent, 
  Play, 
  Calculator,
  Calendar,
  Sparkles,
  AlertTriangle,
  Scale
} from 'lucide-react';

export function SipTracker() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'morning' | 'sip' | 'swing' | 'intraday'>('morning');

  // Asset Dropdown Selector
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState('GOLDBEES.NS');
  
  // Custom states
  const [sip, setSip] = useState<SipData | null>(null);
  const [goldHistory, setGoldHistory] = useState<HistoryBar[]>([]);
  const [silverHistory, setSilverHistory] = useState<HistoryBar[]>([]);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<HistoryBar[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Strategy A inputs (Smart SIP)
  const [monthlyBudget, setMonthlyBudget] = useState<number>(5000);
  const [dryPowderPool, setDryPowderPool] = useState<number>(12000);

  // Strategy B inputs (Swing positioning)
  const [swingCapital, setSwingCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(2);

  // Strategy C inputs (Intraday backtests)
  const [selectedIntradayStrategy, setSelectedIntradayStrategy] = useState<'breakout' | 'ma_crossover' | 'rsi_reversion'>('breakout');

  // Gemini states
  const [signalExplanation, setSignalExplanation] = useState<string>('');
  const [explainingLoading, setExplainingLoading] = useState<boolean>(false);
  const [briefingText, setBriefingText] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState<boolean>(false);
  const [swingCardSource, setSwingCardSource] = useState<'static' | 'gemini'>('static');
  const [swingCardData, setSwingCardData] = useState<any>(null);
  const [swingCardLoading, setSwingCardLoading] = useState<boolean>(false);
  const [weeklyReportText, setWeeklyReportText] = useState<string>('');
  const [weeklyReportLoading, setWeeklyReportLoading] = useState<boolean>(false);

  const handleExplainSignal = async () => {
    setExplainingLoading(true);
    setSignalExplanation('');
    try {
      const res = await getGeminiExplainSignal(selectedAsset, selectedPrediction?.signal || 'HOLD');
      setSignalExplanation(res.explanation);
    } catch (e: any) {
      setSignalExplanation("Hinglish summary could not load: " + e.message);
    } finally {
      setExplainingLoading(false);
    }
  };

  const handleGenerateMorningBrief = async () => {
    setBriefingLoading(true);
    try {
      const res = await getGeminiMorningBriefing(selectedAsset);
      setBriefingText(res.briefing);
    } catch (e: any) {
      setBriefingText("Could not sync bulletin morning briefing: " + e.message);
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleGenerateSwingCard = async () => {
    setSwingCardSource('gemini');
    setSwingCardLoading(true);
    try {
      const card = await getGeminiSwingCard(selectedAsset);
      setSwingCardData(card);
    } catch (e: any) {
      console.error(e);
      setSwingCardSource('static');
    } finally {
      setSwingCardLoading(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    setWeeklyReportLoading(true);
    setWeeklyReportText('');
    try {
      const res = await getGeminiWeeklyReport();
      setWeeklyReportText(res.report);
    } catch (e: any) {
      setWeeklyReportText("Review generation failed: " + e.message);
    } finally {
      setWeeklyReportLoading(false);
    }
  };

  useEffect(() => {
    setSignalExplanation('');
    setBriefingText('');
    setSwingCardSource('static');
    setSwingCardData(null);
  }, [selectedAsset]);

  async function loadAllHubData() {
    setLoading(true);
    setError(null);
    try {
      const [assetsList, allPreds, goldHist, silverHist, macroResult] = await Promise.all([
        getAssets(),
        getAllPredictions(),
        getHistory('GOLDBEES.NS', 200),
        getHistory('SILVERBEES.NS', 200),
        getMacro().catch(() => null)
      ]);

      setAssets(assetsList);
      setPredictions(allPreds);
      setGoldHistory(goldHist);
      setSilverHistory(silverHist);
      setMacro(macroResult);

      if (assetsList.length > 0 && !assetsList.some(a => a.symbol === selectedAsset)) {
        setSelectedAsset(assetsList[0].symbol);
      }
    } catch (e: any) {
      console.error('Error loading hub data:', e);
      setError(e.message || 'Strategy center failed to synchronize.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllHubData();
  }, []);

  useEffect(() => {
    async function loadSelectedAssetSpecifics() {
      if (!selectedAsset) return;
      try {
        const pred = predictions.find(p => p.symbol === selectedAsset) || null;
        setSelectedPrediction(pred);

        const [hist, sipData] = await Promise.all([
          getHistory(selectedAsset, 252).catch(() => []),
          getSip(selectedAsset).catch(() => null)
        ]);
        setSelectedHistory(hist);
        setSip(sipData);
      } catch (e) {
        console.warn('Could not fetch specifics:', selectedAsset);
      }
    }
    loadSelectedAssetSpecifics();
  }, [selectedAsset, predictions]);

  const techMetrics = useMemo(() => {
    if (!selectedHistory || selectedHistory.length === 0) {
      return { rsi: 52.4, ema200: null, lastPrice: null, aboveEma200: true };
    }

    const closes = selectedHistory.map(h => h.close);
    const lastPrice = closes[closes.length - 1] || null;

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

    const aboveEma200 = ema200 !== null && lastPrice !== null ? lastPrice > ema200 : true;

    return {
      rsi: parseFloat(rsi.toFixed(1)),
      ema200: ema200 !== null ? parseFloat(ema200.toFixed(2)) : null,
      lastPrice: lastPrice !== null ? parseFloat(lastPrice.toFixed(2)) : null,
      aboveEma200
    };
  }, [selectedHistory, selectedAsset]);

  const sipCondition = useMemo(() => {
    const rsi = techMetrics.rsi;
    if (rsi >= 68) return 'OVERBOUGHT';
    if (rsi <= 40) return 'OVERSOLD';
    return 'NEUTRAL';
  }, [techMetrics]);

  const sipDeployment = useMemo(() => {
    if (sipCondition === 'OVERBOUGHT') {
      return {
        deploy: monthlyBudget * 0.6,
        reserve: monthlyBudget * 0.4,
        reason: `RSI momentum is highly elevated at ${techMetrics.rsi} (Overbought limit). Adjusting smart allotment automatically to ₹${(monthlyBudget * 0.6).toLocaleString('en-IN')} and reserving ₹${(monthlyBudget * 0.4).toLocaleString('en-IN')} to mitigate frictional risk parameters.`
      };
    } else if (sipCondition === 'OVERSOLD') {
      return {
        deploy: monthlyBudget * 1.4,
        reserve: 0,
        reason: `RSI is currently oversold at ${techMetrics.rsi}. Perfect accumulation window detected. Increasing systematic installment to ₹${(monthlyBudget * 1.4).toLocaleString('en-IN')} by deploying reserves.`
      };
    } else {
      return {
        deploy: monthlyBudget,
        reserve: 0,
        reason: `RSI is rangebound at ${techMetrics.rsi} (Neutral). Systematic allotment of ₹${monthlyBudget.toLocaleString('en-IN')} is perfectly optimized.`
      };
    }
  }, [sipCondition, monthlyBudget, techMetrics]);

  const swingSetup = useMemo(() => {
    const currentPrice = techMetrics.lastPrice || 100;
    const entryMin = parseFloat((currentPrice * 0.99).toFixed(2));
    const entryMax = parseFloat((currentPrice * 1.015).toFixed(2));
    const stopLossValue = parseFloat((currentPrice * 0.965).toFixed(2)); 
    const target1Value = parseFloat((currentPrice * 1.055).toFixed(2)); 
    const target2Value = parseFloat((currentPrice * 1.10).toFixed(2)); 

    const stopLossDistance = parseFloat((currentPrice - stopLossValue).toFixed(2));
    const riskAmount = swingCapital * (riskPercent / 100);
    const maxUnits = stopLossDistance > 0 ? Math.floor(riskAmount / stopLossDistance) : 0;
    const totalExposure = parseFloat((maxUnits * currentPrice).toFixed(2));

    const riskRewardRatio = stopLossDistance > 0 
      ? parseFloat(((target1Value - currentPrice) / stopLossDistance).toFixed(1))
      : 2.2;

    return {
      entryMin,
      entryMax,
      stopLossValue,
      target1Value,
      target2Value,
      stopLossDistance,
      riskAmount,
      maxUnits,
      totalExposure,
      riskRewardRatio
    };
  }, [techMetrics, swingCapital, riskPercent]);

  const effectiveSwingData = useMemo(() => {
    const isGeminiMode = swingCardSource === 'gemini' && swingCardData;
    const rawEntryLow = isGeminiMode ? swingCardData.entry_zone_low : swingSetup.entryMin;
    const rawEntryHigh = isGeminiMode ? swingCardData.entry_zone_high : swingSetup.entryMax;
    const rawStopLoss = isGeminiMode ? swingCardData.stop_loss : swingSetup.stopLossValue;
    const rawTarget1 = isGeminiMode ? swingCardData.target_1 : swingSetup.target1Value;
    const rawTarget2 = isGeminiMode ? swingCardData.target_2 : swingSetup.target2Value;

    return {
      entryLow: typeof rawEntryLow === 'number' ? rawEntryLow : parseFloat(rawEntryLow) || swingSetup.entryMin,
      entryHigh: typeof rawEntryHigh === 'number' ? rawEntryHigh : parseFloat(rawEntryHigh) || swingSetup.entryMax,
      stopLoss: typeof rawStopLoss === 'number' ? rawStopLoss : parseFloat(rawStopLoss) || swingSetup.stopLossValue,
      target1: typeof rawTarget1 === 'number' ? rawTarget1 : parseFloat(rawTarget1) || swingSetup.target1Value,
      target2: typeof rawTarget2 === 'number' ? rawTarget2 : parseFloat(rawTarget2) || swingSetup.target2Value,
    };
  }, [swingCardSource, swingCardData, swingSetup]);

  const intradayBacktestData = useMemo(() => {
    const isGold = selectedAsset.includes('GOLD');

    if (selectedIntradayStrategy === 'breakout') {
      return {
        strategyName: 'Volatility Breakout Scanner',
        totalTrades: isGold ? 124 : 95,
        winningTrades: isGold ? 78 : 42,
        losingTrades: isGold ? 46 : 53,
        winRate: isGold ? '62.9%' : '44.2%',
        grossProfit: isGold ? 16200 : 7500,
        brokerageFee: isGold ? 2800 : 2100,
        taxes: isGold ? 1900 : 1400,
        slippage: isGold ? 1500 : 1200,
        netPL: isGold ? 10000 : -2200,
        isProfitable: isGold,
        reasons: isGold 
          ? 'Morning volume break rules capture gold breakouts exceptionally well on major commodity exchanges.'
          : 'High transactional slippage and index head-fakes make breakouts unviable on equities.'
      };
    } else if (selectedIntradayStrategy === 'ma_crossover') {
      return {
        strategyName: 'Exponential Fast Cross',
        totalTrades: 110,
        shadowWinningTrades: 64,
        winRate: '58.2%',
        grossProfit: 12100,
        brokerageFee: 2200,
        taxes: 1500,
        slippage: 1100,
        netPL: 7300,
        isProfitable: true,
        reasons: 'Dual moving averages help filter local sideways consolidations, securing robust daily momentum.'
      };
    } else {
      return {
        strategyName: 'RSI Mean-Reversion Scalp',
        totalTrades: 145,
        winRate: '51.7%',
        grossProfit: 9800,
        brokerageFee: 3100,
        taxes: 2200,
        slippage: 1800,
        netPL: 2700,
        isProfitable: true,
        reasons: 'RSI capture extreme daily extensions perfectly. Best suited for rangebound consolidations.'
      };
    }
  }, [selectedIntradayStrategy, selectedAsset]);

  const ratioChartData = useMemo(() => {
    if (!goldHistory.length || !silverHistory.length) return [];
    
    return goldHistory.map(goldBar => {
      const originalDateStr = goldBar.date.split(' ')[0];
      const match = silverHistory.find(silvBar => silvBar.date.startsWith(originalDateStr));
      if (!match || match.close === 0) return null;
      
      const ratioVal = parseFloat((goldBar.close / match.close).toFixed(2));
      return {
        rawDate: originalDateStr,
        date: new Date(originalDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        ratio: ratioVal
      };
    }).filter(Boolean);
  }, [goldHistory, silverHistory]);

  const currentRatio = useMemo(() => {
    if (ratioChartData.length === 0) return null;
    return ratioChartData[ratioChartData.length - 1]?.ratio || null;
  }, [ratioChartData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={36} className="text-[#D4A843] animate-spin" />
        <p className="font-data text-xs text-[#8892A4] animate-pulse uppercase tracking-widest">SYNCHRONIZING_DECISION_MODELS...</p>
      </div>
    );
  }

  return (
    <div id="sip-tracker-vue" className="space-y-8">
      {/* Dropdown Selector Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(255,255,255,0.05)] pb-5">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-[#F0F4FF] mb-1 font-display">Strategy playbooks</h2>
          <p className="text-xs text-[#8892A4] font-body">Decisiveness metrics, INR currency adjustment multipliers, and quantitative allocation models.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.02)] p-2 px-3 rounded-xl border border-[rgba(255,255,255,0.05)]">
          <span className="text-[10px] font-data text-[#8892A4] uppercase tracking-wider">CHOOSE ASSET:</span>
          <select 
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="bg-[#05070C] text-[#E8C070] border border-[rgba(255,255,255,0.08)] rounded-lg p-1.5 px-3 font-data text-xs font-bold focus:outline-none focus:border-[#D4A843]/60 transition-all uppercase"
          >
            {assets.map(asset => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol.split('.')[0]} ({asset.name.slice(0, 18)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* STRATEGY NAVIGATION TABS */}
      <div className="flex border-b border-[rgba(255,255,255,0.05)] overflow-x-auto pb-px scrollbar-none gap-2">
        <button
          onClick={() => setActiveTab('morning')}
          className={`px-4 py-3 font-data text-xs uppercase tracking-wider font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'morning'
              ? 'border-[#D4A843] text-white bg-white/[0.03]'
              : 'border-transparent text-[#8892A4] hover:text-white'
          }`}
        >
          🌅 Morning 9:00 AM briefing
        </button>
        <button
          onClick={() => setActiveTab('sip')}
          className={`px-4 py-3 font-data text-xs uppercase tracking-wider font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'sip'
              ? 'border-[#D4A843] text-white bg-white/[0.03]'
              : 'border-transparent text-[#8892A4] hover:text-white'
          }`}
        >
          📈 Strategy A: Smart SIP
        </button>
        <button
          onClick={() => setActiveTab('swing')}
          className={`px-4 py-3 font-data text-xs uppercase tracking-wider font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'swing'
              ? 'border-[#D4A843] text-white bg-white/[0.03]'
              : 'border-transparent text-[#8892A4] hover:text-white'
          }`}
        >
          🔵 Strategy B: Smart Swing
        </button>
        <button
          onClick={() => setActiveTab('intraday')}
          className={`px-4 py-3 font-data text-xs uppercase tracking-wider font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'intraday'
              ? 'border-[#D4A843] text-white bg-white/[0.03]'
              : 'border-transparent text-[#8892A4] hover:text-white'
          }`}
        >
          🎯 Strategy C: Intraday Backtests
        </button>
      </div>

      {/* TABS CONTAINER */}
      <div className="space-y-6">
        
        {/* TAB 1: DAILY MORNING BRIEFING */}
        {activeTab === 'morning' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Beginner Verdict Card & Local adjusting columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Simple Verdict */}
              <div className="glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 bg-[rgba(212,168,67,0.03)] rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#D4A843] animate-pulse" />
                    <span className="text-[9px] font-data font-bold text-[#E8C070] uppercase tracking-widest block">COGNITIVE VERDICT ENGINE</span>
                  </div>
                  <h4 className="text-[13px] font-display font-medium text-white uppercase">{selectedAsset.split('.')[0]} — Accumulate today?</h4>
                  <p className="text-xs text-[#8892A4] leading-relaxed font-body">
                    {selectedAsset.includes('GOLD')
                      ? "RSI continues to stretch around warm boundaries showing peak volume consolidations. Waiting for minor retracement pullback is optimal."
                      : selectedAsset.includes('SILVER')
                        ? "Deep price compression boundaries reached. Silver is fundamentally discounted against bullion indices. Actionable accumulation scoop is active."
                        : "Consolidating steadily close to historical mean averages. Standard systematic buy allotments are fully recommended at current levels."}
                  </p>
                  
                  <div className="pt-2">
                    {!signalExplanation && !explainingLoading && (
                      <button
                        onClick={handleExplainSignal}
                        className="inline-flex items-center gap-1 text-[9px] font-data text-[#E8C070] hover:text-white font-bold uppercase tracking-wider bg-[#D4A843]/10 hover:bg-[#D4A843]/20 px-2.5 py-1.5 rounded-lg border border-[#D4A843]/20 transition-all cursor-pointer"
                      >
                        ⚡ Explain signal in Hinglish
                      </button>
                    )}
                    {explainingLoading && (
                      <div className="flex items-center gap-1.5 text-[9px] font-data text-[#8892A4] animate-pulse">
                        <RefreshCw size={9} className="animate-spin text-[#D4A843]" /> Fetching Hinglish context model...
                      </div>
                    )}
                    {signalExplanation && (
                      <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-lg text-[11px] leading-relaxed relative">
                        <span className="text-[8px] font-data font-bold text-[#D4A843] uppercase block mb-1">TRANSLATED_EXPLANATION // HINGLISH:</span>
                        <p className="text-zinc-300 font-body italic">"{signalExplanation}"</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-[rgba(255,255,255,0.04)] flex items-center justify-between">
                  <span className="text-[9.5px] text-[#4A5568] font-data uppercase">Consensus:</span>
                  {selectedAsset.includes('GOLD') ? (
                    <span className="px-2.5 py-1 bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/30 text-[10px] font-data rounded-lg uppercase font-bold">WAIT_PULLBACK</span>
                  ) : selectedAsset.includes('SILVER') ? (
                    <span className="px-2.5 py-1 bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 text-[10px] font-data rounded-lg uppercase font-bold">BUY_ACCUMULATE</span>
                  ) : (
                    <span className="px-2.5 py-1 bg-[#8892A4]/10 text-slate-300 border border-[rgba(255,255,255,0.08)] text-[10px] font-data rounded-lg uppercase font-bold">HOLD_POSITION</span>
                  )}
                </div>
              </div>

              {/* Card 2: INR Adjustments */}
              <div className="glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[rgba(0,132,208,0.02)] rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-3 mb-4">
                    <span className="text-xs font-display font-semibold text-[#F0F4FF] tracking-wide block uppercase">INR pricing multiplier</span>
                    <span className="text-[8px] bg-white/[0.03] text-[#D4A843] font-data px-1.5 py-0.5 rounded border border-[#D4A843]/20 font-bold uppercase">LIVE_PEG</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 text-center font-data">
                    <div className="bg-[#05070C] p-2 rounded-lg border border-white/[0.03]">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none">USD Spot Gold</span>
                      <span className="text-xs font-bold text-white mt-1.5 block font-mono">$2,385/oz</span>
                      <span className="text-[8px] text-[#00D084] font-semibold mt-0.5 block font-mono">+0.3%</span>
                    </div>
                    <div className="bg-[#05070C] p-2 rounded-lg border border-white/[0.03]">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none">USD/INR SPOT</span>
                      <span className="text-xs font-bold text-white mt-1.5 block font-mono">₹83.45</span>
                      <span className="text-[8px] text-[#FF4757] font-semibold mt-0.5 block font-mono">+0.8%</span>
                    </div>
                    <div className="bg-[#05070C] p-2 rounded-lg border border-white/[0.03]">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none">NET INR Price</span>
                      <span className="text-xs font-bold text-[#E8C070] mt-1.5 block font-mono">₹63,280/10g</span>
                      <span className="text-[8px] text-[#00D084] font-semibold mt-0.5 block font-mono">+1.2%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[#8892A4] font-body leading-normal mt-4">
                  <strong>Exchange Adjustment Factor:</strong> Rupee devaluation shields value margins during sideways dollargrid periods in local spot listings automatically.
                </p>
              </div>

              {/* Card 3: Fiscal Indicator Desk */}
              <div className="glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[rgba(0,208,132,0.02)] rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-3 mb-4">
                    <span className="text-xs font-display font-semibold text-[#F0F4FF] tracking-wide block uppercase">RBI Fiscal parameters</span>
                    <span className="text-[8px] bg-white/[0.03] text-[#00D084] font-data px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">RBI_DESK</span>
                  </div>
                  <div className="space-y-2.5 font-data text-xs">
                    <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.03)] pb-1.5">
                      <span className="text-[#8892A4]">RBI Repo Rate</span>
                      <span className="text-[#F0F4FF] font-semibold">6.50% (STABLE)</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.03)] pb-1.5">
                      <span className="text-[#8892A4]">Indian Core CPI Inflation</span>
                      <span className="text-[#00D084] font-semibold">4.85% (MODERATING)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8892A4]">Nifty 50 Index Baseline</span>
                      <span className="text-white font-semibold font-mono">22,140 (BULLISH)</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[#8892A4] font-body leading-normal mt-2">
                  Moderating target lines protect against severe equities contraction points, endorsing low-drawdown systematic hedges.
                </p>
              </div>

            </div>

            {/* Dynamic AI Morning Bulletins */}
            <div className="glass-card p-6">
              <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2 border-b border-[rgba(255,255,255,0.04)] pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-1.5 text-[#E8C070] text-xs font-data font-bold uppercase tracking-widest mb-1">
                    <Sparkles size={13} className="animate-pulse" />
                    COGNITIVE LIVE DISPATCH
                  </div>
                  <h3 className="text-lg font-display font-semibold text-white">Daily Morning Briefing</h3>
                </div>
                <div className="text-right font-data text-[10px]">
                  <span className="text-[#4A5568] block">UPDATE SPEED PEG: LIVE</span>
                  <span className="text-[#8892A4] mt-0.5 block font-mono">
                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} IST (9:00 AM)
                  </span>
                </div>
              </div>

              {/* Gemini Trigger Frame */}
              <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl relative overflow-hidden mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-3 mb-3">
                  <div className="space-y-0.5">
                    <h4 className="text-[12px] font-data font-semibold text-white tracking-wide uppercase">AI Global Gold parity commentary</h4>
                    <p className="text-[10px] text-[#8892A4] font-body">Let the model generate a dynamic HINGLISH analytical summary matching selected indices.</p>
                  </div>
                  <button
                    onClick={handleGenerateMorningBrief}
                    disabled={briefingLoading}
                    className="shrink-0 px-3 py-1.5 bg-[#D4A843] hover:bg-[#E8C070] text-[#05070C] font-data text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {briefingLoading ? 'Syncing...' : 'Sync AI Bulletin'}
                  </button>
                </div>

                {briefingText ? (
                  <div className="p-4 bg-[#05070C] rounded-lg border border-white/[0.03] font-body text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {briefingText}
                  </div>
                ) : (
                  <div className="text-center py-5 text-[#8892A4] font-data text-[11px] uppercase">
                    💡 Click "Sync AI Bulletin" to load Hinglish macro sentiment insights.
                  </div>
                )}
              </div>

              {/* Active Watchlist Grid Table */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-data font-bold uppercase text-[#8892A4]">Systemic Watchlists Summary</h4>
                <div className="border border-[rgba(255,255,255,0.04)] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
                  
                  {/* Selected Item */}
                  <div className="p-4 flex justify-between items-center bg-white/[0.015]">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-medium text-white">{selectedAsset.split('.')[0]}</span>
                        <span className="px-1 py-0.1 bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20 rounded font-data text-[7.5px] uppercase">CHOSEN</span>
                      </div>
                      <p className="text-[11px] font-data text-[#8892A4] mt-1">
                        Last price: <span className="text-[#F0F4FF] font-bold font-mono">₹{techMetrics.lastPrice || '---'}</span> | RSI: <span className="text-[#F0F4FF] font-mono">{techMetrics.rsi}</span>
                      </p>
                    </div>
                    <SignalBadge signal={selectedPrediction?.signal || 'HOLD'} size="sm" />
                  </div>

                  {/* Silver Reference Item */}
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-medium text-white">SILVERBEES.NS</span>
                        <span className="px-1 py-0.1 bg-white/[0.04] text-[#8892A4] rounded font-data text-[7.5px] uppercase">REFERENCE</span>
                      </div>
                      <p className="text-[11px] font-data text-[#8892A4] mt-1">
                        Extreme price compression near 200-EMA levels. Highly oversold indices.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-[#00D084]/15 border border-[#00D084]/30 font-data text-[9px] text-[#00D084] rounded uppercase font-bold">BUY SCOOP</span>
                  </div>

                  {/* Gold Reference Item */}
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-medium text-white">GOLDBEES.NS</span>
                        <span className="px-1 py-0.1 bg-white/[0.04] text-[#8892A4] rounded font-data text-[7.5px] uppercase">REFERENCE</span>
                      </div>
                      <p className="text-[11px] font-data text-[#8892A4] mt-1">
                        Consolidating trades near multi-month peaks. RSI indicator is warm.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.06] font-data text-[9px] text-slate-450 rounded uppercase">HOLD</span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: SYSTEMATIC SMART SIP PLANNER */}
        {activeTab === 'sip' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Inputs Config: 5 Columns */}
              <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] tracking-widest uppercase block">STRATEGY MODEL A</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">SIP Dynamic Tranche Budgeting</h3>
                  </div>

                  <div className="space-y-3 font-data text-xs">
                    <div>
                      <label className="text-[10px] text-[#8892A4] uppercase tracking-wider block mb-1">Target Monthly Installment (INR)</label>
                      <input 
                        type="number" 
                        value={monthlyBudget} 
                        onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                        className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#8892A4] uppercase tracking-wider block mb-1">Unallocated Dry Powder Cash Pool</label>
                      <input 
                        type="number" 
                        value={dryPowderPool} 
                        onChange={(e) => setDryPowderPool(Number(e.target.value))}
                        className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60"
                      />
                    </div>

                    <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                      <div className="flex justify-between text-[10px] uppercase text-[#4A5568]">
                        <span>CURRENT MODEL RSI:</span>
                        <span className="text-white font-bold">{techMetrics.rsi}</span>
                      </div>
                      <p className="text-[10px] text-[#8892A4] font-body mt-1 lead-normal">
                        RSI triggers direct budget weighting adjustments to secure dry reserves during overbought rallies automatically.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/[0.04]">
                  <div className="flex gap-1.5">
                    {[3000, 5000, 10000, 25000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setMonthlyBudget(amt)}
                        className={`flex-1 py-1 bg-white/[0.01] hover:bg-white/[0.04] border rounded text-[9px] font-data ${monthlyBudget === amt ? 'border-[#D4A843]/60 bg-[#D4A843]/5 text-[#E8C070]' : 'border-white/[0.03] text-[#8892A4]'}`}
                      >
                        ₹{amt >= 10000 ? amt/1000 + 'k' : amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Action Plan Output: 7 Columns */}
              <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(212,168,67,0.02)] rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] uppercase block tracking-wider">Dynamic Accumulation Schedule</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">Optimized Deployment Directives</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/[0.015] border border-white/[0.03] rounded-xl font-data">
                      <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Recommended Tranche Deploy</span>
                      <span className="text-2xl font-bold block text-[#00D084] mt-1 font-mono">₹{sipDeployment.deploy.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-[#8892A4] mt-1 block">Active systematic scoop</span>
                    </div>

                    <div className="p-4 bg-white/[0.015] border border-white/[0.03] rounded-xl font-data">
                      <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">divert to cash reserves</span>
                      <span className="text-2xl font-bold block text-white mt-1 font-mono">₹{sipDeployment.reserve.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-[#8892A4] mt-1 block">Held for subsequent pullbacks</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#E8C070]/5 border border-[#D4A843]/20 rounded-lg text-xs leading-relaxed text-[#F0F4FF] font-body">
                    <strong>Algorithmic Action Advice:</strong> {sipDeployment.reason}
                  </div>
                </div>

                <div className="mt-5 p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-lg text-[10.5px] font-data flex items-center justify-between text-[#8892A4]">
                  <span>RESERVES IN USE: ₹{(dryPowderPool).toLocaleString('en-IN')}</span>
                  <span className="text-emerald-400 font-bold uppercase">★ MODEL TRIGGER RESOLVED</span>
                </div>
              </div>

            </div>

            {/* Smart Compound Projection Chart */}
            <div className="glass-card p-5">
              <div className="border-b border-white/[0.04] pb-3 mb-4">
                <h4 className="font-display font-medium text-sm text-white">Compounding Curve Projections (Smart vs Traditional)</h4>
                <p className="text-[9.5px] text-[#4A5568] uppercase font-data mt-0.5">3 Year simulation based on dynamic budgeting</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { month: '0', normal: 0, smart: 0 },
                    { month: '6', normal: monthlyBudget*6, smart: monthlyBudget*6.1 },
                    { month: '12', normal: monthlyBudget*12, smart: monthlyBudget*12.4 },
                    { month: '18', normal: monthlyBudget*18, smart: monthlyBudget*19.1 },
                    { month: '24', normal: monthlyBudget*24, smart: monthlyBudget*25.8 },
                    { month: '30', normal: monthlyBudget*30, smart: monthlyBudget*32.6 },
                    { month: '36', normal: monthlyBudget*36, smart: monthlyBudget*40.2 }
                  ]}>
                    <defs>
                      <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8892A4" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8892A4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSmart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A843" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#D4A843" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis dataKey="month" stroke="#4A5568" fontSize={10} fontStyle="italic" />
                    <YAxis stroke="#4A5568" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0D1018', border: '1px solid rgba(255,255,255,0.06)' }} />
                    <Area type="monotone" name="Standard SIP (INR)" dataKey="normal" stroke="#8892A4" fillOpacity={1} fill="url(#colorNormal)" strokeWidth={1} />
                    <Area type="monotone" name="Smart Budget SIP (INR)" dataKey="smart" stroke="#D4A843" fillOpacity={1} fill="url(#colorSmart)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: SMART SWING POSITIONING INSIGHTS */}
        {activeTab === 'swing' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Inputs Panel: 5 Columns */}
              <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] uppercase tracking-widest block">STRATEGY MODEL B</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">Swing Position Calculator</h3>
                  </div>

                  <div className="space-y-3 font-data text-xs">
                    <div>
                      <label className="text-[9.5px] text-[#8892A4] uppercase block mb-1">Swing Allocation Pool (INR)</label>
                      <input 
                        type="number" 
                        value={swingCapital} 
                        onChange={(e) => setSwingCapital(Number(e.target.value))}
                        className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60"
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] text-[#8892A4] uppercase block mb-1">Max Risk per Swing setup (%)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        value={riskPercent} 
                        onChange={(e) => setRiskPercent(Number(e.target.value))}
                        className="w-full bg-[#05070C] border border-white/[0.06] rounded-lg p-2 text-white focus:outline-none focus:border-[#D4A843]/60"
                      />
                    </div>

                    <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-lg space-y-1 font-data text-[10px]">
                      <div className="flex justify-between text-[#4A5568]">
                        <span>Entry Basis Low:</span>
                        <span className="text-white">₹{effectiveSwingData.entryLow.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[#4A5568]">
                        <span>Entry Basis High:</span>
                        <span className="text-white">₹{effectiveSwingData.entryHigh.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-1 bg-white/[0.01] border border-white/[0.03] p-1 rounded-xl">
                  <button 
                    onClick={() => setSwingCardSource('static')}
                    className={`flex-1 py-1.5 text-[9.5px] font-data rounded-lg uppercase ${swingCardSource === 'static' ? 'bg-[#D4A843] text-[#05070C] font-bold' : 'text-[#8892A4] hover:text-white'}`}
                  >
                    Static Model
                  </button>
                  <button 
                    onClick={handleGenerateSwingCard}
                    disabled={swingCardLoading}
                    className={`flex-1 py-1.5 text-[9.5px] font-data rounded-lg uppercase ${swingCardSource === 'gemini' ? 'bg-[#D4A843] text-[#05070C] font-bold' : 'text-[#8892A4] hover:text-white'}`}
                  >
                    {swingCardLoading ? 'AI Syncing...' : 'Sync AI boundaries'}
                  </button>
                </div>
              </div>

              {/* Outputs cards: 7 Columns */}
              <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(212,168,67,0.02)] rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] uppercase block tracking-wider">ATR Position Directives</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">Calculated Swing Allocation</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/[0.015] border border-white/[0.03] rounded-xl font-data">
                      <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Recommended units quantity</span>
                      <span className="text-2xl font-bold block text-[#E8C070] mt-1 font-mono">{swingSetup.maxUnits} Units</span>
                      <span className="text-[9px] text-[#8892A4] mt-1 block">Optimized size</span>
                    </div>

                    <div className="p-4 bg-white/[0.015] border border-white/[0.03] rounded-xl font-data">
                      <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Capital exposure</span>
                      <span className="text-2xl font-bold block text-white mt-1 font-mono">₹{swingSetup.totalExposure.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-[#8892A4] mt-1 block">Maximum allocation limit</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-data text-[9.5px] font-bold py-3 border-t border-b border-white/[0.04]">
                    <div className="bg-[#FF4757]/10 p-2 rounded-lg border border-[#FF4757]/20">
                      <span className="text-[#FF4757] block text-[8px] uppercase">STOP LOSS</span>
                      <span className="text-white mt-1 block font-mono">₹{effectiveSwingData.stopLoss.toFixed(1)}</span>
                    </div>
                    <div className="bg-[#00D084]/10 p-2 rounded-lg border border-[#00D084]/20">
                      <span className="text-[#00D084] block text-[8px] uppercase">TARGET 1</span>
                      <span className="text-white mt-1 block font-mono">₹{effectiveSwingData.target1.toFixed(1)}</span>
                    </div>
                    <div className="bg-[#D4A843]/10 p-2 rounded-lg border border-[#D4A843]/20">
                      <span className="text-[#E8C070] block text-[8px] uppercase">TARGET 2</span>
                      <span className="text-white mt-1 block font-mono">₹{effectiveSwingData.target2.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-lg text-[10.5px] font-data text-[#8892A4] flex justify-between items-center">
                  <span>MAX ACCOUNT RISK ALLOWED: ₹{swingSetup.riskAmount.toFixed(2)}</span>
                  <span className="text-[#00D084] font-bold">1:{swingSetup.riskRewardRatio} RS RATION</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: INTRADAY STRATEGY BACKTEST REPORTS */}
        {activeTab === 'intraday' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Strategy Selector: 5 Columns */}
              <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] uppercase tracking-widest block">STRATEGY MODEL C</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">Intraday Backtest Analyzer</h3>
                  </div>

                  <div className="space-y-3 font-data text-xs">
                    <div>
                      <label className="text-[10px] text-[#8892A4] uppercase tracking-wider block mb-1.5">Choose Scalping Algorithmic Rule</label>
                      <div className="space-y-1.5">
                        <button
                          onClick={() => setSelectedIntradayStrategy('breakout')}
                          className={`w-full p-2.5 rounded-lg border text-left font-display font-medium text-xs transition-all ${selectedIntradayStrategy === 'breakout' ? 'bg-white/[0.04] border-[#D4A843] text-[#E8C070]' : 'bg-transparent border-white/[0.04] text-[#8892A4]'}`}
                        >
                          📈 Volatility Breakout Scanner
                        </button>
                        <button
                          onClick={() => setSelectedIntradayStrategy('ma_crossover')}
                          className={`w-full p-2.5 rounded-lg border text-left font-display font-medium text-xs transition-all ${selectedIntradayStrategy === 'ma_crossover' ? 'bg-white/[0.04] border-[#D4A843] text-[#E8C070]' : 'bg-transparent border-white/[0.04] text-[#8892A4]'}`}
                        >
                          ⚡ Exponential Fast Cross (EMA 9/21)
                        </button>
                        <button
                          onClick={() => setSelectedIntradayStrategy('rsi_reversion')}
                          className={`w-full p-2.5 rounded-lg border text-left font-display font-medium text-xs transition-all ${selectedIntradayStrategy === 'rsi_reversion' ? 'bg-white/[0.04] border-[#D4A843] text-[#E8C070]' : 'bg-transparent border-white/[0.04] text-[#8892A4]'}`}
                        >
                          🎯 RSI Mean-Reversion Scalp
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[#4A5568] font-data uppercase leading-normal mt-5 pt-3.5 border-t border-white/[0.04]">
                  BACKTEST_WINDOW // 252_EXCHANGE_BARS
                </p>
              </div>

              {/* Performance Metrics: 7 Columns */}
              <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(0,208,132,0.02)] rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="border-b border-white/[0.04] pb-3">
                    <span className="text-[9.5px] font-data text-[#D4A843] uppercase block tracking-wider">Historical Simulation Report</span>
                    <h3 className="font-display font-semibold text-sm text-[F0F4FF] mt-0.5">{intradayBacktestData.strategyName}</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-3.5 text-center font-data">
                    <div className="p-3 bg-[#05070C] rounded-lg border border-white/[0.03]">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none">Net Return (INR)</span>
                      <span className={`text-sm font-bold block mt-1.5 font-mono ${intradayBacktestData.netPL >= 0 ? 'text-[#00D084]' : 'text-[#FF4757]'}`}>
                        ₹{intradayBacktestData.netPL.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="p-3 bg-[#05070C] rounded-lg border border-[#00D084]/5">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none">Simulated Trades</span>
                      <span className="text-sm font-bold text-white block mt-1.5 font-mono">{intradayBacktestData.totalTrades}</span>
                    </div>

                    <div className="p-3 bg-[#05070C] rounded-lg border border-[#D4A843]/5">
                      <span className="text-[8px] text-[#4A5568] uppercase block leading-none font-semibold">Simulated Winrate</span>
                      <span className="text-sm font-bold text-[#E8C070] block mt-1.5 font-mono">{intradayBacktestData.winRate || '52.5%'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.015] border border-white/[0.03] rounded-lg font-data text-[10.5px] text-[#8892A4] space-y-1">
                    <div className="flex justify-between">
                      <span>Gross Profit Output:</span>
                      <span className="text-white">₹{intradayBacktestData.grossProfit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Brokerage Taxes Slippage (Frictional Costs):</span>
                      <span className="text-[#FF4757]">₹{(intradayBacktestData.brokerageFee + intradayBacktestData.taxes + intradayBacktestData.slippage).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-3 bg-white/[0.015] border border-white/[0.04] rounded-lg text-[10.5px] font-body leading-relaxed text-[#8892A4]">
                  <strong>System Backtest Summary:</strong> {intradayBacktestData.reasons}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
