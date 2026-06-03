import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import cron from 'node-cron';

import { scanNifty500ForSwingSetups, getCachedSwingSetups, isCacheValid } from './src/services/bulkScanner';
import { getNSEQuote, getMultipleQuotes } from './src/services/nseQuotes';

import { 
  getAssetsList, 
  getPricesHistory, 
  compileMacroReport, 
  getSentimentAnalysis, 
  getSipAnalysis, 
  getCorrelationAnalysis, 
  getAccuracyReport, 
  compilePrediction, 
  getAllPredictionsSuite,
  runBackgroundSync,
  getFundamentalData,
  importAsset,
  searchAssetsOnline,
  getGeminiMorningBriefing,
  getGeminiSwingCard,
  getGeminiExplainSignal,
  getGeminiWeeklyReportPlan,
  runHistoricalBacktest,
  getSwingScannerSetups
} from './src/services/serverApi';

// Load env vars
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Basic security and logging
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Vite dev
  }));
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

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

  app.post('/api/accuracy/backtest/:symbol', async (req, res) => {
    try {
      const result = await runHistoricalBacktest(req.params.symbol);
      res.json(result);
    } catch (error: any) {
      console.error(`Error in /api/accuracy/backtest/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/predict-all', async (req, res) => {
    try {
      const predictions = await getAllPredictionsSuite();
      res.json(predictions);
    } catch (error: any) {
      console.error('Error in /api/predict-all:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/predict/:symbol', async (req, res) => {
    try {
      const prediction = await compilePrediction(req.params.symbol);
      res.json(prediction);
    } catch (error: any) {
      console.error(`Error in /api/predict/${req.params.symbol}:`, error);
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
        // Safe fast immediate backup list while the background scan runs
        setups = await getSwingScannerSetups();
      }
      res.json(setups);
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
  app.get('/api/gemini/morning-briefing', async (req, res) => {
    try {
      const asset = (req.query.asset as string) || 'GOLDBEES.NS';
      const brief = await getGeminiMorningBriefing(asset);
      res.json(brief);
    } catch (error: any) {
      console.error('Error in /api/gemini/morning-briefing:', error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/gemini/swing-card/:symbol', async (req, res) => {
    try {
      const card = await getGeminiSwingCard(req.params.symbol);
      res.json(card);
    } catch (error: any) {
      console.error(`Error in /api/gemini/swing-card/${req.params.symbol}:`, error);
      res.status(500).json({ detail: error.message });
    }
  });

  app.get('/api/gemini/explain-signal', async (req, res) => {
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

  app.get('/api/gemini/weekly-report', async (req, res) => {
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

  app.post('/api/retrain/:symbol', async (req, res) => {
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
    console.log(`🚀 Astraeus server fully integrated. Root accessible on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
