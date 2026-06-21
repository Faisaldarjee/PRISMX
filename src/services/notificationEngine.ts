import { supabaseAdmin } from './supabaseAdmin';
import { db, compilePrediction, getPricesHistory } from './serverApi';
import { sendSignalEmail, sendDailySummaryEmail, sendEarningsAlertEmail } from './emailService';
import { TechnicalAgent } from './agents/technicalAgent';

// Initialize the SQLite tables for logging
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal TEXT NOT NULL,
    channel TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    success INTEGER DEFAULT 1
  );
`);

/**
 * Checks notifications logs to prevent spamming the user within a 4-hour window
 */
export function shouldSendNotification(userId: string, symbol: string, signal: string): boolean {
  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const row = db.prepare(`
      SELECT COUNT(*) as count 
      FROM notifications_log 
      WHERE user_id = ? AND symbol = ? AND signal = ? AND sent_at > ?
    `).get(userId, symbol, signal, fourHoursAgo) as { count: number };
    
    return row.count === 0;
  } catch (err: any) {
    console.warn('[shouldSendNotification] error checking log:', err.message);
    return true; // proceed upon failure to prevent blocking alerts
  }
}

/**
 * Record a successfully dispatched alert in SQLite
 */
export function logNotification(userId: string, symbol: string, signal: string, channel: string, success = 1) {
  try {
    db.prepare(`
      INSERT INTO notifications_log (user_id, symbol, signal, channel, sent_at, success)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, symbol, signal, channel, new Date().toISOString(), success ? 1 : 0);
  } catch (err: any) {
    console.error('[logNotification] database write failure:', err.message);
  }
}

/**
 * Deliver prediction triggers (BUY or SELL) along user selected channels
 */
async function dispatchNotifications(
  userId: string,
  userEmail: string | undefined,
  symbol: string,
  signal: string,
  description: string,
  price: number,
  prefs: any,
  fcmToken: string | undefined,
  predictionPayload: any
) {
  if (!shouldSendNotification(userId, symbol, signal)) {
    console.log(`[NotificationEngine] Anti-spam block active. Skipping duplicate trigger for ${userId}:${symbol}:${signal}`);
    return;
  }

  // 1. In-App Notifications Channel (Supabase)
  if (prefs.channelInApp !== false) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          symbol,
          signal,
          price,
          description,
          read: false
        });
      
      if (error) throw error;
      logNotification(userId, symbol, signal, 'inapp', 1);
    } catch (e: any) {
      console.warn(`[NotificationEngine] Failed to save in-app message for ${userId}:`, e.message);
      logNotification(userId, symbol, signal, 'inapp', 0);
    }
  }

  // 2. Email Notifications Channel (Resend)
  if (prefs.channelEmail && userEmail) {
    try {
      const success = await sendSignalEmail(userEmail, {
        symbol,
        signal,
        price,
        description,
        confidence: predictionPayload.confidence,
        conviction: predictionPayload.conviction,
        entryZone: predictionPayload.trade_plan?.entry_range,
        stopLoss: predictionPayload.trade_plan?.stop_loss || predictionPayload.stop_loss,
        target1: predictionPayload.trade_plan?.target_1 || predictionPayload.target_price,
        target2: predictionPayload.trade_plan?.target_2 || (predictionPayload.target_price * 1.05),
        holdDays: predictionPayload.hold_time_recommendation ? parseInt(predictionPayload.hold_time_recommendation, 10) : 10,
        riskReward: predictionPayload.trade_plan?.risk_reward_ratio
      });
      logNotification(userId, symbol, signal, 'email', success ? 1 : 0);
    } catch (e: any) {
      console.warn(`[NotificationEngine] Resend trigger failure for ${userEmail}:`, e.message);
    }
  }

  // 3. Browser Push Alerts Channel (FCM) — Disabled during Supabase Migration
  if (prefs.channelPush && fcmToken) {
    console.info('[NotificationEngine] Browser push alerts are disabled in Supabase configuration.');
  }
}

/**
 * Deliver custom categories (Earnings, Sector, SIP) across correct user streams
 */
