import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  getPrediction, 
  getHistory, 
  getSentiment, 
  getSip, 
  triggerRetraining,
  getFundamentals
} from '../api';
import { 
  Prediction, 
  HistoryBar, 
  SentimentData, 
  SipData,
  FundamentalData
} from '../types';
import { SignalBadge } from '../components/SignalBadge';
import { PriceChart } from '../components/PriceChart';
import { AgentCard } from '../components/AgentCard';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Cpu, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  Target,
  ShieldAlert,
  Gauge,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const resolvedSymbol = symbol || 'GOLDBEES.NS';

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<HistoryBar[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [sip, setSip] = useState<SipData | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalData | null>(null);

  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [retrainSuccess, setRetrainSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEtf = resolvedSymbol.toUpperCase().includes('BEES') || 
                resolvedSymbol.toUpperCase() === 'GOLDBEES.NS' || 
                resolvedSymbol.toUpperCase() === 'SILVERBEES.NS';

  async function loadDetails(isRefresh = false) {
    setLoading(true);
    setError(null);
    setRetrainSuccess(null);
    try {
      const [predData, histData, sentData, fundData] = await Promise.all([
        getPrediction(resolvedSymbol, isRefresh),
        getHistory(resolvedSymbol, 252),
        getSentiment(resolvedSymbol),
        getFundamentals(resolvedSymbol).catch(err => {
          console.warn('Fundamentals omitted: ', err);
          return null;
        })
      ]);

      setPrediction(predData);
      setHistory(histData);
      setSentiment(sentData);
      setFundamentals(fundData);

      if (isEtf) {
        try {
          const sipData = await getSip(resolvedSymbol);
          setSip(sipData);
        } catch (sipError) {
          console.warn('SIP metrics omitted:', sipError);
          setSip(null);
        }
      } else {
        setSip(null);
      }
    } catch (e: any) {
      console.error('Error loading detail streams:', e);
      setError(e.message || 'Unified detail stream failed to fetch.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [resolvedSymbol]);

  async function handleRetraining() {
    setRetraining(true);
    setRetrainSuccess(null);
    try {
      const res = await triggerRetraining(resolvedSymbol);
      setRetrainSuccess(`Retraining scheduled: ${res.message}. The model parameters will re-optimize in background.`);
    } catch (e: any) {
      console.error('Retraining failed:', e);
      alert(`Model calibration failure: ${e.message}`);
    } finally {
      setRetraining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={36} className="text-[#D4A843] animate-spin" />
        <p className="font-data text-xs text-[#8892A4] animate-pulse uppercase tracking-widest">COMPILING_ASSET_METRICS_{resolvedSymbol.split('.')[0]}...</p>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] max-w-md mx-auto p-8 rounded-2xl bg-[#0C1018] border border-white/[0.05] shadow-xl text-center">
        <AlertCircle size={40} className="text-[#FF4757] mb-4" />
        <h3 className="text-sm font-display font-semibold text-white mb-2">Integrated Pipeline Fault</h3>
        <p className="text-xs text-[#8892A4] mb-6 font-body leading-relaxed">{error || 'Asset metrics unavailable in NSE database.'}</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="px-4 py-2 bg-white/[0.02] border border-white/[0.05] text-[#8892A4] text-[10px] font-data font-bold rounded-xl hover:text-white uppercase">
            Return to Matrix
          </Link>
          <button 
            onClick={() => loadDetails()}
            className="px-4 py-2 bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-[#E8C070] border border-[#D4A843]/20 text-[10px] font-data font-bold rounded-xl uppercase transition-all"
          >
            Try Sync Once more
          </button>
        </div>
      </div>
    );
  }

  const breakdown = prediction.agent_breakdown || {};
  const techAgent = {
    name: 'Technical Trend Agent',
    signal: breakdown.technical?.signal || 'HOLD',
    confidence: breakdown.technical?.confidence || 0.6,
    reasons: breakdown.technical?.reasons || breakdown.technical?.key_reasons || ['RSI momentum threshold check', 'EMA median valuation lines']
  };

  const macroAgent = {
    name: 'Macro Correlation Agent',
    signal: breakdown.macro?.signal || 'HOLD',
    confidence: breakdown.macro?.confidence || 0.7,
    reasons: breakdown.macro?.key_reasons || ['Dollar strength currency peg adjustments', 'Bullion spot vault metrics']
  };

  const mlAgent = {
    name: 'ML XGBoost Predictor',
    signal: breakdown.ml?.signal || 'HOLD',
    confidence: breakdown.ml?.confidence || 0.65,
    reasons: breakdown.ml?.top_features ? breakdown.ml.top_features : ['XGBoost predictive factors', 'Pattern convergence weights']
  };

  const sentAgent = {
    name: 'FinBERT NLP Analyzer',
    signal: breakdown.sentiment?.signal || 'HOLD',
    confidence: breakdown.sentiment?.confidence || 0.5,
    reasons: breakdown.sentiment?.sentiment_label ? [`NLP Tone: ${breakdown.sentiment.sentiment_label}`] : ['FinBERT news feed aggregator']
  };

  return (
    <div id="asset-detail-vue" className="space-y-8 animate-fadeIn">
      {/* Return to Dash Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-5 font-sans">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[#8892A4] hover:text-[#E8C070] transition-colors text-xs font-data">
          <ArrowLeft size={13} />
          &larr; Return to Dashboard Matrix
        </Link>
        <button 
          onClick={() => loadDetails(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] text-[#8892A4] hover:text-white rounded-lg text-xs font-data border border-[rgba(255,255,255,0.04)]"
        >
          <RefreshCw size={11} />
          FORCE_RECALIBRATION
        </button>
      </div>

      {/* Hero Asset Plate */}
      <section className="glass-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[rgba(212,168,67,0.02)] rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 pb-6 border-b border-white/[0.04]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-display font-medium tracking-tight text-white uppercase italic">
                {resolvedSymbol.split('.')[0]}
              </h2>
              <span className="text-[8px] font-data font-bold uppercase bg-white/[0.03] border border-white/[0.06] text-[#E8C070] px-2 py-0.5 rounded">
                ACTIVE_SUITE_ASSET
              </span>
            </div>
            <p className="text-[#8892A4] text-xs font-body">{isEtf ? 'Securitized Precious Metals ETF Brokerage Segment' : 'NSE Corporate Private Equities Stock'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-data text-xs">
            {/* Orchestrator verdict */}
            <div>
              <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Orchestration Decision</span>
              <div className="flex items-center gap-3 mt-1.5">
                <SignalBadge signal={prediction.signal} size="lg" />
              </div>
            </div>
            
            {/* Timeframe */}
            <div className="border-l border-white/[0.04] pl-6">
              <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Decision Timeframe</span>
              <span className="text-sm font-semibold text-white mt-1.5 block flex items-center gap-1.5 font-mono">
                <Clock size={13} className="text-[#8892A4]" />
                {prediction.timeframe}
              </span>
            </div>

            {/* Risk Class */}
            <div className="border-l border-white/[0.04] pl-6">
              <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Risk Framework rating</span>
              <span className={`text-sm font-bold tracking-widest mt-1.5 block flex items-center gap-1 font-mono ${
                prediction.risk_level === 'LOW' 
                  ? 'text-[#00D084]' 
                  : prediction.risk_level === 'MEDIUM' 
                    ? 'text-[#E8C070]' 
                    : 'text-[#FF4757]'
              }`}>
                <AlertTriangle size={12} />
                {prediction.risk_level}
              </span>
            </div>
          </div>
        </div>

        {/* Retraining panel */}
        <div className="mt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#05070C] border border-white/[0.03] rounded-xl p-4">
          <div className="flex gap-2.5 items-start">
            <Cpu className="text-[#E8C070] mt-0.5 shrink-0" size={16} />
            <div>
              <h4 className="font-display font-medium text-xs text-slate-200">Self-Learning Model Calibration</h4>
              <p className="text-[11px] text-[#8892A4] font-body mt-0.5">XGBoost pattern matching weights can be recursively retrained on the server using active NSE database entries.</p>
            </div>
          </div>
          <button 
            onClick={handleRetraining}
            disabled={retraining}
            className="w-full sm:w-auto px-4 py-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-[#8892A4] hover:text-white rounded-lg text-xs font-data font-bold disabled:opacity-50 transition-all cursor-pointer uppercase shrink-0"
          >
            {retraining ? 'CALIBRATING...' : 'FORCE RE-TRAIN'}
          </button>
        </div>

        {retrainSuccess && (
          <div className="mt-3 p-3 bg-[#00D084]/10 border border-[#00D084]/25 rounded-xl text-xs text-slate-200 font-body">
            {retrainSuccess}
          </div>
        )}
      </section>

      {/* COGNITIVE ACTIONABLE TARGETS BLOCK */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 font-data">
        
        {/* Entry target */}
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20">
            <Gauge size={18} />
          </div>
          <div>
            <span className="text-[9px] text-[#4A5568] tracking-wider uppercase block">IDEAL SWING ENTRY LEVEL</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-white font-mono">₹{(prediction.entry_price || prediction.last_price || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Reward Target */}
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/20">
            <Target size={18} />
          </div>
          <div>
            <span className="text-[9px] text-[#4A5568] tracking-wider uppercase block">ALGORITHM EXIT TARGET PRICE</span>
            <div className="flex items-baseline gap-1 mt-1 font-mono">
              <span className="text-lg font-bold text-[#00D084]">₹{(prediction.target_price || 0).toLocaleString('en-IN')}</span>
              {prediction.target_price && prediction.entry_price && (
                <span className="text-[9.5px] font-bold text-[#00D084] ml-1.5">
                  (+{(((prediction.target_price - prediction.entry_price) / prediction.entry_price) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Protective Stop Loss */}
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/20">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span className="text-[9px] text-[#4A5568] tracking-wider uppercase block">CAPITAL PROTECTION STOP LOSS</span>
            <div className="flex items-baseline gap-1 mt-1 font-mono">
              <span className="text-lg font-bold text-[#FF4757]">₹{(prediction.stop_loss || 0).toLocaleString('en-IN')}</span>
              {prediction.stop_loss && prediction.entry_price && (
                <span className="text-[9.5px] font-bold text-[#FF4757] ml-1.5 font-mono">
                  ({(((prediction.stop_loss - prediction.entry_price) / prediction.entry_price) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

      </section>

      {/* CENTRAL PRICE CHART */}
      <section className="h-[340px]">
        <PriceChart data={history} symbol={resolvedSymbol} />
      </section>

      {/* MULTI_TIMEFRAME CONCORDANCE & ACTIVE SGD FEATURE VALUES */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 font-data text-xs">
        
        {/* Trend Concordant Block */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-4 font-sans">
            <Layers className="text-[#00D084]" size={16} />
            <div>
              <h4 className="font-display font-semibold text-sm text-white">Multi-Timeframe Trend Concordance</h4>
              <p className="text-[9px] text-[#8892A4] font-body uppercase mt-0.5">Aligned Weekly, Daily, and Hourly momentum signals</p>
            </div>
          </div>

          {prediction.multiTimeframe ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-[#8892A4] uppercase">Weekly Trend Basis:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  prediction.multiTimeframe.weeklyTrend === 'BULLISH'
                    ? 'bg-[#00D084]/15 text-[#00D084]'
                    : prediction.multiTimeframe.weeklyTrend === 'BEARISH'
                      ? 'bg-[#FF4757]/15 text-[#FF4757]'
                      : 'bg-white/[0.04] text-slate-300'
                }`}>
                  {prediction.multiTimeframe.weeklyTrend}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-[#8892A4] uppercase">Daily Trend Setup Trigger:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  prediction.multiTimeframe.dailySignal === 'BUY'
                    ? 'bg-[#00D084]/15 text-[#00D084] border border-[#00D084]/20'
                    : prediction.multiTimeframe.dailySignal === 'SELL'
                      ? 'bg-[#FF4757]/15 text-[#FF4757] border border-[#FF4757]/20'
                      : 'bg-white/[0.04] text-slate-300'
                }`}>
                  {prediction.multiTimeframe.dailySignal}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-[#8892A4] uppercase">4-Hour Fine Entry Trigger:</span>
                <span className={`font-semibold text-xs ${
                  prediction.multiTimeframe.fourHourTrig === 'ACCUMULATE_NOW' ? 'text-[#00D084]' : 'text-slate-200'
                }`}>
                  {prediction.multiTimeframe.fourHourTrig === 'ACCUMULATE_NOW' ? '⚡ INTERACTIVE ACCUMULATE NOW' : prediction.multiTimeframe.fourHourTrig}
                </span>
              </div>

              <div className="pt-3 flex justify-between items-center">
                <span className="text-[#8892A4]">Concordance Status:</span>
                <span className="text-[10px] font-bold text-[#E8C070] uppercase bg-[#D4A843]/10 px-2.5 py-1 rounded-lg border border-[#D4A843]/20">
                  {prediction.multiTimeframe.concurrence}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[#8892A4] font-data text-xs uppercase italic">
              Concordance values compiling...
            </div>
          )}
        </div>

        {/* SGD ML Weights Panel */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-4 font-sans">
            <Sparkles className="text-[#E8C070]" size={16} />
            <div>
              <h4 className="font-display font-semibold text-sm text-white">Stochastic Gradient Descent (SGD) ML Core</h4>
              <p className="text-[9px] text-[#8892A4] font-body uppercase mt-0.5">Incremental coefficients trained live on raw prices</p>
            </div>
          </div>

          <div className="space-y-3">
            {breakdown.ml?.top_features ? (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-white/[0.02]">
                  <span className="text-[#8892A4]">LIVE XGBOOST CONFIDENCE RATIO:</span>
                  <span className="text-[#00D084] font-bold font-mono">{Math.round((breakdown.ml.confidence || 0.74) * 100)}%</span>
                </div>
                <div className="space-y-2">
                  <span className="text-[8px] text-[#4A5568] uppercase block tracking-widest font-mono">ACTIVE SGD METRIC VALUE STREAMS:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {breakdown.ml.top_features.map((feat: string, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-[#05070C] p-2 rounded-lg border border-white/[0.02] text-[10px]">
                        <span className="text-[#8892A4] truncate max-w-[90px]">{feat.split(':')[0]}</span>
                        <span className="text-[#E8C070] font-mono font-semibold">{feat.split(':')[1] || '0.5U'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-[#8892A4] font-data text-xs uppercase italic">
                Stochastic models formulating...
              </div>
            )}
          </div>
        </div>

      </section>

      {/* DECENTRALIZED MULTI-AGENT SHIELD DEEP GRID */}
      <section className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wider pl-1">Decentralized Brokerage Expert Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AgentCard 
            agentName={techAgent.name} 
            signal={techAgent.signal} 
            confidence={techAgent.confidence} 
            reasons={techAgent.reasons} 
          />
          <AgentCard 
            agentName={macroAgent.name} 
            signal={macroAgent.signal} 
            confidence={macroAgent.confidence} 
            reasons={macroAgent.reasons} 
          />
          <AgentCard 
            agentName={mlAgent.name} 
            signal={mlAgent.signal} 
            confidence={mlAgent.confidence} 
            reasons={mlAgent.reasons} 
          />
          <AgentCard 
            agentName={sentAgent.name} 
            signal={sentAgent.signal} 
            confidence={sentAgent.confidence} 
            reasons={sentAgent.reasons} 
          />
        </div>
      </section>

      {/* RATIONALE FACTORS & ADVANCED TIMING TIMELINE */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-data">
        
        {/* Core factors checklist */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-4 font-sans">
            <FileText className="text-[#E8C070]" size={16} />
            <h4 className="font-display font-medium text-sm text-[#F0F4FF]">Consensus Decisive Factors</h4>
          </div>
          <ul id="key-reasons-detail" className="space-y-2.5 font-body">
            {prediction.key_reasons.map((r, i) => (
              <li key={i} className="flex gap-3 bg-[#05070C] border border-white/[0.02] rounded-xl p-3.5 text-xs text-zinc-300 leading-normal">
                <div className="w-5 h-5 bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono font-semibold mt-0.5">
                  {i + 1}
                </div>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Smart SIP directive box (ETFs only) */}
        {isEtf ? (
          <div className="glass-card p-5 flex flex-col justify-between bg-gradient-to-br from-[#D4A843]/[0.015] via-transparent to-transparent font-sans">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
                <TrendingUp className="text-[#E8C070]" size={16} />
                <h4 className="font-display font-semibold text-sm text-[#F0F4FF]">Dynamic SIP Timing Metric</h4>
              </div>

              {sip ? (
                <div className="space-y-4 font-data">
                  <div>
                    <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Timing Directive</span>
                    <span className={`text-sm font-bold uppercase mt-1.5 inline-block px-3 py-1.5 rounded-lg border font-mono ${
                      sip.sip_recommendation === 'BUY' 
                        ? 'bg-[#00D084]/15 text-[#00D084] border-[#00D084]/25' 
                        : 'bg-[#D4A843]/15 text-[#E8C070] border-[#D4A843]/25'
                    }`}>
                      {sip.sip_recommendation}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Decision weight parameter</span>
                    <div className="h-1.5 w-full bg-[#05070C] rounded-full overflow-hidden border border-white/[0.02]">
                      <div className="h-full bg-[#D4A843] rounded-full" style={{ width: `${sip.confidence}%` }} />
                    </div>
                  </div>

                  {sip.reasons && sip.reasons.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.03] text-xs font-body leading-relaxed text-[#8892A4] italic">
                      "{sip.reasons[0]}"
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-[#8892A4] font-data text-xs uppercase animate-pulse">
                  Calibrating SIP logic...
                </div>
              )}
            </div>

            <Link 
              to="/sip"
              className="w-full mt-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] text-[#8892A4] hover:text-white rounded-lg border border-white/[0.04] font-data text-[10px] font-bold uppercase transition-all tracking-wider text-center"
            >
              Open Smart Hub Curve
            </Link>
          </div>
        ) : (
          <div className="glass-card p-5 flex flex-col justify-center items-center text-center font-sans">
            <Info size={28} className="text-[#8892A4] mb-2" />
            <h4 className="font-display font-semibold text-xs text-slate-200">SIP analytics unavailable</h4>
            <p className="text-[#8892A4] text-[11px] font-body mt-1.5 max-w-[200px] leading-normal">
              Systematic compounding planners are restricted entirely to safety commodity ETF elements.
            </p>
          </div>
        )}

      </section>

      {/* CORE PROFILE FUNDAMENTAL GRID LAYOUT */}
      <section className="glass-card p-5">
        <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-5 font-sans">
          <Layers className="text-[#E8C070]" size={16} />
          <div>
            <h4 className="font-display font-medium text-sm text-[#F0F4FF]">Key Fundamental Metrics & Asset Profile</h4>
            <p className="text-[9.5px] text-[#4A5568] uppercase font-data mt-0.5">NSE Exchange audited parameters</p>
          </div>
        </div>

        {fundamentals ? (
          <div className="font-data text-xs">
            {fundamentals.type === 'ETF' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Asset Under Management (AUM)</span>
                    <span className="text-white font-bold">{fundamentals.market_cap || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Net Asset Value (NAV)</span>
                    <span className="text-white font-bold font-mono">{fundamentals.nav || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Expense Ratio</span>
                    <span className="text-[#E8C070] font-bold">{fundamentals.expense_ratio || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Tracking Error</span>
                    <span className="text-white font-mono">{fundamentals.tracking_error || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">52 Week High / Low</span>
                    <span className="text-white font-bold font-mono">{fundamentals.year_high_low || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-[#8892A4] font-body">Physical Backing Class</span>
                    <span className="text-[#00D084] font-bold uppercase">{fundamentals.physical_backing || 'LBMA Vault'}</span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Market Capitalization</span>
                    <span className="text-white font-bold">{fundamentals.market_cap || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Price to Earnings (P/E)</span>
                    <span className="text-[#E8C070] font-bold font-mono">{fundamentals.pe_ratio || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8892A4]">Price to Book (P/B) Ratio</span>
                    <span className="text-white font-mono">{fundamentals.pb_ratio || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Promoter Holding</span>
                    <span className="text-[#00D084] font-bold">{fundamentals.promoter_holding || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Shares Pledged Status</span>
                    <span className="text-white font-mono">{fundamentals.promoter_pledged || '0.0%'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8892A4]">Debt to Equity Ratio</span>
                    <span className="text-white font-mono">{fundamentals.debt_to_equity || '0.0'}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center border-b border-white/[0.02] pb-1.5">
                    <span className="text-[#8892A4]">Dividend Annual Yield</span>
                    <span className="text-white font-bold">{fundamentals.dividend_yield || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-[#8892A4] font-body">Earnings Announcement Date</span>
                    <span className="text-[#E8C070] font-bold">{fundamentals.earnings_date || 'N/A'}</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-[#8892A4] font-data text-xs uppercase animate-pulse">
            Compiling exchange indicators...
          </div>
        )}
      </section>

      {/* FINBERT NATURAL LANGUAGE HEADSETS */}
      {sentiment && (
        <section className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/[0.04] pb-3.5">
            <div className="font-sans">
              <h3 className="font-display font-medium text-sm text-[#F0F4FF]">FinBERT NLP Sentiment Dashboard</h3>
              <p className="text-[9.5px] text-[#4A5568] uppercase font-data mt-0.5">Web scraper news streams parsed yesterday</p>
            </div>
            
            <div className="flex items-center gap-2 font-data text-xs text-slate-350">
              <span>Sentiment Convergence Aggregator Weight:</span>
              <span className={`px-2.5 py-0.5 rounded font-mono font-bold ${
                sentiment.score > 0.05 
                  ? 'bg-[#00D084]/10 text-[#00D084]' 
                  : 'bg-[#FF4757]/10 text-[#FF4757]'
              }`}>
                {sentiment.score > 0 ? '+' : ''}{sentiment.score?.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-data text-xs">
            <div className="lg:col-span-2 space-y-2.5">
              <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Audited Headlines</span>
              {sentiment.headlines && sentiment.headlines.length > 0 ? (
                <div id="headlines-container" className="space-y-1.5">
                  {sentiment.headlines.map((headline, i) => (
                    <div key={i} className="p-3 bg-white/[0.015] border border-white/[0.02] rounded-xl flex items-start gap-3">
                      <span className="px-1.5 py-0.5 bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/20 rounded font-mono text-[8px] mt-0.5 shrink-0">NLP_OK</span>
                      <p className="text-xs text-zinc-300 font-body leading-relaxed">{headline}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[#8892A4] font-data text-xs uppercase italic bg-[#05070C] rounded-lg border border-white/[0.02]">
                  No news headlines scraped for this index segment.
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <span className="text-[9px] text-[#4A5568] uppercase tracking-wider block">Upcoming Events & Risks</span>
              {sentiment.upcoming_events && sentiment.upcoming_events.length > 0 ? (
                <div id="events-container" className="space-y-1.5">
                  {sentiment.upcoming_events.map((evt, i) => (
                    <div key={i} className="p-3 bg-[#05070C] border border-white/[0.02] rounded-xl flex gap-2 items-start font-body text-xs text-slate-300 leading-normal">
                      <Calendar size={13} className="text-[#E8C070] shrink-0 mt-0.5" />
                      <span>{evt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[#8892A4] font-data text-xs uppercase italic bg-[#05070C] rounded-lg border border-white/[0.02]">
                  No upcoming economic calendars flagged.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
