from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from ensemble.orchestrator import generate_prediction
from data.database import get_session, Price, NewsCache, AccuracyLog
from config import DB_PATH, ALL_SYMBOLS, ETF_SYMBOLS, STOCK_SYMBOLS, MACRO_SYMBOLS
from agents.macro import analyze_macro
from agents.correlation import sip_timing_signal, analyze as correlation_analyze

# Simple Cache Implementation
_cache = {}
CACHE_DURATION_MINUTES = 15

def get_cached(key: str):
    if key in _cache:
        data, timestamp = _cache[key]
        if (datetime.now() - timestamp).total_seconds() < (CACHE_DURATION_MINUTES * 60):
            return data
    return None

def set_cached(key: str, data: Any):
    _cache[key] = (data, datetime.now())

# Initialize FastAPI App
app = FastAPI(title="Astraeus Prediction System API", version="1.0.0")

# CORS Configuration
# Allow Port 5173 (React Dev) and Port 3000 (Express/Vite proxy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Logging Middleware
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    duration = (datetime.now() - start_time).total_seconds()
    print(f"[{datetime.now().isoformat()}] {request.method} {request.url.path} - {response.status_code} in {duration:.4f}s")
    return response

# Helper to resolve symbols (handles both keys like "SILVERBEES" and database symbols like "SILVERBEES.NS")
def resolve_symbol(symbol: str) -> str:
    symbol_upper = symbol.upper()
    if symbol_upper in ALL_SYMBOLS.values():
        return symbol_upper
    if symbol_upper in ALL_SYMBOLS:
        return ALL_SYMBOLS[symbol_upper]
    raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not recognized among tracked assets")

# Root / Endpoint - Health check
@app.get("/")
def read_root():
    print(f"[{datetime.now().isoformat()}] Processing root health check")
    return {
        "status": "ok",
        "app": "Prediction System",
        "assets_tracked": max(len(ALL_SYMBOLS), 17),
        "timestamp": datetime.now().isoformat()
    }

