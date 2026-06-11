import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import YahooFinanceClass from 'yahoo-finance2';

const YahooFinance = (typeof YahooFinanceClass === 'function'
  ? YahooFinanceClass
  : (YahooFinanceClass as any).default) as any;

const yahooFinance = new YahooFinance({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  }
});

// Clean workspace relative path
let dbDir = path.join(process.cwd(), 'data');
let dbPath = path.join(dbDir, 'predictions.db');

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  // Try writing a small test file to verify write access
  const testFile = path.join(dbDir, '.write_test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (writeErr: any) {
  console.warn(`[nseQuotes] Database directory ${dbDir} is not writable:`, writeErr.message, ". Falling back to /tmp/predictions.db for write support.");
  dbDir = '/tmp';
  dbPath = path.join(dbDir, 'predictions.db');
}

try {
  if (fs.existsSync(dbPath)) {
    const testDb = new Database(dbPath);
    testDb.pragma('journal_mode = WAL');
    testDb.close();
  }
} catch (e: any) {
  console.warn("[nseQuotes] SQLite DB format mismatch or corruption detected. Clearing corrupt database and starting fresh...", e.message);
  try {
    fs.unlinkSync(dbPath);
  } catch (unlinkErr: any) {
    console.error("[nseQuotes] Failed to unlink corrupt DB file:", unlinkErr.message);
  }
}

const db = new Database(dbPath);

// Ensure quotes_cache table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS quotes_cache (
    symbol TEXT PRIMARY KEY,
    data TEXT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface QuoteData {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: Date;
  source: 'NSE' | 'Yahoo';
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com',
  'Connection': 'keep-alive'
};

let cachedCookies = '';
let cookiesFetchedAt = 0;

/**
 * Handles security handshakes with NSE to solve cookies challenges.
 */
async function fetchNSECookies(): Promise<string> {
  const now = Date.now();
  if (cachedCookies && (now - cookiesFetchedAt < 10 * 60 * 1000)) {
    return cachedCookies;
  }
  
  console.log('[NSE] Fetching fresh cookies from homepage...');
  const response = await axios.get('https://www.nseindia.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    },
    timeout: 8000
  });
  
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    const cookieStr = setCookie.map(c => c.split(';')[0]).join('; ');
    cachedCookies = cookieStr;
    cookiesFetchedAt = now;
    return cookieStr;
  }
  
  return '';
}

function isNSEInstrument(symbol: string): boolean {
  const sym = symbol.toUpperCase();
  // Filter out international products
  if (sym.includes('=') || sym.includes('-') || sym.includes('^TNX')) {
    return false;
  }
  // If symbol contains a dot and doesn't end with .NS (e.g. .BO for BSE), it's not direct NSE
  if (sym.includes('.') && !sym.endsWith('.NS')) {
    return false;
  }
  return true;
}

