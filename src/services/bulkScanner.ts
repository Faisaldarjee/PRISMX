import { NIFTY_500_SYMBOLS } from '../data/nifty500';
import { TechnicalAgent } from './agents/technicalAgent';
import { getPricesHistory } from './serverApi';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize predictions.db
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'predictions.db');
const db = new Database(dbPath);

// Ensure predictions_cache table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS predictions_cache (
    rank INTEGER,
    symbol TEXT PRIMARY KEY,
    score REAL,
    lastPrice REAL,
    rsi REAL,
    adx REAL,
    bbSqueeze INTEGER,
    volumeRatio REAL,
    signal TEXT,
    stopLoss REAL,
    target1 REAL,
    target2 REAL,
    scannedAt TEXT
  );
`);

export interface SwingSetup {
  rank: number;
  symbol: string;
  score: number;
  lastPrice: number;
  rsi: number;
  adx: number;
  bbSqueeze: boolean;
  volumeRatio: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  scannedAt: Date;
}

// Global flag to prevent concurrent active scans from overloading the system
let isScanningActive = false;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scans all listed Nifty 500 securities to detect maximum setups with scoring priorities
 */
export async function scanNifty500ForSwingSetups(): Promise<SwingSetup[]> {
  if (isScanningActive) {
    console.log("[bulkScanner] A scans trigger is already in active execution. Skipping concurrent run.");
    return getCachedSwingSetups();
  }

  isScanningActive = true;
  console.log(`[bulkScanner] starting full Nifty 500 swing scan of ${NIFTY_500_SYMBOLS.length} securities...`);

  const results: {
    symbol: string;
    score: number;
    lastPrice: number;
    rsi: number;
    adx: number;
    bbSqueeze: boolean;
    volumeRatio: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    stopLoss: number;
    target1: number;
    target2: number;
  }[] = [];

  const batchSize = 50;
  const total = NIFTY_500_SYMBOLS.length;

  for (let i = 0; i < total; i += batchSize) {
    const currentBatchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);
    console.log(`[bulkScanner] Scanning batch ${currentBatchNum}/${totalBatches}...`);

    const batchSymbols = NIFTY_500_SYMBOLS.slice(i, i + batchSize);

    // Process securities in parallel within the current batch to be highly performant
    const batchPromises = batchSymbols.map(async (symbol) => {
      try {
        // Fetch 60 days OHLCV history (conforms to rule: candles_cache write-through)
        const prices = await getPricesHistory(symbol, 60);
        if (!prices || prices.length < 30) {
          return null;
        }

        const technicals = TechnicalAgent.analyze(prices);
        const rsi = technicals.rsi;
        const adx = technicals.adx || 0;
        const bbSqueeze = technicals.bbSqueeze?.isSqueezed || false;
        const volumeRatio = technicals.volumeRatio || 1.0;
        const lastCandle = prices[prices.length - 1];
        const lastPrice = lastCandle ? lastCandle.close : 0;

        if (lastPrice <= 0) {
          return null;
        }

        // Apply scoring guidelines
        let score = 0;
        if (adx > 25) score += 30;
        if (bbSqueeze) score += 25;
        if (volumeRatio > 1.5) score += 20;
        if (rsi >= 35 && rsi <= 65) score += 15;
        if (rsi < 30) score += 10; // Oversold bonus

        // Bound to maximum 100 points
        if (score > 100) {
          score = 100;
        }

        // Construct trade signal indicators
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        if (score >= 50) {
          signal = 'BUY';
        } else if (rsi > 70) {
          signal = 'SELL';
        }

        return {
          symbol,
          score,
          lastPrice,
          rsi,
          adx,
          bbSqueeze,
          volumeRatio,
          signal,
          stopLoss: technicals.stopLoss || Number((lastPrice * 0.95).toFixed(2)),
          target1: technicals.target1 || Number((lastPrice * 1.05).toFixed(2)),
          target2: technicals.target2 || Number((lastPrice * 1.10).toFixed(2))
        };
      } catch (err: any) {
        // Graceful error logging per stock to safeguard continuous scans
        // console.warn(`[bulkScanner] Failed scanning item ${symbol}: ${err.message}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const r of batchResults) {
      if (r !== null) {
        results.push(r);
      }
    }

    // Rate-limiting delay safety window between scans batches
    if (i + batchSize < total) {
      await delay(300);
    }
  }

  // Sort candidates by score descending to extract optimal setups
  results.sort((a, b) => b.score - a.score);

  // Take top 20 set rank index and create proper return list
  const top20: SwingSetup[] = results.slice(0, 20).map((r, index) => ({
    rank: index + 1,
    symbol: r.symbol,
    score: r.score,
    lastPrice: r.lastPrice,
    rsi: r.rsi,
    adx: r.adx,
    bbSqueeze: r.bbSqueeze,
    volumeRatio: r.volumeRatio,
    signal: r.signal,
    scannedAt: new Date()
  }));

  // Commit results to cache database
  try {
    const deleteCached = db.prepare("DELETE FROM predictions_cache");
    const insertCached = db.prepare(`
      INSERT INTO predictions_cache (rank, symbol, score, lastPrice, rsi, adx, bbSqueeze, volumeRatio, signal, stopLoss, target1, target2, scannedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Run transaction
    const transaction = db.transaction((setupsList) => {
      deleteCached.run();
      for (const s of setupsList) {
        const matchingResult = results.find(r => r.symbol === s.symbol);
        insertCached.run(
          s.rank,
          s.symbol,
          s.score,
          s.lastPrice,
          s.rsi,
          s.adx,
          s.bbSqueeze ? 1 : 0,
          s.volumeRatio,
          s.signal,
          matchingResult ? matchingResult.stopLoss : s.lastPrice * 0.95,
          matchingResult ? matchingResult.target1 : s.lastPrice * 1.05,
          matchingResult ? matchingResult.target2 : s.lastPrice * 1.10,
          s.scannedAt.toISOString()
        );
      }
    });

    transaction(top20);
    console.log(`[bulkScanner] Full scan of Nifty 500 completed successfully. Cached ${top20.length} elements.`);
  } catch (err: any) {
    console.error("[bulkScanner] Cache database write transaction failed:", err.message);
  }

  isScanningActive = false;
  return top20;
}

/**
 * Reads and returns results from the local predictions_cache database
 */
export function getCachedSwingSetups(): SwingSetup[] {
  try {
    const rows = db.prepare("SELECT * FROM predictions_cache ORDER BY rank ASC").all() as any[];
    return rows.map(r => ({
      rank: r.rank,
      symbol: r.symbol,
      score: r.score,
      setupScore: r.score, // Backward compatibility for FE views
      tickerName: r.symbol.replace('.NS', ''), // Compatibility for FE labels
      lastPrice: r.lastPrice,
      rsi: r.rsi,
      adx: r.adx,
      bbSqueeze: r.bbSqueeze === 1,
      isSqueezed: r.bbSqueeze === 1, // Compatibility variant
      volumeRatio: r.volumeRatio,
      signal: r.signal as 'BUY' | 'SELL' | 'HOLD',
      stopLoss: r.stopLoss,
      target1: r.target1,
      target2: r.target2,
      scannedAt: new Date(r.scannedAt)
    }));
  } catch (err: any) {
    console.error("[bulkScanner] Failed reading cached configurations:", err.message);
    return [];
  }
}

/**
 * Checks if the cached setups are valid (present and fresher than 4 hours TTL)
 */
export function isCacheValid(): boolean {
  try {
    const row = db.prepare("SELECT scannedAt FROM predictions_cache LIMIT 1").get() as any;
    if (!row) {
      return false;
    }
    const scannedAt = new Date(row.scannedAt).getTime();
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    return scannedAt > fourHoursAgo;
  } catch {
    return false;
  }
}