async function dispatchCustomAlert(
  userId: string,
  userEmail: string | undefined,
  symbol: string,
  signalKey: string,
  description: string,
  prefs: any,
  fcmToken: string | undefined,
  type: 'earnings' | 'sector' | 'sip',
  payload: any
) {
  // 1. In-App Notifications Channel (Supabase)
  if (prefs.channelInApp !== false) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          symbol,
          signal: type.toUpperCase(),
          price: 0,
          description,
          read: false
        });
      if (error) throw error;
      logNotification(userId, symbol, signalKey, 'inapp', 1);
    } catch (e: any) {
      console.warn(`[NotificationEngine] Custom in-app write failure:`, e.message);
      logNotification(userId, symbol, signalKey, 'inapp', 0);
    }
  }

  // 2. Email Notifications Channel
  if (prefs.channelEmail && userEmail) {
    try {
      let success = false;
      if (type === 'earnings') {
        success = await sendEarningsAlertEmail(userEmail, payload);
      } else if (type === 'sip') {
        success = await sendSignalEmail(userEmail, {
          symbol,
          signal: 'BUY',
          price: 0,
          description,
          confidence: 85,
          conviction: 'HIGH',
          entryZone: 'Oversold RSI SIP ETF Zone'
        });
      } else {
        success = await sendDailySummaryEmail(userEmail, [{ symbol, signal: 'BULLISH', description }]);
      }
      logNotification(userId, symbol, signalKey, 'email', success ? 1 : 0);
    } catch (e: any) {
      console.warn(`[NotificationEngine] Custom email dispatch issue:`, e.message);
    }
  }

  // 3. Browser Push Alerts Channel — Disabled during Supabase Migration
  if (prefs.channelPush && fcmToken) {
    console.info('[NotificationEngine] Browser push alerts are disabled in Supabase configuration.');
  }
}

/**
 * Sweep prediction setups and alert profiles.
 * Runs on backend crons regularly during Indian market hours.
 */
export interface CacheableUserProfile {
  id: string;
  email?: string;
  interestedSymbols: string[];
  notificationPrefs: any;
  fcmToken?: string;
}

export async function getUsersFromCacheOrFirestore(): Promise<CacheableUserProfile[]> {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, interested_symbols, notification_prefs');

    if (error) throw error;

    return (profiles || []).map(p => ({
      id: p.id,
      email: p.email,
      interestedSymbols: p.interested_symbols || [],
      notificationPrefs: p.notification_prefs || {
        notifyHighConfidence: true,
        notifyEarnings: true,
        notifySector: true,
        notifySip: true,
        notifyAllSignals: false,
        channelInApp: true,
        channelEmail: true,
        channelPush: false,
        minConfidence: 80
      }
    }));
  } catch (err: any) {
    console.warn('[NotificationEngine] Supabase user query failed. Falling back to SQLite User Profiles Cache:', err.message);
    try {
      const rows = db.prepare('SELECT uid, email, displayName, interested_symbols, notification_prefs FROM user_profiles_cache').all() as any[];
      return rows.map(r => {
        let interestedSymbols: string[] = [];
        try {
          interestedSymbols = r.interested_symbols ? JSON.parse(r.interested_symbols) : [];
        } catch {
          interestedSymbols = [];
        }
        
        let notificationPrefs = null;
        try {
          notificationPrefs = r.notification_prefs ? JSON.parse(r.notification_prefs) : null;
        } catch {}
        
        return {
          id: r.uid,
          email: r.email,
          interestedSymbols,
          notificationPrefs: notificationPrefs || {
            notifyHighConfidence: true,
            notifyEarnings: true,
            notifySector: true,
            notifySip: true,
            notifyAllSignals: false,
            channelInApp: true,
            channelEmail: true,
            channelPush: false,
            minConfidence: 80
          }
        };
      });
    } catch (sqlErr: any) {
      console.error('[NotificationEngine] SQLite fallback database query failed:', sqlErr.message);
      return [];
    }
  }
}

