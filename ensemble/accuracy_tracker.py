import datetime
import json
import os
import random
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import sessionmaker

from data.database import Price, Prediction, AccuracyLog
from config import DB_PATH, ETF_SYMBOLS, STOCK_SYMBOLS, ETF_WEIGHTS, STOCK_WEIGHTS

# Database Engine Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def get_symbol_alias(symbol_val: str) -> str:
    """
    Converts a database-level Yahoo Symbol (e.g. 'SILVERBEES.NS') back to its config alias key ('SILVERBEES').
    """
    for k, v in ETF_SYMBOLS.items():
        if symbol_val == v:
            return k
    for k, v in STOCK_SYMBOLS.items():
        if symbol_val == v:
            return k
    return symbol_val

def get_trading_day_offset(start_date, n_days: int) -> datetime.datetime:
    """
    Determines the datetime that is exactly n_days in the future from start_date, 
    skipping weekends (Saturdays and Sundays). Strips timezone markers for consistency.
    """
    if isinstance(start_date, str):
        try:
            start_date = datetime.datetime.fromisoformat(start_date)
        except ValueError:
            try:
                start_date = datetime.datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                start_date = datetime.datetime.strptime(start_date[:10], "%Y-%m-%d")
                
    if isinstance(start_date, datetime.date) and not isinstance(start_date, datetime.datetime):
        start_date = datetime.datetime.combine(start_date, datetime.time.min)
        
    current_date = start_date.replace(tzinfo=None)
    days_added = 0
    while days_added < n_days:
        current_date += datetime.timedelta(days=1)
        # Weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
        if current_date.weekday() < 5:
            days_added += 1
    return current_date

def check_pending_predictions() -> list:
    """
    Identifies predictions matching the maturity window of 5+ trading days 
    which have directional targets (BUY or SELL) and have not been evaluated.
    """
    session = Session()
    try:
        # Get already evaluated IDs
        checked_ids = {r[0] for r in session.query(AccuracyLog.prediction_id).all() if r[0] is not None}
        
        # Query predictions with active direction predictions
        predictions = session.query(Prediction).filter(
            Prediction.signal.in_(["BUY", "SELL"])
        ).all()
        
        pending_list = []
        now = datetime.datetime.utcnow()
        
        for pred in predictions:
            if pred.id in checked_ids:
                continue
                
            # Maturity timestamp check
            maturity_date = get_trading_day_offset(pred.timestamp, 5)
            if maturity_date <= now:
                pending_list.append({
                    "id": pred.id,
                    "symbol": pred.symbol,
                    "signal": pred.signal,
                    "timestamp": pred.timestamp,
                    "technical_signal": pred.technical_signal,
                    "macro_signal": pred.macro_signal,
                    "ml_signal": pred.ml_signal,
                    "sentiment_signal": pred.sentiment_signal
                })
        return pending_list
    finally:
        session.close()

def evaluate_one_prediction(prediction_id: int) -> dict:
    """
    Evaluates individual prediction outcome. Checks close prices at entry 
    and exactly 5 trading days later.
    """
    session = Session()
    try:
        pred = session.query(Prediction).filter_by(id=prediction_id).first()
        if not pred:
            raise ValueError(f"Prediction Entry ID {prediction_id} not found")
            
        target_date = get_trading_day_offset(pred.timestamp, 5)
        
        # Fetch prices to evaluate close levels
        price_rows = session.query(Price).filter_by(symbol=pred.symbol, interval="1d").order_by(Price.date.asc()).all()
        if not price_rows:
            return {
                "error": f"No Price data found for {pred.symbol}"
            }
            
        # Target closest prices using minimum temporal distance algorithm
        entry_row = min(price_rows, key=lambda x: abs((x.date - pred.timestamp).total_seconds()))
        exit_row = min(price_rows, key=lambda x: abs((x.date - target_date).total_seconds()))
        
        entry_price = float(entry_row.close)
        exit_price = float(exit_row.close)
        
        actual_movement = "UP" if exit_price > entry_price else "DOWN"
        was_correct = False
        if pred.signal == "BUY" and actual_movement == "UP":
            was_correct = True
        elif pred.signal == "SELL" and actual_movement == "DOWN":
            was_correct = True
            
        return {
            "prediction_id": pred.id,
            "symbol": pred.symbol,
            "predicted_signal": pred.signal,
            "actual_movement": actual_movement,
            "was_correct": was_correct,
            "entry_price": round(entry_price, 2),
            "exit_price": round(exit_price, 2),
            "return_pct": round(((exit_price - entry_price) / entry_price * 100), 2) if entry_price > 0 else 0.0
        }
    finally:
        session.close()

