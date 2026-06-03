
ETF_SYMBOLS = {
    "SILVERBEES": "SILVERBEES.NS",
    "GOLDBEES": "GOLDBEES.NS",
}

STOCK_SYMBOLS = {
    "HINDZINC": "HINDZINC.NS",
    "VEDL": "VEDL.NS",
    "MUTHOOTFIN": "MUTHOOTFIN.NS",
    "MANAPPURAM": "MANAPPURAM.NS",
    "TITAN": "TITAN.NS",
    "WAAREE": "WAAREEENER.NS",
}

MACRO_SYMBOLS = {
    "GOLD_SPOT": "GC=F",
    "SILVER_SPOT": "SI=F",
    "DXY": "DX-Y.NYB",
    "US10Y": "^TNX",
    "USDINR": "INR=X",
    "NIFTY": "^NSEI",
    "INDIAVIX": "^INDIAVIX",
}

ALL_SYMBOLS = {**ETF_SYMBOLS, **STOCK_SYMBOLS, **MACRO_SYMBOLS}

# Database Configuration
DB_PATH = "sqlite:///data/predictions.db"

# Data Fetching Intervals
HISTORICAL_PERIOD = "5y"
DAILY_INTERVAL = "1d"
INTRADAY_INTERVAL = "5m"

# Prediction Engine Weights
ETF_WEIGHTS = {
    "macro": 0.40,
    "technical": 0.30,
    "ml": 0.20,
    "sentiment": 0.10,
}

STOCK_WEIGHTS = {
    "technical": 0.40,
    "ml": 0.35,
    "sentiment": 0.25,
}
