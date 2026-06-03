import pandas as pd
import pandas_ta as ta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from data.database import Price, Base
from config import DB_PATH
import numpy as np

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def get_price_data(symbol: str, limit: int = 200) -> pd.DataFrame:
    """
    Fetches historical price data from the SQLite database for a given symbol.
    Uses exactly the requested pattern.
    """
    session = Session()
    try:
        rows = session.query(Price).filter_by(
            symbol=symbol, interval="1d"
        ).order_by(Price.date.asc()).limit(limit).all()
        
        if not rows:
            return pd.DataFrame()
            
        df = pd.DataFrame([{
            "date": r.date, 
            "open": r.open, 
            "high": r.high,
            "low": r.low, 
            "close": r.close, 
            "volume": r.volume
        } for r in rows])
        
        df.set_index("date", inplace=True)
        return df
    finally:
        session.close()

def calculate_indicators(df: pd.DataFrame) -> dict:
    """
    Calculates technical indicators using pandas-ta with safe column detection.
    Follows exactly the requested SAFE USAGE PATTERN.
    """
    if df.empty or len(df) < 50:
        return {}

    indicators = {}
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    # Current Price Metadata
    indicators["current_price"] = round(float(close.iloc[-1]), 2)
    indicators["52w_high"] = round(float(high.iloc[-252:].max()), 2) if len(df) >= 252 else round(float(high.max()), 2)
    indicators["52w_low"] = round(float(low.iloc[-252:].min()), 2) if len(df) >= 252 else round(float(low.min()), 2)

    # RSI(14)
    rsi = ta.rsi(close, length=14)
    if rsi is not None and not rsi.empty:
        indicators["rsi"] = round(float(rsi.iloc[-1]), 2)

    # MACD(12, 26, 9) - line, signal, histogram (Safe usage)
    macd = ta.macd(close, fast=12, slow=26, signal=9)
    if macd is not None and not macd.empty:
        print("MACD columns:", macd.columns.tolist())
        macd_line_col = [c for c in macd.columns if 'MACD_' in c and 's' not in c and 'h' not in c][0]
        macd_signal_col = [c for c in macd.columns if 'MACDs_' in c][0]
        macd_hist_col = [c for c in macd.columns if 'MACDh_' in c][0]
        indicators["macd_line"] = round(float(macd[macd_line_col].iloc[-1]), 4)
        indicators["macd_signal"] = round(float(macd[macd_signal_col].iloc[-1]), 4)
        indicators["macd_hist"] = round(float(macd[macd_hist_col].iloc[-1]), 4)

    # Bollinger Bands(20) - upper, mid, lower (Safe usage)
    bb = ta.bbands(close, length=20, std=2)
    if bb is not None and not bb.empty:
        print("BB columns:", bb.columns.tolist())
        bb_col_upper = [c for c in bb.columns if 'BBU' in c][0]
        bb_col_lower = [c for c in bb.columns if 'BBL' in c][0]
        bb_col_mid = [c for c in bb.columns if 'BBM' in c][0]
        indicators["bb_upper"] = round(float(bb[bb_col_upper].iloc[-1]), 4)
        indicators["bb_lower"] = round(float(bb[bb_col_lower].iloc[-1]), 4)
        indicators["bb_mid"] = round(float(bb[bb_col_mid].iloc[-1]), 4)

    # EMAs
    ema20 = ta.ema(close, length=20)
    ema50 = ta.ema(close, length=50)
    ema200 = ta.ema(close, length=200)
    
    if ema20 is not None: indicators["ema20"] = round(float(ema20.iloc[-1]), 2)
    if ema50 is not None: indicators["ema50"] = round(float(ema50.iloc[-1]), 2)
    if ema200 is not None: indicators["ema200"] = round(float(ema200.iloc[-1]), 2)

    # ATR(14)
    atr = ta.atr(high, low, close, length=14)
    if atr is not None and not atr.empty:
        indicators["atr"] = round(float(atr.iloc[-1]), 4)

    # Volume MA 20
    vol_ma = ta.sma(volume, length=20)
    if vol_ma is not None and not vol_ma.empty:
        indicators["volume_ma20"] = round(float(vol_ma.iloc[-1]), 0)
        indicators["current_volume"] = int(volume.iloc[-1])

    return indicators

