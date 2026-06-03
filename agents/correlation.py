
import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from data.database import Price, Base
from config import DB_PATH, ALL_SYMBOLS, ETF_SYMBOLS, MACRO_SYMBOLS
import pandas_ta as ta

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def get_aligned_prices(symbols: list[str], limit: int = 252) -> pd.DataFrame:
    """
    Fetches close prices for multiple symbols from the database and aligns them by date.
    Returns a wide DataFrame where each column is a symbol.
    """
    session = Session()
    try:
        data_frames = []
        for symbol in symbols:
            # Handle both alias and full symbol if needed, though usually full symbol is used in DB
            rows = session.query(Price).filter_by(
                symbol=symbol, interval="1d"
            ).order_by(Price.date.asc()).limit(limit).all()
            
            if rows:
                df = pd.DataFrame([{"date": r.date, symbol: r.close} for r in rows])
                df.set_index("date", inplace=True)
                data_frames.append(df)
        
        if not data_frames:
            return pd.DataFrame()
            
        # Aligned by date using inner join
        aligned_df = pd.concat(data_frames, axis=1, join="inner")
        return aligned_df
    finally:
        session.close()

def rolling_correlation(symbol1: str, symbol2: str, window: int = 30) -> dict:
    """
    Calculates rolling correlation between two symbols.
    """
    df = get_aligned_prices([symbol1, symbol2], limit=100)
    if df.empty or len(df) < window:
        return {"error": "Insufficient data for rolling correlation"}
        
    rolling_corr = df[symbol1].rolling(window=window).corr(df[symbol2])
    current_corr = float(rolling_corr.iloc[-1])
    
    # Trend analysis (last 5 days)
    trend_val = current_corr - float(rolling_corr.iloc[-5])
    trend = "Strengthening" if trend_val > 0.05 else ("Weakening" if trend_val < -0.05 else "Stable")
    
    # Interpretation
    if current_corr > 0.7:
        interp = f"Strong positive correlation ({current_corr:.2f}). Assets move together."
    elif current_corr < -0.7:
        interp = f"Strong negative correlation ({current_corr:.2f}). Assets move inversely."
    else:
        interp = "Moderate or weak correlation."

    return {
        "symbol1": symbol1,
        "symbol2": symbol2,
        "current_correlation": round(current_corr, 3),
        "trend": trend,
        "interpretation": interp
    }

def full_correlation_matrix(symbols: list[str]) -> dict:
    """
    Generates a full correlation matrix for the provided symbols.
    Identifies strong positive and negative relationships.
    """
    df = get_aligned_prices(symbols, limit=252)
    if df.empty:
        return {"error": "No data available for matrix"}
        
    corr_matrix = df.corr().to_dict()
    
    strong_pos = []
    strong_neg = []
    
    # Find significant pairs
    for i, s1 in enumerate(symbols):
        for j, s2 in enumerate(symbols):
            if i >= j: continue # Skip diagonal and duplicates
            val = corr_matrix[s1].get(s2)
            if val is None: continue
            
            if val > 0.75:
                strong_pos.append({"pair": [s1, s2], "value": round(val, 3)})
            elif val < -0.75:
                strong_neg.append({"pair": [s1, s2], "value": round(val, 3)})

    return {
        "matrix": corr_matrix,
        "strong_positive_pairs": strong_pos,
        "strong_negative_pairs": strong_neg
    }

def lead_lag_analysis(leader: str, follower: str, max_lag: int = 5) -> dict:
    """
    Analyzes if moves in the leader asset price predict moves in the follower asset price.
    """
    df = get_aligned_prices([leader, follower], limit=300)
    if df.empty:
        return {"error": "Insufficient data for lead-lag"}
        
    # Calculate daily returns for better stationarity
    df_returns = df.pct_change().dropna()
    
    best_lag = 0
    max_corr = 0
    
    # Test lags
    for lag in range(1, max_lag + 1):
        # Leader[t] vs Follower[t + lag]
        corr = df_returns[leader].corr(df_returns[follower].shift(-lag))
        if abs(corr) > abs(max_corr):
            max_corr = corr
            best_lag = lag
            
    if abs(max_corr) > 0.2:
        interp = f"{leader} tends to lead {follower} by {best_lag} days with correlation {max_corr:.2f}"
    else:
        interp = "No significant lead-lag relationship detected."
        
    return {
        "leader": leader,
        "follower": follower,
        "best_lag_days": best_lag,
        "correlation_at_best_lag": round(max_corr, 3),
        "interpretation": interp
    }

