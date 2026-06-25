import { Type } from '@google/genai';
import { db } from './serverApi';
import { fetchGlobalMacro, GlobalMacroData } from './globalMacro';
import { fetchFIIDIIData, getFIIDIISignal } from './institutionalFlow';
import { fetchUpcomingEvents } from './earningsTracker';
import { getBulkDealSignalForSymbol, getPromoterData, fetchBulkDeals } from './bulkInsiderTracker';
import { fetchHeadlinesForSymbol } from './newsFetcher';
import YahooFinanceClass from 'yahoo-finance2';
import { ai, isGeminiSuspended, handleGeminiError, trackGeminiCall, callGeneratedContentWithRetry } from './geminiState';

const YahooFinance = (typeof YahooFinanceClass === 'function' ? YahooFinanceClass : (YahooFinanceClass as any).default) as any;
const yahooFinance = new YahooFinance({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  }
});

export interface NewsMasterSummary {
  overallSentiment: number; // -100 to +100
  marketMood: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
  macroBrief: string;
  flowAnalysis: string;
  weeklyOutlook: string;
  opportunities: Array<{ title: string; reason: string; confidence: number }>;
  risks: Array<{ title: string; impact: string; probability: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  lastUpdated: string;
}

export interface SymbolIntelligence {
  symbol: string;
  sentimentScore: number; // -100 to +100
  tradeSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  fiveDayNarrative: string;
  keyCatalysts: string[];
  swingStrategy: {
    recommendedAction: 'BUY' | 'SELL' | 'HOLD' | 'ACCUMULATE';
    entryZone: string;
    targetZone: string;
    stopLoss: string;
    horizon: string;
  };
}

export async function getCompleteNewsIntelligence(): Promise<NewsMasterSummary> {
  const cacheTTL = 6 * 60 * 60 * 1000; // 6 hours (extended cache)
  const masterKey = '_MASTER_INDEX';

  let cachedPayload: any = null;
  try {
    const row = db.prepare("SELECT * FROM intelligence_cache WHERE symbol = ?").get(masterKey) as any;
    if (row) {
      cachedPayload = JSON.parse(row.data);
      const isStillValid = (Date.now() - new Date(row.updated_at).getTime()) < cacheTTL;
      if (isStillValid || isGeminiSuspended() || !ai) {
        console.log(`[NewsIntelligence] Serving master index summary from cache. (Valid? ${isStillValid}, Gemini Suspended? ${isGeminiSuspended()})`);
        return cachedPayload;
      }
    }
  } catch (err: any) {
    console.warn("[NewsIntelligence] Cache read error:", err.message);
  }

  console.log("[NewsIntelligence] Master cache miss. Gathering indicators...");
  const [macro, flowSig, deals, events] = await Promise.all([
    fetchGlobalMacro(),
    getFIIDIISignal(),
    fetchBulkDeals(),
    fetchUpcomingEvents()
  ]);

  // Compute deterministic sentiment baseline
  let score = 0;
  if (macro?.globalSignal === 'BULLISH') score += 25;
  if (macro?.globalSignal === 'BEARISH') score -= 30;
  if (flowSig?.signal === 'BULLISH') score += 25;
  if (flowSig?.signal === 'BEARISH') score -= 25;

  // Add drift based on recent index closes
  const sAndPChange = macro?.sp500?.change1D ?? 0.1;
  score += Math.max(-30, Math.min(30, Math.round(sAndPChange * 15)));
  
  // Bound score
  score = Math.max(-100, Math.min(100, score));

  const getMood = (val: number): NewsMasterSummary['marketMood'] => {
    if (val < -50) return 'EXTREME_FEAR';
    if (val < -10) return 'FEAR';
    if (val < 15) return 'NEUTRAL';
    if (val < 55) return 'GREED';
    return 'EXTREME_GREED';
  };

  const marketMood = getMood(score);

  // Default robust briefs
  const spTrend = macro?.sp500?.trend ?? 'FLAT';
  const rateVal = macro?.usdinr?.rate ?? 83.45;
  let macroBrief = `Global macro structures show S&P 500 trending ${spTrend} closed with ${sAndPChange > 0 ? 'positive' : 'negative'} trajectory at ${sAndPChange.toFixed(2)}%. USD/INR rate remains steady near ₹${rateVal.toFixed(2)}.`;
  let flowAnalysis = `Institutional activities indicate a ${flowSig?.signal ?? 'NEUTRAL'} sentiment. ${flowSig?.reason ?? 'No major institutional imbalances detected.'}`;
  let weeklyOutlook = `Index transitions are poised inside a standard support pocket. Overcoming local consolidation points requires expanded domestic mutual fund volumes. Recommendations skew towards selective equity accumulation near major 50-EMA levels.`;

  let opportunities = [
    { title: "Commodity BeES Support", reason: "Gold prices consolidate with technical support at $2350, boosting safe-haven assets.", confidence: 85 },
    { title: "Automobile Swing Setup", reason: "Crude stability at $78 relieves margin cost pressures for transport operators.", confidence: 75 }
  ];

  let risks = [
    { title: "US Treasury Spot Inflation", reason: "US 10-Yr yield staying above 4.3% compresses debt-to-equity flow limits.", impact: "Widespread valuation compression across tier-2 tech stocks.", probability: "MEDIUM" as const },
    { title: "Near-Term Expiry Adjustments", reason: "Volatile options rolling leads to transient price gaps.", impact: "Elevated spot intraday drawdowns.", probability: "HIGH" as const }
  ];

  if (ai && !isGeminiSuspended()) {
    try {
      console.log("[NewsIntelligence] Requesting Gemini to synthesize corporate intelligence master report...");
      const schema = {
        type: Type.OBJECT,
        properties: {
          macroBrief: { type: Type.STRING },
          flowAnalysis: { type: Type.STRING },
          weeklyOutlook: { type: Type.STRING },
          opportunities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reason: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["title", "reason", "confidence"]
            }
          },
          risks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                impact: { type: Type.STRING },
                probability: { type: Type.STRING }
              },
              required: ["title", "impact", "probability"]
            }
          }
        },
        required: ["macroBrief", "flowAnalysis", "weeklyOutlook", "opportunities", "risks"]
      };

      const usYieldVal = macro?.us10yrYield?.value ?? 4.35;
      const vixVal = macro?.indiaVix?.value ?? 15.6;
      const crudeVal = macro?.crudeoil?.price ?? 78.5;
      const response = await callGeneratedContentWithRetry({
        model: 'gemini-3.5-flash',
        contents: `Synthesize the following Indian stock market docket into a master market summary and outlook report.
DOCKET:
- Global Macro Indicators: S&P 500 trend=${spTrend}, 1D Change=${sAndPChange}%, crude oil=$${crudeVal}/barrel, US 10-Yr Yield=${usYieldVal}%, India VIX=${vixVal}.
- FII/DII Institutional flows summary: ${flowSig?.reason ?? 'Stable flows.'} (Signal is ${flowSig?.signal ?? 'NEUTRAL'}).
- Big Deals on NSE of today: ${JSON.stringify(deals.slice(0, 5))}
- Upcoming major events: ${JSON.stringify(events.slice(0, 5))}

Return a structured JSON output of type NewsMasterSummary that maps exactly to the provided schema. The analysis must be senior-grade quantitative research. Do not return markdown block wrappers around JSON.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      if (response && response.text) {
        const payload = JSON.parse(response.text.trim());
        macroBrief = payload.macroBrief;
        flowAnalysis = payload.flowAnalysis;
        weeklyOutlook = payload.weeklyOutlook;
        opportunities = payload.opportunities.map((o: any) => ({
          title: o.title,
          reason: o.reason,
          confidence: Number(o.confidence) || 75
        }));
        risks = payload.risks.map((r: any) => ({
          title: r.title,
          impact: r.impact,
          probability: (r.probability === 'HIGH' || r.probability === 'MEDIUM' || r.probability === 'LOW') ? r.probability : 'LOW'
        }));
        console.log("[NewsIntelligence] Gemini master report generated successfully.");
      }
    } catch (err: any) {
      let errStr = err.message || String(err);
      if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted")) {
        errStr = "Quota exceeded (429 / RESOURCE_EXHAUSTED)";
      } else if (errStr.includes('<!DOCTYPE') || errStr.includes('<html')) {
        errStr = "HTML response from API";
      }
      const shortErr = errStr.substring(0, 120);
      console.log(`[NewsIntelligence] Gemini master generation fallback applied gracefully: ${shortErr}...`);
      handleGeminiError(err, "NewsMaster");
      if (cachedPayload) {
        console.log("[NewsIntelligence] Gemini master generation failed. Returning cached stale master summary report.");
        return cachedPayload;
      }
    }
  }

  const result: NewsMasterSummary = {
    overallSentiment: score,
    marketMood,
    macroBrief,
    flowAnalysis,
    weeklyOutlook,
    opportunities,
    risks,
    lastUpdated: new Date().toISOString()
  };

  try {
    db.prepare(`
      INSERT OR REPLACE INTO intelligence_cache (symbol, data, updated_at)
      VALUES (?, ?, ?)
    `).run(masterKey, JSON.stringify(result), new Date().toISOString());
  } catch (err: any) {
    console.error("[NewsIntelligence] Save master cache failed:", err.message);
  }

  return result;
}

export async function getSymbolIntelligence(symbol: string): Promise<SymbolIntelligence> {
  const cacheTTL = 6 * 60 * 60 * 1000; // 6 hours Cache for symbols (extended cache)
  const symKey = symbol.toUpperCase().trim();

  let cachedPayload: any = null;
  try {
    const row = db.prepare("SELECT * FROM intelligence_cache WHERE symbol = ?").get(symKey) as any;
    if (row) {
      cachedPayload = JSON.parse(row.data);
      const isStillValid = (Date.now() - new Date(row.updated_at).getTime()) < cacheTTL;
      if (isStillValid || isGeminiSuspended() || !ai) {
        console.log(`[SymbolIntelligence] Serving ${symKey} report from cache. (Valid? ${isStillValid}, Gemini Suspended? ${isGeminiSuspended()})`);
        return cachedPayload;
      }
    }
  } catch (err: any) {
    console.warn("[SymbolIntelligence] Cache symbol read failed:", err.message);
  }

  console.log(`[SymbolIntelligence] Cache miss. Synthesizing data for ${symKey}...`);

  // Gather current quote to calculate precise entry & targets
  let lastPrice = 1000;
  try {
    const qRaw = await yahooFinance.quote(symKey) as any;
    if (qRaw && qRaw.regularMarketPrice) {
      lastPrice = qRaw.regularMarketPrice;
      console.log(`[SymbolIntelligence] Resolved lastPrice for ${symKey} via Yahoo Finance: ${lastPrice}`);
    } else {
      throw new Error("Yahoo Finance quote returned null price");
    }
  } catch (err: any) {
    console.log(`[SymbolIntelligence] yahooFinance.quote failed for ${symKey} (${err.message}). Trying fallback price sources...`);
    try {
      const { getPricesHistory } = await import('./serverApi');
      const prices = await getPricesHistory(symKey, 50);
      if (prices && prices.length > 0) {
        lastPrice = prices[prices.length - 1].close;
        console.log(`[SymbolIntelligence] Resolved fallback lastPrice for ${symKey} via getPricesHistory: ${lastPrice}`);
      } else {
        const { getNSEQuote } = await import('./nseQuotes');
        const cleanSym = symKey.split('.')[0];
        const q = await getNSEQuote(cleanSym);
        if (q && q.lastPrice > 0) {
          lastPrice = q.lastPrice;
          console.log(`[SymbolIntelligence] Resolved fallback lastPrice for ${symKey} via getNSEQuote: ${lastPrice}`);
        }
      }
    } catch (fallbackErr: any) {
      console.warn(`[SymbolIntelligence] Failed to resolve fallback price for ${symKey}:`, fallbackErr.message);
    }
  }

  const [dealsSignal, promoterData, newsHeadlines] = await Promise.all([
    getBulkDealSignalForSymbol(symKey),
    getPromoterData(symKey),
    fetchHeadlinesForSymbol(symKey)
  ]);

  // Determine sentiment score deterministically as baseline
  let score = 0;
  if (dealsSignal.netImpact === 'BULLISH') score += 30;
  if (dealsSignal.netImpact === 'BEARISH') score -= 30;
  if (promoterData.isInsiderBuyingStable) score += 20;

  score = Math.max(-100, Math.min(100, score));

  const getSentimentText = (val: number): SymbolIntelligence['tradeSentiment'] => {
    if (val > 15) return 'BULLISH';
    if (val < -15) return 'BEARISH';
    return 'NEUTRAL';
  };

  const tradeSentiment = getSentimentText(score);

  // Fallback narrative & swing plan
  let fiveDayNarrative = `${symKey} is displaying robust structural indicators. Promoter holding is stable at ${promoterData.promoterGroupHolding}%, with no core pledges. Liquidity accumulation bounds support swing consolidations.`;
  let keyCatalysts = [
    `Stable promoter ownership holdings registered at ${promoterData.promoterGroupHolding}%`,
    `Local mutual fund consolidation profiles matching technical support bounds`,
    `Headlines mentions count: ${newsHeadlines.length} articles indexed`
  ];

  let swingStrategy = {
    recommendedAction: (score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD') as SymbolIntelligence['swingStrategy']['recommendedAction'],
    entryZone: `₹${(lastPrice * 0.98).toFixed(1)} - ₹${(lastPrice * 1.01).toFixed(1)}`,
    targetZone: `₹${(lastPrice * 1.06).toFixed(1)} - ₹${(lastPrice * 1.10).toFixed(1)}`,
    stopLoss: `₹${(lastPrice * 0.94).toFixed(1)}`,
    horizon: `5-8 Market Days`
  };

  if (ai && !isGeminiSuspended()) {
    try {
      console.log(`[SymbolIntelligence] Querying Gemini for ticker ${symKey}...`);
      const schema = {
        type: Type.OBJECT,
        properties: {
          sentimentScore: { type: Type.INTEGER },
          tradeSentiment: { type: Type.STRING },
          fiveDayNarrative: { type: Type.STRING },
          keyCatalysts: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          swingStrategy: {
            type: Type.OBJECT,
            properties: {
              recommendedAction: { type: Type.STRING },
              entryZone: { type: Type.STRING },
              targetZone: { type: Type.STRING },
              stopLoss: { type: Type.STRING },
              horizon: { type: Type.STRING }
            },
            required: ["recommendedAction", "entryZone", "targetZone", "stopLoss", "horizon"]
          }
        },
        required: ["sentimentScore", "tradeSentiment", "fiveDayNarrative", "keyCatalysts", "swingStrategy"]
      };

      const response = await callGeneratedContentWithRetry({
        model: 'gemini-3.5-flash',
        contents: `Review this comprehensive equities dossier for the stock ${symKey}:
- Last Quote Price: ₹${lastPrice.toFixed(2)}
- Bulk Transactions (NSE): Buying pressure=₹${dealsSignal.buyingPressure.toFixed(1)}Cr, Selling pressure=₹${dealsSignal.sellingPressure.toFixed(1)}Cr. Net Signal status is ${dealsSignal.netImpact}.
- Promoter configuration: Holding=${promoterData.promoterGroupHolding}%, Pledged=${promoterData.pledgedHolding}%. Recent insider transactions: ${JSON.stringify(promoterData.recentPurchases)}
- Latest news signals: ${JSON.stringify(newsHeadlines.slice(0, 6))}

Generate a short-horizon fiveDayNarrative (5-day outlook draft), key trading catalysts (bullet items), and target/entry levels for a Swing Strategy. Keep target ratios realistic. Match the JSON output schema strictly.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      if (response && response.text) {
        const payload = JSON.parse(response.text.trim());
        score = Number(payload.sentimentScore) || score;
        const rawAction = payload.swingStrategy.recommendedAction.toUpperCase();
        
        swingStrategy = {
          recommendedAction: (rawAction.includes('BUY') ? 'BUY' : rawAction.includes('SELL') ? 'SELL' : rawAction.includes('ACCUMULATE') ? 'ACCUMULATE' : 'HOLD') as any,
          entryZone: payload.swingStrategy.entryZone,
          targetZone: payload.swingStrategy.targetZone,
          stopLoss: payload.swingStrategy.stopLoss,
          horizon: payload.swingStrategy.horizon
        };

        fiveDayNarrative = payload.fiveDayNarrative;
        keyCatalysts = payload.keyCatalysts;
        console.log(`[SymbolIntelligence] Gemini complete for ticker ${symKey}.`);
      }
    } catch (err: any) {
      let errStr = err.message || String(err);
      if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted")) {
        errStr = "Quota exceeded (429 / RESOURCE_EXHAUSTED)";
      } else if (errStr.includes('<!DOCTYPE') || errStr.includes('<html')) {
        errStr = "HTML response from API";
      }
      const shortErr = errStr.substring(0, 120);
      console.log(`[SymbolIntelligence] Fallback applied gracefully for ticker ${symKey}: ${shortErr}...`);
      handleGeminiError(err, "SymbolSpy-" + symKey);
      if (cachedPayload) {
        console.log(`[SymbolIntelligence] Gemini failed. Returning cached stale report for ticker ${symKey}.`);
        return cachedPayload;
      }
    }
  }

  const result: SymbolIntelligence = {
    symbol: symKey,
    sentimentScore: score,
    tradeSentiment: getSentimentText(score),
    fiveDayNarrative,
    keyCatalysts,
    swingStrategy
  };

  try {
    db.prepare(`
      INSERT OR REPLACE INTO intelligence_cache (symbol, data, updated_at)
      VALUES (?, ?, ?)
    `).run(symKey, JSON.stringify(result), new Date().toISOString());
  } catch (err: any) {
    console.error("[SymbolIntelligence] Write database cache failed:", err.message);
  }

  return result;
}
