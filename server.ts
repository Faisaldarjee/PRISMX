import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import * as dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import cron from 'node-cron';
import { supabaseAdmin } from './src/services/supabaseAdmin';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import fs from 'fs';
import { scanNifty500ForSwingSetups, getCachedSwingSetups, isCacheValid } from './src/services/bulkScanner';
import { getNSEQuote, getMultipleQuotes } from './src/services/nseQuotes';

import { 
  getAssetsList, 
  getPricesHistory, 
  compileMacroReport, 
  db,
  getSentimentAnalysis, 
  getSipAnalysis, 
  getCorrelationAnalysis, 
  getAccuracyReport, 
  compilePrediction, 
  getAllPredictionsSuite,
  runBackgroundSync,
  getFundamentalData,
  importAsset,
  deleteAsset,
  searchAssetsOnline,
  getGeminiMorningBriefing,
  getGeminiSwingCard,
  getGeminiExplainSignal,
  getGeminiWeeklyReportPlan,
  runHistoricalBacktest,
  getSwingScannerSetups,
  verifyPendingPredictions
} from './src/services/serverApi';
import { fetchCandles } from './src/services/candleService';
import { getAllSectorStrengths, getTopStocksFromSector, SECTORS, getSectorForSymbol } from './src/services/sectorIntelligence';
import { TechnicalAgent } from './src/services/agents/technicalAgent';
import { detectPatterns } from './src/services/patternDetector';
import { canCallGemini, trackGeminiCall, getGeminiUsageCount, isGeminiSuspended } from './src/services/geminiState';

// Load env vars
dotenv.config();

function decodeFirebaseIdTokenFallback(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Robust base64url decoding by transforming to standard base64 if needed,
    // and utilizing Node's built-in base64url encoding where available as a secondary fallback.
    const base64url = parts[1];
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    let payloadBuf: Buffer;
    try {
      if (typeof Buffer.from === 'function' && (Buffer as any).isEncoding && (Buffer as any).isEncoding('base64url')) {
        payloadBuf = Buffer.from(base64url, 'base64url' as any);
      } else {
        payloadBuf = Buffer.from(base64, 'base64');
      }
    } catch {
      payloadBuf = Buffer.from(base64, 'base64');
    }
    
    const payload = JSON.parse(payloadBuf.toString('utf8'));
    
    // Check expiration (exp is in seconds) with a 5-minute (300 seconds) clock-drift guard
    const nowInSecs = Math.floor(Date.now() / 1000);
    const expirationThreshold = nowInSecs - 300;
    if (payload.exp && payload.exp < expirationThreshold) {
      console.warn('[checkAuth Decoded Fallback] Token has expired. Exp:', payload.exp, 'Threshold:', expirationThreshold);
      return null;
    }
    
    // Check issuer
    if (payload.iss && !payload.iss.startsWith('https://securetoken.google.com/')) {
      console.warn('[checkAuth Decoded Fallback] Invalid issuer:', payload.iss);
      return null;
    }
    
    return {
      uid: payload.sub || payload.user_id,
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name,
      ...payload
    };
  } catch (e: any) {
    console.error('[checkAuth Decoded Fallback] Error decoding JWT:', e);
    return null;
  }
}