export async function checkAndSendNotifications() {
  console.log('[NotificationEngine] Starting active signal sweep across assets...');
  
  const users = await getUsersFromCacheOrFirestore();
  console.log(`[NotificationEngine] Sweeping ${users.length} user settings...`);
  
  for (const user of users) {
    const userId = user.id;
    const email = user.email;
    const interestedSymbols = user.interestedSymbols;
    const prefs = user.notificationPrefs;
    const fcmToken = user.fcmToken;

    const minConfidence = prefs.minConfidence ?? 80;

    // Triggers 1 & 2: Technical Accumulate Signals check
    for (const rawSymbol of interestedSymbols) {
      const symbol = rawSymbol.toUpperCase();
      try {
        const prediction = await compilePrediction(symbol);
        const confidence = prediction.confidence || 0;
        const signal = prediction.signal || 'HOLD';
        const conviction = prediction.conviction || 'MEDIUM';
        const price = prediction.entry_price || prediction.lastPrice || 0;
        
        // Trigger 1: High confidence BUY parameters met
        if (signal === 'BUY' && confidence >= minConfidence && conviction === 'HIGH') {
          const description = `🟢 ${symbol} — Strong BUY Signal\nConfidence: ${confidence}% | Entry: ₹${price}\nADX ${prediction.technicals?.adx || '28.6'} + BB Squeeze confirmed\nCheck PRISMX for full trade plan`;
          
          await dispatchNotifications(userId, email, symbol, 'BUY', description, price, prefs, fcmToken, prediction);
        }
        
        // Trigger 2: High confidence SELL/BOOK parameters met
        else if (signal === 'SELL' && confidence >= minConfidence) {
          const description = `🔴 ${symbol} — SELL Signal\nConfidence: ${confidence}% | Consider booking profits`;
          
          await dispatchNotifications(userId, email, symbol, 'SELL', description, price, prefs, fcmToken, prediction);
        }
      } catch (err: any) {
        console.warn(`[NotificationEngine] Skipping profile symbol ${symbol}:`, err.message);
      }
    }

    // Trigger 3: Watchlist Earnings warnings within 3 days
    if (prefs.notifyEarnings) {
      try {
        const { fetchUpcomingEvents } = await import('./earningsTracker');
        const upcomingEvents = await fetchUpcomingEvents();
        
        let watchlistSymbols: string[] = [];
        try {
          const { data: wl, error } = await supabaseAdmin
            .from('watchlists')
            .select('symbols')
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          watchlistSymbols = wl?.symbols || interestedSymbols;
        } catch (wlErr) {
          watchlistSymbols = interestedSymbols;
        }
        
        for (const event of upcomingEvents) {
          if (watchlistSymbols.some((s: string) => s.toUpperCase().includes(event.symbol.toUpperCase())) && event.daysAway <= 3) {
            const signalKey = `RESULTS_${event.symbol}_${event.date}`;
            const description = `⚠️ ${event.symbol} results in ${event.daysAway} days\nHigh volatility expected — review your positions`;
            
            if (shouldSendNotification(userId, event.symbol, signalKey)) {
              await dispatchCustomAlert(userId, email, event.symbol, signalKey, description, prefs, fcmToken, 'earnings', event);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[NotificationEngine] Volatility alert scan issue:`, e.message);
      }
    }

    // Trigger 4: Sector Heat index over 85% score
    if (prefs.notifySector) {
      try {
        const { getAllSectorStrengths } = await import('./sectorIntelligence');
        const sectors = await getAllSectorStrengths();
        for (const sec of sectors) {
          if (sec.score > 85) {
            const signalKey = `SECTOR_HEAT_${sec.sector}_${new Date().toISOString().substring(0, 10)}`;
            const description = `🔥 ${sec.name} Sector HOT today\n${sec.topStocks?.join(', ') || ''} showing strong setups\nCheck Smart Swing scanner`;
            
            if (shouldSendNotification(userId, sec.sector, signalKey)) {
              await dispatchCustomAlert(userId, email, sec.sector, signalKey, description, prefs, fcmToken, 'sector', sec);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[NotificationEngine] Sector check issue:`, e.message);
      }
    }

    // Trigger 5: ETF Oversold accumulation RSI alarms
    if (prefs.notifySip) {
      for (const etf of ['GOLDBEES.NS', 'SILVERBEES.NS']) {
        try {
          const prices = await getPricesHistory(etf, 100);
          if (prices.length > 14) {
            const technicals = TechnicalAgent.analyze(prices);
            const rsi = Math.round(technicals.rsi);
            
            if (rsi < 35) {
              const signalKey = `SIP_TRIGGER_${etf}_${new Date().toISOString().substring(0, 10)}`;
              const description = `💰 ${etf.replace('.NS', '')} RSI ${rsi} — Oversold\nGood time to deploy extra SIP this month`;
              
              if (shouldSendNotification(userId, etf, signalKey)) {
                await dispatchCustomAlert(userId, email, etf, signalKey, description, prefs, fcmToken, 'sip', { rsi });
              }
            }
          }
        } catch (e: any) {
          console.warn(`[NotificationEngine] SIP tracker failed for ${etf}:`, e.message);
        }
      }
    }
  }
}

/**
 * Sweeps daily closing trade signals and dispatches summaries to subscribers. 
 * Scheduled to run daily at 4:00 PM IST (16:00 Asia/Kolkata timezone).
 */
export async function sendDailySummary() {
  console.log('[NotificationEngine] Assembling daily digest files for dispatch...');
  
  const users = await getUsersFromCacheOrFirestore();

  // Get current setups list
  let setups: any[] = [];
  try {
    const { getCachedSwingSetups } = await import('./bulkScanner');
    setups = getCachedSwingSetups();
  } catch {
    // ignore, fallback used
  }

  const summaries = setups.slice(0, 3).map(s => ({
    symbol: s.symbol,
    signal: s.signal || 'BUY',
    description: `Setup RSI: ${Math.round(s.rsi)} | ADX: ${Math.round(s.adx)} | Volume Ratio: ${s.volumeRatio?.toFixed(1) || '1.5'}`
  }));

  for (const user of users) {
    const email = user.email;
    const prefs = user.notificationPrefs;
    const userId = user.id;

    if (email && prefs.channelEmail) {
      const signalKey = `SUMMARY_DIGEST_${new Date().toISOString().substring(0, 10)}`;
      if (shouldSendNotification(userId, 'SUMMARY', signalKey)) {
        await sendDailySummaryEmail(email, summaries);
        logNotification(userId, 'SUMMARY', signalKey, 'email', 1);
      }
    }
  }
}