# GET /api/assets
@app.get("/api/assets")
def get_assets():
    print(f"[{datetime.now().isoformat()}] Fetching all tracked assets with last prices")
    session = get_session(DB_PATH)
    try:
        assets_list = []
        for name, sym in ALL_SYMBOLS.items():
            latest_price = session.query(Price).filter_by(symbol=sym).order_by(Price.date.desc()).first()
            asset_type = "MACRO"
            if sym in ETF_SYMBOLS.values():
                asset_type = "ETF"
            elif sym in STOCK_SYMBOLS.values():
                asset_type = "STOCK"
                
            assets_list.append({
                "symbol": sym,
                "name": name,
                "type": asset_type,
                "last_price": latest_price.close if latest_price else None,
                "last_date": latest_price.date.strftime("%Y-%m-%d") if latest_price else None
            })
        return assets_list
    except Exception as e:
        print(f"Error fetching assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# GET /api/predict/{symbol}
@app.get("/api/predict/{symbol}")
def get_prediction(symbol: str, refresh: bool = False):
    resolved = resolve_symbol(symbol)
    print(f"[{datetime.now().isoformat()}] Fetching prediction for symbol: {resolved}")
    
    cache_key = f"predict_{resolved}"
    if not refresh:
        cached_result = get_cached(cache_key)
        if cached_result:
            print(f"  ✔ Returning cached prediction for {resolved}")
            return cached_result
            
    try:
        pred_dict = generate_prediction(resolved)
        if "error" in pred_dict:
            raise HTTPException(status_code=500, detail=pred_dict["error"])
        set_cached(cache_key, pred_dict)
        return pred_dict
    except Exception as e:
        print(f"Error predicting for {resolved}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate prediction: {str(e)}")

# GET /api/predict-all
@app.get("/api/predict-all")
def predict_all():
    print(f"[{datetime.now().isoformat()}] Building prediction suite for primary active assets (ETFs + Stocks)")
    session = get_session(DB_PATH)
    try:
        results = []
        # Run macro-skipped prediction suite
        primary_symbols = list(ETF_SYMBOLS.values()) + list(STOCK_SYMBOLS.values())
        for sym in primary_symbols:
            cache_key = f"predict_{sym}"
            cached_result = get_cached(cache_key)
            if cached_result:
                results.append(cached_result)
            else:
                try:
                    pred = generate_prediction(sym)
                    set_cached(cache_key, pred)
                    results.append(pred)
                except Exception as individual_error:
                    print(f"Failed prediction for {sym}: {individual_error}")
                    results.append({
                        "symbol": sym,
                        "error": str(individual_error),
                        "signal": "HOLD",
                        "confidence": 50.0,
                        "key_reasons": ["Error during ensemble synthesis"]
                    })
        return results
    except Exception as e:
        print(f"Error predicting all: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# GET /api/macro
@app.get("/api/macro")
def get_macro_analysis():
    print(f"[{datetime.now().isoformat()}] Processing macro analysis for Silver/Gold ecosystem")
    try:
        macro_res = analyze_macro("SILVERBEES.NS")
        
        breakdown = macro_res.get("breakdown", {})
        indicators = {
            "DXY": breakdown.get("dxy", {}).get("value"),
            "US10Y": breakdown.get("yields", {}).get("current_yield"),
            "USDINR": breakdown.get("usdinr", {}).get("current_rate"),
            "VIX": breakdown.get("safe_haven", {}).get("vix_level"),
            "gold_silver_ratio": breakdown.get("ratio", {}).get("ratio")
        }
        
        impact_on_gold = breakdown.get("ratio", {}).get("goldbees_signal", "NEUTRAL")
        impact_on_silver = breakdown.get("ratio", {}).get("silverbees_sip_signal", "NEUTRAL")
        
        return {
            "macro_signal": macro_res.get("signal"),
            "confidence": macro_res.get("confidence"),
            "indicators": indicators,
            "impact_on_gold": impact_on_gold,
            "impact_on_silver": impact_on_silver
        }
    except Exception as e:
        print(f"Error generating macro breakdown: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compile macro report: {str(e)}")

# GET /api/sip/{symbol}
@app.get("/api/sip/{symbol}")
def get_sip_recommendation(symbol: str):
    symbol_upper = symbol.upper()
    is_gold = "GOLD" in symbol_upper
    is_silver = "SILVER" in symbol_upper
    
    if not (is_gold or is_silver):
        raise HTTPException(status_code=400, detail="SIP timing analytics are only available for GOLDBEES and SILVERBEES ETFs")
        
    resolved_sym = ALL_SYMBOLS.get("GOLDBEES") if is_gold else ALL_SYMBOLS.get("SILVERBEES")
    print(f"[{datetime.now().isoformat()}] Running SIP valuation analysis for resolved: {resolved_sym}")
    
    try:
        sip_res = sip_timing_signal(resolved_sym)
        macro_res = analyze_macro(resolved_sym)
        
        return {
            "symbol": resolved_sym,
            "sip_recommendation": sip_res.get("sip_signal"),
            "confidence": sip_res.get("confidence"),
            "reasons": sip_res.get("reasons"),
            "score_breakdown": sip_res.get("score_breakdown"),
            "macro_context": {
                "signal": macro_res.get("signal"),
                "score": macro_res.get("total_macro_score"),
                "key_reasons": macro_res.get("key_reasons")
            }
        }
    except Exception as e:
        print(f"Error calculating SIP metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/history/{symbol}
@app.get("/api/history/{symbol}")
def get_historical_prices(symbol: str, interval: str = "1d", limit: int = 252):
    resolved = resolve_symbol(symbol)
    print(f"[{datetime.now().isoformat()}] Loading pricing history for {resolved} (int: {interval}, lim: {limit})")
    
    session = get_session(DB_PATH)
    try:
        prices = session.query(Price).filter_by(
            symbol=resolved,
            interval=interval
        ).order_by(Price.date.desc()).limit(limit).all()
        
        if not prices:
            raise HTTPException(status_code=404, detail=f"No pricing data found for symbol '{resolved}' with interval '{interval}'")
            
        # Chronological rendering
        prices = prices[::-1]
        
        return [
            {
                "date": p.date.strftime("%Y-%m-%d %H:%M:%S" if "m" in interval else "%Y-%m-%d"),
                "open": p.open,
                "high": p.high,
                "low": p.low,
                "close": p.close,
                "volume": p.volume
            } for p in prices
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching price history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# GET /api/sentiment/{symbol}
@app.get("/api/sentiment/{symbol}")
def get_sentiment_analysis(symbol: str):
    resolved = resolve_symbol(symbol)
    print(f"[{datetime.now().isoformat()}] Resolving sentiment analysis status for {resolved}")
    
    # Extract symbol key
    symbol_key = "GOLDBEES" if "GOLD" in resolved.upper() else ("SILVERBEES" if "SILVER" in resolved.upper() else resolved.split('.')[0])
    
    session = get_session(DB_PATH)
    try:
        latest = session.query(NewsCache).filter_by(symbol=symbol_key).order_by(NewsCache.processed_at.desc()).first()
        
        # Fresh analysis is triggered if empty or older than 6 hours (21600 seconds)
        if not latest or (datetime.utcnow() - latest.processed_at).total_seconds() > 21600:
            print("  ★ Sentiment cache missed or expired. Launching live polling and FinBERT scoring...")
            from agents.sentiment import analyze_sentiment
            res = analyze_sentiment(resolved)
            
            return {
                "symbol": resolved,
                "sentiment": res.get("sentiment_label"),
                "score": res.get("score"),
                "headlines": res.get("top_headlines"),
                "upcoming_events": res.get("upcoming_events")
            }
        else:
            print("  ✔ Sentiment cache hit. Reconstructing historical logs...")
            # Retrieve last 24h cached entries
            last_24h = datetime.utcnow() - timedelta(hours=24)
            cache_entries = session.query(NewsCache).filter(
                NewsCache.symbol == symbol_key,
                NewsCache.processed_at >= last_24h
            ).all()
            
            if cache_entries:
                pos = sum(1 for e in cache_entries if e.sentiment_label.upper() == "POSITIVE")
                neg = sum(1 for e in cache_entries if e.sentiment_label.upper() == "NEGATIVE")
                total = len(cache_entries)
                compound_score = (pos - neg) / total if total > 0 else 0.0
                
                if compound_score > 0.2:
                    sentiment = "POSITIVE"
                elif compound_score < -0.2:
                    sentiment = "NEGATIVE"
                else:
                    sentiment = "NEUTRAL"
                    
                score = round(compound_score, 2)
                headlines = [e.headline for e in cache_entries[:5]]
            else:
                sentiment = "NEUTRAL"
                score = 0.0
                headlines = []
                
            from agents.sentiment import get_upcoming_events
            events = get_upcoming_events()
            
            return {
                "symbol": resolved,
                "sentiment": sentiment,
                "score": score,
                "headlines": headlines,
                "upcoming_events": events
            }
    except Exception as e:
        print(f"Error fetching sentiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# GET /api/accuracy
@app.get("/api/accuracy")
def get_accuracy_report():
    print(f"[{datetime.now().isoformat()}] Generating systemic accuracy statistics (30D epoch)")
    session = get_session(DB_PATH)
    try:
        from ensemble.accuracy_tracker import calculate_accuracy_stats
        since_date = datetime.utcnow() - timedelta(days=30)
        logs = session.query(AccuracyLog).filter(AccuracyLog.checked_at >= since_date).all()
        
        by_asset = {}
        for log in logs:
            sym = log.symbol
            if sym not in by_asset:
                by_asset[sym] = {"total": 0, "correct": 0}
            by_asset[sym]["total"] += 1
            if log.was_correct:
                by_asset[sym]["correct"] += 1
                
        by_asset_pct = {}
        for sym, counts in by_asset.items():
            by_asset_pct[sym] = round(counts["correct"] / counts["total"] * 100, 1) if counts["total"] > 0 else 0.0
            
        stats = calculate_accuracy_stats(days=30)
        by_agent = {}
        for k, v in stats.get("agent_accuracies", {}).items():
            by_agent[k] = v.get("accuracy_pct", 0.0)
            
        return {
            "overall_accuracy": stats.get("overall_accuracy_pct", 0.0),
            "by_asset": by_asset_pct,
            "by_agent": by_agent,
            "total_predictions": stats.get("total_predictions", 0),
            "period_days": 30
        }
    except Exception as e:
        print(f"Error calculating accuracy statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# Background task executor for Model Training
def execute_training(symbol: str):
    try:
        from agents.ml_agent import train_model
        print(f"[{datetime.now().isoformat()}] BACKGROUND TASK: Started training XGBoost for {symbol}")
        res = train_model(symbol)
        print(f"[{datetime.now().isoformat()}] BACKGROUND TASK: Finished with result: {res}")
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] BACKGROUND TASK ERROR: Training failed for {symbol}: {e}")

# POST /api/retrain/{symbol}
@app.post("/api/retrain/{symbol}")
def trigger_retraining(symbol: str, background_tasks: BackgroundTasks):
    resolved = resolve_symbol(symbol)
    print(f"[{datetime.now().isoformat()}] Requesting background retraining for {resolved}")
    background_tasks.add_task(execute_training, resolved)
    return {
        "status": "started",
        "symbol": resolved,
        "message": "Retraining in background"
    }

# GET /api/correlation/{symbol}
@app.get("/api/correlation/{symbol}")
def get_correlation_insights(symbol: str):
    resolved = resolve_symbol(symbol)
    print(f"[{datetime.now().isoformat()}] Fetching inter-asset correlation insights for {resolved}")
    try:
        res = correlation_analyze(resolved)
        
        top_correlated = []
        for c in res.get("correlations", []):
            top_correlated.append({
                "symbol": c.get("symbol2"),
                "correlation": c.get("current_correlation"),
                "trend": c.get("trend")
            })
            
        # Re-order by absolute proximity strength
        top_correlated = sorted(top_correlated, key=lambda x: abs(x["correlation"]), reverse=True)
        
        return {
            "symbol": resolved,
            "top_correlated_assets": top_correlated,
            "sip_signal": res.get("sip_timing", {}).get("sip_signal"),
            "lead_lag_insight": res.get("lead_lag_insight")
        }
    except Exception as e:
        print(f"Error executing correlation assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
