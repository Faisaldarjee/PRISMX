import { db } from './database';

export interface AgentSignal {
  agent: 'technical' | 'smc' | 'macro' | 'sentiment' | 'news';
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0 - 100
  weight: number; // fractional weight, e.g. 0.35, sum of all active weights = 1.0
}

export interface AgentInput {
  agent: 'technical' | 'smc' | 'macro' | 'sentiment' | 'news';
  signal: string;
  confidence: number;
}

export interface ConsensusResult {
  finalSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  consensusScore: number; // Raw score from -2.0 to +2.0 based on weighted math
  agentBreakdown: AgentSignal[];
  conflictDetected: boolean;
  conflictReason?: string;
}

export class WeightedConsensusEngine {
  // Configured default weights:
  // - SMC Agent: 35% (Institutional Money Tracking)
  // - Technical Agent: 30%
  // - Sentiment/News Agent: 20%
  // - Macro Agent: 15%
  private static DEFAULT_WEIGHTS: Record<string, number> = {
    smc: 0.35,
    technical: 0.30,
    sentiment: 0.20,
    macro: 0.15
  };

  private static SIGNAL_VALUES: Record<string, number> = {
    STRONG_BUY: 2.0,
    BUY: 1.0,
    HOLD: 0.0,
    NEUTRAL: 0.0, // mapping fallback
    SELL: -1.0,
    STRONG_SELL: -2.0
  };