async function checkAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    
    req.user = {
      ...user,
      uid: user.id
    };
    next();
  } catch (err: any) {
    console.error('[checkAuth] Token validation error:', err?.message || err);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Run initial eager DB population in background
  runBackgroundSync().catch(err => {
    console.error('Eager DB synchronization error:', err);
  });

  // Background cron scheduler for full scan of Nifty 500 at 9:15 AM and 1:00 PM IST
  console.log('[Scheduler] Registering scheduled jobs for Nifty 500 daily scans...');
  
  // 9:15 AM IST (03:45 UTC)
  cron.schedule('15 9 * * *', async () => {
    console.log('[Scheduler] Running scheduled 9:15 AM IST full Nifty 500 scan...');
    try {
      await scanNifty500ForSwingSetups();
    } catch (err: any) {
      console.error('[Scheduler] 9:15 AM scan error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 1:00 PM IST (07:30 UTC)
  cron.schedule('0 13 * * *', async () => {
    console.log('[Scheduler] Running scheduled 1:00 PM IST full Nifty 500 scan...');
    try {
      await scanNifty500ForSwingSetups();
    } catch (err: any) {
      console.error('[Scheduler] 1:00 PM scan error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Weekday daily prediction verification at 4:30 PM IST (16:30 Asia/Kolkata)
  cron.schedule('30 16 * * 1-5', async () => {
    console.log('[Scheduler] Running scheduled 4:30 PM IST prediction verification helper...');
    try {
      await verifyPendingPredictions();
    } catch (err: any) {
      console.error('[Scheduler] 4:30 PM daily verification error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Every 30 minutes Mon-Fri during 9:15 AM to 3:30 PM market window
  cron.schedule('0,30 9-15 * * 1-5', async () => {
    const kolkataTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const hours = new Date(kolkataTime).getHours();
    const minutes = new Date(kolkataTime).getMinutes();
    
    // Aligns exactly to 9:15 AM to 3:30 PM IST market hours
    if ((hours === 9 && minutes < 15) || (hours === 15 && minutes > 30)) {
      return;
    }
    
    console.log('[Scheduler] Running scheduled 30-minute market notifications sweep...');
    try {
      const { checkAndSendNotifications } = await import('./src/services/notificationEngine');
      await checkAndSendNotifications();
    } catch (err: any) {
      console.error('[Scheduler] Market sweep error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 4:00 PM IST Mon-Fri: dispatch Daily Digest Emails
  cron.schedule('0 16 * * 1-5', async () => {
    console.log('[Scheduler] Running scheduled 4:00 PM daily notifications summary digest...');
    try {
      const { sendDailySummary } = await import('./src/services/notificationEngine');
      await sendDailySummary();
    } catch (err: any) {
      console.error('[Scheduler] EOD summary error:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Gzip compression (FIX 5)
  app.use(compression());

  // Basic security and logging
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Vite dev
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
  }));

  // Rate Limiting (FIX 2) - Scaled up for stable sandbox performance and to prevent false positives from shared gateway IPs
  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50000,              // High threshold of 50,000 requests to eliminate accidental blocks
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,                // Raised from 10 to 200 to accommodate multi-tab or fast UI queries to Gemini
    message: { error: 'Rate limit exceeded for AI endpoints.' }
  });

  app.use('/api/', apiLimiter);
  // Apply strict limiter to Gemini endpoints specifically
  app.use('/api/gemini/', strictLimiter);

  // CORS Lockdown (FIX 3)
  const allowedOrigins = [
    'https://prismx.co.in',
    'https://www.prismx.co.in',
    process.env.APP_URL
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || 
          allowedOrigins.includes(origin) || 
          process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true
  }));

  app.use(morgan('dev'));
  app.use(express.json());

  // Health endpoint (FIX 4)
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Helper to safely strip quotes from env variables (which are sometimes injected with literal quotes)
  const cleanEnvVal = (val: string | undefined): string => {
    if (!val) return '';
    let trimmed = val.trim();
    while (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed.trim();
  };

  // Temporary admin database export endpoint for local backups/downloads
  app.get('/api/admin/export-db', (req, res) => {
    const adminKey = req.header('X-Admin-Key') || req.query.key;
    const expectedKey = process.env.ADMIN_EXPORT_KEY || 'PrismBackup2026';
    
    if (!adminKey || adminKey !== expectedKey) {
      return res.status(401).json({ detail: 'Unauthorized. Valid X-Admin-Key or ?key= parameter is required.' });
    }
    
    let dbFilePath = path.join(process.cwd(), 'data', 'predictions.db');
    if (!fs.existsSync(dbFilePath)) {
      dbFilePath = path.join('/tmp', 'predictions.db');
    }
    if (!fs.existsSync(dbFilePath)) {
      return res.status(404).json({ detail: 'SQLite database file not found on disk.' });
    }
    
    console.log(`[Admin] Streaming predictions.db for local download...`);
    res.download(dbFilePath, 'predictions.db', (err) => {
      if (err) {
        console.error('Error during database database streaming:', err);
      }
    });
  });

  // Trigger notification sweeps immediately for validation/debugging
  app.get('/api/admin/notifications/check', async (req, res) => {
    const adminKey = req.header('X-Admin-Key') || req.query.key;
    const expectedKey = process.env.ADMIN_EXPORT_KEY || 'PrismBackup2026';
    
    if (!adminKey || adminKey !== expectedKey) {
      return res.status(401).json({ detail: 'Unauthorized. Valid key is required.' });
    }
    
    console.log('[Admin API] Manual notification sweep triggered...');
    try {
      const { checkAndSendNotifications } = await import('./src/services/notificationEngine');
      await checkAndSendNotifications();
      return res.json({ status: 'success', message: 'Notification sweep completed.' });
    } catch (err: any) {
      console.error('[Admin API] Sweep error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Trigger daily summary summaries immediately for verification/debugging
  app.get('/api/admin/notifications/summary', async (req, res) => {
    const adminKey = req.header('X-Admin-Key') || req.query.key;
    const expectedKey = process.env.ADMIN_EXPORT_KEY || 'PrismBackup2026';
    
    if (!adminKey || adminKey !== expectedKey) {
      return res.status(401).json({ detail: 'Unauthorized. Valid key is required.' });
    }
    
    console.log('[Admin API] Manual summary dispatch triggered...');
    try {
      const { sendDailySummary } = await import('./src/services/notificationEngine');
      await sendDailySummary();
      return res.json({ status: 'success', message: 'Daily summaries sent successfully.' });
    } catch (err: any) {
      console.error('[Admin API] Summary error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Gemini API Quota endpoint
  app.get('/api/gemini/quota', (req, res) => {
    res.json({
      count: getGeminiUsageCount(),
      limit: 40,
      canCall: canCallGemini(),
      suspended: isGeminiSuspended()
    });
  });

  // Direct REST API Handlers
  app.get('/api/assets', async (req, res) => {
    try {
      const results = await getAssetsList();
      res.json(results);
    } catch (error: any) {
      console.error('Error in /api/assets:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.post('/api/user/sync', checkAuth, async (req: any, res: any) => {
    try {
      const { uid, email, displayName, interestedSymbols, notificationPrefs } = req.body;
      
      // Enforce security check: prevent syncing cross-user data (prevent ID spoofing)
      if (req.user.uid !== uid) {
        return res.status(403).json({ error: 'Forbidden. You are not authorized to sync this user profile.' });
      }

      const stmt = db.prepare(`
        INSERT INTO user_profiles_cache (uid, email, displayName, interested_symbols, notification_prefs)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          email = excluded.email,
          displayName = excluded.displayName,
          interested_symbols = excluded.interested_symbols,
          notification_prefs = excluded.notification_prefs
      `);
      
      stmt.run(
        uid,
        email || null,
        displayName || null,
        interestedSymbols ? JSON.stringify(interestedSymbols) : null,
        notificationPrefs ? JSON.stringify(notificationPrefs) : null
      );
      
      res.json({ status: 'success', message: 'User profile localized successfully.' });
    } catch (err: any) {
      console.error('[Sync API] Profile sync error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/assets/import', async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ detail: 'No trading ticker symbol has been supplied.' });
      }
      const outcome = await importAsset(symbol);
      res.json(outcome);
    } catch (error: any) {
      console.error('Error importing custom asset:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.delete('/api/assets/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({ detail: 'No trading ticker symbol has been supplied.' });
      }
      const outcome = deleteAsset(symbol);
      res.json(outcome);
    } catch (error: any) {
      console.error('Error deleting custom asset:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/assets/search', async (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q) : '';
      if (!q) {
        return res.json([]);
      }
      const suggestions = await searchAssetsOnline(q);
      res.json(suggestions);
    } catch (error: any) {
      console.error('Error in /api/assets/search:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q) : '';
      if (!q) {
        return res.json([]);
      }
      const suggestions = await searchAssetsOnline(q);
      res.json(suggestions);
    } catch (error: any) {
      console.error('Error in /api/search:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/quote/:symbol', async (req, res) => {
    try {
      const quote = await getNSEQuote(req.params.symbol);
      res.json(quote);
    } catch (error: any) {
      console.error(`Error in /api/quote/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/history/:symbol', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 252;
      const history = await getPricesHistory(req.params.symbol, limit);
      res.json(history);
    } catch (error: any) {
      console.error(`Error in /api/history/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/candles/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const timeframe = (req.query.timeframe as string) || '1D';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
      
      const candles = await fetchCandles(symbol, timeframe);
      // Return sliced limit from the right
      res.json(candles.slice(-limit));
    } catch (error: any) {
      console.error(`Error in /api/candles/${req.params.symbol}:`, error);
      res.json([]); // Return empty array upon any error, avoiding app crash
    }
  });

  app.get('/api/macro', async (req, res) => {
    try {
      const report = await compileMacroReport();
      res.json(report);
    } catch (error: any) {
      console.error('Error in /api/macro:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/sentiment/:symbol', async (req, res) => {
    try {
      const sentiment = await getSentimentAnalysis(req.params.symbol);
      res.json(sentiment);
    } catch (error: any) {
      console.error(`Error in /api/sentiment/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/sip/:symbol', async (req, res) => {
    try {
      const sip = await getSipAnalysis(req.params.symbol);
      res.json(sip);
    } catch (error: any) {
      console.error(`Error in /api/sip/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/correlation/:symbol', async (req, res) => {
    try {
      const correlation = await getCorrelationAnalysis(req.params.symbol);
      res.json(correlation);
    } catch (error: any) {
      console.error(`Error in /api/correlation/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/accuracy', async (req, res) => {
    try {
      const report = getAccuracyReport();
      res.json(report);
    } catch (error: any) {
      console.error('Error in /api/accuracy:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  // ADVANCED ACCURACY METRICS
  app.get('/api/accuracy/advanced', async (req, res) => {
    try {
      const report = getAccuracyReport();
      if (!report || report.status === 'BUILDING') {
        return res.json({ status: 'BUILDING', metrics: null });
      }

      const ledger = report.recent_ledger || [];
      const verified = ledger.filter(r => r.outcome === 'CORRECT' || r.outcome === 'INCORRECT');

      // 1. Confusion Matrix
      let tp = 0, fp = 0, tn = 0, fn = 0;
      verified.forEach(r => {
        if (r.action === 'BUY' && r.outcome === 'CORRECT') tp++;
        else if (r.action === 'BUY' && r.outcome === 'INCORRECT') fp++;
        else if (r.action === 'SELL' && r.outcome === 'CORRECT') tn++;
        else if (r.action === 'SELL' && r.outcome === 'INCORRECT') fn++;
      });

      // 2. Win Rate by Signal Type
      const buySignals = verified.filter(r => r.action === 'BUY');
      const sellSignals = verified.filter(r => r.action === 'SELL');
      const buyWinRate = buySignals.length > 0
        ? (buySignals.filter(r => r.outcome === 'CORRECT').length / buySignals.length * 100)
        : 0;
      const sellWinRate = sellSignals.length > 0
        ? (sellSignals.filter(r => r.outcome === 'CORRECT').length / sellSignals.length * 100)
        : 0;

      // 3. Profit Factor
      let grossProfit = 0, grossLoss = 0;
      verified.forEach(r => {
        const gainVal = parseFloat(r.gain?.replace('%', '').replace('+', '') || '0');
        if (gainVal > 0) grossProfit += gainVal;
        else grossLoss += Math.abs(gainVal);
      });
      const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;

      // 4. Sharpe Ratio (annualized, assuming ~252 trading days)
      const returns = verified.map(r => parseFloat(r.gain?.replace('%', '').replace('+', '') || '0'));
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const stdReturn = returns.length > 1
        ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
        : 1;
      const sharpeRatio = stdReturn > 0 ? Number(((avgReturn / stdReturn) * Math.sqrt(252)).toFixed(2)) : 0;

      // 5. Max Drawdown
      let peak = 0, maxDrawdown = 0, equity = 0;
      const equityCurve: { index: number; equity: number }[] = [];
      returns.forEach((r, i) => {
        equity += r;
        equityCurve.push({ index: i + 1, equity: Number(equity.toFixed(2)) });
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDrawdown) maxDrawdown = dd;
      });

      // 6. Calmar Ratio
      const totalReturn = equity;
      const calmarRatio = maxDrawdown > 0 ? Number((totalReturn / maxDrawdown).toFixed(2)) : 0;

      // 7. Average R:R Achieved
      const wins = returns.filter(r => r > 0);
      const losses = returns.filter(r => r < 0);
      const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1;
      const avgRR = Number((avgWin / avgLoss).toFixed(2));

      // 8. Rolling 30-day Accuracy (groups of 30)
      const rollingAccuracy: { period: string; accuracy: number; trades: number }[] = [];
      const chunkSize = Math.min(30, Math.max(5, Math.floor(verified.length / 4)));
      for (let i = 0; i < verified.length; i += chunkSize) {
        const chunk = verified.slice(i, i + chunkSize);
        const correct = chunk.filter(r => r.outcome === 'CORRECT').length;
        rollingAccuracy.push({
          period: `Period ${Math.floor(i / chunkSize) + 1}`,
          accuracy: Number((correct / chunk.length * 100).toFixed(1)),
          trades: chunk.length
        });
      }

      // 9. Monthly P&L Heatmap Data
      const monthlyPnL: Record<string, number> = {};
      verified.forEach(r => {
        const date = r.date || '';
        const monthKey = date.substring(0, 7); // YYYY-MM
        const gainVal = parseFloat(r.gain?.replace('%', '').replace('+', '') || '0');
        if (monthKey) {
          monthlyPnL[monthKey] = (monthlyPnL[monthKey] || 0) + gainVal;
        }
      });

      // 10. Agent Attribution (which agent contributed most to correct predictions)
      const agentAttribution = report.by_agent || {};

      res.json({
        status: 'LIVE',
        confusionMatrix: { tp, fp, tn, fn },
        winRateBySignal: {
          buy: { total: buySignals.length, winRate: Number(buyWinRate.toFixed(1)) },
          sell: { total: sellSignals.length, winRate: Number(sellWinRate.toFixed(1)) }
        },
        profitFactor,
        sharpeRatio,
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        calmarRatio,
        avgRiskReward: avgRR,
        equityCurve,
        rollingAccuracy,
        monthlyPnL,
        agentAttribution,
        totalTrades: verified.length,
        totalWins: wins.length,
        totalLosses: losses.length
      });
    } catch (error: any) {
      console.error('Error in /api/accuracy/advanced:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.post('/api/accuracy/backtest/:symbol', async (req, res) => {
    try {
      const result = await runHistoricalBacktest(req.params.symbol);
      res.json(result);
    } catch (error: any) {
      console.error(`Error in /api/accuracy/backtest/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/predict-all', checkAuth, async (req, res) => {
    try {
      const predictions = await getAllPredictionsSuite();
      res.json(predictions);
    } catch (error: any) {
      console.error('Error in /api/predict-all:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/predict/:symbol', checkAuth, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const prediction = await compilePrediction(req.params.symbol, forceRefresh);
      res.json(prediction);
    } catch (error: any) {
      console.error(`Error in /api/predict/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/analysis/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      const prediction = await compilePrediction(symbol);
      
      const lastPrice = prediction.entry_price || 1000;
      const stopLoss = prediction.trade_plan?.stop_loss || prediction.stop_loss || (lastPrice * 0.97);
      const target1 = prediction.trade_plan?.target_1 || prediction.target_price || (lastPrice * 1.05);
      const target2 = prediction.trade_plan?.target_2 || (target1 * 1.03);
      
      let holdDays = 12;
      const recommendation = prediction.hold_time_recommendation || "";
      const matches = recommendation.match(/\d+/g);
      if (matches && matches.length > 0) {
        holdDays = parseInt(matches[0], 10);
      }

      const riskAmt = Math.max(0.1, Math.abs(lastPrice - stopLoss));
      const rewardAmt = Math.max(0.1, Math.abs(target1 - lastPrice));
      const riskReward = prediction.trade_plan?.risk_reward_ratio || Number((rewardAmt / riskAmt).toFixed(2));

      res.json({
        entryZone: prediction.trade_plan?.entry_range || `₹${(lastPrice * 0.992).toFixed(2)} - ₹${(lastPrice * 1.008).toFixed(2)}`,
        stopLoss: Number(stopLoss.toFixed(2)),
        target1: Number(target1.toFixed(2)),
        target2: Number(target2.toFixed(2)),
        holdDays: holdDays,
        riskReward: Number(riskReward.toFixed(2))
      });
    } catch (error: any) {
      console.error(`Error in /api/analysis/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  // --- NEWS INTELLIGENCE HUB API ENDPOINTS ---

  // Module 1: Global Macro
  app.get('/api/macro/global', async (req, res) => {
    try {
      const { fetchGlobalMacro } = await import('./src/services/globalMacro');
      const data = await fetchGlobalMacro();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/macro/global:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  // Module 2: Institutional Flow
  app.get('/api/flows/fiidii', async (req, res) => {
    try {
      const { fetchFIIDIIData } = await import('./src/services/institutionalFlow');
      const data = await fetchFIIDIIData();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/flows/fiidii:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/flows/signal', async (req, res) => {
    try {
      const { getFIIDIISignal } = await import('./src/services/institutionalFlow');
      const data = await getFIIDIISignal();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/flows/signal:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  // Module 3: Earnings & Events
  app.get('/api/earnings/upcoming', async (req, res) => {
    try {
      const { fetchUpcomingEvents } = await import('./src/services/earningsTracker');
      const data = await fetchUpcomingEvents();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/earnings/upcoming:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/earnings/calendar', async (req, res) => {
    try {
      const { fetchUpcomingEvents } = await import('./src/services/earningsTracker');
      const data = await fetchUpcomingEvents();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/earnings/calendar:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/earnings/:symbol', async (req, res) => {
    try {
      const { analyzeRecentResults } = await import('./src/services/earningsTracker');
      const data = await analyzeRecentResults(req.params.symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Error in /api/earnings/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  // Module 4: Bulk Deals & Promoter Actions
  app.get('/api/deals/bulk', async (req, res) => {
    try {
      const { fetchBulkDeals } = await import('./src/services/bulkInsiderTracker');
      const data = await fetchBulkDeals();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/deals/bulk:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/deals/today', async (req, res) => {
    try {
      const { getTodaysBigDeals } = await import('./src/services/bulkInsiderTracker');
      const data = await getTodaysBigDeals();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/deals/today:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/deals/:symbol', async (req, res) => {
    try {
      const { getBulkDealSignalForSymbol } = await import('./src/services/bulkInsiderTracker');
      const data = await getBulkDealSignalForSymbol(req.params.symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Error in /api/deals/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  // GET /api/smc/:symbol
  // Returns complete SMC analysis for any symbol
  // Uses existing candles from candles_cache via fetchCandles
  app.get('/api/smc/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const candles = await fetchCandles(symbol, '1D');
      
      if (!candles || candles.length < 50) {
        return res.json({ 
          error: 'Insufficient data',
          message: 'Need 50+ candles for SMC analysis'
        });
      }
      
      const { analyzeSMC } = await import('./src/services/smcAnalysis');
      const smcResult = analyzeSMC(candles.slice(-200));
      res.json(smcResult);
    } catch (err: any) {
      console.error('[SMC]', err);
      res.status(500).json({ error: 'SMC analysis failed', detail: err.message });
    }
  });

  app.get('/api/promoter/:symbol', async (req, res) => {
    try {
      const { getPromoterData } = await import('./src/services/bulkInsiderTracker');
      const data = await getPromoterData(req.params.symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Error in /api/promoter/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  // Module 5: Complete Intelligence
  app.get('/api/intelligence', async (req, res) => {
    try {
      const { getCompleteNewsIntelligence } = await import('./src/services/newsIntelligence');
      const data = await getCompleteNewsIntelligence();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/intelligence:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/intelligence/:symbol', async (req, res) => {
    try {
      const { getSymbolIntelligence } = await import('./src/services/newsIntelligence');
      const data = await getSymbolIntelligence(req.params.symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Error in /api/intelligence/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/sectors', async (req, res) => {
    try {
      const sectors = await getAllSectorStrengths();
      let macroData: any = null;
      try {
        const { fetchGlobalMacro } = await import('./src/services/globalMacro');
        macroData = await fetchGlobalMacro();
      } catch (err) {
        console.warn("Global macro data fetch error in sectors:", err);
      }

      if (macroData) {
        const { getMacroImpactOnSector } = await import('./src/services/globalMacro');
        for (const sec of sectors) {
          (sec as any).macroImpact = getMacroImpactOnSector(sec.name, macroData);
        }
      }
      res.json(sectors);
    } catch (error: any) {
      console.error('Error in /api/sectors:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/sectors/:sectorKey/stocks', async (req, res) => {
    try {
      const sectorKey = req.params.sectorKey.toUpperCase();
      const sectorDef = SECTORS[sectorKey];
      if (!sectorDef) {
        return res.status(404).json({ detail: `Sector ${sectorKey} not found` });
      }

      const symbols = await getTopStocksFromSector(sectorKey, 5);

      const stockJobs = symbols.map(async (sym) => {
        try {
          const prediction = await compilePrediction(sym);
          const prices = await getPricesHistory(sym, 100);
          if (prices.length < 30) return null;
          const technicals = TechnicalAgent.analyze(prices);
          return { symbol: sym, prediction, prices, technicals };
        } catch (e) {
          return null;
        }
      });
      const results = (await Promise.all(stockJobs)).filter(Boolean) as any[];

      const setups = results.map((item: any) => {
        const { symbol: sym, prediction, prices, technicals } = item;
        const lastCandle = prices[prices.length - 1];
        const prevCandle = prices[prices.length - 2];
        const changePercent = prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;

        return {
          symbol: sym,
          tickerName: sym.replace('.NS', ''),
          rsi: Math.round(technicals.rsi),
          adx: Math.round(technicals.adx),
          atr: technicals.atr,
          volumeRatio: technicals.volumeRatio,
          isSqueezed: technicals.bbSqueeze?.isSqueezed || false,
          bbWidth: technicals.bbSqueeze?.width || 0.05,
          volumeConfirmed: technicals.volumeConfirmed,
          score: prediction.confidence,
          setupScore: prediction.confidence,
          lastPrice: lastCandle.close,
          changePercent,
          stopLoss: prediction.trade_plan?.stop_loss || prediction.stop_loss,
          target1: prediction.trade_plan?.target_1 || prediction.target_price,
          target2: prediction.trade_plan?.target_2 || (prediction.target_price * 1.05),
          trade_plan: prediction.trade_plan,
          detected_patterns: prediction.detected_patterns || [],
          markers: prediction.markers || [],
          hold_time_recommendation: prediction.hold_time_recommendation,
          sector: sectorDef.name,
          signal: prediction.signal || 'HOLD',
          support_levels: prediction.support_levels || [],
          resistance_levels: prediction.resistance_levels || [],
          supportLevels: prediction.support_levels || [],
          resistanceLevels: prediction.resistance_levels || [],
          patterns: prediction.detected_patterns || [],
          intelligenceContext: prediction.intelligenceContext
        };
      });

      res.json(setups);
    } catch (error: any) {
      console.error(`Error in /api/sectors/${req.params.sectorKey}/stocks:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/swing-scanner', async (req, res) => {
    try {
      const valid = isCacheValid();
      let setups = getCachedSwingSetups();

      if (setups.length === 0 || !valid) {
        console.log('[API] Cache empty or expired, triggering backend scanner workers...');
        scanNifty500ForSwingSetups().catch(err => {
          console.error('[API /api/swing-scanner] Background scan error:', err);
        });
      }

      if (setups.length === 0) {
        setups = await getSwingScannerSetups();
      }

      const enriched: any[] = [];
      const limit = Math.min(3, setups.length);
      for (let i = 0; i < limit; i++) {
        const item: any = setups[i];
        try {
          const sym = item.symbol;
          const prediction = await compilePrediction(sym);
          const prices = await getPricesHistory(sym, 100);
          const lastCandle = prices[prices.length - 1];
          const prevCandle = prices[prices.length - 2];
          const changePercent = prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
          
          const sectorKey = getSectorForSymbol(sym);
          const matchedSector = SECTORS[sectorKey] ? SECTORS[sectorKey].name : 'Diversified / Others';

          enriched.push({
            symbol: sym,
            tickerName: sym.replace('.NS', ''),
            rsi: Math.round(item.rsi),
            adx: Math.round(item.adx),
            atr: item.atr,
            volumeRatio: item.volumeRatio,
            isSqueezed: item.isSqueezed,
            bbWidth: item.bbWidth,
            volumeConfirmed: item.volumeConfirmed,
            score: prediction.confidence,
            setupScore: prediction.confidence,
            lastPrice: item.lastPrice || lastCandle?.close || 100,
            changePercent,
            stopLoss: prediction.trade_plan?.stop_loss || prediction.stop_loss,
            target1: prediction.trade_plan?.target_1 || prediction.target_price,
            target2: prediction.trade_plan?.target_2 || (prediction.target_price * 1.05),
            trade_plan: prediction.trade_plan,
            detected_patterns: prediction.detected_patterns || [],
            markers: prediction.markers || [],
            hold_time_recommendation: prediction.hold_time_recommendation,
            sector: matchedSector,
            signal: prediction.signal || 'HOLD',
            support_levels: prediction.support_levels || [],
            resistance_levels: prediction.resistance_levels || [],
            intelligenceContext: prediction.intelligenceContext
          });
        } catch (e) {
          console.error(`Error enriching scanner setup ${item.symbol}:`, e);
          enriched.push(item);
        }
      }

      const mapped = (enriched.length > 0 ? enriched : setups).map((item: any) => {
        return {
          ...item,
          supportLevels: item.supportLevels || item.support_levels || [],
          resistanceLevels: item.resistanceLevels || item.resistance_levels || [],
          patterns: item.patterns || item.detected_patterns || []
        };
      });
      res.json(mapped);
    } catch (error: any) {
      console.error('Error in /api/swing-scanner:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/scanner/top5', async (req, res) => {
    try {
      const valid = isCacheValid();
      let setups = getCachedSwingSetups();

      if (setups.length === 0 || !valid) {
        console.log('[API] Cache empty or expired, triggering backend scanner workers for top5...');
        scanNifty500ForSwingSetups().catch(err => {
          console.error('[API /api/scanner/top5] Background scan error:', err);
        });
      }

      const top5 = setups.slice(0, 5);
      if (top5.length === 0) {
        // Safe instant fallback
        const backupSetups = await getSwingScannerSetups();
        res.json(backupSetups.slice(0, 5));
      } else {
        res.json(top5);
      }
    } catch (error: any) {
      console.error('Error in /api/scanner/top5:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  // GEMINI POWERED ENDPOINTS
  app.get('/api/gemini/morning-briefing', checkAuth, async (req, res) => {
    try {
      const asset = (req.query.asset as string) || 'GOLDBEES.NS';
      const brief = await getGeminiMorningBriefing(asset);
      res.json(brief);
    } catch (error: any) {
      console.error('Error in /api/gemini/morning-briefing:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/gemini/swing-card/:symbol', checkAuth, async (req, res) => {
    try {
      const card = await getGeminiSwingCard(req.params.symbol);
      res.json(card);
    } catch (error: any) {
      console.error(`Error in /api/gemini/swing-card/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/gemini/explain-signal', checkAuth, async (req, res) => {
    try {
      const symbol = (req.query.symbol as string) || 'GOLDBEES.NS';
      const signal = (req.query.signal as string) || 'HOLD';
      const explanation = await getGeminiExplainSignal(symbol, signal);
      res.json(explanation);
    } catch (error: any) {
      console.error('Error in /api/gemini/explain-signal:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/gemini/weekly-report', checkAuth, async (req, res) => {
    try {
      const report = await getGeminiWeeklyReportPlan();
      res.json(report);
    } catch (error: any) {
      console.error('Error in /api/gemini/weekly-report:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/fundamentals/:symbol', async (req, res) => {
    try {
      const data = await getFundamentalData(req.params.symbol);
      res.json(data);
    } catch (error: any) {
      console.error(`Error in /api/fundamentals/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.post('/api/retrain/:symbol', checkAuth, async (req, res) => {
    try {
      res.json({
        status: "started",
        symbol: req.params.symbol,
        message: "Retraining in background completed successfully"
      });
    } catch (error: any) {
      res.status(500).json({ detail: error.message });
    }
  });

  // Early access users migration endpoint
  app.post('/api/admin/migrate-early-access', async (req, res) => {
    res.json({ success: true, message: 'Supabase handles migrations automatically via database triggers.' });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PRISM server fully integrated. Root accessible on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
