# 🚀 Bang ON Portfolio Prediction & Dynamic Strategy Workspace
### 📊 Unified Developer & Product Blueprint Suite

Welcome to the **Bang ON AI** repository. This document serves as the absolute master-blueprint, system architect reference, and setup manual for the complete application. Designed specifically for Indian commodity BeES (Exchange Traded Funds) and modern volatile equities, **Bang ON** operates to eliminate emotional trading biases by answering three classic quantitative questions: **"KAB, KITNA aur KAHAN"** (When to buy, How much to allocate, and Where to park capital).

---

## 🗺️ Part 1: The 6 Foundation Blueprints

Below are the 6 foundational blueprints prepared to guide the development, testing, styling, data integrity, and orchestration flows of the **Bang ON** ecosystem.

---

### 📋 1. Product Requirements Document (PRD)

| Parameter | Specification |
| :--- | :--- |
| **App Name** | Bang ON AI Portfolio Prediction & Dynamic Strategy Workspace |
| **One-Line Idea** | A high-contrast quantitative portfolio advisor and risk calculator eliminating retail trading bias through decentralized multi-agent prediction scoring, dynamic RSI-tuned SIP planner, and ATR position sizers. |
| **Target Users** | Self-directed Indian retail investors, commodity BeES accumulators, active swing traders, and tactical portfolio compounders. |
| **User Role** | Single investor with optional profile synchronization to sync watchlists across devices. |
| **MVP Asset Scope** | Liquid Indian commodity index ETFs (**GOLDBEES.NS**, **SILVERBEES.NS**) and volatile benchmark equities (**TATAMOTORS.NS**, **ADANIPOWER.NS**, **SUZLON.NS**, **RELIANCE.NS**, **WAAREEENER.NS**). |
| **Out of Scope V1** | Automated direct broker algorithmic order routing, options chain writing/greeks, and intraday margin leveraged trading. |

#### Core User Stories
*   **SIP Timing (KAB)**: "As an investor, I want to see a systematic SIP planner that dynamically scales my monthly rupee budget based on the 14-day RSI, so that I accumulate heavily at bottoms and save capital in gold/silver reserves during market peaks."
*   **Risk Protection (KITNA)**: "As a swing trader, I want a position-sizing calculator that reads the asset's active Average True Range (ATR) and tells me the entry, target, stop loss, and *exact unit quantity* to buy based on my account size and custom risk threshold, so that I never blow up my trading account on a single bad play."
*   **Market Analysis (KAHAN)**: "As a self-directed allocator, I want to see today's top setups scanned on converging momentum indicators (ADX trend strength, Bollinger Band compression, volume ratios), backed by a live decentralized multi-agent voting ensemble, so that I allocate only to qualified setups."

---

### ⚙️ 2. Technical Requirements Document (TRD)

#### Technical Architecture Flowchart
```
[React 19 Frontend Web UI] ──(HTTP JSON / API Proxy)──> [Node.js Express Server Entry]
                                                               │
     ┌────────────────────────┬────────────────────────────────┼──────────────────────────────┐
     ▼                        ▼                                ▼                              ▼
[Yahoo Finance API]     [SQLite database]              [Google GenAI SDK]            [Indicator Formulas]
(Daily market feeds)   (Auth caches & watchlists)    (gemini-2.5-flash briefs)     (RSI-14, ADX, ATR, BB)
```

#### Selected Tech Stack
*   **User Interface Framework**: React 19 SPA served via Vite 6.
*   **Styling Engine**: Tailwind CSS v4 using the optimized PostCSS Vite bundler plugin. Includes raw `@import` styles and dynamic conditional typography styles.
*   **Server Entrypoint**: Express v4 (compiled as CJS in production via `esbuild` into `dist/server.cjs` for performance, and launched via `tsx` live TypeScript engine under development).
*   **Database Engine**: Offline-First `better-sqlite3` SQL database to cache ticker prices history, store prediction matrix coordinates, save notifications logs, and persist custom added equity symbols watchlists.
*   **AI Engine API**: Google GenAI SDK (`@google/genai` v1.52.0) utilizing clientless server-secured `gemini-2.5-flash` model weights for generating automated, on-demand portfolio morning briefs, swing trade templates, and weekly summary briefs.
*   **Technical Analytics Engine**: Mathematical calculations computed via the standard technicalindicators and mathjs libraries, delivering deterministic Bollinger Band Squeezes, RSI values, ATR metrics, and EMA trendlines crossover configurations.

---

### 🔄 3. App Flow Document