def log_accuracy_result(evaluation: dict):
    """
    Saves an evaluation structure into the AccuracyLog database table.
    """
    if "error" in evaluation:
        print(f"Could not log entry: {evaluation['error']}")
        return
        
    session = Session()
    try:
        log_entry = AccuracyLog(
            prediction_id=evaluation["prediction_id"],
            symbol=evaluation["symbol"],
            predicted=evaluation["predicted_signal"],
            actual=evaluation["actual_movement"],
            was_correct=evaluation["was_correct"],
            checked_at=datetime.datetime.utcnow()
        )
        session.add(log_entry)
        session.commit()
    except Exception as e:
        print(f"Error persisting AccuracyLog: {e}")
        session.rollback()
    finally:
        session.close()

def is_agent_correct(agent_signal: str, actual_movement: str) -> bool:
    """
    Normalizes and computes whether an individual agent signal was correct 
    relative to actual movement. Ignores/Bypasses HOLD state.
    """
    if not agent_signal:
        return None
    signal_upper = str(agent_signal).upper()
    if actual_movement == "UP":
        if signal_upper in ["BUY", "BULLISH", "STRONG_BULLISH", "POSITIVE", "UP"]:
            return True
        elif signal_upper in ["SELL", "BEARISH", "STRONG_BEARISH", "NEGATIVE", "DOWN"]:
            return False
    elif actual_movement == "DOWN":
        if signal_upper in ["SELL", "BEARISH", "STRONG_BEARISH", "NEGATIVE", "DOWN"]:
            return True
        elif signal_upper in ["BUY", "BULLISH", "STRONG_BULLISH", "POSITIVE", "UP"]:
            return False
    return None

def calculate_accuracy_stats(symbol: str = None, days: int = 30) -> dict:
    """
    Gathers metrics on predictions accuracy and agent voting accuracy over N days.
    """
    session = Session()
    try:
        since_date = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        
        # Link AccuracyLog with original Prediction to inspect model signals
        query = session.query(AccuracyLog, Prediction).join(
            Prediction, AccuracyLog.prediction_id == Prediction.id
        ).filter(AccuracyLog.checked_at >= since_date)
        
        if symbol:
            query = query.filter(AccuracyLog.symbol == symbol)
            
        records = query.all()
        
        total_predictions = len(records)
        correct_predictions = sum(1 for log, pred in records if log.was_correct)
        overall_accuracy_pct = (correct_predictions / total_predictions * 100) if total_predictions > 0 else 0.0
        
        # Aggregate Agent level contributions
        agent_stats = {
            "technical": {"total": 0, "correct": 0},
            "macro": {"total": 0, "correct": 0},
            "ml": {"total": 0, "correct": 0},
            "sentiment": {"total": 0, "correct": 0}
        }
        
        for log, pred in records:
            actual_movement = log.actual
            
            # Technical Model
            is_c = is_agent_correct(pred.technical_signal, actual_movement)
            if is_c is not None:
                agent_stats["technical"]["total"] += 1
                if is_c:
                    agent_stats["technical"]["correct"] += 1
                    
            # Macro Model
            is_c = is_agent_correct(pred.macro_signal, actual_movement)
            if is_c is not None:
                agent_stats["macro"]["total"] += 1
                if is_c:
                    agent_stats["macro"]["correct"] += 1
                    
            # ML Model
            is_c = is_agent_correct(pred.ml_signal, actual_movement)
            if is_c is not None:
                agent_stats["ml"]["total"] += 1
                if is_c:
                    agent_stats["ml"]["correct"] += 1
                    
            # Sentiment Model
            is_c = is_agent_correct(pred.sentiment_signal, actual_movement)
            if is_c is not None:
                agent_stats["sentiment"]["total"] += 1
                if is_c:
                    agent_stats["sentiment"]["correct"] += 1
                    
        agent_accuracies = {}
        for agent, stats in agent_stats.items():
            tot = stats["total"]
            corr = stats["correct"]
            agent_accuracies[agent] = {
                "total": tot,
                "correct": corr,
                "accuracy_pct": round(corr / tot * 100, 1) if tot > 0 else 0.0
            }
            
        return {
            "symbol": symbol,
            "days": days,
            "total_predictions": total_predictions,
            "correct_predictions": correct_predictions,
            "overall_accuracy_pct": round(overall_accuracy_pct, 1),
            "agent_accuracies": agent_accuracies
        }
    finally:
        session.close()

