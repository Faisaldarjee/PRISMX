import YahooFinanceClass from 'yahoo-finance2';
const yahooFinance = new YahooFinanceClass();

async function test() {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 10 * 24 * 60 * 60 * 1000);
    const res = await yahooFinance.chart('INR=X', { period1: start, period2: end, interval: '1d' });
    console.log(res.quotes);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}
test();
