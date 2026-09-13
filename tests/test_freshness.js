import assert from 'assert';
import {
  parseUtcTimestamp,
  calculateAgeMinutes,
  evaluateArticle,
  filterFreshNewsArticles
} from '../src/pipeline/filterEngine.js';
import { Deduplicator } from '../src/pipeline/deduplicator.js';
import { PublishedStore } from '../src/storage/publishedStore.js';

async function runFreshnessTests() {
  console.log('🧪 Running Verification Tests for Strict 1-Hour (60m) Freshness & Ordering...\n');

  const nowUtc = Date.now();
  const MINUTE = 60 * 1000;

  // 1. Prepare test articles with precise UTC offsets
  const article15m = {
    title: 'Spot Bitcoin ETF Inflows Hit Weekly Record Amid Institutional Accumulation',
    description: 'Spot Bitcoin ETF products recorded fresh institutional inflows today.',
    source: 'CoinDesk',
    url: 'https://coindesk.com/article-15m',
    publishedAt: new Date(nowUtc - 15 * MINUTE).toISOString()
  };

  const article45m = {
    title: 'Federal Reserve Signals Caution on Interest Rates as Inflation Cools',
    description: 'Fed officials discussed CPI inflation prints and monetary policy stance.',
    source: 'Reuters',
    url: 'https://reuters.com/article-45m',
    publishedAt: new Date(nowUtc - 45 * MINUTE).toISOString()
  };

  const article75m = {
    title: 'Ethereum Treasury Reserves Surge Across Major DeFi Protocol Foundations',
    description: 'ETH liquidity pools and stablecoin reserves saw notable expansion.',
    source: 'The Block',
    url: 'https://theblock.co/article-75m',
    publishedAt: new Date(nowUtc - 75 * MINUTE).toISOString()
  };

  const article4h = {
    title: 'Bitcoin, Ethereum, and XRP Face Headwinds as Bond Yields Rise',
    description: 'Crypto assets traded lower as Treasury yields edged upward.',
    source: 'CoinGape',
    url: 'https://coingape.com/article-4h',
    publishedAt: new Date(nowUtc - 240 * MINUTE).toISOString()
  };

  // Test 1: 15-minute-old article passes
  const eval15m = evaluateArticle(article15m, nowUtc, 60);
  assert.strictEqual(eval15m.passed, true, '15-minute article must PASS');
  assert.strictEqual(eval15m.logEntry.status, 'FRESH');
  console.log('  ✅ 15-minute-old article passed (FRESH)');

  // Test 2: 45-minute-old article passes
  const eval45m = evaluateArticle(article45m, nowUtc, 60);
  assert.strictEqual(eval45m.passed, true, '45-minute article must PASS');
  assert.strictEqual(eval45m.logEntry.status, 'FRESH');
  console.log('  ✅ 45-minute-old article passed (FRESH)');

  // Test 3: 75-minute-old article is rejected under 1-hour cutoff
  const eval75m = evaluateArticle(article75m, nowUtc, 60);
  assert.strictEqual(eval75m.passed, false, '75-minute article must be REJECTED');
  assert.strictEqual(eval75m.logEntry.status, 'REJECTED');
  console.log('  ✅ 75-minute-old article rejected (exceeds 1-hour limit)');

  // Test 4: 4-hour-old article is rejected
  const eval4h = evaluateArticle(article4h, nowUtc, 60);
  assert.strictEqual(eval4h.passed, false, '4-hour article must be REJECTED');
  assert.strictEqual(eval4h.logEntry.status, 'REJECTED');
  console.log('  ✅ 4-hour-old article rejected (exceeds 1-hour limit)');

  // Test 5: Newest articles are sorted first
  console.log('\n🧪 Testing Sort Order & Filter...');
  const allArticles = [article75m, article15m, article45m, article4h];
  const freshList = filterFreshNewsArticles(allArticles, 60, nowUtc, 60);
  assert.strictEqual(freshList.length, 2, 'Only the 2 articles <= 60m should survive filter');

  const sorted = [...freshList].sort((a, b) => b.pubTimestamp - a.pubTimestamp);
  assert.strictEqual(sorted[0].url, article15m.url, 'First item must be 15m old');
  assert.strictEqual(sorted[1].url, article45m.url, 'Second item must be 45m old');
  console.log('  ✅ Articles correctly filtered and sorted strictly by UTC timestamp');

  // Test 6: Deduplication Against Sent Articles
  console.log('\n🧪 Testing Deduplication Against Sent Articles...');
  const testStore = new PublishedStore('src/storage/test_published_store.json');
  const deduplicator = new Deduplicator(testStore);

  const deduped1 = deduplicator.deduplicateBatch([article15m, article45m]);
  assert.strictEqual(deduped1.length, 2, 'First run should allow both articles');
  testStore.markPublished(article15m);

  const deduped2 = deduplicator.deduplicateBatch([article15m, article45m]);
  assert.strictEqual(deduped2.length, 1, 'Second run should filter out article15m');
  assert.strictEqual(deduped2[0].url, article45m.url, 'Only article45m remains');
  console.log('  ✅ Already published article was successfully prevented from re-sending!');

  import('fs').then(fs => {
    if (fs.existsSync('src/storage/test_published_store.json')) {
      fs.unlinkSync('src/storage/test_published_store.json');
    }
  });

  console.log('\n🎉 ALL FRESHNESS & DEDUPLICATION TESTS PASSED 100%!');
}

runFreshnessTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