def clip_and_normalize(weights: dict, min_val: float = 0.05, max_val: float = 0.60) -> dict:
    """
    Enforces min 0.05 and max 0.60 boundaries while keeping weight sums strictly at 1.0.
    """
    adjusted = weights.copy()
    if sum(adjusted.values()) == 0:
        return {k: round(1.0 / len(adjusted), 3) for k in adjusted}
        
    for _ in range(10):
        total = sum(adjusted.values())
        adjusted = {k: v / total for k, v in adjusted.items()}
        
        clipped = False
        for k, v in adjusted.items():
            if v < min_val:
                adjusted[k] = min_val
                clipped = True
            elif v > max_val:
                adjusted[k] = max_val
                clipped = True
        if not clipped:
            break
            
    # Final scaling consolidation
    total = sum(adjusted.values())
    return {k: round(v / total, 3) for k, v in adjusted.items()}

def update_weights_from_accuracy() -> dict:
    """
    Calculates moving 30-day agent efficiency and re-balances orchestrator configurations. 
    Protects boundaries and saves the resulting profiles to weights.json.
    """
    stats = calculate_accuracy_stats(days=30)
    total_evals = stats["total_predictions"]
    
    weights_path = "models/weights.json"
    
    # Pre-populate defaults
    default_weights = {}
    for k in ETF_SYMBOLS.keys():
        default_weights[k] = ETF_WEIGHTS.copy()
    for k in STOCK_SYMBOLS.keys():
        default_weights[k] = STOCK_WEIGHTS.copy()
        
    current_weights = default_weights.copy()
    if os.path.exists(weights_path):
        try:
            with open(weights_path, "r") as f:
                current_weights = json.load(f)
        except Exception:
            pass
            
    if total_evals < 20:
        return {
            "updated": False,
            "old_weights": current_weights,
            "new_weights": current_weights,
            "accuracy_used": stats,
            "reason": f"Insufficient evaluations ({total_evals} registered, 20 required)"
        }
        
    session = Session()
    try:
        since_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
        records = session.query(AccuracyLog, Prediction).join(
            Prediction, AccuracyLog.prediction_id == Prediction.id
        ).filter(AccuracyLog.checked_at >= since_date).all()
        
        # Categorize results
        etf_stats = {"macro": {"total": 0, "correct": 0}, "technical": {"total": 0, "correct": 0}, "ml": {"total": 0, "correct": 0}, "sentiment": {"total": 0, "correct": 0}}
        stock_stats = {"technical": {"total": 0, "correct": 0}, "ml": {"total": 0, "correct": 0}, "sentiment": {"total": 0, "correct": 0}}
        
        for log, pred in records:
            is_etf_item = any(pred.symbol == s for s in ETF_SYMBOLS.values())
            actual_movement = log.actual
            
            if is_etf_item:
                for agent in ["macro", "technical", "ml", "sentiment"]:
                    sig = getattr(pred, f"{agent}_signal")
                    is_c = is_agent_correct(sig, actual_movement)
                    if is_c is not None:
                        etf_stats[agent]["total"] += 1
                        if is_c:
                            etf_stats[agent]["correct"] += 1
            else:
                for agent in ["technical", "ml", "sentiment"]:
                    sig = getattr(pred, f"{agent}_signal")
                    is_c = is_agent_correct(sig, actual_movement)
                    if is_c is not None:
                        stock_stats[agent]["total"] += 1
                        if is_c:
                            stock_stats[agent]["correct"] += 1
                            
        # Compute accuracy inputs (fallback to config defaults if target empty)
        etf_accuracies = {}
        for agent, s in etf_stats.items():
            etf_accuracies[agent] = s["correct"] / s["total"] if s["total"] > 0 else ETF_WEIGHTS[agent]
            
        stock_accuracies = {}
        for agent, s in stock_stats.items():
            stock_accuracies[agent] = s["correct"] / s["total"] if s["total"] > 0 else STOCK_WEIGHTS[agent]
            
        # Refine weights
        new_etf_weights = clip_and_normalize(etf_accuracies, min_val=0.05, max_val=0.60)
        new_stock_weights = clip_and_normalize(stock_accuracies, min_val=0.05, max_val=0.60)
        
        new_weights_dict = {}
        for key in ETF_SYMBOLS.keys():
            new_weights_dict[key] = new_etf_weights
        for key in STOCK_SYMBOLS.keys():
            new_weights_dict[key] = new_stock_weights
            
        # Serialize to weight registry
        with open(weights_path, "w") as f:
            json.dump(new_weights_dict, f, indent=4)
            
        return {
            "updated": True,
            "old_weights": current_weights,
            "new_weights": new_weights_dict,
            "accuracy_used": stats
        }
    finally:
        session.close()