  /**
   * Calculate adaptive weights dynamically based on historical accuracy.
   */
  public static getAdaptiveWeights(symbol?: string): Record<string, number> {
    const DEFAULT_WEIGHTS = this.DEFAULT_WEIGHTS;
    
    try {
      // Step 1: Get symbol-specific predictions (last 50)
      let rows: any[] = [];
      
      if (symbol) {
        try {
          rows = db.prepare(`
            SELECT 
              smc_signal, technical_signal, 
              sentiment_signal, macro_signal,
              signal as final_signal, outcome,
              market_regime
            FROM accuracy_logs
            WHERE symbol = ? 
            AND outcome IN ('WIN', 'LOSS', 'NEUTRAL')
            AND outcome IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 50
          `).all(symbol) as any[];
        } catch (dbErr) {
          console.warn('[AdaptiveWeights] Symbol query failed, using global only:', dbErr);
        }
      }
      
      // Step 2: If < 5 symbol records, blend with global
      let globalRows: any[] = [];
      if (rows.length < 5) {
        try {
          globalRows = db.prepare(`
            SELECT 
              smc_signal, technical_signal,
              sentiment_signal, macro_signal,
              signal as final_signal, outcome,
              market_regime
            FROM accuracy_logs
            WHERE outcome IN ('WIN', 'LOSS', 'NEUTRAL')
            AND outcome IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 100
          `).all() as any[];
        } catch (dbErr) {
          console.warn('[AdaptiveWeights] Global query failed:', dbErr);
        }
      }
      
      // Step 3: Blend — 70% symbol + 30% global
      // If no symbol data, use 100% global
      const blendedRows = rows.length >= 5
        ? [...rows, ...globalRows.slice(0, Math.floor(globalRows.length * 0.3))]
        : globalRows;
      
      if (blendedRows.length < 5) {
        console.log('[AdaptiveWeights] Insufficient data, using defaults');
        return DEFAULT_WEIGHTS;
      }
      
      // Step 4: Calculate accuracy per agent
      // with sample-size confidence adjustment
      function calcAgentAccuracy(
        agentSignalKey: string, 
        rowsList: any[]
      ): { accuracy: number; sampleSize: number } {
        const relevant = rowsList.filter(r => r[agentSignalKey] !== null && r[agentSignalKey] !== undefined);
        if (relevant.length === 0) return { accuracy: 0.5, sampleSize: 0 };
        
        const correct = relevant.filter(r => {
          const agentSignal = r[agentSignalKey];
          const outcome = r.outcome;
          
          // Agent was bullish and outcome was WIN
          if (['BULLISH', 'BUY', 'STRONG_BUY'].includes(agentSignal) 
              && outcome === 'WIN') return true;
          // Agent was bearish and outcome was WIN (price fell)
          if (['BEARISH', 'SELL', 'STRONG_SELL'].includes(agentSignal) 
              && outcome === 'WIN') return true;
          // Agent was neutral and outcome was NEUTRAL
          if (['NEUTRAL', 'HOLD'].includes(agentSignal) 
              && outcome === 'NEUTRAL') return true;
          return false;
        });
        
        return {
          accuracy: correct.length / relevant.length,
          sampleSize: relevant.length
        };
      }
      
      const agents = {
        smc: calcAgentAccuracy('smc_signal', blendedRows),
        technical: calcAgentAccuracy('technical_signal', blendedRows),
        sentiment: calcAgentAccuracy('sentiment_signal', blendedRows),
        macro: calcAgentAccuracy('macro_signal', blendedRows),
      };
      
      // Step 5: Sample-size confidence adjustment
      // (prevents small sample overfitting)
      function adjustedAccuracy(
        accuracy: number, 
        sampleSize: number
      ): number {
        const confidenceFactor = Math.min(1, sampleSize / 30);
        return (accuracy * confidenceFactor) + (0.5 * (1 - confidenceFactor));
      }
      
      // Step 6: Calculate dynamic weights
      const rawWeights = {
        smc: DEFAULT_WEIGHTS.smc * Math.max(0.1, 
          1.0 + (adjustedAccuracy(agents.smc.accuracy, agents.smc.sampleSize) - 0.5) * 2.0),
        technical: DEFAULT_WEIGHTS.technical * Math.max(0.1,
          1.0 + (adjustedAccuracy(agents.technical.accuracy, agents.technical.sampleSize) - 0.5) * 2.0),
        sentiment: DEFAULT_WEIGHTS.sentiment * Math.max(0.1,
          1.0 + (adjustedAccuracy(agents.sentiment.accuracy, agents.sentiment.sampleSize) - 0.5) * 2.0),
        macro: DEFAULT_WEIGHTS.macro * Math.max(0.1,
          1.0 + (adjustedAccuracy(agents.macro.accuracy, agents.macro.sampleSize) - 0.5) * 2.0),
      };
      
      // Step 7: Normalize to sum = 1.0
      const total = Object.values(rawWeights).reduce((a, b) => a + b, 0);
      const normalizedWeights = {
        smc: rawWeights.smc / total,
        technical: rawWeights.technical / total,
        sentiment: rawWeights.sentiment / total,
        macro: rawWeights.macro / total,
      };
      
      console.log('[AdaptiveWeights] Symbol:', symbol || 'global');
      console.log('[AdaptiveWeights] Sample sizes:', {
        smc: agents.smc.sampleSize,
        technical: agents.technical.sampleSize,
        sentiment: agents.sentiment.sampleSize,
        macro: agents.macro.sampleSize,
      });
      console.log('[AdaptiveWeights] Final weights:', normalizedWeights);
      
      return normalizedWeights;
      
    } catch (e) {
      console.error('[AdaptiveWeights] Error, using defaults:', e);
      return DEFAULT_WEIGHTS;
    }
  }

