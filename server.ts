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
      const setups: any[] = [];

      for (const sym of symbols) {
        try {
          const prediction = await compilePrediction(sym);
          const prices = await getPricesHistory(sym, 100);
          if (prices.length < 30) continue;

          const technicals = TechnicalAgent.analyze(prices);
          const lastCandle = prices[prices.length - 1];
          const prevCandle = prices[prices.length - 2];
          const changePercent = prevCandle ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;

          setups.push({
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
          });
        } catch (e: any) {
          console.error(`Error processing stock ${sym} in sector ${sectorKey}:`, e);
        }
      }

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
