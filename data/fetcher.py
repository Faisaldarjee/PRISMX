import yfinance as yf
import pandas as pd
from data.database import get_session, Price
from config import ALL_SYMBOLS, HISTORICAL_PERIOD, DAILY_INTERVAL
from sqlalchemy.exc import SQLAlchemyError
import datetime

class DataFetcher:
    """
    Handles data retrieval from Yahoo Finance and storage in SQLite.
    """
    
    @staticmethod
    def fetch_historical(alias: str, symbol: str):
        """
        Fetches historical data for a specific asset and saves it to the database.
        """
        print(f"Fetching historical data for {alias} ({symbol})...")
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=HISTORICAL_PERIOD, interval=DAILY_INTERVAL)
            
            if df.empty:
                print(f"Warning: No data returned for {symbol}")
                return
                
            session = get_session()
            
            # Convert DF to database records
            records = []
            for index, row in df.iterrows():
                price_record = Price(
                    symbol=symbol,
                    date=index.to_pydatetime(),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=int(row['Volume']),
                    interval=DAILY_INTERVAL
                )
                records.append(price_record)
            
            # Efficient bulk insert
            session.bulk_save_objects(records)
            session.commit()
            print(f"Successfully saved {len(records)} records for {symbol}")
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
        finally:
            session.close()

    @staticmethod
    def fetch_all():
        """
        Loops through all configured symbols and fetches historical data.
        """
        for alias, symbol in ALL_SYMBOLS.items():
            DataFetcher.fetch_historical(alias, symbol)

    @staticmethod
    def update_daily():
        """
        Fetches the latest data (last 5 days) for all assets to catch up.
        """
        print("Starting daily update for all symbols...")
        for alias, symbol in ALL_SYMBOLS.items():
            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(period="5d", interval=DAILY_INTERVAL)
                
                if df.empty: continue
                
                session = get_session()
                for index, row in df.iterrows():
                    # Check if record already exists to avoid duplicates
                    exists = session.query(Price).filter_by(symbol=symbol, date=index.to_pydatetime()).first()
                    if not exists:
                        price_record = Price(
                            symbol=symbol,
                            date=index.to_pydatetime(),
                            open=float(row['Open']),
                            high=float(row['High']),
                            low=float(row['Low']),
                            close=float(row['Close']),
                            volume=int(row['Volume']),
                            interval=DAILY_INTERVAL
                        )
                        session.add(price_record)
                
                session.commit()
                session.close()
            except Exception as e:
                print(f"Failed daily update for {symbol}: {e}")

if __name__ == "__main__":
    DataFetcher.fetch_all()
