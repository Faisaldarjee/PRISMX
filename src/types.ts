export interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Asset {
  symbol: string;
  name: string;
  type: 'ETF' | 'STOCK' | 'MACRO';
  last_price: number | null;
  last_date: string | null;
}

export interface AgentResult {
  signal: string;
  confidence?: number;
  reasons?: string[];
  key_reasons?: string[];
  direction?: string;
  top_features?: string[];
  sentiment_label?: string;
}

export interface Prediction {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'MIXED';
  confidence: number;
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  weighted_score: number;
  timeframe: string;
  agent_breakdown: {
    technical: AgentResult | null;
    macro: AgentResult | null;
    ml: AgentResult | null;
    sentiment: AgentResult | null;
  };
  key_reasons: string[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  sip_recommendation?: string | null;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  errors?: string[];
  timestamp: string;
  prediction_id?: number;
  multiTimeframe?: {
    weeklyTrend: string;
    dailySignal: string;
    fourHourTrig: string;
    concurrence: string;
  };
}

export interface FundamentalData {
  symbol: string;
  name: string;
  type: 'ETF' | 'STOCK' | 'MACRO';
  market_cap?: string;
  pe_ratio?: string;
  pb_ratio?: string;
  promoter_holding?: string;
  promoter_pledged?: string;
  debt_to_equity?: string;
  dividend_yield?: string;
  earnings_date?: string;
  year_high_low?: string;
  expense_ratio?: string;
  aum?: string;
  tracking_error?: string;
  nav?: string;
  physical_backing?: string;
}

export interface MacroData {
  macro_signal: string;
  confidence: number;
  indicators: {
    DXY: number;
    US10Y: number;
    USDINR: number;
    VIX: number;
    gold_silver_ratio: number;
  };
  impact_on_gold: string;
  impact_on_silver: string;
}

export interface SipData {
  symbol: string;
  sip_recommendation: string;
  confidence: number;
  reasons: string[];
  score_breakdown?: Record<string, number>;
  macro_context: {
    signal: string;
    score: number;
    key_reasons: string[];
  };
}

export interface SentimentData {
  symbol: string;
  sentiment: string;
  score: number;
  headlines: string[];
  upcoming_events: string[];
}

export interface AccuracyData {
  overall_accuracy: number;
  by_asset: Record<string, number>;
  by_agent: Record<string, number>;
  total_predictions: number;
  period_days: number;
  recent_ledger?: any[];
}

export interface CorrelatedAsset {
  symbol: string;
  correlation: number;
  trend: string;
}

export interface CorrelationData {
  symbol: string;
  top_correlated_assets: CorrelatedAsset[];
  sip_signal: string | null;
  lead_lag_insight: string;
}