#### Screen Hierarchy & User Navigation
1.  **Dashboard Hub (Default Landing)**:
    *   **Desk A**: Real-time Interactive Market Ticker ticker informing NSE market hour states.
    *   **Desk B**: *Today's Top 5 Swing Setups* matrix list displaying technical ratings.
    *   **Desk C**: *Dynamic Capital Allocation Calculator* - interactive input panels mapping trade budgets, custom volatility risk levels (%), custom pricing entry, and stop losses. Outputs share purchases quantity and targets.
2.  **Assets Index Screen**:
    *   Displays list of tracked assets, filters (All, Gems, Commodity MeTALS).
    *   Button to append custom stock symbol tickers seamlessly (triggering automatic validation crawler, caching price streams in SQLite, and dispatching notification events).
3.  **Active Asset Detail Desk (Deep Dive)**:
    *   High-contrast candle chart powered by Recharts showing historical movements.
    *   *Stochastic Gradient Descent (SGD) ML Core Tracker*: Displays training model accuracies and custom live indicator coefficient adjustments.
    *   *Multi-Timeframe Trend Concordance Panel*: Tracks Weekly Trend, Daily Setup Trigger, and Hourly timings.
    *   Decentralized voting grid detail of the 4 core agents (Technical, Macro, Sentiment, ML).
4.  **SIP & Strategy Hub**:
    *   RSI Dynamic Budget Estimator.
    *   Gold/Silver Spread Arbitrage chart tracking physical value differences.
    *   200-EMA support warnings, and USD-INR rupee hedging values.
5.  **Accuracy / Diagnostics Desk (Friction Simulator)**:
    *   Backtesting diagnostic engine auditing 6 months of historical setups.
    *   Factor-in Indian taxation (Securities Transaction Tax - STT, 15% Short Term Capital gains), 0.03% brokerage fees, and bid-ask slippages to display true Net P&L metrics.

#### Dynamic Interface Interaction
```
[Click Ticker Scan Setup] ────> [Auto-populates Risk Calculator Inputs]
                                            │
                                            ▼
                             [Outputs Exact units to acquire]
                                            │
                                            ▼
                           [Analyze] ─> [Directs to Detail Page]
```

---

### 🎨 4. UI/UX Design Brief

*   **Visual Direction Archetype**: Classic High-Contrast Swiss-Modernist / Institutional Bloomberg Quantitative terminal.
*   **Color Blueprint**:
    *   *Canvas*: Absolute Space Black (`#07090e`, `#020408`)
    *   *High-Priority Prompts*: Electric Celestial Emerald (`#10b981` / `#059669`)
    *   *Functional Indicators*: Cyber Cobalt blue (`#0ea5e9`), Deep Royal Indigo purple (`#6366f1`)
    *   *Alert Warnings*: Vivid Crimson Rose (`#f43f5e`), Marigold Amber (`#f59e0b`)
*   **Typography Hierarchy**: Space Grotesk/Outfit for bold headers, balanced margins, Inter for reading controls, and raw monospace **JetBrains Mono** for pricing values, percentages, and trade sizing outputs.
*   **User Interface Rules**:
    *   No noisy graphic gradients. Use deep slate outline boundaries (`border-slate-800` / `900`) and clean negative spacing, allowing technical charts and indicators to stand out clearly.
    *   Subtle blur backdrops (`backdrop-blur-md`) and framer motion spring scale curves on interactions (`active:scale-[0.98]`).
    *   Redundant telemetry or simulated terminal loading clutter is strictly forbidden. The page margins are kept absolutely clean to let user-data dominate the visual landscape.

---

### 🗄️ 5. Backend Schema Document

The local database operates using high-speed SQLite via the `better-sqlite3` driver. The following database layout defines the persistence engine:

```sql
-- Track and validate imported user tickers
CREATE TABLE IF NOT EXISTS custom_assets (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    asset_type TEXT NOT NULL CHECK(asset_type IN ('ETF', 'STOCK'))
);

-- Store predictions compiled from multi-agent analysis 
CREATE TABLE IF NOT EXISTS predictions_cache (
    symbol TEXT PRIMARY KEY,
    signal TEXT NOT NULL CHECK(signal IN ('BUY', 'HOLD', 'SELL')),
    score REAL NOT NULL,
    confidence REAL NOT NULL,
    payload TEXT, -- JSON holding technical, sentiment, macro and SGD ML variables
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache daily candles data streams to bypass Yahoo Finance rate-limits
CREATE TABLE IF NOT EXISTS candles_cache (
    symbol TEXT,
    date TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    PRIMARY KEY (symbol, date)
);

-- Store diagnostic backtesting performance results
CREATE TABLE IF NOT EXISTS backtest_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    strategy TEXT,
    net_pnl REAL,
    win_rate REAL,
    total_trades INTEGER,
    taxation_paid REAL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active notifications log triggered by watchlist interests
CREATE TABLE IF NOT EXISTS live_notifications (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    signal TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    read INTEGER DEFAULT 0 CHECK(read IN (0, 1)),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 📆 6. Implementation Plan

#### Development Lifecycle
```
[Phase 1: Setup & Routing] ──> [Phase 2: Data & SQLite] ──> [Phase 3: Multi-Agent Hub]
                                                                        │
