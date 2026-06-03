import { RSI, MACD, BollingerBands, EMA } from 'technicalindicators';

export interface PriceCandle {
  close: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
}

export interface TechnicalSignals {
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  bb: { upper: number; lower: number; middle: number };
  ema20: number;
  ema50: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1
  adx: number;
  atr: number;
  volumeRatio: number;
  bbSqueeze: { isSqueezed: boolean; width: number; avgWidth20: number };
  volumeConfirmed: boolean;
  stopLoss: number;
  target1: number;
  target2: number;
}

// Pristine native calculation helpers to prevent library compatibility errors
function calculateATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < 2) return candles[0]?.close * 0.025 || 5;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const today = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      today.high - today.low,
      Math.abs(today.high - prev.close),
      Math.abs(today.low - prev.close)
    );
    trs.push(tr);
  }

  const atr = trs.slice(-period).reduce((sum, val) => sum + val, 0) / Math.min(period, trs.length);
  return Number((atr || candles[candles.length - 1].close * 0.02).toFixed(2));
}

function calculateADX(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period * 2) return 22.5; // neutral starting index if history is sparse

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const today = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      today.high - today.low,
      Math.abs(today.high - prev.close),
      Math.abs(today.low - prev.close)
    );
    trs.push(tr);

    const upMove = today.high - prev.high;
    const downMove = prev.low - today.low;

    let plusDM = 0;
    let minusDM = 0;

    if (upMove > downMove && upMove > 0) {
      plusDM = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      minusDM = downMove;
    }

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  let smoothedTR = 0;
  let smoothedPlusDM = 0;
  let smoothedMinusDM = 0;

  for (let i = 0; i < period; i++) {
    smoothedTR += trs[i];
    smoothedPlusDM += plusDMs[i];
    smoothedMinusDM += minusDMs[i];
  }

  const dxValues: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trs[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

    const sum = plusDI + minusDI;
    const diff = Math.abs(plusDI - minusDI);
    const dx = sum > 0 ? (diff / sum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length === 0) return 22.5;

  const adx = dxValues.slice(-period).reduce((sum, val) => sum + val, 0) / Math.min(period, dxValues.length);
  return Number((adx || 22.5).toFixed(2));
}