def print_accuracy_report():
    """
    Outputs a premium CLI terminal summary showing current system health 
    and learning weights modifications.
    """
    session = Session()
    try:
        now = datetime.datetime.utcnow()
        first_of_month = datetime.datetime(now.year, now.month, 1)
        monthly_count = session.query(Prediction).filter(Prediction.timestamp >= first_of_month).count()
        
        stats_30 = calculate_accuracy_stats(days=30)
        stats_60 = calculate_accuracy_stats(days=60)
        stats_90 = calculate_accuracy_stats(days=90)
        
        print("\n" + "="*70)
        print("                 ASTRAEUS SELF-LEARNING AGENT REPORT                 ")
        print("="*70)
        print(f"Predictions Created This Month: {monthly_count}")
        print("\nSystemic directional accuracy over temporal intervals:")
        print(f"  ● 30-Day Window: {stats_30['overall_accuracy_pct']}% ({stats_30['correct_predictions']}/{stats_30['total_predictions']})")
        print(f"  ● 60-Day Window: {stats_60['overall_accuracy_pct']}% ({stats_60['correct_predictions']}/{stats_60['total_predictions']})")
        print(f"  ● 90-Day Window: {stats_90['overall_accuracy_pct']}% ({stats_90['correct_predictions']}/{stats_90['total_predictions']})")
        
        # Pull performance metrics by symbol
        all_logs = session.query(AccuracyLog).all()
        asset_counts = {}
        for log in all_logs:
            symbol = log.symbol
            if symbol not in asset_counts:
                asset_counts[symbol] = {"total": 0, "correct": 0}
            asset_counts[symbol]["total"] += 1
            if log.was_correct:
                asset_counts[symbol]["correct"] += 1
                
        print("\n" + "-"*70)
        print(f"{'Asset Symbol':<22} | {'Total Evaluated':<15} | {'Correct Calls':<15} | {'Accuracy %':<10}")
        print("-"*70)
        
        best_asset = "N/A"
        best_accuracy = -1.0
        best_total = 0
        
        if not asset_counts:
            print(f"  {'No evaluations registered in database.':^66}")
        else:
            for sym, counts in sorted(asset_counts.items()):
                corr = counts["correct"]
                tot = counts["total"]
                pct = (corr / tot * 100) if tot > 0 else 0.0
                print(f"{sym:<22} | {tot:<15} | {corr:<15} | {pct:.1f}%")
                
                if pct > best_accuracy:
                    best_accuracy = pct
                    best_asset = sym
                    best_total = tot
                elif pct == best_accuracy and tot > best_total:
                    best_asset = sym
                    best_total = tot
                    
        print("-"*70)
        if best_asset != "N/A":
            print(f"Best Performing Asset: {best_asset} ({best_accuracy:.1f}% accuracy over {best_total} predictions)")
        else:
            print("Best Performing Asset: N/A")
            
        print("\n" + "="*30 + " AGENT VOTING EFFICIENCY (30D) " + "="*19)
        for agent, spec in stats_30["agent_accuracies"].items():
            print(f"  ● {agent.upper():<12} : {spec['accuracy_pct']:>5}% correctness ({spec['correct']}/{spec['total']} votes cast)")
            
        weights_path = "models/weights.json"
        print("\n" + "="*30 + " AGENT WEIGHT PROFILES " + "="*21)
        
        current_weights = {}
        if os.path.exists(weights_path):
            with open(weights_path, "r") as f:
                current_weights = json.load(f)
                
        if not current_weights:
            print("  Currently using configuration defaults:")
            print(f"    ETFs Weights: {ETF_WEIGHTS}")
            print(f"    Stocks Weights: {STOCK_WEIGHTS}")
        else:
            first_etf = list(ETF_SYMBOLS.keys())[0]
            etf_w = current_weights.get(first_etf, ETF_WEIGHTS)
            print("\n  ETFs Current Active Weights:")
            for ag, val in etf_w.items():
                print(f"    ● {ag.upper():<12} : {val:.3f}")
                
            first_stock = list(STOCK_SYMBOLS.keys())[0]
            stock_w = current_weights.get(first_stock, STOCK_WEIGHTS)
            print("\n  Stocks Current Active Weights:")
            for ag, val in stock_w.items():
                print(f"    ● {ag.upper():<12} : {val:.3f}")
                
        print("="*70 + "\n")
    finally:
        session.close()

