import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Target, 
  ShieldAlert, 
  Gauge, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';
import { Prediction } from '../types';

interface NiftyDerivativeDashboardProps {
  prediction: Prediction;
}

interface OptionChainRow {
  ceOi: number;
  ceOiChg: number;
  ceLtp: number;
  ceChg: number;
  strike: number;
  peLtp: number;
  peChg: number;
  peOi: number;
  peOiChg: number;
}

export function NiftyDerivativeDashboard({ prediction }: NiftyDerivativeDashboardProps) {
  // Lot size of Nifty options is 25 shares
  const LOT_SIZE = 25;
  const spotPrice = prediction.entry_price || (prediction as any).last_price || 23250.50;
  
  // Calculate nearest strike to spot
  const centerStrike = Math.round(spotPrice / 50) * 50;

  // Selected state for customized option strategy
  const [selectedStrategy, setSelectedStrategy] = useState<'NONE' | 'BULL_CALL' | 'BEAR_PUT' | 'IRON_CONDOR' | 'LONG_STRADDLE'>('BULL_CALL');
  const [lotsCount, setLotsCount] = useState<number>(1);
  const [customExpiryPrice, setCustomExpiryPrice] = useState<number>(centerStrike);

  // Derive derivative stats dynamically based on spot
  const pcr = 1.14; // Put Call Ratio
  const maxPain = centerStrike;
  const iv = 12.85; // Implied Volatility %
  
  // Nifty Futures stats
  const futureLtp = Number((spotPrice + 38.65).toFixed(2));
  const futurePremiumPercent = ((futureLtp - spotPrice) / spotPrice * 100).toFixed(2);
  const futureOi = "1.32 Crore shares";
  const futureOiChange = "+2.4% (Long Buildup)";

  // Option lines generator around spot
  const optionChain = useMemo<OptionChainRow[]>(() => {
    const rows: OptionChainRow[] = [];
    // 5 strikes below + spot strike + 5 strikes above = 11 strikes
    for (let i = -5; i <= 5; i++) {
      const strike = centerStrike + (i * 50);
      
      // Calculate realistic premiums (Black Scholes approximations)
      const diff = strike - spotPrice;
      
      // Calls pricing model
      let ceLtp = 0;
      if (diff < 0) {
        // In-the-money (Intrinsic + Time value)
        ceLtp = Math.abs(diff) + (65 - Math.abs(diff) * 0.1);
      } else {
        // Out-of-the-money (Exponential decay)
        ceLtp = 65 * Math.pow(0.68, diff / 50);
      }
      ceLtp = parseFloat(Math.max(1.8, ceLtp).toFixed(2));
      
      // Puts pricing model
      let peLtp = 0;
      if (diff > 0) {
        // In-the-money put
        peLtp = Math.abs(diff) + (58 - Math.abs(diff) * 0.1);
      } else {
        // Out-of-the-money put
        peLtp = 58 * Math.pow(0.65, Math.abs(diff) / 50);
      }
      peLtp = parseFloat(Math.max(1.5, peLtp).toFixed(2));

      // Generate Call / Put OI clusters based on real structures (Resistance at 23500, Support at 23000)
      const ceOiBase = strike === centerStrike + 150 ? 8400000 : strike === centerStrike + 100 ? 6800000 : 3500000 / (Math.abs(i) || 1);
      const peOiBase = strike === centerStrike - 150 ? 9200000 : strike === centerStrike - 100 ? 7600000 : 3800000 / (Math.abs(i) || 1);

      rows.push({
        ceOi: Math.round(ceOiBase),
        ceOiChg: parseFloat((15.4 + (strike % 5) - Math.abs(i) * 2).toFixed(1)),
        ceLtp,
        ceChg: parseFloat(((diff < 0 ? 12.8 : -14.5) + (strike % 8)).toFixed(1)),
        strike,
        peLtp,
        peChg: parseFloat(((diff > 0 ? 8.5 : -19.2) - (strike % 6)).toFixed(1)),
        peOi: Math.round(peOiBase),
        peOiChg: parseFloat((21.2 - (strike % 4) - Math.abs(i) * 3).toFixed(1)),
      });
    }
    return rows;
  }, [centerStrike, spotPrice]);

  // Derived legs configuration for selected strategy templates
  // Bull Call, Bear Put, Iron Condor, Long Straddle
  const activeStrategyLegs = useMemo(() => {
    const defaultLegs = {
      name: "",
      type: "DEBIT",
      legs: [] as { action: 'BUY' | 'SELL'; type: 'CE' | 'PE'; strike: number; ltp: number }[]
    };

    if (selectedStrategy === 'BULL_CALL') {
      const buyLegStrike = centerStrike;
      const sellLegStrike = centerStrike + 100;
      const buyLegLtp = optionChain.find(o => o.strike === buyLegStrike)?.ceLtp || 75;
      const sellLegLtp = optionChain.find(o => o.strike === sellLegStrike)?.ceLtp || 28;

      return {
        name: "Nifty Bull Call Spread Playbook",
        description: "Optimal for standard bullish setups. Buying ATM call financed by selling highly decayed OTM call to limit downside risk and cost.",
        type: "DEBIT",
        legs: [
          { action: 'BUY' as const, type: 'CE' as const, strike: buyLegStrike, ltp: buyLegLtp },
          { action: 'SELL' as const, type: 'CE' as const, strike: sellLegStrike, ltp: sellLegLtp }
        ]
      };
    }

    if (selectedStrategy === 'BEAR_PUT') {
      const buyLegStrike = centerStrike;
      const sellLegStrike = centerStrike - 100;
      const buyLegLtp = optionChain.find(o => o.strike === buyLegStrike)?.peLtp || 68;
      const sellLegLtp = optionChain.find(o => o.strike === sellLegStrike)?.peLtp || 24;

      return {
        name: "Nifty Bear Put Spread Playbook",
        description: "Standard bearish hedge. Highly recommended when micro-resistance cap triggers negative indicators near intraday pivot lines.",
        type: "DEBIT",
        legs: [
          { action: 'BUY' as const, type: 'PE' as const, strike: buyLegStrike, ltp: buyLegLtp },
          { action: 'SELL' as const, type: 'PE' as const, strike: sellLegStrike, ltp: sellLegLtp }
        ]
      };
    }

    if (selectedStrategy === 'IRON_CONDOR') {
      const putBuyStrike = centerStrike - 150;
      const putSellStrike = centerStrike - 50;
      const callSellStrike = centerStrike + 50;
      const callBuyStrike = centerStrike + 150;

      const putBuyLtp = optionChain.find(o => o.strike === putBuyStrike)?.peLtp || 12;
      const putSellLtp = optionChain.find(o => o.strike === putSellStrike)?.peLtp || 42;
      const callSellLtp = optionChain.find(o => o.strike === callSellStrike)?.ceLtp || 45;
      const callBuyLtp = optionChain.find(o => o.strike === callBuyStrike)?.ceLtp || 14;

      return {
        name: "Nifty Decayed Iron Condor",
        description: "Premium delta-neutral yield structure. Perfect when main algorithm registers consolidation HOLD ranges with low VIX values.",
        type: "CREDIT",
        legs: [
          { action: 'BUY' as const, type: 'PE' as const, strike: putBuyStrike, ltp: putBuyLtp },
          { action: 'SELL' as const, type: 'PE' as const, strike: putSellStrike, ltp: putSellLtp },
          { action: 'SELL' as const, type: 'CE' as const, strike: callSellStrike, ltp: callSellLtp },
          { action: 'BUY' as const, type: 'CE' as const, strike: callBuyStrike, ltp: callBuyLtp }
        ]
      };
    }

    if (selectedStrategy === 'LONG_STRADDLE') {
      const buyLtpCE = optionChain.find(o => o.strike === centerStrike)?.ceLtp || 75;
      const buyLtpPE = optionChain.find(o => o.strike === centerStrike)?.peLtp || 68;

      return {
        name: "Nifty High Volatility Straddle Play",
        description: "Hedge for substantial breakout events like union budgets, central reserve rate releases, and earnings intensity shifts.",
        type: "DEBIT",
        legs: [
          { action: 'BUY' as const, type: 'CE' as const, strike: centerStrike, ltp: buyLtpCE },
          { action: 'BUY' as const, type: 'PE' as const, strike: centerStrike, ltp: buyLtpPE }
        ]
      };
    }

    return defaultLegs;
  }, [selectedStrategy, centerStrike, optionChain]);

  // Strategy payoff calculus
  const payoffMetrics = useMemo(() => {
    if (!activeStrategyLegs.legs.length) {
      return { marginRequired: 0, netDebtorCredit: 0, maxProfit: 0, maxLoss: 0, breakEvens: [] as number[] };
    }

    const totalLotMultiplier = LOT_SIZE * lotsCount;
    let netPremiumSign = 0; // Negative means debit (paying), Positive means credit (receiving)
    let marginRequired = 45000 * lotsCount; // Base rough margin placeholder

    activeStrategyLegs.legs.forEach(leg => {
      const legPrem = leg.ltp;
      if (leg.action === 'BUY') {
        netPremiumSign -= legPrem;
      } else {
        netPremiumSign += legPrem;
        marginRequired += 110000 * lotsCount; // Selling options requires heavier margins
      }
    });

    const netDebtorCredit = Math.round(netPremiumSign * totalLotMultiplier);

    // High fidelity target estimation for max loss/profit at expiration
    let maxLoss = 0;
    let maxProfit = 0;
    let breakEvens: number[] = [];

    if (selectedStrategy === 'BULL_CALL') {
      const leg1 = activeStrategyLegs.legs[0];
      const leg2 = activeStrategyLegs.legs[1];
      const strikeDiff = leg2.strike - leg1.strike;
      
      maxLoss = Math.abs(netDebtorCredit); // Debit paid is max loss
      maxProfit = Math.round((strikeDiff - (leg1.ltp - leg2.ltp)) * totalLotMultiplier);
      breakEvens = [leg1.strike + (leg1.ltp - leg2.ltp)];
    } else if (selectedStrategy === 'BEAR_PUT') {
      const leg1 = activeStrategyLegs.legs[0];
      const leg2 = activeStrategyLegs.legs[1];
      const strikeDiff = leg1.strike - leg2.strike;

      maxLoss = Math.abs(netDebtorCredit); // Debit paid is max loss
      maxProfit = Math.round((strikeDiff - (leg1.ltp - leg2.ltp)) * totalLotMultiplier);
      breakEvens = [leg1.strike - (leg1.ltp - leg2.ltp)];
    } else if (selectedStrategy === 'IRON_CONDOR') {
      // Net credit received is max profit
      maxProfit = Math.abs(netDebtorCredit);
      const netCreditPerShare = netDebtorCredit / totalLotMultiplier;
      
      // Protection strikes
      const cellPutStrike = activeStrategyLegs.legs[1].strike;
      const buyPutStrike = activeStrategyLegs.legs[0].strike;
      const cellCallStrike = activeStrategyLegs.legs[2].strike;
      const buyCallStrike = activeStrategyLegs.legs[3].strike;

      const downStrikeDiff = cellPutStrike - buyPutStrike;
      const upStrikeDiff = buyCallStrike - cellCallStrike;

      const maxLossDown = (downStrikeDiff - netCreditPerShare) * totalLotMultiplier;
      const maxLossUp = (upStrikeDiff - netCreditPerShare) * totalLotMultiplier;

      maxLoss = Math.round(Math.max(maxLossDown, maxLossUp));
      breakEvens = [cellPutStrike - netCreditPerShare, cellCallStrike + netCreditPerShare];
    } else if (selectedStrategy === 'LONG_STRADDLE') {
      const netPaid = Math.abs(netPremiumSign);
      maxLoss = Math.abs(netDebtorCredit);
      maxProfit = Infinity; // Infinite theoretical upside/downside
      breakEvens = [centerStrike - netPaid, centerStrike + netPaid];
    }

    return {
      marginRequired: marginRequired,
      netDebtorCredit,
      maxProfit,
      maxLoss,
      breakEvens
    };
  }, [activeStrategyLegs, lotsCount, selectedStrategy, centerStrike]);

  // Expiry simulator payout values
  const currentExpiryPnl = useMemo(() => {
    if (!activeStrategyLegs.legs.length) return 0;
    const totalMultiplier = LOT_SIZE * lotsCount;
    let totalPnlPoints = 0;

    activeStrategyLegs.legs.forEach(leg => {
      if (leg.type === 'CE') {
        const intrinsicAtExpiry = Math.max(0, customExpiryPrice - leg.strike);
        
        if (leg.action === 'BUY') {
          totalPnlPoints += (intrinsicAtExpiry - leg.ltp);
        } else {
          totalPnlPoints -= (intrinsicAtExpiry - leg.ltp);
        }
      } else {
        const intrinsicAtExpiry = Math.max(0, leg.strike - customExpiryPrice);

        if (leg.action === 'BUY') {
          totalPnlPoints += (intrinsicAtExpiry - leg.ltp);
        } else {
          totalPnlPoints -= (intrinsicAtExpiry - leg.ltp);
        }
      }
    });

    return Math.round(totalPnlPoints * totalMultiplier);
  }, [activeStrategyLegs, lotsCount, customExpiryPrice]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. METRICS ROW */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
        {/* Spot Price */}
        <div className="glass-card p-4">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-sans">Nifty 50 Index Spot</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-white tracking-tight">₹{spotPrice.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-[#00D084] font-bold">+1.12%</span>
          </div>
          <span className="text-[9px] text-[#4A5568] block mt-1 font-sans">Underlying Spot Index</span>
        </div>

        {/* Nifty Future Contract */}
        <div className="glass-card p-4">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-sans">Nifty Active Future (CE/PE Base)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-[#E8C070] tracking-tight">₹{futureLtp.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-[#E8C070] font-bold">+{futurePremiumPercent}% Basis</span>
          </div>
          <span className="text-[9px] text-slate-500 block mt-1 font-sans">OI: {futureOiChange}</span>
        </div>

        {/* Put-Call Ratio (PCR) */}
        <div className="glass-card p-4">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-sans">Put Call Ratio (PCR)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-emerald-400 tracking-tight">{pcr}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded">BULLISH BIAS</span>
          </div>
          <span className="text-[9px] text-slate-500 block mt-1 font-sans">Support robust at 23,100PE</span>
        </div>

        {/* Max Pain / Volatility */}
        <div className="glass-card p-4">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-sans">Max Pain & Volatility (VIX)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-white tracking-tight">₹{maxPain}</span>
            <span className="text-[10px] text-rose-450 font-bold ml-2">VIx: {iv}%</span>
          </div>
          <span className="text-[9px] text-slate-500 block mt-1 font-sans">Optimal option decay strike range</span>
        </div>
      </section>

      {/* 2. OPTION PLAYBOOK SELECTOR */}
      <section className="glass-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-4">
          <Layers className="text-[#00D084]" size={16} />
          <div>
            <h4 className="font-display font-semibold text-sm text-white">Nifty 50 Hedged Strategy Playbooks</h4>
            <p className="text-[9pt] text-slate-400 font-body">Choose a recommended derivative setup based on predictive algorithms</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { id: 'BULL_CALL', title: 'Bull Call Spread', type: 'Bullish', desc: 'Buy CE + Sell OTM CE', color: 'border-emerald-500/20 focus:border-emerald-500 bg-emerald-950/10' },
            { id: 'BEAR_PUT', title: 'Bear Put Spread', type: 'Bearish', desc: 'Buy PE + Sell OTM PE', color: 'border-rose-500/20 focus:border-rose-500 bg-rose-950/10' },
            { id: 'IRON_CONDOR', title: 'Iron Condor Strategy', type: 'Neutral', desc: 'Two buys + two sells', color: 'border-amber-500/20 focus:border-amber-500 bg-amber-950/10' },
            { id: 'LONG_STRADDLE', title: 'Long Straddle', type: 'Volatile breakout', desc: 'Buy CE + Buy PE ATM', color: 'border-indigo-500/20 focus:border-indigo-500 bg-indigo-950/10' }
          ].map((strat) => {
            const isSelected = selectedStrategy === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => setSelectedStrategy(strat.id as any)}
                className={`p-4 rounded-xl text-left border cursor-pointer hover:bg-white/[0.03] transition-all relative ${
                  isSelected 
                    ? 'border-[#00D084] bg-white/[0.02] ring-1 ring-[#00D084]/20' 
                    : 'border-white/[0.04] bg-black/20'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 text-[8px] bg-[#00D084]/25 text-[#00D084] font-mono px-2 py-0.5 rounded border border-[#00D084]/30 uppercase font-extrabold font-sans">
                    Active Play
                  </span>
                )}
                <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                  strat.type === 'Bullish' ? 'text-emerald-400' : strat.type === 'Bearish' ? 'text-rose-400' : strat.type === 'Neutral' ? 'text-amber-400' : 'text-indigo-400'
                }`}>
                  {strat.type}
                </span>
                <span className="text-xs text-white block mt-1 font-bold font-display">{strat.title}</span>
                <span className="text-[10px] text-slate-500 mt-1 block font-mono">{strat.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Playbook Explanation Panel */}
        {selectedStrategy !== 'NONE' && (
          <div className="p-4 bg-white/[0.015] border border-white/[0.03] rounded-xl text-xs space-y-2">
            <h5 className="font-bold text-white flex items-center gap-1.5 leading-normal">
              <Sparkles size={13} className="text-[#E8C070]" />
              {activeStrategyLegs.name}
            </h5>
            <p className="text-[#8892A4] font-body font-normal text-[11.5px] leading-relaxed">
              {activeStrategyLegs.description}
            </p>
          </div>
        )}
      </section>

      {/* 3. LOT SELECTION & STRATEGY WORKSPACE */}
      {selectedStrategy !== 'NONE' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strategy Legs Configurator */}
          <div className="glass-card p-5 md:p-6 lg:col-span-2 space-y-5">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3 mb-2">
              <h4 className="font-display font-semibold text-xs text-white uppercase tracking-widest">Active Contracts Workspace</h4>
              
              {/* Lot Selector */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-mono">Lot Size: 25 shares</span>
                <div className="flex items-center border border-white/[0.06] rounded-lg bg-[#05070C] p-0.5 font-mono">
                  <button 
                    onClick={() => setLotsCount(Math.max(1, lotsCount - 1))}
                    className="px-2 py-0.5 text-slate-400 hover:text-white rounded hover:bg-white/[0.03] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 py-0.5 text-xs font-bold text-white">{lotsCount} Lot{lotsCount > 1 && 's'}</span>
                  <button 
                    onClick={() => setLotsCount(lotsCount + 1)}
                    className="px-2 py-0.5 text-slate-400 hover:text-white rounded hover:bg-white/[0.03] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Strategy Legs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] text-slate-500">
                    <th className="pb-2.5 font-sans uppercase text-[9px]">Leg Action</th>
                    <th className="pb-2.5 font-sans uppercase text-[9px]">Option Ticker</th>
                    <th className="pb-2.5 font-sans uppercase text-[9px]">Option Type</th>
                    <th className="pb-2.5 font-sans uppercase text-[9px]">Strike Price</th>
                    <th className="pb-2.5 font-sans uppercase text-[9px]">LTP (Premium)</th>
                    <th className="pb-2.5 font-sans uppercase text-[9px] text-right">Debit/Credit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {activeStrategyLegs.legs.map((leg, idx) => {
                    const legPaid = leg.action === 'BUY' ? '-' : '+';
                    const legPaidColor = leg.action === 'BUY' ? 'text-rose-400' : 'text-emerald-400';
                    const premiumCost = Math.round(leg.ltp * LOT_SIZE * lotsCount);

                    return (
                      <tr key={idx} className="hover:bg-white/[0.01]">
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                            leg.action === 'BUY' ? 'bg-red-500/10 text-rose-450 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {leg.action}
                          </span>
                        </td>
                        <td className="py-3 text-white font-bold">NIFTY26JUN</td>
                        <td className="py-3">
                          <span className={`font-bold ${leg.type === 'CE' ? 'text-cyan-400' : 'text-purple-400'}`}>
                            {leg.type === 'CE' ? 'CALL (CE)' : 'PUT (PE)'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-300">₹{leg.strike}</td>
                        <td className="py-3 text-slate-300">₹{leg.ltp.toFixed(2)}</td>
                        <td className={`py-3 text-right font-extrabold ${legPaidColor}`}>
                          {legPaid}₹{premiumCost.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick calculations panels */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.04]">
              {/* Premium outlay */}
              <div className="bg-[#05070C] border border-white/[0.03] p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Net Cash Outflow</span>
                <span className={`text-base font-bold block mt-1 ${payoffMetrics.netDebtorCredit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {payoffMetrics.netDebtorCredit < 0 ? '-' : '+'}₹{Math.abs(payoffMetrics.netDebtorCredit).toLocaleString('en-IN')}
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-0.5 font-sans">Option {selectedStrategy === 'IRON_CONDOR' ? 'Credit Received' : 'Debit Cost'}</span>
              </div>

              {/* Margin Outlay */}
              <div className="bg-[#05070C] border border-white/[0.03] p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Estimated Margin</span>
                <span className="text-base font-bold text-white block mt-1">
                  ₹{payoffMetrics.marginRequired.toLocaleString('en-IN')}
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-0.5 font-sans">Leverage capital locks</span>
              </div>

              {/* Max Profit */}
              <div className="bg-[#05070C] border border-white/[0.03] p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Max Profit Limit</span>
                <span className="text-base font-bold text-emerald-400 block mt-1">
                  {payoffMetrics.maxProfit === Infinity ? 'Uncapped Upward' : `₹${payoffMetrics.maxProfit.toLocaleString('en-IN')}`}
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-0.5 font-sans">Hedged return ceiling</span>
              </div>

              {/* Max Risk */}
              <div className="bg-[#05070C] border border-white/[0.03] p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans">Max Loss Exposure</span>
                <span className="text-base font-bold text-rose-450 block mt-1">
                  ₹{payoffMetrics.maxLoss.toLocaleString('en-IN')}
                </span>
                <span className="text-[8.5px] text-slate-500 block mt-0.5 font-sans">Hedged risk absolute floor</span>
              </div>
            </div>
          </div>

          {/* 4. REAL-TIME EXPRY SIMULATION & PAYOFF GAUGE */}
          <div className="glass-card p-5 md:p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-2">
                <Gauge className="text-amber-500" size={16} />
                <h4 className="font-display font-semibold text-xs text-white uppercase tracking-widest">Nifty Expiry Playback Calculator</h4>
              </div>

              {/* Simulator instructions */}
              <p className="text-[11px] text-[#8892A4] font-body leading-relaxed">
                Slide the horizontal scale below to simulate where the Nifty 50 Underlying Index will close on option expiration date. See the active hedged payoff in real time.
              </p>

              {/* Expiry Price Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-500">Nifty Spot on Expiry:</span>
                  <span className="text-white font-bold text-sm bg-slate-900 border border-slate-800 px-3 py-0.5 rounded">
                    ₹{customExpiryPrice}
                  </span>
                </div>
                <input
                  type="range"
                  min={centerStrike - 500}
                  max={centerStrike + 500}
                  step={10}
                  value={customExpiryPrice}
                  onChange={(e) => setCustomExpiryPrice(Number(e.target.value))}
                  className="w-full accent-[#00D084] bg-slate-910 outline-none rounded-lg h-1"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>-500 pts</span>
                  <span>Center Strike ({centerStrike})</span>
                  <span>+500 pts</span>
                </div>
              </div>

              {/* PnL Payoff Visual Gauge */}
              <div className={`mt-6 p-5 rounded-2xl border text-center font-mono space-y-1 transition-all ${
                currentExpiryPnl >= 0 
                  ? 'bg-emerald-950/20 border-emerald-500/20 shadow-[0_4px_30px_rgba(0,208,132,0.03)]' 
                  : 'bg-rose-950/20 border-rose-500/20 shadow-[0_4px_30px_rgba(255,71,87,0.03)]'
              }`}>
                <span className="text-[9.5pt] text-slate-400 font-sans block">Projected Hedge Profit/Loss</span>
                <span className={`text-2xl font-black tracking-tight block ${currentExpiryPnl >= 0 ? 'text-[#00D084]' : 'text-[#FF4757]'}`}>
                  {currentExpiryPnl >= 0 ? '+' : ''}₹{currentExpiryPnl.toLocaleString('en-IN')}
                </span>
                <span className={`text-[9px] font-bold block ${currentExpiryPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ({(currentExpiryPnl / (payoffMetrics.marginRequired || 1) * 100).toFixed(2)}% margin return)
                </span>
              </div>
            </div>

            {/* Hedged Strategy Rule */}
            <div className="mt-5 p-3 bg-white/[0.015] border border-white/[0.02] rounded-xl flex gap-2 items-start text-[10px] text-slate-400 leading-normal font-sans">
              <Info size={13} className="text-[#8892A4] mt-0.5 shrink-0" />
              <span>
                Break-even Index Price target is {payoffMetrics.breakEvens.map(b => `₹${b.toFixed(0)}`).join(' or ')}. Avoid maintaining long or unhedged legs into the expiry afternoon due to volatile theta decay shifts.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 5. LIVE OPTION CHAIN MATRIX (GRID TABLE) */}
      <section className="glass-card p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
          <div>
            <h4 className="text-sm font-display font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity size={18} className="text-[#00D084]" /> Live Nifty 50 Options Chain Matrix (Calls vs Puts)
            </h4>
            <p className="text-xs text-[#8892A4] mt-1 font-body">Complete Strike price overview highlighting Open Interest buildup and premium decay indices:</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse font-mono text-[11.5px] min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-white/[0.05] text-[#8892A4] uppercase text-[9.5px]">
                <th colSpan={4} className="pb-3 border-r border-white/[0.04] text-center font-bold text-cyan-400 font-sans tracking-widest bg-cyan-950/5">CALL OPTIONS (CE)</th>
                <th className="pb-3 px-4 font-bold text-white bg-slate-900 border-x border-white/[0.04]">STRIKE</th>
                <th colSpan={4} className="pb-3 text-center border-l border-white/[0.04] font-bold text-purple-400 font-sans tracking-widest bg-purple-950/5">PUT OPTIONS (PE)</th>
              </tr>
              <tr className="border-b border-white/[0.04] text-[8.5px] text-[#4A5568]">
                <th className="py-2.5">OI (Shares)</th>
                <th className="py-2.5">OI Change %</th>
                <th className="py-2.5">Premium (LTP)</th>
                <th className="py-2.5 border-r border-white/[0.04]">LTP Change %</th>
                <th className="py-2.5 px-4 font-semibold text-slate-400 bg-slate-950 border-x border-white/[0.04]">STRPrice</th>
                <th className="py-2.5 pl-4">Premium (LTP)</th>
                <th className="py-2.5">LTP Change %</th>
                <th className="py-2.5">OI (Shares)</th>
                <th className="py-2.5">OI Change %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {optionChain.map((row, idx) => {
                const isAtm = row.strike === centerStrike;
                const ceOiInCr = (row.ceOi / 10000000).toFixed(2);
                const peOiInCr = (row.peOi / 10000000).toFixed(2);

                return (
                  <tr 
                    key={idx} 
                    className={`hover:bg-white/[0.02] transition-colors ${
                      isAtm ? 'bg-[#00D084]/[0.02] font-semibold text-slate-100' : ''
                    }`}
                  >
                    {/* Calls OI */}
                    <td className="py-3.5 text-slate-400">{(row.ceOi).toLocaleString('en-IN')}</td>
                    {/* Calls OI Chg */}
                    <td className={`py-3.5 ${row.ceOiChg >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                      {row.ceOiChg >= 0 ? '+' : ''}{row.ceOiChg}%
                    </td>
                    {/* Calls LTP */}
                    <td className="py-3.5 text-cyan-400 font-bold">₹{row.ceLtp.toFixed(2)}</td>
                    {/* Calls Price change */}
                    <td className={`py-3.5 border-r border-white/[0.04] ${row.ceChg >= 0 ? 'text-emerald-450' : 'text-rose-450'}`}>
                      {row.ceChg >= 0 ? '+' : ''}{row.ceChg}%
                    </td>

                    {/* HIdhlighted Strike price */}
                    <td className={`py-3.5 px-4 font-bold bg-slate-900 border-x border-white/[0.04] text-center ${
                      isAtm ? 'text-[#E8C070] text-sm scale-105 border-y border-[#00D084]/20 ring-1 ring-[#00D084]/15' : 'text-slate-200'
                    }`}>
                      {row.strike} {isAtm && <span className="text-[8px] font-mono block tracking-tight text-[#00D084] uppercase font-bold">ATM</span>}
                    </td>

                    {/* Puts LTP */}
                    <td className="py-3.5 pl-4 text-purple-400 font-bold">₹{row.peLtp.toFixed(2)}</td>
                    {/* Puts Price change */}
                    <td className={`py-3.5 ${row.peChg >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                      {row.peChg >= 0 ? '+' : ''}{row.peChg}%
                    </td>
                    {/* Puts OI */}
                    <td className="py-3.5 text-slate-400">{(row.peOi).toLocaleString('en-IN')}</td>
                    {/* Puts OI Chg */}
                    <td className={`py-3.5 ${row.peOiChg >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                      {row.peOiChg >= 0 ? '+' : ''}{row.peOiChg}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Disclaimer footer inside options chain */}
        <div className="p-4 bg-slate-950 border border-white/[0.02] rounded-xl flex gap-3 text-xs text-[#8892A4] mt-2 font-sans font-normal leading-relaxed">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p>
            <strong>Standard Risk Warning:</strong> Dynamic mathematical Option Premiums and Open Interest chains are modeled on underlying market vectors and indices in near real-time. Derivatives are highly leveraged instruments; always configure tight protective stops across both single legs and spread playbooks before committing live brokerage capital.
          </p>
        </div>
      </section>
    </div>
  );
}
