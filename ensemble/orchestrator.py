import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from agents.technical import analyze as technical_analyze
from agents.macro import analyze_macro
from agents.sentiment import analyze_sentiment
from agents.ml_agent import predict as ml_predict
from agents.correlation import sip_timing_signal
from data.database import Prediction, init_db, Base
from config import DB_PATH, ETF_SYMBOLS, STOCK_SYMBOLS, ETF_WEIGHTS, STOCK_WEIGHTS

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def run_agents_parallel(symbol: str) -> dict:
    """
    Executes all relevant agents in parallel for a given symbol.
    Uses ThreadPoolExecutor to handle I/O and CPU bound tasks across agents.
    """
    results = {
        "technical": None,
        "macro": None,
        "ml": None,
        "sentiment": None,
        "errors": []
    }
    
    is_etf = any(symbol == s for s in ETF_SYMBOLS.values())
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        # Submit tasks
        tasks = {
            "technical": executor.submit(technical_analyze, symbol),
            "ml": executor.submit(ml_predict, symbol),
            "sentiment": executor.submit(analyze_sentiment, symbol),
        }
        
        # Macro is only for ETFs
        if is_etf:
            tasks["macro"] = executor.submit(analyze_macro, symbol)
            
        # Collect results with timeout
        for name, future in tasks.items():
            try:
                # 60 second timeout per agent
                res = future.result(timeout=60)
                if res and "error" not in res:
                    results[name] = res
                elif res and "error" in res:
                    results["errors"].append(f"{name.upper()} Agent error: {res['error']}")
            except FutureTimeout:
                results["errors"].append(f"{name.upper()} Agent timed out")
            except Exception as e:
                results["errors"].append(f"{name.upper()} Agent failed: {str(e)}")
                
    return results

def calculate_weighted_signal(symbol: str, agent_results: dict) -> dict:
    """
    Combines individual agent signals into a single weighted score.
    Returns the unified signal, confidence, and conviction levels.
    """
    is_etf = any(symbol == s for s in ETF_SYMBOLS.values())
    weights = ETF_WEIGHTS if is_etf else STOCK_WEIGHTS
    
    # SIGNAL TO SCORE: BUY=+1, HOLD=0, SELL=-1
    mapping = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}
    
    weighted_score = 0.0
    agent_scores = {}
    valid_agents = []
    
    for agent_name, weight in weights.items():
        res = agent_results.get(agent_name)
        if res and "signal" in res:
            score = mapping.get(res["signal"], 0.0)
            weighted_score += score * weight
            agent_scores[agent_name] = score
            valid_agents.append(res["signal"])
        else:
            agent_scores[agent_name] = 0.0
            
    # Normalize weighted score based on available agents if some failed? 
    # The requirement doesn't specify normalization, but usually we should.
    # However, weights are fixed proportions of the total (1.0).
    
    # Signal determination
    if weighted_score > 0.1:
        final_signal = "BUY"
    elif weighted_score < -0.1:
        final_signal = "SELL"
    else:
        final_signal = "HOLD"
        
    # Confidence = |weighted_score| / max_possible_score * 100 + 50, capped at 95
    # Since weights sum to 1.0, max_possible_score is 1.0
    confidence = abs(weighted_score) * 100 + 50
    confidence = min(95.0, confidence)
    
    # Conviction: HIGH if confidence > 75 and all agents agree, MEDIUM if 55-75, LOW < 55
    all_agree = False
    if valid_agents:
        first = valid_agents[0]
        # Only check agreement if final signal is not HOLD
        if final_signal != "HOLD":
            all_agree = all(s == final_signal for s in valid_agents)
            
    if confidence > 75 and all_agree:
        conviction = "HIGH"
    elif confidence >= 55:
        conviction = "MEDIUM"
    else:
        conviction = "LOW"
        
    return {
        "signal": final_signal,
        "confidence": round(confidence, 1),
        "conviction": conviction,
        "weighted_score": round(weighted_score, 3),
        "agent_scores": agent_scores
    }

def recommend_timeframe(symbol: str, technical_result: dict) -> str:
    """
    Provides a trading timeframe recommendation based on volatility and trend strength.
    """
    if not technical_result or "indicators" not in technical_result:
        return "SWING — Default timeframe"
        
    indicators = technical_result["indicators"]
    atr = indicators.get("atr", 0)
    price = indicators.get("current_price", 1)
    
    # Volatility as % of price
    volatility_pct = (atr / price) * 100 if price > 0 else 0
    
    # EMA alignment from technical agent reasons
    reasons = technical_result.get("reasons", [])
    strong_trend = any("multi-EMA" in r for r in reasons)
    
    if volatility_pct > 2.0 and strong_trend:
        return "SWING — Elevated volatility with established trend supports multi-day moves"
    elif volatility_pct < 0.8 and not strong_trend:
        return "LONGTERM — Low volatility and sideways consolidation; wait for breakout"
    elif volatility_pct > 3.5:
        return "INTRADAY — Extreme volatility detected; high risk for overnight holds"
    else:
        return "SWING — Moderate volatility and trend structure"