export class TechnicalAgent {
  /**
   * Analyzes technical indicators for a given set of historical prices or candles.
   */
  static analyze(pricesInput: number[] | PriceCandle[]): TechnicalSignals {
    if (pricesInput.length < 30) {
      throw new Error('Insufficient data for technical analysis. Minimum 30 frames required.');
    }

    // Unify input format for complete backward compatibility
    const candles: { close: number; high: number; low: number; open: number; volume: number }[] = pricesInput.map(item => {
      if (typeof item === 'number') {
        return {
          close: item,
          high: item * 1.012,
          low: item * 0.988,
          open: item,
          volume: 1000
        };
      } else {
        const closeVal = item.close;
        return {
          close: closeVal,
          high: item.high ?? closeVal * 1.012,
          low: item.low ?? closeVal * 0.988,
          open: item.open ?? closeVal,
          volume: item.volume ?? 1000
        };
      }
    });

    const prices = candles.map(c => c.close);

    const rsiValues = RSI.calculate({ values: prices, period: 14 });
    const macdValues = MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    const bbValues = BollingerBands.calculate({ values: prices, period: 20, stdDev: 2 });
    const ema20 = EMA.calculate({ values: prices, period: 20 });
    const ema50 = EMA.calculate({ values: prices, period: 50 });

    const currentRSI = rsiValues[rsiValues.length - 1] ?? 50.0;
    const currentMACD = (macdValues[macdValues.length - 1] as any) ?? { m: 0, s: 0, h: 0 };
    const currentBB = (bbValues[bbValues.length - 1] as any) ?? { upper: prices[prices.length - 1] * 1.05, lower: prices[prices.length - 1] * 0.95, middle: prices[prices.length - 1] };
    const lastEma20 = ema20[ema20.length - 1] ?? prices[prices.length - 1];
    const lastEma50 = ema50[ema50.length - 1] ?? prices[prices.length - 1];
    const lastPrice = prices[prices.length - 1];

    let score = 0;
    
    // RSI scoring
    if (currentRSI < 30) score += 0.35; // Oversold (bullish trigger)
    else if (currentRSI > 70) score -= 0.35; // Overbought (bearish trigger)
    else if (currentRSI >= 40 && currentRSI <= 60) score += 0.15; // Moderate room-to-run (favorable for swing)
    
    // MACD scoring
    const macdVal = currentMACD.MACD || currentMACD.macd || 0;
    const histogramVal = currentMACD.histogram || currentMACD.MACDHistogram || 0;

    if (histogramVal > 0) score += 0.25;
    else score -= 0.25;
    
    // EMA Cross
    if (lastEma20 > lastEma50) score += 0.15;
    else score -= 0.15;
    
    // Price relative to BB
    if (lastPrice < currentBB.lower) score += 0.15;
    else if (lastPrice > currentBB.upper) score -= 0.15;

    // 1. Calculate ADX
    const adxVal = calculateADX(candles, 14);
    if (adxVal > 25) {
      // Trend is strong. Amplify signal direction of current score.
      score *= 1.25;
    } else if (adxVal < 20) {
      // Sideways range bound. Attenuate score because trend is weak.
      score *= 0.6;
    }

    // 2. Calculate ATR
    const atrVal = calculateATR(candles, 14);

    // 3. Analyze Bollinger Bands Squeeze
    let isSqueezed = false;
    let currentBBWidth = 0.05;
    let avgBBWidth = 0.05;
    if (bbValues.length >= 20) {
      const activeWidths = bbValues.map((v: any) => (v.upper - v.lower) / (v.middle || 1));
      currentBBWidth = activeWidths[activeWidths.length - 1] ?? 0.05;
      avgBBWidth = activeWidths.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      isSqueezed = currentBBWidth < 0.85 * avgBBWidth || currentBBWidth < 0.035;
    }

    if (isSqueezed) {
      // Momentum contraction, favorable breakout upcoming.
      score += (score >= 0 ? 0.1 : -0.1);
    }

    // 4. Calculate Volume confirmation
    let volumeRatio = 1.0;
    let volumeConfirmed = false;
    if (candles.length >= 20) {
      const yesterdayCandle = candles[candles.length - 2];
      const todayCandle = candles[candles.length - 1];
      const recentVolumes = candles.slice(-20).map(c => c.volume);
      const avgVol = recentVolumes.reduce((a, b) => a + b, 0) / 20;

      if (avgVol > 0) {
        volumeRatio = todayCandle.volume / avgVol;
        volumeConfirmed = volumeRatio >= 1.5;
        if (volumeConfirmed) {
          // Extra convergence when breakout has actual volume support
          score += (score >= 0 ? 0.2 : -0.2);
        }
      }
    }

    // Stop Loss and Targets logic (ATR-based)
    // 1.5x ATR Risk for Stop Loss, 2x for Target 1, 3x for Target 2.
    // Automatically enforces clean Risk:Reward profiles
    const stopLoss = Number((lastPrice - 1.5 * atrVal).toFixed(2));
    const target1 = Number((lastPrice + 2.0 * atrVal).toFixed(2));
    const target2 = Number((lastPrice + 3.0 * atrVal).toFixed(2));

    const finalScore = Math.max(-1, Math.min(1, score));
    const trend = finalScore > 0.15 ? 'bullish' : (finalScore < -0.15 ? 'bearish' : 'neutral');

    return {
      rsi: currentRSI,
      macd: { 
        macd: macdVal, 
        signal: currentMACD.signal || 0, 
        histogram: histogramVal 
      },
      bb: currentBB,
      ema20: lastEma20,
      ema50: lastEma50,
      trend,
      score: finalScore,
      adx: adxVal,
      atr: atrVal,
      volumeRatio,
      bbSqueeze: {
        isSqueezed,
        width: Number(currentBBWidth.toFixed(4)),
        avgWidth20: Number(avgBBWidth.toFixed(4))
      },
      volumeConfirmed,
      stopLoss,
      target1,
      target2
    };
  }
}
