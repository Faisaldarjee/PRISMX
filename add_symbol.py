import sys
import re
import os

def print_usage():
    print("=" * 70)
    print("                 ASTRAEUS SYMBOL REGISTRATION UTILITY")
    print("=" * 70)
    print("Usage: python add_symbol.py <ALIAS> <SYMBOL> <TYPE>")
    print("Example: python add_symbol.py IDFCFIRSTB IDFCFIRSTB.NS STOCK")
    print("\nTypes of tracked assets:")
    print("  ● STOCK : Corporate equities (e.g. TITAN.NS, VEDL.NS)")
    print("  ● ETF   : Exchange Traded Funds (e.g. GOLDBEES.NS, SILVERBEES.NS)")
    print("  ● MACRO : Global metrics & cross-asset indicators (e.g. ^NSEI, ^INDIAVIX)")
    print("=" * 70)

def add_to_config(alias: str, symbol: str, asset_type: str):
    config_path = 'config.py'
    if not os.path.exists(config_path):
        raise FileNotFoundError("config.py not found in the root directory")

    with open(config_path, 'r') as f:
        content = f.read()

    # Determine dictionary placement
    if asset_type == "ETF":
        target_dict = "ETF_SYMBOLS"
    elif asset_type == "STOCK":
        target_dict = "STOCK_SYMBOLS"
    elif asset_type == "MACRO":
        target_dict = "MACRO_SYMBOLS"
    else:
        raise ValueError("Invalid type. Choose either ETF, STOCK, or MACRO")

    # Locate target dict block using smart regex pairing
    pattern = re.compile(rf"({target_dict}\s*=\s*\{{[^}}]*?)(}})", re.DOTALL)
    match = pattern.search(content)
    if not match:
        raise Exception(f"Could not find configuration block {target_dict} in config.py")

    dict_content = match.group(1).rstrip()
    
    # Avoid duplicate additions
    if f'"{alias}":' in dict_content or f"'{alias}':" in dict_content:
        print(f"[config.py] Symbol key '{alias}' is already registered in {target_dict}. Skipping rewrite.")
        return

    # Add new entry with standard indent
    new_entry = f'\n    "{alias}": "{symbol}",'
    updated_dict = dict_content + new_entry + "\n"
    
    new_content = content[:match.start()] + updated_dict + "}" + content[match.end():]
    
    with open(config_path, 'w') as f:
        f.write(new_content)
    
    print(f"[config.py] Successfully updated {target_dict} mapping.")

def main():
    if len(sys.argv) < 4:
        print_usage()
        sys.exit(1)

    alias = sys.argv[1].upper().strip()
    symbol = sys.argv[2].strip()
    asset_type = sys.argv[3].upper().strip()

    if asset_type not in ["STOCK", "ETF", "MACRO"]:
        print(f"Error: Invalid asset type '{asset_type}'. Must be ETF, STOCK, or MACRO.")
        print_usage()
        sys.exit(1)

    print("=" * 70)
    print(f"COMMENCING REGISTRATION FOR ASSET: {alias} ({symbol})")
    print("=" * 70)

    try:
        # Step 1: Add to configuration file
        add_to_config(alias, symbol, asset_type)

        # Step 2: Sync and load historical data
        print("\n[Step 2/3] Fetching global market history for new asset from Yahoo Finance...")
        from data.fetcher import DataFetcher
        DataFetcher.fetch_historical(alias, symbol)

        # Step 3: Train localized machine learning predictors
        if asset_type in ["STOCK", "ETF"]:
            print(f"\n[Step 3/3] Engineering indicators & training localized XGBoost predictor for {symbol}...")
            from agents.ml_agent import train_model
            train_model(symbol)
        else:
            print("\n[Step 3/3] Cross-asset indices registered. ML model training bypassed for MACRO type index.")

        print("\n" + "=" * 70)
        print(f"Symbol {alias} added successfully")
        print("=" * 70)

    except Exception as e:
        print(f"\n[Error] High-level registration failed for symbol: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
