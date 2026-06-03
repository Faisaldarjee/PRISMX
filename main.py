import config
from data.database import init_db, get_session, Price
from data.fetcher import DataFetcher
import os

def print_banner():
    print("="*60)
    print(" ASTRAEUS: MULTI-AGENT PREDICTION SYSTEM (NSE/BSE) ")
    print("="*60)

def main():
    print_banner()
    
    # 1. Configuration Review
    print(f"Tracking Total Assets: {len(config.ALL_SYMBOLS)}")
    print(f"ETFs: {list(config.ETF_SYMBOLS.keys())}")
    print(f"Stocks: {list(config.STOCK_SYMBOLS.keys())}")
    print(f"Macro: {list(config.MACRO_SYMBOLS.keys())}")
    print("-" * 60)

    # 2. Initialize Database
    init_db(config.DB_PATH)

    # 3. Synchronize Data
    print("Initializing Data Fetcher...")
    try:
        # Check if we have data already
        session = get_session(config.DB_PATH)
        record_count = session.query(Price).count()
        session.close()

        if record_count == 0:
            print("Database empty. Starting bulk historical fetch (this may take time)...")
            DataFetcher.fetch_all()
        else:
            print(f"Database contains {record_count} historical records. Running catch-up scan...")
            DataFetcher.update_daily()
            
    except Exception as e:
        print(f"Critical error during synchronization: {e}")

    # 4. Final Status Report
    session = get_session(config.DB_PATH)
    total_records = session.query(Price).count()
    print(f"Synchronization Complete. Total Database Records: {total_records}")
    print("=" * 60)
    session.close()

if __name__ == "__main__":
    main()
