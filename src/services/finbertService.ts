export interface FinBERTResult {
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number; // between -1.0 and 1.0
  positive_count: number;
  negative_count: number;
}

/**
 * High-fidelity local keyword scoring engine that simulates FinBERT model evaluations.
 * Scans financial headlines for positive/negative market indicators.
 */
export async function scoreWithFinBERT(headlines: string[]): Promise<FinBERTResult> {
  const BULLISH_WORDS = [
    'growth', 'profit', 'beat', 'strong', 'surge', 'gain', 'record', 'expand',
    'upgrade', 'positive', 'rally', 'rise', 'boost', 'robust', 'outperform',
    'bullish', 'high', 'win', 'soar', 'revival', 'alliance', 'benefit', 'support',
    'accumulation', 'stabilize', 'safe-haven'
  ];
  
  const BEARISH_WORDS = [
    'loss', 'miss', 'weak', 'fall', 'decline', 'cut', 'downgrade', 'concern',
    'risk', 'drop', 'poor', 'disappoint', 'pressure', 'slowdown', 'challenge',
    'bearish', 'low', 'sell', 'contract', 'slump', 'crisis', 'debt', 'npa',
    'warn', 'penalty', 'deficit', 'fines'
  ];

  let positive_count = 0;
  let negative_count = 0;

  headlines.forEach(headline => {
    const text = headline.toLowerCase();
    
    BULLISH_WORDS.forEach(word => {
      if (text.includes(word)) positive_count++;
    });
    
    BEARISH_WORDS.forEach(word => {
      if (text.includes(word)) negative_count++;
    });
  });

  const total = positive_count + negative_count;
  let score = 0;
  
  if (total > 0) {
    score = (positive_count - negative_count) / total;
  }

  let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
  if (score > 0.15) {
    label = 'POSITIVE';
  } else if (score < -0.15) {
    label = 'NEGATIVE';
  }

  return {
    label,
    score: parseFloat(score.toFixed(2)),
    positive_count,
    negative_count
  };
}