def save_prediction(prediction_dict: dict) -> int:
    """
    Saves the final ensemble prediction to the SQLite database.
    """
    session = Session()
    try:
        new_pred = Prediction(
            symbol=prediction_dict["symbol"],
            signal=prediction_dict["signal"],
            confidence=prediction_dict["confidence"],
            technical_signal=prediction_dict["agent_breakdown"].get("technical", {}).get("signal"),
            macro_signal=prediction_dict["agent_breakdown"].get("macro", {}).get("signal"),
            ml_signal=prediction_dict["agent_breakdown"].get("ml", {}).get("signal"),
            sentiment_signal=prediction_dict["agent_breakdown"].get("sentiment", {}).get("signal"),
            reasons=json.dumps(prediction_dict["key_reasons"]),
            timeframe=prediction_dict["timeframe"]
        )
        session.add(new_pred)
        session.commit()
        return new_pred.id
    except Exception as e:
        print(f"Error saving prediction: {e}")
        return -1
    finally:
        session.close()

def generate_prediction(symbol: str) -> dict:
    """
    Orchestrates the entire prediction pipeline for a symbol.
    """
    print(f"\nOrchestrating ensemble for {symbol}...")
    
    # 1. Run all agents in parallel
    agent_results = run_agents_parallel(symbol)
    
    # 2. Calculate weighted signal
    ensemble_res = calculate_weighted_signal(symbol, agent_results)
    
    # 3. Timeframe Recommendation
    timeframe = recommend_timeframe(symbol, agent_results.get("technical"))
    
    # 4. SIP Signal (ETFs only)
    sip_rec = None
    if "BEE" in symbol.upper():
        sip_data = sip_timing_signal(symbol)
        if sip_data and "sip_signal" in sip_data:
            sip_rec = sip_data["sip_signal"]
            
    # 5. Collect Reasons (Top 5)
    all_reasons = []
    # Add reasons from technical
    if agent_results["technical"]:
        all_reasons.extend(agent_results["technical"].get("reasons", []))
    # Add reasons from macro
    if agent_results["macro"]:
        all_reasons.extend(agent_results["macro"].get("key_reasons", []))
    # Add reasons from ML (top features)
    if agent_results["ml"]:
        all_reasons.append(f"ML Predicts: {agent_results['ml']['direction']}")
        all_reasons.extend([f"Feature: {f}" for f in agent_results['ml'].get('top_features', [])[:2]])
    # Add reasons from sentiment
    if agent_results["sentiment"]:
        all_reasons.append(f"Sentiment: {agent_results['sentiment']['sentiment_label']}")
        
    top_reasons = all_reasons[:5]
    
    # 6. Assemble Dict
    prediction_data = {
        "symbol": symbol,
        "signal": ensemble_res["signal"],
        "confidence": ensemble_res["confidence"],
        "conviction": ensemble_res["conviction"],
        "weighted_score": ensemble_res["weighted_score"],
        "timeframe": timeframe,
        "agent_breakdown": {
            "technical": agent_results["technical"],
            "macro": agent_results["macro"],
            "ml": agent_results["ml"],
            "sentiment": agent_results["sentiment"]
        },
        "key_reasons": top_reasons,
        "risk_level": "LOW" if ensemble_res["confidence"] > 75 else ("MEDIUM" if ensemble_res["confidence"] >= 55 else "HIGH"),
        "sip_recommendation": sip_rec,
        "errors": agent_results["errors"],
        "timestamp": datetime.now().isoformat()
    }
    
    # 7. Save to DB
    pred_id = save_prediction(prediction_data)
    prediction_data["prediction_id"] = pred_id
    
    return prediction_data

def run_all_predictions() -> list:
    """
    Runs the ensemble for all primary symbols in the configuration.
    """
    all_symbols = list(ETF_SYMBOLS.values()) + list(STOCK_SYMBOLS.values())
    results = []
    
    for symbol in all_symbols:
        try:
            res = generate_prediction(symbol)
            results.append(res)
        except Exception as e:
            print(f"FAILED orchestration for {symbol}: {e}")
            
    return results

if __name__ == "__main__":
    # Test on core ETFs
    for s in ["GOLDBEES.NS", "SILVERBEES.NS"]:
        print(f"\n{'='*30} ENSEMBLE TEST: {s} {'='*30}")
        analysis = generate_prediction(s)
        
        print(f"FINAL SIGNAL: {analysis['signal']}")
        print(f"CONFIDENCE: {analysis['confidence']}%")
        print(f"CONVICTION: {analysis['conviction']}")
        print(f"TIMEFRAME: {analysis['timeframe']}")
        print(f"RISK LEVEL: {analysis['risk_level']}")
        if analysis['sip_recommendation']:
            print(f"SIP REC: {analysis['sip_recommendation']}")
            
        print("\nAGENT CONTRIBUTIONS:")
        for agent, res in analysis['agent_breakdown'].items():
            if res:
                print(f"- {agent.upper()}: {res['signal']} (Conf: {res.get('confidence', 'N/A')}%)")
            else:
                print(f"- {agent.upper()}: [NO DATA]")
                
        print("\nTOP REASONS:")
        for r in analysis['key_reasons']:
            print(f"➔ {r}")
            
        if analysis['errors']:
            print("\nERRORS DETECTED:")
            for err in analysis['errors']:
                print(f"! {err}")
