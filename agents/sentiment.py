
import feedparser
import requests
import pandas as pd
import datetime
import os
import subprocess
import sys
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from data.database import NewsCache, Base
from config import DB_PATH

# Attempt to install required libraries if not found
try:
    import transformers
    from transformers import pipeline
except ImportError:
    print("Transformers library not found. Attempting installation...")
    subprocess.run([sys.executable, "-m", "pip", "install", "transformers", "torch", "xformers"], capture_output=True)
    from transformers import pipeline

try:
    import feedparser
except ImportError:
    print("Feedparser not found. Attempting installation...")
    subprocess.run([sys.executable, "-m", "pip", "install", "feedparser"], capture_output=True)
    import feedparser

# Database Setup
engine = create_engine(DB_PATH)
Session = sessionmaker(bind=engine)

# RSS Feed Configurations
RSS_FEEDS = [
    "https://www.moneycontrol.com/rss/business.xml",
    "https://economictimes.indiatimes.com/markets/rss.cms",
    "https://www.livemint.com/rss/markets"
]

KEYWORDS = {
    "SILVERBEES": ["silver", "chandi", "MCX silver", "silver ETF", "SILVERBEES"],
    "GOLDBEES": ["gold", "sona", "MCX gold", "gold ETF", "GOLDBEES", "bullion"],
    "HINDZINC": ["hindustan zinc", "hindzinc", "zinc"],
    "MUTHOOTFIN": ["muthoot finance", "muthoot", "gold loan"],
    "MANAPPURAM": ["manappuram", "gold loan"],
    "TITAN": ["titan", "tanishq", "jewellery"],
    "VEDL": ["vedanta", "vedl"],
    "WAAREE": ["waaree", "solar", "waareeener"],
}

# Global model cache
_sentiment_pipeline = None

def load_finbert():
    """
    Lazy loads the FinBERT sentiment analysis pipeline.
    """
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        print("Initializing FinBERT model (ProsusAI/finbert)...")
        # Note: This might take a while on first run due to model download
        try:
            _sentiment_pipeline = pipeline("text-classification", model="ProsusAI/finbert")
        except Exception as e:
            print(f"Error loading FinBERT: {e}. Falling back to basic sentiment logic.")
            return None
    return _sentiment_pipeline