def seed_mock_predictions_if_empty():
    """
    Clever test helper: if prices are available in database but predictions are completely 
    empty, populates a suite of mock histories to showcase evaluations immediately.
    """
    session = Session()
    try:
        price_count = session.query(Price).count()
        pred_count = session.query(Prediction).count()
        if price_count > 10 and pred_count == 0:
            print("\nDatabase contains pricing but no orchestration prediction history.")
            print("Seeding 25 mock historical records to demonstrate accuracy tracking instantly...")
            
            # Fetch last 100 prices
            price_entries = session.query(Price).order_by(Price.date.desc()).limit(110).all()
            if not price_entries:
                return
                
            p_by_sym = {}
            for p in price_entries:
                if p.symbol not in p_by_sym:
                    p_by_sym[p.symbol] = []
                p_by_sym[p.symbol].append(p)
                
            random.seed(42)
            symbols_to_seed = list(ETF_SYMBOLS.values()) + list(STOCK_SYMBOLS.values())
            seeded = 0
            
            for symbol in symbols_to_seed:
                sym_prices = p_by_sym.get(symbol, [])
                if len(sym_prices) < 20:
                    continue
                    
                # We place predictions dates matching indices 12 to 22 in chronological offset
                for idx in range(12, min(22, len(sym_prices))):
                    price_entry = sym_prices[idx]
                    
                    signal = random.choice(["BUY", "SELL"])
                    tech_sig = random.choice(["BUY", "SELL", "HOLD"])
                    macro_sig = random.choice(["BULLISH", "BEARISH", "NEUTRAL"])
                    ml_sig = random.choice(["BUY", "SELL", "HOLD"])
                    sent_sig = random.choice(["POSITIVE", "NEGATIVE", "NEUTRAL"])
                    
                    mock_pred = Prediction(
                        symbol=symbol,
                        timestamp=price_entry.date,
                        signal=signal,
                        confidence=random.uniform(62.0, 92.0),
                        technical_signal=tech_sig,
                        macro_signal=macro_sig if "BEE" in symbol else None,
                        ml_signal=ml_sig,
                        sentiment_signal=sent_sig,
                        reasons=json.dumps(["Backdated technical alignment", "Simulated trend verification"]),
                        timeframe="SWING"
                    )
                    session.add(mock_pred)
                    seeded += 1
            session.commit()
            print(f"Generated {seeded} mock backdated predictions!")
    except Exception as e:
        print(f"Failed to populate mock records: {e}")
        session.rollback()
    finally:
        session.close()

def run_daily_accuracy_check():
    """
    Core automation pipeline routine. Finds matured predictions, scores success levels, 
    persists performance metrics, and shifts orchestrator weights based on efficiency.
    """
    print("="*70)
    print("                RUNNING LIVE RECONCILIATION PIPELINE                ")
    print("="*70)
    
    # Pre-populate demo predictions if needed
    seed_mock_predictions_if_empty()
    
    pending = check_pending_predictions()
    print(f"Detected {len(pending)} pending directional predictions ripe for validation.")
    
    logged_count = 0
    for item in pending:
        try:
            eval_dict = evaluate_one_prediction(item["id"])
            if "error" in eval_dict:
                print(f"Skipped {item['id']} for {item['symbol']} : {eval_dict['error']}")
                continue
                
            log_accuracy_result(eval_dict)
            outcome = "CORRECT" if eval_dict["was_correct"] else "FAILED"
            print(f"  ✔ Evaluated ID {item['id']} ({item['symbol']}): Pred: {item['signal']}, Actual: {eval_dict['actual_movement']} | {outcome}")
            logged_count += 1
        except Exception as e:
            print(f"  ✖ Validation mistake for Prediction {item['id']}: {e}")
            
    print("-" * 70)
    print(f"Successfully evaluated and logged {logged_count} total accuracy reports.")
    
    # Refresh weights
    weights_res = update_weights_from_accuracy()
    if weights_res.get("updated"):
        print("SUCCESS: Orchestrator agent weights successfully optimized and written to models/weights.json.")
    else:
        print(f"BYPASS: Weights optimization skipped. Reason: {weights_res.get('reason', 'N/A')}")
    print("="*70 + "\n")

if __name__ == "__main__":
    # Ensure tables are built
    from data.database import init_db
    init_db(DB_PATH)
    
    # Run evaluation
    run_daily_accuracy_check()
    
    # Print statistics
    print_accuracy_report()
