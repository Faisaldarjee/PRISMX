import { 
  Asset, 
  Prediction, 
  MacroData, 
  SipData, 
  HistoryBar, 
  SentimentData, 
  AccuracyData, 
  CorrelationData,
  FundamentalData
} from './types';

// Smart API routing base resolution
const API_BASE = window.location.port === '5173' ? 'http://localhost:3000' : '';

async function fetchJson<T>(url: string, options?: RequestInit, retries = 4, delayMs = 1500): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      let message = `API request failed: ${response.statusText}`;
      try {
        const errObj = JSON.parse(text);
        if (errObj.detail) {
          message = errObj.detail;
        }
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  } catch (error: any) {
    const isNetworkError = error instanceof TypeError || 
                         error.message?.includes('Failed to fetch') || 
                         error.message?.includes('NetworkError') ||
                         error.message?.includes('abort');
                         
    if (isNetworkError && retries > 0) {
      console.warn(`[API Client] Network failure calling ${url}. Retrying in ${delayMs}ms. Retries left: ${retries}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchJson<T>(url, options, retries - 1, delayMs * 1.5);
    }
    throw error;
  }
}

export async function getAssets(): Promise<Asset[]> {
  return fetchJson<Asset[]>(`${API_BASE}/api/assets`);
}

export async function getPrediction(symbol: string, refresh = false): Promise<Prediction> {
  return fetchJson<Prediction>(`${API_BASE}/api/predict/${symbol}?refresh=${refresh}`);
}

export async function getAllPredictions(): Promise<Prediction[]> {
  return fetchJson<Prediction[]>(`${API_BASE}/api/predict-all`);
}

export async function getMacro(): Promise<MacroData> {
  return fetchJson<MacroData>(`${API_BASE}/api/macro`);
}

export async function getSip(symbol: string): Promise<SipData> {
  return fetchJson<SipData>(`${API_BASE}/api/sip/${symbol}`);
}

export async function getHistory(symbol: string, limit = 252): Promise<HistoryBar[]> {
  return fetchJson<HistoryBar[]>(`${API_BASE}/api/history/${symbol}?limit=${limit}`);
}

export async function getSentiment(symbol: string): Promise<SentimentData> {
  return fetchJson<SentimentData>(`${API_BASE}/api/sentiment/${symbol}`);
}

export async function getAccuracy(): Promise<AccuracyData> {
  return fetchJson<AccuracyData>(`${API_BASE}/api/accuracy`);
}

export async function runBacktest(symbol: string): Promise<any> {
  return fetchJson<any>(
    `${API_BASE}/api/accuracy/backtest/${encodeURIComponent(symbol)}`,
    { method: 'POST' }
  );
}

export async function getCorrelation(symbol: string): Promise<CorrelationData> {
  return fetchJson<CorrelationData>(`${API_BASE}/api/correlation/${symbol}`);
}

export async function getFundamentals(symbol: string): Promise<FundamentalData> {
  return fetchJson<FundamentalData>(`${API_BASE}/api/fundamentals/${symbol}`);
}

export async function importAsset(symbol: string): Promise<{ symbol: string; name: string; type: string; alreadyExists: boolean }> {
  return fetchJson<{ symbol: string; name: string; type: string; alreadyExists: boolean }>(
    `${API_BASE}/api/assets/import`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol })
    }
  );
}

export async function searchAssets(query: string): Promise<any[]> {
  return fetchJson<any[]>(`${API_BASE}/api/assets/search?q=${encodeURIComponent(query)}`);
}

export async function triggerRetraining(symbol: string): Promise<{ status: string; symbol: string; message: string }> {
  return fetchJson<{ status: string; symbol: string; message: string }>(
    `${API_BASE}/api/retrain/${symbol}`,
    { method: 'POST' }
  );
}

export async function getGeminiMorningBriefing(asset: string): Promise<{ briefing: string }> {
  return fetchJson<{ briefing: string }>(`${API_BASE}/api/gemini/morning-briefing?asset=${encodeURIComponent(asset)}`);
}

export async function getGeminiSwingCard(symbol: string): Promise<any> {
  return fetchJson<any>(`${API_BASE}/api/gemini/swing-card/${encodeURIComponent(symbol)}`);
}

export async function getGeminiExplainSignal(symbol: string, signal: string): Promise<{ explanation: string }> {
  return fetchJson<{ explanation: string }>(`${API_BASE}/api/gemini/explain-signal?symbol=${encodeURIComponent(symbol)}&signal=${encodeURIComponent(signal)}`);
}

export async function getGeminiWeeklyReport(): Promise<{ report: string }> {
  return fetchJson<{ report: string }>(`${API_BASE}/api/gemini/weekly-report`);
}

export async function getSwingScannerSetups(): Promise<any[]> {
  return fetchJson<any[]>(`${API_BASE}/api/swing-scanner`);
}
