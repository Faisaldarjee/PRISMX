import { getNSEQuote } from '../services/nseQuotes';
import { fetchHeadlinesForSymbol } from '../services/newsFetcher';
import { getSentimentAnalysis, getPricesHistory } from '../services/serverApi';
import { getCachedSwingSetups, scanNifty500ForSwingSetups } from '../services/bulkScanner';

async function getTopSwingSetups(limit: number) {
  let setups = getCachedSwingSetups();
  if (setups.length === 0) {
    console.log('[Test Setup] Scanner cache empty, executing inline scan...');
    setups = await scanNifty500ForSwingSetups();
  }
  return setups.slice(0, limit);
}

async function getCandles(symbol: string, limit: number) {
  return getPricesHistory(symbol, limit);
}

async function runRealityChecker() {
  console.log('Starting PRISM E2E Reality Check...\n');
  let passCount = 0;

  // TEST 1: NSE Quote
  let test1Pass = false;
  let quotePrice = 0;
  let quoteSource = '';
  try {
    const quote = await getNSEQuote('RELIANCE');
    quotePrice = quote.lastPrice;
    quoteSource = quote.source;
    if (quote.source === 'NSE' && quote.lastPrice > 0) {
      test1Pass = true;
      passCount++;
    }
  } catch (err: any) {
    console.error('TEST 1 Error:', err.message);
  }

  // TEST 2: News Headlines
  let test2Pass = false;
  try {
    const headlines = await fetchHeadlinesForSymbol('GOLDBEES');
    const hasMock = headlines.some(h => h.toLowerCase().includes('mock'));
    if (headlines.length > 0 && !hasMock) {
      test2Pass = true;
      passCount++;
    }
  } catch (err: any) {
    console.error('TEST 2 Error:', err.message);
  }

  // TEST 3: Scanner Results
  let test3Pass = false;
  try {
    const setups = await getTopSwingSetups(5);
    if (setups.length === 5) {
      const distinctScores = new Set(setups.map(s => s.score));
      // Ensure scores vary and are valid
      if (distinctScores.size > 1) {
        test3Pass = true;
        passCount++;
      }
    }
  } catch (err: any) {
    console.error('TEST 3 Error:', err.message);
  }

  // TEST 4: Gemini Sentiment
  let test4Pass = false;
  try {
    const sentiment = await getSentimentAnalysis('NIFTY');
    if (sentiment && sentiment.headlines && sentiment.headlines.length > 0) {
      const hasMock = sentiment.headlines.some((h: string) => h.toLowerCase().includes('mock'));
      if (!hasMock) {
        test4Pass = true;
        passCount++;
      }
    }
  } catch (err: any) {
    console.error('TEST 4 Error:', err.message);
  }

  // TEST 5: Historical Data
  let test5Pass = false;
  try {
    const candles = await getCandles('TCS', 60);
    if (candles.length >= 50) {
      const dates = candles.map(c => new Date(c.date).getTime());
      const maxDateMs = Math.max(...dates);
      const maxDate = new Date(maxDateMs);
      const currentDate = new Date('2026-06-03T05:37:14Z'); // Given environment local time
      const diffMs = currentDate.getTime() - maxDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Allow up to 2.5 days delay for non-trading/timezone windows
      if (diffDays <= 2.5) {
        test5Pass = true;
        passCount++;
      } else {
        console.warn(`TEST 5: Latest candle date was ${maxDate.toISOString().slice(0, 10)}, current date is 2026-06-03. diffDays: ${diffDays.toFixed(2)}`);
      }
    }
  } catch (err: any) {
    console.error('TEST 5 Error:', err.message);
  }

  const percentage = (passCount / 5) * 100;

  console.log('\n=== PRISM REALITY CHECK ===');
  console.log(`TEST 1 NSE Quote:     ${test1Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`TEST 2 News Feed:     ${test2Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`TEST 3 Scanner:       ${test3Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`TEST 4 Sentiment:     ${test4Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`TEST 5 History:       ${test5Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('================================');
  console.log(`Reality Score: ${passCount}/5 (${percentage}%)`);
}

runRealityChecker().catch(err => {
  console.error('E2E Reality Check failed prematurely:', err);
});
