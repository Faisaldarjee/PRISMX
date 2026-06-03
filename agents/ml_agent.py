
import pandas as pd
import pandas_ta as ta
import numpy as np
import os
import joblib
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from data.database import Price, Base
from config import DB_PATH, ETF_SYMBOLS, STOCK_SYMBOLS

# Ensure models directory exists
if not os.path.exists('models'):
    os.makedirs('models')

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

def get_price_data(symbol: str, limit: int = 600) -> pd.DataFrame:
    """
    Fetches historical price data from SQLite for ML training/prediction.
    Requires at least 500 rows for stable training.
    """
    session = Session()
    try:
        rows = session.query(Price).filter_by(
            symbol=symbol, interval="1d"
        ).order_by(Price.date.asc()).limit(limit).all()
        
        if not rows or len(rows) < 100:
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

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs features used for training the XGBoost model.
    Includes returns, volatility, technical indicators, and volume ratios.
    """
    if df.empty or len(df) < 50:
        return pd.DataFrame()

    features = pd.DataFrame(index=df.index)
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    # 1. Price Returns
    features['return_1d'] = close.pct_change(1)
    features['return_5d'] = close.pct_change(5)
    features['return_10d'] = close.pct_change(10)
    features['return_20d'] = close.pct_change(20)

    # 2. Technical Indicators (Safe usage)
    # RSI
    rsi = ta.rsi(close, length=14)
    if rsi is not None:
        features['rsi_14'] = rsi

    # MACD
    macd = ta.macd(close, fast=12, slow=26, signal=9)
    if macd is not None:
        macd_hist_col = [c for c in macd.columns if 'MACDh_' in c][0]
        features['macd_hist'] = macd[macd_hist_col]

    # Bollinger Bands Position
    bb = ta.bbands(close, length=20, std=2)
    if bb is not None:
        bb_col_upper = [c for c in bb.columns if 'BBU' in c][0]
        bb_col_lower = [c for c in bb.columns if 'BBL' in c][0]
        # (Price - Lower) / (Upper - Lower) -> 0 to 1 scale
        features['bb_position'] = (close - bb[bb_col_lower]) / (bb[bb_col_upper] - bb[bb_col_lower])

    # EMA Ratios
    ema20 = ta.ema(close, length=20)
    ema50 = ta.ema(close, length=50)
    ema200 = ta.ema(close, length=200)
    
    if ema20 is not None: features['ema_ratio_20'] = close / ema20
    if ema50 is not None: features['ema_ratio_50'] = close / ema50
    if ema200 is not None: features['ema_ratio_200'] = close / ema200

    # 3. Volume
    features['volume_ratio'] = volume / volume.rolling(20).mean()

    # 4. Volatility
    features['volatility_10'] = close.pct_change().rolling(10).std()
    features['volatility_20'] = close.pct_change().rolling(20).std()

    # 5. Momentum
    features['roc_5'] = ta.roc(close, length=5)
    features['roc_10'] = ta.roc(close, length=10)

    # Clean up
    features.dropna(inplace=True)
    return features

def build_target(df: pd.DataFrame) -> pd.Series:
    """
    Builds the binary classification target: Will price be higher in 5 days?
    1 = Up, 0 = Down/Same
    """
    close = df['close']
    # shift(-5) looks 5 steps into the future
    target = (close.shift(-5) > close).astype(int)
    return target

def train_model(symbol: str) -> dict:
    """
    Trains an XGBoost model for a specific symbol using historical data.
    Implements time-based split and evaluates performance.
    """
    print(f"--- Training ML model for {symbol} ---")
    df = get_price_data(symbol, limit=800)
    if df.empty or len(df) < 200:
        return {"symbol": symbol, "error": "Insufficient data for training"}

    # Feature Engineering
    X = build_features(df)
    y = build_target(df)

    # Align X and y (y will have NaN in the last 5 rows because of shifting)
    common_index = X.index.intersection(y.dropna().index)
    X = X.loc[common_index]
    y = y.loc[common_index]

    if len(X) < 150:
         return {"symbol": symbol, "error": "Insufficient data after feature engineering"}

    feature_names = X.columns.tolist()

    # Time-based Split (80% Train, 20% Test)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    # XGBoost Implementation
    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="logloss",
        use_label_encoder=False
    )

    model.fit(X_train, y_train)

    # Evaluation
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    if acc < 0.52:
        print(f"Warning: Model for {symbol} not reliable (Accuracy: {acc:.2f}). Needs more data.")
    elif acc > 0.80:
        print(f"Warning: Possible overfitting for {symbol} (Accuracy: {acc:.2f}). Check features.")

    # Serialization
    model_path = f"models/{symbol}_xgb_model.pkl"
    features_path = f"models/{symbol}_features.pkl"
    joblib.dump(model, model_path)
    joblib.dump(feature_names, features_path)

    print(f"Model saved to {model_path} | Accuracy: {acc:.2f}")

    return {
        "symbol": symbol,
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "model_path": model_path
    }

def predict(symbol: str) -> dict:
    """
    Loads the trained model and performs inference on the latest available data.
    """
    model_path = f"models/{symbol}_xgb_model.pkl"
    features_path = f"models/{symbol}_features.pkl"

    if not os.path.exists(model_path):
        train_res = train_model(symbol)
        if "error" in train_res:
            return train_res

    # Load artifacts
    model = joblib.load(model_path)
    feature_names = joblib.load(features_path)

    # Get data and build features
    df = get_price_data(symbol, limit=300)
    if df.empty:
        return {"symbol": symbol, "error": "No data for prediction"}
        
    X_latest = build_features(df)
    if X_latest.empty:
         return {"symbol": symbol, "error": "Could not build features for latest data"}
    
    # Use only last available row for prediction
    latest_row = X_latest.tail(1)
    
    # Probability Scores
    probs = model.predict_proba(latest_row)[0]
    direction_val = model.predict(latest_row)[0] # 0 or 1
    
    direction = "UP" if direction_val == 1 else "DOWN"
    confidence = max(probs) * 100
    
    # Signal logic
    signal = "HOLD"
    if direction == "UP" and confidence > 55:
        signal = "BUY"
    elif direction == "DOWN" and confidence > 55:
        signal = "SELL"

    # Feature Importance
    importances = model.feature_importances_
    feat_imp = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)

    return {
        "symbol": symbol,
        "direction": direction,
        "confidence": round(float(confidence), 1),
        "signal": signal,
        "top_features": [f[0] for f in feat_imp[:5]],
        "model_accuracy": "See saved stats"
    }

def train_all():
    """
    Utility to retrain models for all core assets.
    """
    all_targets = list(ETF_SYMBOLS.values()) + list(STOCK_SYMBOLS.values())
    results = []
    for s in all_targets:
        res = train_model(s)
        results.append(res)
    return results

if __name__ == "__main__":
    # Test on core ETFs
    for s in ["SILVERBEES.NS", "GOLDBEES.NS"]:
        print(f"\n================ ML ANALYSIS: {s} ================")
        res = predict(s)
        if "error" in res:
            print(f"Error: {res['error']}")
        else:
            print(f"PREDICTED DIRECTION (5D): {res['direction']}")
            print(f"CONFIDENCE: {res['confidence']}%")
            print(f"ACTION SIGNAL: {res['signal']}")
            print(f"TOP FEATURES: {res['top_features']}")
