import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from data.database import Price, Base
from config import DB_PATH, MACRO_SYMBOLS, ETF_SYMBOLS

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def get_macro_data(symbol_key: str, limit: int = 60) -> pd.DataFrame:
    """
    Fetches historical macro data from the SQLite database.
    Maps the symbol key (e.g. 'DXY') to the actual symbol (e.g. 'DX-Y.NYB') defined in config.
    """
    symbol = MACRO_SYMBOLS.get(symbol_key)
    if not symbol:
        return pd.DataFrame()

    session = Session()
    try:
        rows = session.query(Price).filter_by(
            symbol=symbol, interval="1d"
        ).order_by(Price.date.asc()).limit(limit).all()
        
        if not rows:
            return pd.DataFrame()
            
        df = pd.DataFrame([{
            "date": r.date, 
            "close": r.close, 
        } for r in rows])
        
        df.set_index("date", inplace=True)
        return df
    finally:
        session.close()

def calculate_dxy_signal() -> dict:
    """
    Calculates signal based on Dollar Index (DXY) trends.
    Strong DXY is typically bearish for Gold/Silver.
    """
    df = get_macro_data("DXY")
    if df.empty or len(df) < 30:
        return {"signal": "NEUTRAL", "interpretation": "Insufficient DXY data", "value": 0, "ma30": 0, "rate_of_change_5d": 0}
    
    current_val = float(df['close'].iloc[-1])
    ma30 = float(df['close'].rolling(window=30).mean().iloc[-1])
    # 5-day rate of change
    roc5 = ((current_val - float(df['close'].iloc[-5])) / float(df['close'].iloc[-5])) * 100
    
    # Logic: DXY above MA + rising = bearish gold
    if current_val > ma30 and roc5 > 0:
        signal = "BEARISH"
        interp = "DXY strength (Above MA + Rising) is negative for Gold/Silver"
    elif current_val < ma30 and roc5 < 0:
        signal = "BULLISH"
        interp = "DXY weakness (Below MA + Falling) is positive for Gold/Silver"
    else:
        signal = "NEUTRAL"
        interp = "DXY in consolidation or mixed trend"
        
    return {
        "signal": signal,
        "value": round(current_val, 2),
        "ma30": round(ma30, 2),
        "rate_of_change_5d": round(roc5, 2),
        "interpretation": interp
    }

def calculate_yield_signal() -> dict:
    """
    Calculates signal based on US 10-Year Treasury Yields.
    High yields increase opportunity cost for Gold.
    """
    df = get_macro_data("US10Y")
    if df.empty or len(df) < 5:
        return {"signal": "NEUTRAL", "interpretation": "Insufficient US10Y data", "current_yield": 0, "rate_of_change_5d": 0}

    current_yield = float(df['close'].iloc[-1])
    roc5 = ((current_yield - float(df['close'].iloc[-5])) / float(df['close'].iloc[-5])) * 100
    
    # Logic: Above 4.5% and rising = strong bearish gold
    if current_yield > 4.5 and roc5 > 0:
        signal = "STRONG_BEARISH"
        interp = "High yields and rising trend are strongly negative for non-yielding assets (Gold/Silver)"
    elif current_yield < 3.5 or roc5 < 0:
        signal = "BULLISH"
        interp = "Falling or low yields favor precious metals"
    else:
        signal = "NEUTRAL"
        interp = "Yields are stable or in range"
        
    return {
        "signal": signal,
        "current_yield": round(current_yield, 2),
        "rate_of_change_5d": round(roc5, 2),
        "interpretation": interp
    }

