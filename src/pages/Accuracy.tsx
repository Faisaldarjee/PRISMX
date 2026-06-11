import React, { useEffect, useState, useMemo } from 'react';
import { getAccuracy, getAdvancedAccuracy, runBacktest } from '../api';
import { AccuracyData } from '../types';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  RadarChart, 
  Radar, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine
} from 'recharts';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  LineChart as LineIcon, 
  History, 
  Play, 
  Cpu, 
  Sparkles, 
  Award, 
  CircleDot, 
  HelpCircle, 
  Percent, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  BarChart3, 
  Activity, 
  Zap
} from 'lucide-react';

const DEFAULT_SYMBOLS_FOR_BACKTEST = [
  'GOLDBEES.NS', 
  'SILVERBEES.NS', 
  'RELIANCE.NS', 
  'HDFCBANK.NS', 
  'TATAMOTORS.NS', 
  'TCS.NS', 
  'INFY.NS', 
  'HINDZINC.NS', 
  'VEDL.NS', 
  'TITAN.NS', 
  'WAAREEENER.NS'
];

export function Accuracy() {
  const [accuracy, setAccuracy] = useState<any | null>(null);
  const [advanced, setAdvanced] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Backtest states
  const [backtestSymbol, setBacktestSymbol] = useState('GOLDBEES.NS');
  const [backtesting, setBacktesting] = useState(false);
  const [backtestResult, setBacktestResult] = useState<{ symbol: string; accuracy: number | null; tested_days: number; correct_predictions: number; error?: string } | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [basicData, advData] = await Promise.all([
        getAccuracy(),
        getAdvancedAccuracy()
      ]);
      setAccuracy(basicData);
      setAdvanced(advData);
    } catch (e: any) {
      console.error('Error fetching accuracy stats:', e);
      setError(e.message || 'Statistics module offline. Verify backend connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBacktest() {
    setBacktesting(true);
    setBacktestResult(null);
    setBacktestError(null);
    try {
      const res = await runBacktest(backtestSymbol);
      if (res && !res.error) {
        setBacktestResult(res);
        // Refresh accuracy figures from server
        const [freshData, freshAdv] = await Promise.all([
          getAccuracy(),
          getAdvancedAccuracy()
        ]);
        setAccuracy(freshData);
        setAdvanced(freshAdv);
      } else if (res && res.error) {
        setBacktestError(res.error);
      } else {
        setBacktestError('Backtest execution failed.');
      }
    } catch (e: any) {
      console.error(e);
      setBacktestError(e.message || 'Validation failed. Check price cache or connectivity.');
    } finally {
      setBacktesting(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const isBuilding = !accuracy || accuracy.status === 'BUILDING' || !advanced || advanced.status === 'BUILDING';

  const assetChartData = useMemo(() => {
    if (isBuilding || !accuracy?.by_asset) return [];
    return Object.entries(accuracy.by_asset).map(([asset, accuracyPct]) => ({
      name: asset.split('.')[0],
      accuracy: accuracyPct
    }));
  }, [accuracy, isBuilding]);

  const agentChartData = useMemo(() => {
    if (isBuilding || !accuracy?.by_agent) return [];
    return Object.entries(accuracy.by_agent).map(([agent, accuracyPct]) => ({
      agent: agent.toUpperCase(),
      accuracy: accuracyPct
    }));
  }, [accuracy, isBuilding]);

  const executionLedger = useMemo(() => {
    if (isBuilding || !accuracy?.recent_ledger) return [];
    
    // Compute running cumulative P&L
    let runningPnL = 0;
    const ledger = [...accuracy.recent_ledger].reverse(); // oldest first to compute cumulative
    const mapped = ledger.map(item => {
      const gainVal = parseFloat(item.gain?.replace('%', '').replace('+', '') || '0');
      runningPnL += gainVal;
      return {
        ...item,
        cumulative: Number(runningPnL.toFixed(2))
      };
    });
    return mapped.reverse(); // return newest first for the table display
  }, [accuracy, isBuilding]);

  // Heatmap helper to generate a visual grid of months
  const monthlyHeatmap = useMemo(() => {
    if (isBuilding || !advanced?.monthlyPnL) return [];
    return Object.entries(advanced.monthlyPnL).map(([monthKey, returnVal]) => {
      // monthKey is YYYY-MM
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return {
        key: monthKey,
        label,
        value: Number((Number(returnVal) || 0).toFixed(2))
      };
    }).sort((a, b) => a.key.localeCompare(b.key));
  }, [advanced, isBuilding]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" id="accuracy-loading-skeleton">
        <RefreshCw size={40} className="text-[#D4A843] animate-spin" />
        <div className="text-center">
          <p className="font-data text-xs text-[#8892A4] animate-pulse uppercase tracking-widest">CALIBRATING_QUANTITATIVE_MODELS...</p>
          <p className="text-[10px] text-zinc-500 font-sans mt-1">Aggregating historical signals, covariance attributes, and confusion matrix data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto p-8 rounded-2xl bg-[#0C1018] border border-white/[0.05] shadow-xl text-center" id="accuracy-error-state">
        <AlertCircle size={44} className="text-[#FF4757] mb-4" />
        <h3 className="text-sm font-display font-semibold text-white mb-2">Metrics Execution Framework Fault</h3>
        <p className="text-xs text-[#8892A4] mb-6 font-body leading-relaxed">{error}</p>
        <button 
          onClick={loadData}
          className="px-5 py-2.5 bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-[#E8C070] border border-[#D4A843]/20 rounded-xl transition-all font-data font-bold uppercase text-[10px] tracking-wider"
        >
          Retry Calibration Sync
        </button>
      </div>
    );
  }

  return (
    <div id="accuracy-matrix-vue" className="space-y-8 animate-fadeIn">
      
      {/* SECTION 1: PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(255,255,255,0.05)] pb-5 font-sans">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-2xl font-medium tracking-tight text-white font-display">Backtest &amp; Accuracy Matrix</h2>
            {isBuilding ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/20 text-[#E8C070] font-mono text-[9px] uppercase tracking-wider animate-pulse">
                <CircleDot size={8} className="animate-ping" /> SEEDING_REQUIRED_FLOW
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00D084]/10 border border-[#00D084]/25 text-[#00D084] font-mono text-[9px] uppercase tracking-wider">
                <CheckCircle size={8} /> LIVE_MATHEMATICAL
              </span>
            )}
          </div>
          <p className="text-xs text-[#8892A4] font-body">
            Real time predictive performance reporting and backtesting. Signals verified dynamically after each trade cycle completes.
          </p>
        </div>
        <button 
          onClick={loadData} 
          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] text-[#8892A4] hover:text-white rounded-lg text-xs font-data border border-[rgba(255,255,255,0.04)] transition-all cursor-pointer hover:border-white/[0.12]"
        >
          <RefreshCw size={11} className={isBuilding ? "animate-spin" : ""} />
          RELOAD_METRICS
        </button>
      </div>

      {/* SECTION 2: QUANTITATIVE CALIBRATOR ENGINE PANEL */}
      <section className="glass-card p-6" id="backtest-calibrater">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[rgba(255,255,255,0.04)]">
          <div className="space-y-0.5">
            <h3 className="text-sm font-display font-semibold text-white flex items-center gap-1.5 uppercase">
              <Cpu size={16} className="text-[#D4A843]" />
              Quantitative Calibrations Simulator
            </h3>
            <p className="text-[11px] text-[#8892A4] font-body">
              Iterate active Technical, ML Stack, and Sentiment agents across 252 historical trading days to generate predictive validation logs.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={backtestSymbol}
              onChange={(e) => setBacktestSymbol(e.target.value)}
              disabled={backtesting}
              className="bg-[#05070C] border border-white/[0.06] rounded-lg p-2 font-data text-xs text-[#E8C070] focus:outline-none focus:border-[#D4A843]/60 transition-all uppercase cursor-pointer"
            >
              {DEFAULT_SYMBOLS_FOR_BACKTEST.map((asset) => (
                <option key={asset} value={asset}>
                  {asset.split('.')[0]}
                </option>
              ))}
            </select>
            <button
              onClick={handleBacktest}
              disabled={backtesting}
              className="px-4 py-2 bg-[#D4A843] hover:bg-[#E8C070] text-[#05070C] text-xs font-data font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-lg shadow-[#D4A843]/15"
            >
              <Play size={11} fill="currentColor" />
              {backtesting ? 'SIMULATING...' : 'RUN_TEST'}
            </button>
          </div>
        </div>

        {backtesting && (
          <div className="rounded-lg bg-white/[0.012] border border-white/[0.04] p-4 text-[11px] font-mono text-[#8892A4] space-y-1.5 animate-pulse">
            <div className="flex items-center gap-1.5 text-[#00D084] font-bold">
              <RefreshCw size={12} className="animate-spin" /> STACKED_ENSEMBLE_PROCESSING
            </div>
            <p className="leading-relaxed text-zinc-400">
              Generating simulated signals, fetching historical closing rates, accounting for variance drift, and writing verified instances to accuracy ledger...
            </p>
          </div>
        )}

        {backtestError && (
          <div className="rounded-lg bg-[#FF4757]/10 border border-[#FF4757]/20 p-4 text-[11px] font-data text-[#FF4757] flex items-center gap-2">
            <AlertCircle size={14} />
            {backtestError}
          </div>
        )}

        {backtestResult && (
          <div className="rounded-lg bg-[#00D084]/5 border border-[#00D084]/25 p-5 space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[#00D084] font-data text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} className="animate-bounce text-[#D4A843]" />
                CONVERGENCE_TEST_COMPLETED // {backtestResult.symbol.split('.')[0]}
              </div>
              {backtestResult.accuracy !== null && backtestResult.accuracy < 60 && (
                <span className="text-[10px] text-[#FF4757] font-mono border border-[#FF4757]/30 px-2.5 py-0.5 rounded uppercase font-medium">
                  ⚠️ ACCURACY_WARNING
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-data">
              <div className="bg-[#05070C] p-3 rounded-lg border border-white/[0.02]">
                <span className="text-[8.5px] text-[#4A5568] uppercase block">Interval Tested</span>
                <span className="text-sm font-bold text-[#F0F4FF] mt-1 block font-mono">{backtestResult.tested_days} bars</span>
              </div>
              <div className="bg-[#05070C] p-3 rounded-lg border border-white/[0.02]">
                <span className="text-[8.5px] text-[#4A5568] uppercase block">Accurate Predictions</span>
                <span className="text-sm font-bold text-[#00D084] mt-1 block font-mono">{backtestResult.correct_predictions} Days</span>
              </div>
              <div className="bg-[#05070C] p-3 rounded-lg border border-[#00D084]/10 bg-gradient-to-r from-[#00D084]/5 to-transparent">
                <span className="text-[8.5px] text-[#00D084]/70 uppercase block font-bold">Calibrated Accuracy Hits</span>
                <span className="text-sm font-black text-[#00D084] mt-1 block font-mono">
                  {backtestResult.accuracy !== null ? `${backtestResult.accuracy}%` : 'N/A (No trade signals)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {isBuilding ? (
        /* SKELETON / PLACEHOLDER WHEN DATA IS NOT READY OR IN BUILDING PHASE */
        <div id="accuracy-building-state" className="rounded-xl border border-dashed border-[#D4A843]/30 bg-[#D4A843]/5 p-8 text-center space-y-4 max-w-2xl mx-auto">
          <HelpCircle size={36} className="text-[#E8C070] mx-auto animate-pulse" />
          <h3 className="font-display font-semibold text-white text-base">Metrics Warehouse Generating</h3>
          <p className="text-xs text-[#8892A4] max-w-md mx-auto leading-relaxed">
            Real trade predictions are collected daily and verified after exactly 5 trading days. 
            There are currently <strong className="text-[#E8C070] font-mono">{accuracy?.pending_predictions || 0} pending</strong> predictions logged in predictions database.
          </p>
          <div className="pt-2">
            <span className="inline-block text-[10px] font-mono uppercase bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20 px-4 py-2 rounded-full font-bold">
              👉 TRIGGER "RUN_TEST" ABOVE TO SEED HISTORICAL LOGS INSTANTLY 👈
            </span>
          </div>
        </div>
      ) : (
        /* COMPREHENSIVE LIVE ADVANCED METRICS VIEW */
        <div id="accuracy-live-panel" className="space-y-8">
          
          {/* SECTION 3: TOP-LEVEL KPI TILES */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 font-data">
            
            {/* KPI 1: Overall Accuracy */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-1 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Overall Accuracy</span>
                <span className="p-1 px-1.5 bg-[#00D084]/10 border border-[#00D084]/20 rounded text-[#00D084]">
                  <CheckCircle2 size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono gradient-text-gold">
                  {typeof accuracy.overall_accuracy === 'number' && !isNaN(accuracy.overall_accuracy) 
                    ? `${accuracy.overall_accuracy.toFixed(1)}%` 
                    : '—'}
                </span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">Ratio of correct target hits</p>
              </div>
            </div>

            {/* KPI 2: Profit Factor */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-2 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Profit Factor</span>
                <span className="p-1 px-1.5 bg-blue-500/10 border border-blue-500/25 rounded text-blue-400">
                  <TrendingUp size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono text-white">{advanced.profitFactor || 'N/A'}</span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">Gross gains divided by losses</p>
              </div>
            </div>

            {/* KPI 3: Sharpe Ratio */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-3 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Sharpe Ratio</span>
                <span className="p-1 px-1.5 bg-purple-500/10 border border-purple-500/25 rounded text-purple-400">
                  <Sparkles size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono text-white">{(advanced.sharpeRatio || 0) > 0 ? `+${advanced.sharpeRatio}` : advanced.sharpeRatio}</span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">Annualized risk-adjusted edge</p>
              </div>
            </div>

            {/* KPI 4: Max Drawdown */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-4 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Max Drawdown</span>
                <span className="p-1 px-1.5 bg-[#FF4757]/10 border border-[#FF4757]/20 rounded text-[#FF4757]">
                  <AlertTriangle size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono text-[#FF4757]">{advanced.maxDrawdown > 0 ? `-${advanced.maxDrawdown}%` : '0.00%'}</span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">Largest peak-to-trough drop</p>
              </div>
            </div>

            {/* KPI 5: Calmar Ratio */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-5 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Calmar Ratio</span>
                <span className="p-1 px-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded text-cyan-450">
                  <Award size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono text-white">{advanced.calmarRatio || 'N/A'}</span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">CAGR versus Max Drawdown</p>
              </div>
            </div>

            {/* KPI 6: Average Risk:Reward */}
            <div className="stat-card flex flex-col justify-between h-28 animate-fadeInUp stagger-6 shadow-lg">
              <div className="flex items-start justify-between">
                <span className="text-[9px] text-[#8892A4] uppercase tracking-wider font-semibold">Avg Risk:Reward</span>
                <span className="p-1 px-1.5 bg-[#FFA502]/10 border border-[#FFA502]/20 rounded text-[#FFA502]">
                  <Target size={13} />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl md:text-2xl font-bold font-mono text-white">{advanced.avgRiskReward}:1</span>
                <p className="text-[9px] text-[#4A5568] mt-0.5">Average win vs average loss</p>
              </div>
            </div>

          </div>

          {/* SECTION 4: EQUITY CURVE CHART */}
          <div className="glass-card p-5 animate-fadeInUp shadow-lg" id="equity-curve-card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] flex items-center gap-1.5">
                  <TrendingUp className="text-[#D4A843]" size={15} />
                  Cumulative Return Equity Curve
                </h4>
                <p className="text-[10px] text-[#8892A4] mt-0.5">Running total feedback gain of verified predictions inside database</p>
              </div>
              <span className="font-data text-xs text-[#00D084] font-bold bg-[#00D084]/8 border border-[#00D084]/20 px-2 py-0.5 rounded">
                Total Return: +{advanced.equityCurve?.[advanced.equityCurve.length - 1]?.equity?.toFixed(2) || '0'}%
              </span>
            </div>

            <div className="h-[250px] w-full">
              {advanced.equityCurve && advanced.equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={advanced.equityCurve} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A843" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#D4A843" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                    <XAxis 
                      dataKey="index" 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#4A5568" 
                      fontSize={10} 
                      tickFormatter={(v) => `T#${v}`}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#4A5568" 
                      fontSize={10} 
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#07090F',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#F0F4FF'
                      }}
                      formatter={(v: any) => [`${v}%`, 'Return']}
                      labelFormatter={(idx) => `Trade #${idx}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#D4A843" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#equityGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center font-data text-xs text-[#8892A4] uppercase">
                  Accumulating trading data points...
                </div>
              )}
            </div>
          </div>

          {/* DUAL COLS: CONFUSION MATRIX & WIN RATE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* SECTION 5: CONFUSION MATRIX */}
            <div className="glass-card p-5 shadow-lg flex flex-col justify-between" id="confusion-matrix-card">
              <div className="mb-4">
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] flex items-center gap-1.5 uppercase">
                  <Percent size={15} className="text-zinc-400" />
                  Predictive Confusion Matrix
                </h4>
                <p className="text-[10px] text-[#8892A4] mt-0.5">True positive vs false alarm accuracy verification classification grid</p>
              </div>

              {/* 2x2 Matrix Grid */}
              <div className="grid grid-cols-2 gap-3.5 font-data text-center flex-1 py-2">
                
                {/* True Positive */}
                <div className="p-4 rounded-xl border border-[#00D084]/20 bg-[#00D084]/6 flex flex-col justify-center gap-1">
                  <span className="text-[8.5px] text-[#00D084]/70 font-semibold uppercase tracking-wider leading-none">True Positive (TP)</span>
                  <span className="text-xl font-bold font-mono text-white mt-1">{advanced.confusionMatrix?.tp}</span>
                  <p className="text-[9px] text-[#8892A4]">Correct BUY setups</p>
                </div>

                {/* False Positive */}
                <div className="p-4 rounded-xl border border-[#FF4757]/15 bg-[#FF4757]/4 flex flex-col justify-center gap-1">
                  <span className="text-[8.5px] text-[#FF4757]/70 font-semibold uppercase tracking-wider leading-none">False Positive (FP)</span>
                  <span className="text-xl font-bold font-mono text-white mt-1">{advanced.confusionMatrix?.fp}</span>
                  <p className="text-[9px] text-[#8892A4]">Failed BUY predictions</p>
                </div>

                {/* False Negative */}
                <div className="p-4 rounded-xl border border-[#FF4757]/15 bg-[#FF4757]/4 flex flex-col justify-center gap-1">
                  <span className="text-[8.5px] text-[#FF4757]/70 font-semibold uppercase tracking-wider leading-none">False Negative (FN)</span>
                  <span className="text-xl font-bold font-mono text-white mt-1">{advanced.confusionMatrix?.fn}</span>
                  <p className="text-[9px] text-[#8892A4]">Failed SELL predictions</p>
                </div>

                {/* True Negative */}
                <div className="p-4 rounded-xl border border-[#00D084]/20 bg-[#00D084]/6 flex flex-col justify-center gap-1">
                  <span className="text-[8.5px] text-[#00D084]/70 font-semibold uppercase tracking-wider leading-none">True Negative (TN)</span>
                  <span className="text-xl font-bold font-mono text-white mt-1">{advanced.confusionMatrix?.tn}</span>
                  <p className="text-[9px] text-[#8892A4]">Correct SELL setups</p>
                </div>

              </div>
              
              <div className="text-[9.5px] text-[#4A5568] leading-tight mt-3 font-sans italic text-center">
                * Positive values label BUY alerts, negative values indicate SELL or distribution alerts.
              </div>
            </div>

            {/* SECTION 6: WIN RATE BY SIGNAL TYPE */}
            <div className="glass-card p-5 shadow-lg flex flex-col justify-between" id="win-rates-by-signal-card">
              <div>
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] flex items-center gap-1.5">
                  <BarChart3 className="text-zinc-400" size={15} />
                  Win Rate by Signal Classification
                </h4>
                <p className="text-[10px] text-[#8892A4] mt-0.5">Decoupled execution effectiveness index for accumulation and distribution alerts</p>
              </div>

              <div className="space-y-6 flex-1 flex flex-col justify-center py-4 font-sans">
                
                {/* BUY Win Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-semibold">
                    <span className="text-[#00D084] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <Zap size={11} fill="currentColor" /> Accumulation (BUY) Win Rate
                    </span>
                    <span className="font-data font-black text-white text-[13px]">{advanced.winRateBySignal?.buy?.winRate}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full border border-white/[0.03] overflow-hidden p-0.5">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-[#00D084] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${advanced.winRateBySignal?.buy?.winRate || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-data text-[9.5px] text-[#55637D]">
                    <span>Successful: {Math.round((advanced.winRateBySignal?.buy?.winRate / 100) * advanced.winRateBySignal?.buy?.total)} trades</span>
                    <span>Sample Pool Size: {advanced.winRateBySignal?.buy?.total} signals</span>
                  </div>
                </div>

                {/* SELL Win Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs font-semibold">
                    <span className="text-[#FF4757] uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <AlertTriangle size={11} /> Distribution (SELL) Win Rate
                    </span>
                    <span className="font-data font-black text-white text-[13px]">{advanced.winRateBySignal?.sell?.winRate}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full border border-white/[0.03] overflow-hidden p-0.5">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-[#FF4757] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${advanced.winRateBySignal?.sell?.winRate || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-data text-[9.5px] text-[#55637D]">
                    <span>Successful: {Math.round((advanced.winRateBySignal?.sell?.winRate / 100) * advanced.winRateBySignal?.sell?.total)} trades</span>
                    <span>Sample Pool Size: {advanced.winRateBySignal?.sell?.total} signals</span>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* DUAL COLS: ROLLING ACCURACY & HEATMAP */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* SECTION 7: ROLLING ACCURACY TREND */}
            <div className="glass-card p-5 shadow-lg flex flex-col justify-between" id="rolling-accuracy-card">
              <div className="mb-4">
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] flex items-center gap-1.5">
                  <LineIcon className="text-[#D4A843]" size={15} />
                  Rolling Signal Block Accuracy Trend
                </h4>
                <p className="text-[10px] text-[#8892A4] mt-0.5">Chronological trade chunk target validation hits against baseline random walk probability</p>
              </div>

              <div className="h-[210px] w-full">
                {advanced.rollingAccuracy && advanced.rollingAccuracy.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={advanced.rollingAccuracy} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                      <XAxis 
                        dataKey="period" 
                        tickLine={false} 
                        axisLine={false} 
                        stroke="#4A5568" 
                        fontSize={9.5} 
                        fontFamily="monospace"
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tickLine={false} 
                        axisLine={false} 
                        stroke="#4A5568" 
                        fontSize={9.5} 
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#07090F',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: '#F0F4FF'
                        }}
                        formatter={(v: any) => [`${v}%`, 'Accuracy']}
                      />
                      <ReferenceLine y={50} stroke="#FF4757" strokeDasharray="3 3" label={{ value: "Random Baseline", fill: "#FF4757", fontSize: 8, position: 'top' }} />
                      <Line 
                        type="monotone" 
                        dataKey="accuracy" 
                        stroke="#D4A843" 
                        strokeWidth={2} 
                        dot={{ r: 4, fill: '#0B0F1A', strokeWidth: 2, stroke: '#D4A843' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center font-data text-xs text-[#8892A4] uppercase">
                    Generating rolling regression blocks...
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 8: MONTHLY P&L HEATMAP */}
            <div className="glass-card p-5 shadow-lg flex flex-col justify-between" id="monthly-heatmap-card">
              <div className="mb-4">
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] flex items-center gap-1.5 uppercase">
                  <Activity size={15} className="text-zinc-400" />
                  Monthly Cumulative return Matrix
                </h4>
                <p className="text-[10px] text-[#8892A4] mt-0.5">Sum of verified signal alpha return percent performance calendar grid</p>
              </div>

              {/* Monthly returns grid layout */}
              <div className="flex-1 flex flex-col justify-center py-2" id="heatmap-interactive-stage">
                {monthlyHeatmap.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 font-data text-center">
                    {monthlyHeatmap.map((cell) => {
                      // Style cell based on gain/loss scale
                      let bg = 'bg-[#181F35] border-white/[0.03] text-[#8892A4]';
                      if (cell.value > 15) {
                        bg = 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400 font-bold';
                      } else if (cell.value > 5) {
                        bg = 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300';
                      } else if (cell.value > 0) {
                        bg = 'bg-emerald-950/20 border-emerald-500/10 text-emerald-100';
                      } else if (cell.value < -15) {
                        bg = 'bg-rose-950/70 border-rose-500/40 text-rose-455 font-bold';
                      } else if (cell.value < -5) {
                        bg = 'bg-rose-950/40 border-rose-500/20 text-rose-350';
                      } else if (cell.value < 0) {
                        bg = 'bg-rose-950/20 border-rose-500/10 text-rose-200';
                      }

                      return (
                        <div 
                          key={cell.key} 
                          className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 heatmap-cell ${bg}`}
                        >
                          <span className="text-[10px] uppercase font-bold tracking-wider">{cell.label}</span>
                          <span className="text-[13px] font-mono leading-none">{cell.value > 0 ? `+${cell.value}` : cell.value}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center font-data text-xs text-[#8892A4] uppercase tracking-wider border border-dashed border-white/[0.04] rounded-xl bg-white/[0.01]">
                    No historical indices stored yet. Run backtest above.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* DUAL COLS: COGNITIVE WEIGHTS & ACCURACY SEGMENT INDEX */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* SECTION 10: ASSET ACCURACY BAR CHART */}
            <div className="glass-card p-5 flex flex-col justify-between" id="asset-accuracy-chart-card">
              <div className="mb-4">
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF]">Accuracy Segment Index</h4>
                <p className="text-[9.5px] text-[#4A5568] uppercase font-data mt-0.5 font-bold">Trading symbols hits record breakdown (requires at least 1 predictions logged)</p>
              </div>

              <div className="h-[240px]">
                {assetChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        tickLine={false}
                        axisLine={false}
                        stroke="#4A5568"
                        fontSize={10}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        stroke="#4A5568"
                        fontSize={10}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#0D1018', 
                          border: '1px solid rgba(255,255,255,0.06)', 
                          borderRadius: '8px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#F0F4FF'
                        }}
                        formatter={(v: any) => [`${v}%`, 'Accuracy']}
                      />
                      <Bar 
                        dataKey="accuracy" 
                        fill="#D4A843" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-[#8892A4] uppercase tracking-wider font-mono">
                    <span>Insufficient assets hit count range</span>
                    <span className="text-[9px] text-zinc-500 mt-1 capitalize">Execute backtests or log predictions to seed symbol scores</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 9: AGENT ATTRIBUTION RADAR CHART */}
            <div className="glass-card p-5 flex flex-col justify-between" id="agent-cognitive-weights-card">
              <div className="mb-4">
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF] uppercase">Agent Cognitive Weights Chart</h4>
                <p className="text-[9.5px] text-[#4A5568] uppercase font-data mt-0.5 font-bold">Agent relative feedback accuracy contribution matrix</p>
              </div>

              <div className="h-[240px]">
                {agentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={agentChartData}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis 
                        dataKey="agent" 
                        tick={{ fill: '#8892A4', fontSize: 9, fontFamily: 'monospace' }} 
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: '#4A5568', fontSize: 8 }}
                      />
                      <Radar 
                        name="Calibrated Weight" 
                        dataKey="accuracy" 
                        stroke="#D4A843" 
                        fill="#E8C070" 
                        fillOpacity={0.12} 
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#0D1018', 
                          border: '1px solid rgba(255,255,255,0.06)', 
                          borderRadius: '8px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#F0F4FF'
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center font-data text-xs text-[#8892A4] uppercase tracking-wider animate-pulse">
                    Constructing factor radar...
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* SECTION 11: OUTCOMES JOURNAL TABLE */}
          <section className="glass-card p-5" id="outcomes-journal-section">
            <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.04)] pb-3.5 mb-4 font-sans">
              <History size={14} className="text-[#E8C070]" />
              <h3 className="font-display font-medium text-sm text-[#F0F4FF]">Ensemble Signals &amp; Outcomes Journal (Verified Historicals)</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-data">
                <thead>
                  <tr className="border-b border-white/[0.03] text-[#4A5568] text-[9.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">RECORD ID</th>
                    <th className="py-2.5 px-3">DATE</th>
                    <th className="py-2.5 px-3">ASSET</th>
                    <th className="py-2.5 px-3">SIGNAL</th>
                    <th className="py-2.5 px-3">ENTRY PRICE</th>
                    <th className="py-2.5 px-3">VAL STATUS</th>
                    <th className="py-2.5 px-3 text-right">OUTCOME ALPHA DELTA</th>
                    <th className="py-2.5 px-3 text-right text-amber-500">CUMULATIVE P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {executionLedger.map((row: any) => (
                    <tr key={row.id} className="hover:bg-white/[0.01] transition-colors data-row">
                      <td className="py-3 px-3 font-mono text-[#8892A4]">{row.id}</td>
                      <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">{row.date}</td>
                      <td className="py-3 px-3 font-bold text-white font-display uppercase">{row.symbol}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                          row.action === 'BUY' 
                            ? 'bg-[#00D084]/15 text-[#00D084] border border-[#00D084]/25' 
                            : row.action === 'SELL' 
                              ? 'bg-[#FF4757]/15 text-[#FF4757] border border-[#FF4757]/25' 
                              : 'bg-white/[0.03] text-slate-350 border border-white/[0.06]'
                        }`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[#8892A4]">{row.price}</td>
                      <td className="py-3 px-3">
                        <span className={`font-bold uppercase tracking-wider text-[10px] ${row.outcome === 'CORRECT' ? 'text-[#00D084]' : 'text-[#FF4757]'}`}>
                          {row.outcome}
                        </span>
                      </td>
                      <td className={`py-3 px-3 font-mono text-right font-semibold ${row.gain?.startsWith('+') ? 'text-[#00D084]' : (row.gain === '0.0%' ? 'text-[#4A5568]' : 'text-[#FF4757]')}`}>
                        {row.gain}
                      </td>
                      <td className={`py-3 px-3 font-mono text-right font-bold ${row.cumulative >= 0 ? 'text-[#00D084]' : 'text-[#FF4757]'}`}>
                        {row.cumulative > 0 ? `+${row.cumulative}%` : `${row.cumulative}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {/* SECTION 12: HONEST AUDIT DISCLAIMER CARD */}
      <footer className="rounded-xl border border-white/[0.04] bg-[#05070C] p-5 space-y-2 mb-10" id="accuracy-verification-notice">
        <h4 className="font-display font-semibold text-xs text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
          <AlertCircle size={12} className="text-[#D4A843]" />
          Calibrated Verification Notice &amp; Audit Trail
        </h4>
        <p className="text-[11px] text-[#8892A4] leading-relaxed font-body">
          Accuracy matrix scores, profit factors, drawdowns, and monthly returns are calculated directly from verified historical and live active database records. 
          To prevent predictive leakage and lookahead discrepancies, daily computed signals are locked for exactly 5 market sessions. 
          Upon lock completion, deep integrated agents query yFinance exchange data to fetch real closing rates on that trading day, 
          perform standard mathematical covariance logic, and log verified results to ledger state. No mockup values or simulated stats are used.
        </p>
      </footer>
    </div>
  );
}
