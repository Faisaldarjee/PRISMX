import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as zlib from 'zlib';
import { db } from './database';

// Format date as YYYYMMDD for NSE URL
function formatNSEDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// Check if given date is a weekday (Mon-Fri)
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

// Get last N trading days (skip weekends)
function getLastTradingDays(n: number): Date[] {
  const dates: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    d.setDate(d.getDate() - 1);
    if (isWeekday(d)) dates.push(new Date(d));
  }
  return dates;
}

// Download and parse NSE bhavcopy CSV for a given date
export async function downloadBhavcopy(date: Date): Promise<any[]> {
  const dateStr = formatNSEDate(date);
  const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${dateStr}_F_0000.csv.zip`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.nseindia.com/'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode === 404) {
        // Holiday or weekend — no data
        resolve([]);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`NSE returned ${res.statusCode} for ${dateStr}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
            throw new Error('Not a valid ZIP file local header');
          }
          const filenameLength = buffer.readUInt16LE(26);
          const extraFieldLength = buffer.readUInt16LE(28);
          const compressedSize = buffer.readUInt32LE(18);
          const headerLength = 30 + filenameLength + extraFieldLength;
          
          if (buffer.length < headerLength + compressedSize) {
            throw new Error('Truncated ZIP file buffer');
          }
          const compressedData = buffer.subarray(headerLength, headerLength + compressedSize);
          const csvText = zlib.inflateRawSync(compressedData).toString('utf-8');
          
          const rows = parseBhavcopyCsv(csvText);
          resolve(rows);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('NSE bhavcopy download timed out'));
    });
  });
}

// Parse CSV text into array of price records with dynamic header mapping
function parseBhavcopyCsv(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const symbolIdx = headers.indexOf('TckrSymb');
  const seriesIdx = headers.indexOf('SctySrs');
  const dateIdx = headers.indexOf('TradDt');
  const openIdx = headers.indexOf('OpnPric');
  const highIdx = headers.indexOf('HghPric');
  const lowIdx = headers.indexOf('LwPric');
  const closeIdx = headers.indexOf('ClsPric');
  const volumeIdx = headers.indexOf('TtlTradgVol');
  
  if (
    symbolIdx === -1 ||
    seriesIdx === -1 ||
    dateIdx === -1 ||
    openIdx === -1 ||
    highIdx === -1 ||
    lowIdx === -1 ||
    closeIdx === -1 ||
    volumeIdx === -1
  ) {
    console.error('[Bhavcopy] Required columns missing from CSV headers');
    return [];
  }
  
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < Math.max(symbolIdx, seriesIdx, dateIdx, openIdx, highIdx, lowIdx, closeIdx, volumeIdx) + 1) continue;
    
    const series = cols[seriesIdx]?.trim();
    if (series !== 'EQ') continue; // Only equity series
    
    const symbol = cols[symbolIdx]?.trim();
    const date = cols[dateIdx]?.trim();
    const open = parseFloat(cols[openIdx]);
    const high = parseFloat(cols[highIdx]);
    const low = parseFloat(cols[lowIdx]);
    const close = parseFloat(cols[closeIdx]);
    const volume = parseInt(cols[volumeIdx], 10);
    
    if (!symbol || !date || isNaN(open) || isNaN(close)) continue;
    
    rows.push({
      symbol: symbol + '.NS', // Add Yahoo-compatible suffix
      date: date,
      open,
      high,
      low,
      close,
      volume,
      is_synthetic: 0
    });
  }
  
  return rows;
}

// Insert parsed rows into SQLite prices table
export function insertBhavcopPrices(rows: any[]): number {
  if (rows.length === 0) return 0;
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO prices 
    (symbol, date, open, high, low, close, volume, interval, is_synthetic)
    VALUES (@symbol, @date, @open, @high, @low, @close, @volume, '1d', @is_synthetic)
  `);
  
  const insertMany = db.transaction((items: any[]) => {
    for (const row of items) {
      insert.run(row);
    }
  });
  
  insertMany(rows);
  return rows.length;
}

// Main ingestion function — downloads and stores one day's data
export async function ingestBhavcopDay(date: Date): Promise<{
  date: string;
  rows: number;
  status: 'success' | 'holiday' | 'error';
  error?: string;
}> {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    console.log(`[Bhavcopy] Fetching data for ${dateStr}...`);
    const rows = await downloadBhavcopy(date);
    
    if (rows.length === 0) {
      console.log(`[Bhavcopy] No data for ${dateStr} (holiday/weekend)`);
      return { date: dateStr, rows: 0, status: 'holiday' };
    }
    
    const count = insertBhavcopPrices(rows);
    console.log(`[Bhavcopy] Inserted ${count} rows for ${dateStr}`);
    return { date: dateStr, rows: count, status: 'success' };
    
  } catch (e: any) {
    console.error(`[Bhavcopy] Error for ${dateStr}:`, e.message);
    return { date: dateStr, rows: 0, status: 'error', error: e.message };
  }
}

// Backfill last N trading days
export async function backfillBhavcopy(days: number = 30): Promise<void> {
  console.log(`[Bhavcopy] Starting backfill for last ${days} trading days...`);
  const tradingDays = getLastTradingDays(days);
  
  let success = 0, holidays = 0, errors = 0;
  
  for (const day of tradingDays) {
    const result = await ingestBhavcopDay(day);
    if (result.status === 'success') success++;
    else if (result.status === 'holiday') holidays++;
    else errors++;
    
    // Small delay to avoid NSE rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`[Bhavcopy] Backfill complete: ${success} days ingested, ${holidays} holidays, ${errors} errors`);
}

// Check if today's data already exists
export function isTodayIngested(): boolean {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM prices 
     WHERE date = ? AND is_synthetic = 0 LIMIT 1`
  ).get(today) as any;
  return row?.count > 0;
}