def generate_signal(symbol: str, indicators: dict) -> dict:
    """
    Generates a technical signal based on the scoring rules.
    """
    if not indicators:
        return {"symbol": symbol, "error": "Insufficient data"}

    bull_points = 0
    bear_points = 0
    reasons = []
    
    price = indicators["current_price"]

    # 1. RSI Scoring
    rsi = indicators.get("rsi")
    if rsi is not None:
        if rsi < 30:
            bull_points += 2
            reasons.append(f"RSI oversold ({rsi})")
        elif rsi > 70:
            bear_points += 2
            reasons.append(f"RSI overbought ({rsi})")

    # 2. MACD Scoring
    macd_hist = indicators.get("macd_hist")
    if macd_hist is not None:
        if macd_hist > 0:
            bull_points += 2
            reasons.append("MACD histogram bullish")
        else:
            bear_points += 2
            reasons.append("MACD histogram bearish")

    # 3. EMA Trends
    ema20 = indicators.get("ema20")
    ema50 = indicators.get("ema50")
    ema200 = indicators.get("ema200")
    if ema20 and ema50:
        if price > ema20 and ema20 > ema50:
            if ema200 and ema50 > ema200:
                bull_points += 3
                reasons.append("Strong multi-EMA uptrend (Price > EMA20 > EMA50 > EMA200)")
            else:
                bull_points += 1
                reasons.append("Short-term EMA uptrend")
        elif price < ema20 and ema20 < ema50:
            if ema200 and ema50 < ema200:
                bear_points += 3
                reasons.append("Strong multi-EMA downtrend (Price < EMA20 < EMA50 < EMA200)")
            else:
                bear_points += 1
                reasons.append("Short-term EMA downtrend")

    # 4. Bollinger Bands
    bb_upper = indicators.get("bb_upper")
    bb_lower = indicators.get("bb_lower")
    if bb_upper and bb_lower:
        if price <= bb_lower:
            bull_points += 2
            reasons.append("Price at/below BB lower support")
        elif price >= bb_upper:
            bear_points += 2
            reasons.append("Price at/above BB upper resistance")

    # 5. Volume Confirmation
    vol = indicators.get("current_volume")
    vol_ma = indicators.get("volume_ma20")
    if vol and vol_ma and vol > (1.5 * vol_ma):
        reasons.append(f"High volume confirmation ({vol/vol_ma:.1f}x average)")

    # Signal Decider
    if bull_points > bear_points:
        signal = "BUY"
    elif bear_points > bull_points:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Confidence calculation: 50 + (abs_diff / total * 50), max 95
    total_effective_points = bull_points + bear_points
    if total_effective_points > 0:
        diff = abs(bull_points - bear_points)
        confidence = 50 + (diff / total_effective_points * 50)
    else:
        confidence = 50.0
    
    confidence = min(95.0, confidence)

    return {
        "symbol": symbol,
        "signal": signal,
        "confidence": round(confidence, 1),
        "bull_points": bull_points,
        "bear_points": bear_points,
        "reasons": reasons,
        "indicators": indicators
    }

def analyze(symbol: str) -> dict:
    """
    Main entry point for analyzing a symbol technically.
    """
    df = get_price_data(symbol)
    if df.empty:
        return {"symbol": symbol, "error": "No price data found"}
    
    indicators = calculate_indicators(df)
    if not indicators:
        return {"symbol": symbol, "error": "Could not calculate indicators"}
        
    return generate_signal(symbol, indicators)

if __name__ == "__main__":
    test_symbols = ["SILVERBEES.NS", "GOLDBEES.NS"]
    
    for s in test_symbols:
        print(f"\n{'='*20} TESTING: {s} {'='*20}")
        res = analyze(s)
        if "error" in res:
            print(f"Error: {res['error']}")
        else:
            print(f"SIGNAL: {res['signal']}")
            print(f"CONFIDENCE: {res['confidence']}%")
            print(f"REASONS: {res['reasons']}")
            print(f"PRICE: {res['indicators']['current_price']}")
            print(f"RSI: {res['indicators'].get('rsi')}")
            print(f"MACD Hist: {res['indicators'].get('macd_hist')}")
            print(f"EMA20: {res['indicators'].get('ema20')}")
            print(f"EMA50: {res['indicators'].get('ema50')}")
            print(f"EMA200: {res['indicators'].get('ema200')}")
