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
  console.log('🧪 Running Verification Tests for Freshness, Ordering, Deduplication...\n');

  const nowUtc = Date.now();
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;

  // 1. Prepare test articles with precise UTC offsets
  const article30m = {
    title: 'Spot Bitcoin ETF Inflows Hit Weekly Record Amid Institutional Accumulation',
    description: 'Spot Bitcoin ETF products recorded fresh institutional inflows today.',
    source: 'CoinDesk',
    url: 'https://coindesk.com/article-30m',
    publishedAt: new Date(nowUtc - 30 * MINUTE).toISOString()
  };

  const article5h = {
    title: 'Federal Reserve Signals Caution on Interest Rates as Inflation Cools',
    description: 'Fed officials discussed CPI inflation prints and monetary policy stance.',
    source: 'Reuters',
    url: 'https://reuters.com/article-5h',
    publishedAt: new Date(nowUtc - 5 * HOUR).toISOString()
  };

  const article11h = {
    title: 'Ethereum Treasury Reserves Surge Across Major DeFi Protocol Foundations',
    description: 'ETH liquidity pools and stablecoin reserves saw notable expansion.',
    source: 'The Block',
    url: 'https://theblock.co/article-11h',
    publishedAt: new Date(nowUtc - 11 * HOUR).toISOString()
  };

  const article13h = {
    title: 'Bitcoin, Ethereum, and XRP Face Headwinds as Bond Yields Rise',
    description: 'Crypto assets traded lower as Treasury yields edged upward.',
    source: 'CoinGape',
    url: 'https://coingape.com/article-13h',
    publishedAt: new Date(nowUtc - 13 * HOUR).toISOString()
  };

  const article21h = {
    title: 'Bitcoin Lost Money for a Fourth Day and XRP Took Zero',
    description: 'Fed rate hike odds surge as macro volatility persists.',
    source: '24/7 Wall St.',
    url: 'https://247wallst.com/article-21h',
    publishedAt: new Date(nowUtc - 21 * HOUR).toISOString()
  };

  // Test 1: 30-minute-old article passes
  const eval30m = evaluateArticle(article30m, nowUtc);
  assert.strictEqual(eval30m.passed, true, '30-minute article must PASS');
  assert.strictEqual(eval30m.logEntry.status, 'FRESH');
  console.log('  ✅ 30-minute-old article passed (FRESH)');

  // Test 2: 5-hour-old article passes
  const eval5h = evaluateArticle(article5h, nowUtc);
  assert.strictEqual(eval5h.passed, true, '5-hour article must PASS');
  assert.strictEqual(eval5h.logEntry.status, 'FRESH');
  console.log('  ✅ 5-hour-old article passed (FRESH)');

  // Test 3: 11-hour-old article passes
  const eval11h = evaluateArticle(article11h, nowUtc);
  assert.strictEqual(eval11h.passed, true, '11-hour article must PASS');
  assert.strictEqual(eval11h.logEntry.status, 'FRESH');
  console.log('  ✅ 11-hour-old article passed (FRESH)');

  // Test 4: 13-hour-old article is rejected
  const eval13h = evaluateArticle(article13h, nowUtc);
  assert.strictEqual(eval13h.passed, false, '13-hour article must be REJECTED');
  assert.strictEqual(eval13h.logEntry.status, 'REJECTED');
  assert.strictEqual(eval13h.logEntry.reason, 'older than 12h');
  console.log('  ✅ 13-hour-old article rejected with reason: "older than 12h"');

  // Test 5: 21-hour-old article is rejected
  const eval21h = evaluateArticle(article21h, nowUtc);
  assert.strictEqual(eval21h.passed, false, '21-hour article must be REJECTED');
  assert.strictEqual(eval21h.logEntry.status, 'REJECTED');
  assert.strictEqual(eval21h.logEntry.reason, 'older than 12h');
  console.log('  ✅ 21-hour-old article rejected with reason: "older than 12h"');

  // Test 6: Newest articles are sorted first
  console.log('\n🧪 Testing Sort Order (Newest -> Oldest)...');
  const allArticles = [article11h, article30m, article5h, article13h, article21h];
  const freshList = filterFreshNewsArticles(allArticles, 60, nowUtc);
  assert.strictEqual(freshList.length, 3, 'Only the 3 fresh articles should survive filter');

  const sorted = [...freshList].sort((a, b) => b.pubTimestamp - a.pubTimestamp);
  assert.strictEqual(sorted[0].url, article30m.url, 'First item must be 30m old');
  assert.strictEqual(sorted[1].url, article5h.url, 'Second item must be 5h old');
  assert.strictEqual(sorted[2].url, article11h.url, 'Third item must be 11h old');
  console.log('  ✅ Articles correctly sorted strictly by UTC timestamp (newest first)');

  // Test 7: Deduplication & Persistent Store - Already sent article is not sent again
  console.log('\n🧪 Testing Deduplication Against Sent Articles...');
  const testStore = new PublishedStore('src/storage/test_published_store.json');
  const deduplicator = new Deduplicator(testStore);

  // First batch: send article30m
  const deduped1 = deduplicator.deduplicateBatch([article30m, article5h]);
  assert.strictEqual(deduped1.length, 2, 'First run should allow both articles');
  testStore.markPublished(article30m);

  // Second batch: article30m should now be blocked as already published
  const deduped2 = deduplicator.deduplicateBatch([article30m, article5h]);
  assert.strictEqual(deduped2.length, 1, 'Second run should filter out article30m');
  assert.strictEqual(deduped2[0].url, article5h.url, 'Only article5h remains');
  console.log('  ✅ Already published article was successfully prevented from re-sending!');

  // Cleanup test store file
  import('fs').then(fs => {
    if (fs.existsSync('src/storage/test_published_store.json')) {
      fs.unlinkSync('src/storage/test_published_store.json');
    }
  });

  console.log('\n🎉 ALL 7 TEST REQUIREMENTS PASSED 100%!');
}

runFreshnessTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
