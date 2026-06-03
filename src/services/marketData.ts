import YahooFinanceClass from 'yahoo-finance2';
const yahooFinance = new YahooFinanceClass();
import { subDays, format } from 'date-fns';
import { getNSEQuote } from './nseQuotes';

export interface MarketResult {
  symbol: string;
  data: any[];
  currentPrice: number;
  change: number;
  changePercent: number;
}

const SYMBOLS = {
  ETFs: ['SILVERBEES.NS', 'GOLDBEES.NS'],
  Stocks: ['RELIANCE.NS', 'HDFCBANK.NS', 'TATAMOTORS.NS', 'TCS.NS', 'INFY.NS', 'HINDZINC.NS', 'VEDL.NS', 'MUTHOOTFIN.NS', 'MANAPPURAM.NS', 'TITAN.NS', 'WAAREEENER.NS'],
  Macro: ['GC=F', 'SI=F', 'DX-Y.NYB', '^TNX', 'INR=X', '^NSEI', '^INDIAVIX']
};

export async function fetchHistoricalData(symbol: string, days = 365) {
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    
    let result: any[] = [];
    try {
      const chartRes = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });
      if (chartRes && chartRes.quotes) {
        result = chartRes.quotes.filter(
          (q: any) =>
            q.date &&
            q.close !== null &&
            q.close !== undefined &&
            q.open !== null &&
            q.open !== undefined &&
            q.high !== null &&
            q.high !== undefined &&
            q.low !== null &&
            q.low !== undefined
        );
      }
    } catch (err: any) {
      console.warn(`[chart] Fallback triggered for market data of ${symbol}:`, err.message);
    }

    if (result.length === 0) {
      const historicalRes = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      }) as any[];
      if (historicalRes) {
        result = historicalRes.filter(
          (q: any) =>
            q.date &&
            q.close !== null &&
            q.close !== undefined &&
            q.open !== null &&
            q.open !== undefined &&
            q.high !== null &&
            q.high !== undefined &&
            q.low !== null &&
            q.low !== undefined
        );
      }
    }
    
    if (!result || result.length === 0) {
      throw new Error(`No data found for ${symbol}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching historical for ${symbol}:`, error);
    return [];
  }
}

export async function fetchQuote(symbol: string) {
  try {
    const quote = await getNSEQuote(symbol);
    return {
      ...quote,
      regularMarketPrice: quote.lastPrice,
      regularMarketChange: quote.change,
      regularMarketChangePercent: quote.changePercent,
      regularMarketOpen: quote.open,
      regularMarketDayHigh: quote.high,
      regularMarketDayLow: quote.low,
      regularMarketVolume: quote.volume,
      marketState: 'OPEN'
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

export async function getMarketOverview() {
  const allSymbols = [...SYMBOLS.ETFs, ...SYMBOLS.Stocks, ...SYMBOLS.Macro];
  const results: Record<string, any> = {};
  
  await Promise.all(allSymbols.map(async (symbol) => {
    results[symbol] = await fetchQuote(symbol);
  }));
  
  return results;
}