def fetch_rss_headlines(symbol_key: str) -> list:
    """
    Fetches headlines from all configured RSS feeds and filters for the specific symbol.
    """
    keywords = KEYWORDS.get(symbol_key, [])
    if not keywords:
        return []

    collected_headlines = []
    session = Session()
    
    # Get previously cached URLs to avoid re-processing
    cached_urls = [r.url for r in session.query(NewsCache.url).all()]
    
    for feed_url in RSS_FEEDS:
        try:
            print(f"Polling RSS: {feed_url}")
            feed = feedparser.parse(feed_url, timeout=10)
            
            for entry in feed.entries:
                headline = entry.title
                url = entry.link
                
                # Check for duplicates or already processed
                if url in cached_urls:
                    continue
                
                # Filter by keyword (case insensitive)
                pattern = r'\b(' + '|'.join(map(re.escape, keywords)) + r')\b'
                if re.search(pattern, headline, re.IGNORECASE):
                    collected_headlines.append({
                        "headline": headline,
                        "url": url,
                        "published_at": getattr(entry, 'published', datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                        "symbol": symbol_key
                    })
                    
        except Exception as e:
            print(f"Error fetching from {feed_url}: {e}")
            
    session.close()
    return collected_headlines

def score_headlines(headlines_list: list) -> dict:
    """
    Uses FinBERT to score a list of headlines.
    """
    if not headlines_list:
        return {"label": "NEUTRAL", "score": 0.0, "positive": 0, "negative": 0, "neutral": 0, "total": 0}

    nlp = load_finbert()
    results = []
    
    labels = {"positive": 0, "negative": 0, "neutral": 0}
    
    for item in headlines_list:
        try:
            if nlp:
                # FinBERT model inference
                prediction = nlp(item['headline'])[0]
                label = prediction['label']
                score = prediction['score']
                
                item['sentiment_label'] = label
                item['sentiment_score'] = score
                labels[label] += 1
            else:
                # Mock/Simple fallback if transformers is unavailable
                item['sentiment_label'] = "neutral"
                item['sentiment_score'] = 0.5
                labels["neutral"] += 1
        except Exception as e:
            print(f"Scoring error: {e}")
            
    total = len(headlines_list)
    # Compound score: (pos - neg) / total
    compound_score = (labels["positive"] - labels["negative"]) / total if total > 0 else 0
    
    if compound_score > 0.2:
        final_label = "POSITIVE"
    elif compound_score < -0.2:
        final_label = "NEGATIVE"
    else:
        final_label = "NEUTRAL"
        
    return {
        "label": final_label,
        "score": round(compound_score, 2),
        "positive_count": labels["positive"],
        "negative_count": labels["negative"],
        "neutral_count": labels["neutral"],
        "total": total
    }

def save_to_cache(symbol: str, scored_headlines: list):
    """
    Persists processed headlines to the NewsCache database.
    """
    if not scored_headlines:
        return

    session = Session()
    try:
        for item in scored_headlines:
            # Re-check if URL exists again inside this session to be safe
            exists = session.query(NewsCache).filter_by(url=item['url']).first()
            if not exists:
                news_entry = NewsCache(
                    symbol=symbol,
                    headline=item['headline'],
                    url=item['url'],
                    published_at=datetime.datetime.now(), # In production, parse entry date
                    sentiment_score=item.get('sentiment_score', 0.0),
                    sentiment_label=item.get('sentiment_label', 'neutral')
                )
                session.add(news_entry)
        session.commit()
    except Exception as e:
        print(f"Cache save error: {e}")
    finally:
        session.close()

def get_upcoming_events() -> list:
    """
    Hardcoded scheduling logic for high-impact macro events.
    """
    events = []
    today = datetime.date.today()
    
    # 1. Indian Budget (Feb 1)
    budget_date = datetime.date(today.year if today.month <= 2 else today.year + 1, 2, 1)
    days_to_budget = (budget_date - today).days
    if 0 <= days_to_budget <= 15:
        events.append({
            "event": "Union Budget of India",
            "days_away": days_to_budget,
            "expected_gold_impact": "POSITIVE" # Usually duty changes or inflation hedging
        })

    # 2. RBI MPC (Roughly Feb, Apr, June, Aug, Oct, Dec)
    # This is an approximation. In real system, fetch from an API or calendar.
    m_months = [2, 4, 6, 8, 10, 12]
    for month in m_months:
        mpc_approx = datetime.date(today.year, month, 10) # Typically first half
        days_away = (mpc_approx - today).days
        if 0 <= days_away <= 10:
            events.append({
                "event": f"RBI Monetary Policy Committee (MPC) - {month}/{today.year}",
                "days_away": days_away,
                "expected_gold_impact": "NEUTRAL"
            })
            break

    # 3. US Fed Meeting approximation (8 times a year)
    # Approx: End of Jan, Mar, May, June, July, Sept, Nov, Dec
    fed_months = [1, 3, 5, 6, 7, 9, 11, 12]
    # Check current or next month
    for month in fed_months:
        fed_approx = datetime.date(today.year, month, 20)
        days_away = (fed_approx - today).days
        if 0 <= days_away <= 10:
            events.append({
                "event": "US Federal Reserve FOMC Meeting",
                "days_away": days_away,
                "expected_gold_impact": "NEGATIVE" if days_away < 5 else "NEUTRAL" # Rates usually bearish gold
            })
            break

    return events

def analyze_sentiment(symbol: str) -> dict:
    """
    Orchestrates the sentiment analysis flow for a given symbol.
    """
    # Normalize for keyword map
    symbol_key = "GOLDBEES" if "GOLD" in symbol.upper() else ("SILVERBEES" if "SILVER" in symbol.upper() else symbol.split('.')[0])
    
    # 1. Fetch
    headlines = fetch_rss_headlines(symbol_key)
    
    # 2. Score
    summary = score_headlines(headlines)
    
    # 3. Cache
    save_to_cache(symbol_key, headlines)
    
    # 4. Events
    events = get_upcoming_events()
    
    # Adjust Confidence based on sample size
    confidence = 50 + min(40, summary['total'] * 5) # More news = more confidence
    
    return {
        "symbol": symbol,
        "signal": summary['label'],
        "confidence": float(confidence),
        "score": summary['score'],
        "sentiment_label": summary['label'],
        "top_headlines": [h['headline'] for h in headlines[:5]],
        "breakdown": summary,
        "upcoming_events": events
    }

if __name__ == "__main__":
    for s in ["GOLDBEES.NS", "SILVERBEES.NS"]:
        print(f"\n{'='*20} SENTIMENT ANALYSIS: {s} {'='*20}")
        res = analyze_sentiment(s)
        print(f"SIGNAL: {res['signal']} (Score: {res['score']})")
        print(f"CONFIDENCE: {res['confidence']}%")
        print(f"HEADLINES FOUND: {res['breakdown']['total']}")
        for h in res['top_headlines']:
            print(f"- {h}")
        print(f"UPCOMING EVENTS: {res['upcoming_events']}")