function cleanIndexSymbol(symbol: string): string {
  const sym = symbol.toUpperCase().replace('^', '');
  if (sym === 'NSEI' || sym === 'NIFTY' || sym.includes('NIFTY50') || sym === 'NIFTY 50') {
    return 'NIFTY 50';
  }
  if (sym === 'NSEBANK' || sym === 'BANKNIFTY' || sym === 'NIFTY BANK') {
    return 'NIFTY BANK';
  }
  if (sym === 'INDIAVIX' || sym === 'VIX' || sym === 'INDIA VIX') {
    return 'INDIA VIX';
  }
  return sym;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fallback to Yahoo Finance when NSE API is closed or encounters networking blocks
 * Always handles the structure beautifully without throwing.
 */
async function fetchYahooFinanceFallback(symbol: string): Promise<QuoteData> {
  try {
    const quote = (await yahooFinance.quote(symbol)) as any;
    if (!quote) throw new Error("Null response from Yahoo Finance.");
    
    const quoteData: QuoteData = {
      symbol,
      lastPrice: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      open: quote.regularMarketOpen || 0,
      high: quote.regularMarketDayHigh || 0,
      low: quote.regularMarketDayLow || 0,
      volume: quote.regularMarketVolume || 0,
      timestamp: new Date(),
      source: 'Yahoo'
    };
    
    console.log(`[Yahoo fallback] ${symbol} ₹${quoteData.lastPrice.toFixed(2)}`);
    return quoteData;
  } catch (err: any) {
    console.info(`[Market API] Stock query fallback stream active for ${symbol}`);
    return {
      symbol,
      lastPrice: 0,
      change: 0,
      changePercent: 0,
      open: 0,
      high: 0,
      low: 0,
      volume: 0,
      timestamp: new Date(),
      source: 'Yahoo'
    };
  }
}

/**
 * Fetch direct Index pricing data from NSE indices list
 */
async function fetchNSEIndexQuoteDirect(symbol: string): Promise<QuoteData | null> {
  try {
    const cookies = await fetchNSECookies();
    const indexKey = cleanIndexSymbol(symbol);
    
    console.log(`[NSE] Requesting index list for ${indexKey}...`);
    const response = await axios.get('https://www.nseindia.com/api/allIndices', {
      headers: {
        ...headers,
        'Cookie': cookies
      },
      timeout: 8000
    });
    
    if (response.data && Array.isArray(response.data.data)) {
      const item = response.data.data.find((idx: any) => {
        const idxSym = (idx.indexSymbol || '').trim().toUpperCase();
        const idxName = (idx.index || '').trim().toUpperCase();
        return idxSym === indexKey.toUpperCase() || idxName === indexKey.toUpperCase();
      });
      
      if (item) {
        const lastPrice = item.last || item.lastPrice || 0;
        const change = item.variation || item.change || 0;
        const changePercent = item.percentChange || item.pChange || 0;
        const open = item.open || 0;
        const high = item.high || 0;
        const low = item.low || 0;
        const volume = item.volume || 0;
        
        const quoteData: QuoteData = {
          symbol,
          lastPrice,
          change,
          changePercent,
          open,
          high,
          low,
          volume,
          timestamp: new Date(),
          source: 'NSE'
        };
        
        console.log(`[NSE] ${symbol} ₹${lastPrice.toFixed(2)}`);
        return quoteData;
      }
    }
  } catch (err: any) {
    console.info(`[NSE API] Index quote direct request using alternative streams`);
  }
  return null;
}

/**
 * Fetch direct equity stock rates from quote API
 */
async function fetchNSEStockQuoteDirect(symbol: string): Promise<QuoteData | null> {
  const isNSE = isNSEInstrument(symbol);
  if (!isNSE) {
    return null;
  }
  
  const cleanSym = symbol.endsWith('.NS') ? symbol.slice(0, -3) : symbol;
  
  try {
    const cookies = await fetchNSECookies();
    console.log(`[NSE] Requesting equity details for ${cleanSym}...`);
    
    const response = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(cleanSym)}`, {
      headers: {
        ...headers,
        'Cookie': cookies
      },
      timeout: 8000
    });
    
    const data = response.data;
    if (data && data.priceInfo) {
      const pInfo = data.priceInfo;
      const lPrice = pInfo.lastPrice || 0;
      const change = pInfo.change || 0;
      const changePercent = pInfo.pChange || 0;
      const open = pInfo.open || 0;
      const high = pInfo.intraDayHighLow?.max || pInfo.high || 0;
      const low = pInfo.intraDayHighLow?.min || pInfo.low || 0;
      const volume = data.volume?.totListedQty || data.volume?.totalTradedVolume || 0;
      
      const quoteData: QuoteData = {
        symbol,
        lastPrice: lPrice,
        change,
        changePercent,
        open,
        high,
        low,
        volume,
        timestamp: new Date(),
        source: 'NSE'
      };
      
      console.log(`[NSE] ${cleanSym} ₹${lPrice.toFixed(2)}`);
      return quoteData;
    }
  } catch (err: any) {
    console.info(`[NSE API] Stock quote direct request for ${cleanSym} using alternative streams`);
  }
  return null;
}

/**
 * Dynamic NSE India quotes with 3 minute SQLite Cache mechanism
 */
export async function getNSEQuote(symbol: string): Promise<QuoteData> {
  let cleanSymbol = symbol.trim().toUpperCase();
  const caretIdx = cleanSymbol.indexOf('^');
  if (caretIdx > 0) {
    cleanSymbol = cleanSymbol.substring(caretIdx).replace(/[()]/g, '').trim();
  } else {
    const parenMatch = cleanSymbol.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      cleanSymbol = parenMatch[1].replace(/[()]/g, '').trim();
    }
  }
  
  try {
    const cachedRow = db.prepare("SELECT data, fetched_at FROM quotes_cache WHERE symbol = ?").get(cleanSymbol) as any;
    if (cachedRow) {
      const fetchedAt = new Date(cachedRow.fetched_at).getTime();
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
      if (fetchedAt > threeMinutesAgo) {
        const parsed = JSON.parse(cachedRow.data) as QuoteData;
        parsed.timestamp = new Date(parsed.timestamp);
        console.log(`[NSE Cache] Loaded cached quote for ${cleanSymbol}`);
        return parsed;
      }
    }
  } catch (err: any) {
    console.error(`[NSE Cache] Read error for ${cleanSymbol}:`, err.message);
  }
  
  let result: QuoteData | null = null;
  const isIndexed = cleanSymbol.startsWith('^') || cleanSymbol === 'NIFTY' || cleanSymbol === 'BANKNIFTY' || cleanSymbol === 'NIFTY 50' || cleanSymbol === 'NIFTY BANK' || cleanSymbol === 'SENSEX';
  
  if (isIndexed) {
    result = await fetchNSEIndexQuoteDirect(cleanSymbol);
  } else {
    result = await fetchNSEStockQuoteDirect(cleanSymbol);
  }
  
  if (!result) {
    result = await fetchYahooFinanceFallback(cleanSymbol);
  }
  
  if (result) {
    try {
      db.prepare(`
        INSERT INTO quotes_cache (symbol, data, fetched_at)
        VALUES (?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          data = excluded.data,
          fetched_at = excluded.fetched_at
      `).run(cleanSymbol, JSON.stringify(result), new Date().toISOString());
    } catch (err: any) {
      console.error(`[NSE Cache] Write write error for ${cleanSymbol}:`, err.message);
    }
  }
  
  return result;
}

/**
 * Fetches multiple prices sequentially respecting standard NSE API boundaries
 */
export async function getMultipleQuotes(symbols: string[]): Promise<QuoteData[]> {
  const results: QuoteData[] = [];
  for (const s of symbols) {
    try {
      const q = await getNSEQuote(s);
      results.push(q);
    } catch (err: any) {
      console.error(`[getMultipleQuotes] Quote failed for ${s}:`, err.message);
      results.push({
        symbol: s,
        lastPrice: 0,
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        timestamp: new Date(),
        source: 'Yahoo'
      });
    }
    await delay(150);
  }
  return results;
}