def calculate_usdinr_signal() -> dict:
    """
    Calculates signal based on USD/INR exchange rate.
    Weak INR (high USDINR) benefits local gold prices in India.
    """
    df = get_macro_data("USDINR")
    if df.empty or len(df) < 20:
        return {"signal": "NEUTRAL", "impact": "NEUTRAL", "current_rate": 0, "ma20": 0}

    current_rate = float(df['close'].iloc[-1])
    ma20 = float(df['close'].rolling(window=20).mean().iloc[-1])
    
    # Weak INR (higher rate) = Local ETF benefits (Gold is priced in USD)
    if current_rate > ma20:
        impact = "POSITIVE"
        signal = "BULLISH"
        interp = "INR weakening vs USD. This inflates local Gold/Silver prices (Price in USD * USD/INR)"
    else:
        impact = "NEGATIVE"
        signal = "BEARISH"
        interp = "INR strengthening. Local ETF might see headwinds even if USD gold is stable"
        
    return {
        "signal": signal,
        "current_rate": round(current_rate, 2),
        "ma20": round(ma20, 2),
        "impact": impact,
        "interpretation": interp
    }

def calculate_safe_haven_signal() -> dict:
    """
    Calculates signal based on Market Volatility (VIX) and Nifty performance.
    Fear in the market drives safe-haven demand for Gold.
    """
    vix_df = get_macro_data("INDIAVIX")
    nifty_df = get_macro_data("NIFTY")
    
    if vix_df.empty or nifty_df.empty or len(vix_df) < 5 or len(nifty_df) < 5:
        return {"signal": "NEUTRAL", "safe_haven_active": False, "vix_level": 0, "nifty_5d_change_pct": 0}

    vix_level = float(vix_df['close'].iloc[-1])
    nifty_change_5d = ((float(nifty_df['close'].iloc[-1]) - float(nifty_df['close'].iloc[-5])) / float(nifty_df['close'].iloc[-5])) * 100
    
    safe_haven_active = False
    if vix_level > 20 or nifty_change_5d < -2:
        safe_haven_active = True
        signal = "BULLISH"
        interp = "High Volatility / Nifty Correction detected. Safe haven demand likely active for Gold."
    else:
        signal = "NEUTRAL"
        interp = "Market stability suggests low safe-haven urgency"

    return {
        "signal": signal,
        "vix_level": round(vix_level, 2),
        "nifty_5d_change_pct": round(nifty_change_5d, 2),
        "safe_haven_active": safe_haven_active,
        "interpretation": interp
    }

def calculate_gold_silver_ratio() -> dict:
    """
    Calculates Gold/Silver ratio for relative valuation.
    High ratio favors Silver; Low ratio favors Gold.
    """
    gold_df = get_macro_data("GOLD_SPOT")
    silver_df = get_macro_data("SILVER_SPOT")
    
    if gold_df.empty or silver_df.empty:
        return {"ratio": 0, "interpretation": "Insufficient data for ratio", "silverbees_sip_signal": "NEUTRAL", "goldbees_signal": "NEUTRAL"}
    
    # Align dates and calculate ratio
    combined = pd.concat([gold_df['close'], silver_df['close']], axis=1, keys=['gold', 'silver']).dropna()
    if combined.empty:
        return {"ratio": 0, "interpretation": "No overlapping data", "silverbees_sip_signal": "NEUTRAL", "goldbees_signal": "NEUTRAL"}
        
    current_ratio = combined['gold'].iloc[-1] / combined['silver'].iloc[-1]
    
    silverbees_sip = "NEUTRAL"
    goldbees_signal = "NEUTRAL"
    
    if current_ratio > 85:
        interp = "Silver significantly undervalued relative to Gold (Historic extreme)"
        silverbees_sip = "STRONG_BUY"
        goldbees_signal = "SELL"
    elif current_ratio < 65:
        interp = "Gold undervalued relative to Silver"
        goldbees_signal = "BUY"
        silverbees_sip = "NEUTRAL"
    elif 70 <= current_ratio <= 85:
        interp = "Normal range for Gold-Silver ratio"
    else:
        interp = "Ratio in transition"

    return {
        "ratio": round(current_ratio, 2),
        "interpretation": interp,
        "silverbees_sip_signal": silverbees_sip,
        "goldbees_signal": goldbees_signal
    }