  /**
   * Reconcile multiple agent signals into one unified consensus decision using adaptive self-healing weights.
   */
  public static calculateConsensus(
    inputs: AgentInput[],
    symbol?: string
  ): ConsensusResult {
    // Get adaptive weights (falls back to default if insufficient data)
    const weights = this.getAdaptiveWeights(symbol);
    
    console.log('[Consensus] Using weights for', symbol || 'unknown', ':', weights);

    // 1. Process and normalize signals
    const signals: AgentSignal[] = [];
    let totalWeightUsed = 0;

    // Filter and find what weights we are compiling
    inputs.forEach(input => {
      let normSignal: AgentSignal['signal'] = 'HOLD';
      const uSig = input.signal?.trim().toUpperCase();

      if (uSig === 'STRONG_BUY' || uSig === 'STRONG BUY' || uSig === 'BULLISH' && input.confidence > 80) {
        normSignal = 'STRONG_BUY';
      } else if (uSig === 'BUY' || uSig === 'BULLISH' || uSig === 'ACCUMULATE') {
        normSignal = 'BUY';
      } else if (uSig === 'STRONG_SELL' || uSig === 'STRONG SELL' || uSig === 'BEARISH' && input.confidence > 80) {
        normSignal = 'STRONG_SELL';
      } else if (uSig === 'SELL' || uSig === 'BEARISH') {
        normSignal = 'SELL';
      } else {
        normSignal = 'HOLD';
      }

      // Map dynamic weight
      const weightKey = input.agent === 'news' ? 'sentiment' : input.agent;
      const weight = weights[weightKey] ?? 0.1;
      totalWeightUsed += weight;

      signals.push({
        agent: input.agent,
        signal: normSignal,
        confidence: Math.max(0, Math.min(100, input.confidence)),
        weight
      });
    });

    // 2. Re-normalize weights so the sum is exactly 1.0 if any agent failed or is missing
    if (totalWeightUsed > 0 && Math.abs(totalWeightUsed - 1.0) > 0.001) {
      signals.forEach(s => {
        s.weight = parseFloat((s.weight / totalWeightUsed).toFixed(3));
      });
    }

    // 3. Compute score: sum of [ signalValue * (confidence / 100) * weight ]
    let consensusScore = 0;
    signals.forEach(s => {
      const value = this.SIGNAL_VALUES[s.signal] ?? 0.0;
      const weightedContribution = value * (s.confidence / 100) * s.weight;
      consensusScore += weightedContribution;
    });

    // Round consensusShift to high accuracy precision
    consensusScore = parseFloat(consensusScore.toFixed(3));

    // 4. Map consensusScore to Final Signal based on specified boundary thresholds:
    let finalSignal: ConsensusResult['finalSignal'] = 'HOLD';
    if (consensusScore > 0.8) {
      finalSignal = 'STRONG_BUY';
    } else if (consensusScore >= 0.3) {
      finalSignal = 'BUY';
    } else if (consensusScore <= -0.8) {
      finalSignal = 'STRONG_SELL';
    } else if (consensusScore <= -0.3) {
      finalSignal = 'SELL';
    } else {
      finalSignal = 'HOLD';
    }

    // 5. Conflict detection: Check if major agents contradict directly
    let conflictDetected = false;
    let conflictReason: string | undefined;

    const bullishAgents = signals.filter(s => s.signal === 'STRONG_BUY' || s.signal === 'BUY');
    const bearishAgents = signals.filter(s => s.signal === 'STRONG_SELL' || s.signal === 'SELL');

    if (bullishAgents.length > 0 && bearishAgents.length > 0) {
      conflictDetected = true;
      const smcAgent = signals.find(s => s.agent === 'smc');
      const techAgent = signals.find(s => s.agent === 'technical');

      if (smcAgent && techAgent && (
        (smcAgent.signal.includes('SELL') && techAgent.signal.includes('BUY')) ||
        (smcAgent.signal.includes('BUY') && techAgent.signal.includes('SELL'))
      )) {
        conflictReason = `SMC Smart Money flow registers ${smcAgent.signal} (${smcAgent.confidence}% conf) which conflicts directly with the Technical analysis suggesting a ${techAgent.signal} setup. Use caution.`;
      } else {
        const bulls = bullishAgents.map(b => `${b.agent.toUpperCase()} (${b.signal})`).join(', ');
        const bears = bearishAgents.map(b => `${b.agent.toUpperCase()} (${b.signal})`).join(', ');
        conflictReason = `Opposing signal vectors flagged. Bullish: [${bulls}] VS Bearish: [${bears}]. High volatility setup, market participants are split.`;
      }
    }

    return {
      finalSignal,
      consensusScore,
      agentBreakdown: signals,
      conflictDetected,
      conflictReason
    };
  }
}
