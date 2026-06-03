import { TechnicalAgent } from './agents/technicalAgent';
import { GeminiAgent } from './agents/geminiAgent';
import { fetchHistoricalData, fetchQuote } from './marketData';

export class Orchestrator {
  /**
   * Orchestrates multiple agents to generate a unified prediction for a symbol.
   */
  static async getEnsemblePrediction(symbol: string) {
    console.log(`[Orchestrator] Starting ensemble analysis for ${symbol}`);
    
    // 1. Fetch Data
    const historical = await fetchHistoricalData(symbol, 60); // Last 60 days
    const currentQuote = await fetchQuote(symbol);
    
    if (!historical || historical.length < 50) {
      throw new Error(`Insufficient historical data for ${symbol}`);
    }

    const prices = historical.map(d => d.close);
    
    // 2. Technical Analysis
    const technicals = TechnicalAgent.analyze(prices);
    
    // 3. Fetch Macro Context
    const macroSymbols = ['GC=F', 'SI=F', '^NSEI'];
    const macroData: any = {};
    for (const s of macroSymbols) {
      macroData[s] = await fetchQuote(s);
    }
    
    // 4. Gemini Strategic Analysis
    const strategicPrediction = await GeminiAgent.analyze(
      symbol,
      technicals,
      macroData,
      `Market is currently ${currentQuote?.marketState || 'OPEN'}. Volatility is moderate.`
    );
    
    // 5. Ensemble Logic
    // We weight the Technical score and Gemini's confidence
    const finalConfidence = (technicals.score * 0.4) + (strategicPrediction.confidence * 0.6);
    
    return {
      ...strategicPrediction,
      technicalScore: technicals.score,
      ensembleConfidence: Math.abs(finalConfidence),
      technicals,
      timestamp: new Date().toISOString()
    };
  }
}