def sip_timing_signal(symbol: str) -> dict:
    """
    Determines if it's a good time for a SIP (Systematic Investment Plan) entry.
    Only for Gold and Silver ETFs.
    """
    if "BEE" not in symbol.upper():
        return {"error": "SIP timing logic only applies to ETFs"}
        
    session = Session()
    try:
        # Get historical price
        prices = session.query(Price).filter_by(symbol=symbol, interval="1d").order_by(Price.date.desc()).limit(252).all()
        if not prices or len(prices) < 20:
             return {"error": "Not enough price data for SIP analysis"}
             
        df = pd.DataFrame([{"close": p.close} for p in prices][::-1]) # Sort chronological
        close = df['close']
        
        current_price = float(close.iloc[-1])
        low_52w = float(close.min())
        
        # 1. RSI Check
        rsi = ta.rsi(close, length=14)
        rsi_val = float(rsi.iloc[-1]) if rsi is not None else 50
        
        # 2. Momentum Check (20-day ROC)
        roc20 = float(ta.roc(close, length=20).iloc[-1]) if len(df) >= 20 else 0
        
        # 3. Distance from low
        dist_from_low = (current_price / low_52w) - 1
        
        # 4. Gold-Silver Ratio (Pull from macro symbols)
        gs_ratio = 75 # Default fallback
        gold_spot = session.query(Price).filter_by(symbol=MACRO_SYMBOLS["GOLD_SPOT"]).order_by(Price.date.desc()).first()
        silver_spot = session.query(Price).filter_by(symbol=MACRO_SYMBOLS["SILVER_SPOT"]).order_by(Price.date.desc()).first()
        
        if gold_spot and silver_spot:
            gs_ratio = gold_spot.close / silver_spot.close

        reasons = []
        score = 0
        
        # Scoring Logic
        if rsi_val < 35:
            score += 1
            reasons.append(f"Oversold territory (RSI: {rsi_val:.1f})")
        
        if roc20 < -2:
            score += 1
            reasons.append(f"Negative 20-day momentum ({roc20:.1f}%) - 'Dip' detected")
            
        if dist_from_low < 0.15:
            score += 1
            reasons.append(f"Close to 52-week lows ({dist_from_low*100:.1f}% away)")
            
        # Ratio logic
        if "SILVER" in symbol.upper() and gs_ratio > 85:
            score += 1
            reasons.append(f"Gold-Silver ratio high ({gs_ratio:.1f}) - Silver relatively cheap")
        elif "GOLD" in symbol.upper() and gs_ratio < 65:
            score += 1
            reasons.append(f"Gold-Silver ratio low ({gs_ratio:.1f}) - Gold relatively cheap")

        if score >= 3:
            signal = "SIP_GOOD"
            confidence = 80
        elif score >= 1:
            signal = "SIP_NEUTRAL"
            confidence = 60
        else:
            signal = "SIP_PAUSE"
            confidence = 40
            reasons.append("Asset currently expensive or overbought")

        return {
            "symbol": symbol,
            "sip_signal": signal,
            "confidence": confidence,
            "reasons": reasons,
            "score_breakdown": {
                "rsi": round(rsi_val, 2),
                "roc20_pct": round(roc20, 2),
                "dist_from_low_pct": round(dist_from_low * 100, 2),
                "gold_silver_ratio": round(gs_ratio, 2)
            }
        }
    finally:
        session.close()

def analyze(symbol: str) -> dict:
    """
    Main entry point for correlation and SIP analysis. 
    Connects multiple insights for a given asset.
    """
    corr_related = []
    
    # Default related assets for checking correlation
    related_candidates = [
        ETF_SYMBOLS["GOLDBEES"], 
        ETF_SYMBOLS["SILVERBEES"], 
        MACRO_SYMBOLS["GOLD_SPOT"], 
        MACRO_SYMBOLS["DXY"],
        MACRO_SYMBOLS["NIFTY"]
    ]
    
    # Remove self from list
    related_to_test = [s for s in related_candidates if s != symbol]
    
    for other in related_to_test:
        corr_data = rolling_correlation(symbol, other)
        if "error" not in corr_data:
            corr_related.append(corr_data)
            
    # Lead-lag check with macro leader (Gold Spot usually leads Gold ETF)
    leader_symbol = MACRO_SYMBOLS["GOLD_SPOT"] if "GOLD" in symbol.upper() else MACRO_SYMBOLS["SILVER_SPOT"]
    lead_lag = lead_lag_analysis(leader_symbol, symbol)
    
    # SIP signal
    sip = sip_timing_signal(symbol)
    
    return {
        "symbol": symbol,
        "correlations": corr_related,
        "lead_lag_insight": lead_lag,
        "sip_timing": sip
    }

if __name__ == "__main__":
    # Test on SILVERBEES
    target = ETF_SYMBOLS["SILVERBEES"]
    print(f"\n{'='*20} CORRELATION & SIP ANALYSIS: {target} {'='*20}")
    results = analyze(target)
    
    print(f"\nSIP SIGNAL: {results['sip_timing']['sip_signal']}")
    print(f"REASONS: {results['sip_timing']['reasons']}")
    
    print("\nCORRELATIONS:")
    for c in results['correlations']:
        print(f"➔ {c['symbol2']}: {c['current_correlation']} ({c['trend']})")
        
    print(f"\nLEAD-LAG: {results['lead_lag_insight'].get('interpretation')}")