def analyze_macro(symbol: str) -> dict:
    """
    Main entry point for macro analysis. Analyzes global and local macro factors.
    Returns a unified macro signal and confidence score.
    """
    # Normalize symbol key
    base_symbol = "GOLDBEES" if "GOLD" in symbol.upper() else "SILVERBEES"
    
    dxy = calculate_dxy_signal()
    yields = calculate_yield_signal()
    usdinr = calculate_usdinr_signal()
    safe_haven = calculate_safe_haven_signal()
    ratio = calculate_gold_silver_ratio()
    
    # Scoring Matrix
    score = 0
    reasons = []
    
    # Weight mapping: -1 to 1 based on signal strength
    mapping = {
        "STRONG_BULLISH": 1.0, 
        "BULLISH": 0.6, 
        "NEUTRAL": 0.0, 
        "BEARISH": -0.6, 
        "STRONG_BEARISH": -1.0
    }
    
    # Weights: DXY(35) + Yield(25) + USDINR(20) + SafeHaven(15) + Ratio(5) = 100
    score += mapping.get(dxy['signal'], 0) * 35
    score += mapping.get(yields['signal'], 0) * 25
    score += mapping.get(usdinr['signal'], 0) * 20
    score += mapping.get(safe_haven['signal'], 0) * 15
    
    # Ratio impact specific to the symbol being analyzed
    if base_symbol == "GOLDBEES":
        score += mapping.get(ratio['goldbees_signal'], 0) * 5
    else:
        score += mapping.get(ratio['silverbees_sip_signal'], 0) * 5
        
    # Interpret weighted score (-100 to 100)
    if score > 20: 
        final_signal = "BULLISH"
    elif score < -20: 
        final_signal = "BEARISH"
    else: 
        final_signal = "NEUTRAL"
        
    # Confidence calculation: Base 50% + derived strength
    confidence = min(95.0, 50.0 + abs(score) * 0.45)

    # Collect key reasons for the signal
    all_signals = [
        ("DXY", dxy), 
        ("Yields", yields), 
        ("USDINR", usdinr), 
        ("SafeHaven", safe_haven)
    ]
    for name, s in all_signals:
        if s['signal'] != "NEUTRAL":
            reasons.append(s['interpretation'])
            
    sip_rec = "ACCUMULATE" if score > 30 else ("REDUCE" if score < -30 else "HOLD")
    
    return {
        "symbol": symbol,
        "signal": final_signal,
        "confidence": round(confidence, 1),
        "total_macro_score": round(score, 2),
        "breakdown": {
            "dxy": dxy,
            "yields": yields,
            "usdinr": usdinr,
            "safe_haven": safe_haven,
            "ratio": ratio
        },
        "sip_recommendation": sip_rec,
        "key_reasons": reasons
    }

if __name__ == "__main__":
    # Test for both primary ETFs
    for s in ["GOLDBEES.NS", "SILVERBEES.NS"]:
        print(f"\n{'='*25} MACRO ANALYSIS: {s} {'='*25}")
        analysis = analyze_macro(s)
        
        if "error" in analysis:
            print(f"ERROR: {analysis['error']}")
            continue
            
        print(f"SIGNAL: {analysis['signal']}")
        print(f"CONFIDENCE: {analysis['confidence']}%")
        print(f"SIP RECOMMENDATION: {analysis['sip_recommendation']}")
        print(f"MACRO SCORE: {analysis['total_macro_score']}")
        
        print("\nBREAKDOWN:")
        for k, v in analysis['breakdown'].items():
            sig = v.get('signal', 'N/A')
            print(f"- {k.upper()}: {sig} | {v.get('interpretation', '')}")
            
        print("\nKEY REASONS:")
        for r in analysis['key_reasons']:
            print(f"➔ {r}")