┌───────────────────────────────────────────────────────────────────────┘
▼
[Phase 4: Terminal UI Desk] ──> [Phase 5: Sizing & calculators] ──> [Phase 6: Gemini Reports]
```

1.  **Phase 1: Core Framework Integration**: Scaffolding Node-Vite Express servers, mapping absolute paths compilation via `esbuild`, mapping routing files config in `/src/App.tsx`.
2.  **Phase 2: Database and Market Feeds Setup**: Initializing the Offline-First SQLite structure and creating Yahoo Finance candles caching workers.
3.  **Phase 3: Deep Technical & ML Classifier Formulas**: Developing Technical indicators (RSI, ADX, ATR, BB) and training the live online Stochastic Gradient Descent Logistic Classifier coefficients.
4.  **Phase 4: Responsive Terminal UI Assembly**: Designing the Swiss-Modernist interface with fully modular, separate page components (`Dashboard.tsx`, `AssetDetail.tsx`, `SipTracker.tsx`) to avoid hitting file token limits.
5.  **Phase 5: Financial Execution Desk Integration**: Wiring the position-sizing modules to dynamically interact with user clicks and integrating the systematic RSI-SIP planner inputs.
6.  **Phase 6: Gemini Grounding Model Integration**: Connecting the server-secured `@google/genai` model weights to write morning briefs and export Telegram-ready swing cards, completing absolute production validation.

---

## 🛠️ Part 2: Step-by-Step Workspace Setup Guide

Ready to spin up the local server and interface? Follow these standard setup instructions:

### 1. Prerequisite Checks
Ensure you have Node.js (v18+) and Python 3.10+ installed:
```bash
node --version
python3 --version
```

### 2. Configure Python Virtual Environment & Analytics Modules
Initialize your isolated environment to avoid global library conflicts:
```bash
# Create the virtual environment
python3 -m venv .venv

# Activate the environment (macOS/Linux)
source .venv/bin/activate

# Activate the environment (Windows Command Prompt)
.venv\Scripts\activate

# Install required numerical modules
pip install -r requirements.txt
```

### 3. Install Node.js Frontend Dependencies
Install React, Tailwind CSS, Recharts, and Express dependencies compiled under `package.json`:
```bash
npm install
```

### 4. Setup Local Environments & Launch Dev Client
Create your local environment properties file and supplement with your Gemini API security key:
```bash
# Create .env properties file
cp .env.example .env

# Open .env and add your valid Gemini API Key:
# GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
```
Once configured, launch the server using our dev script proxy which handles compilation and hot-reloads internally:
```bash
npm run dev
```
The server will now accept connections on port `3000` (`http://localhost:3000`).

---

## 📅 Part 3: Automated Market Workflows

To ensure data points stay fresh post-Indian market closing, **Bang ON** includes an automated execution background daemon:
```bash
python scheduler.py
```

### Post-Closing Pipelines (4:00 PM IST)
Every afternoon, the scheduler auto-triggers:
1.  **Candles Crawler**: Downloads the day's physical spot price movements from Yahoo Finance.
2.  **Score Audits**: Evaluates predictions placed exactly 5 days ago against raw close prices to update individual multi-agent confidence ratings.
3.  **Active Optimizer Weights**: Rewrites of `models/weights.json` to elevate high-performing agents and lower under-performing agent weights.
4.  **Briefing compilation**: Re-calibrates calculations ready for your next morning briefing.

*To force immediate calibration testing, call the scheduler with the bypass flag:*
```bash
python scheduler.py --now
```

---

## 🛠️ Adding Custom Tickers
To expand and index custom tickers, run the automated setup utility:
```bash
python add_symbol.py <ALIAS> <TICKER> <ASSET_TYPE>
```
*   **Example (Tata Motors)**: `python add_symbol.py TATAMOTORS TATAMOTORS.NS STOCK`
*   **Example (Silver BeES)**: `python add_symbol.py SILVERBEES SILVERBEES.NS ETF`

---
*Disclaimer: All indicators, automated SGD machine learning estimations, and swing templates compiled in **Bang ON** operate strictly as tools for academic, paper testing, and technical study. Backtested or estimated past yields are never an guarantee of future capital compound levels. Prioritize risk containment always.*
