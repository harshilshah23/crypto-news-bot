import assert from 'assert';
import { evaluateArticle, filterFreshNewsArticles } from '../src/pipeline/filterEngine.js';
import { Deduplicator, cleanHeadline, extractTokens } from '../src/pipeline/deduplicator.js';
import { NewsClassifier } from '../src/pipeline/classifier.js';
import { formatStoryMessage } from '../src/bot/formatter.js';

async function runTests() {
  console.log('🧪 Running Suite 1: Anti-Spam & Relevance Filtering Tests...');

  const clickbaitTest = {
    title: 'Top 3 Meme Coins to Buy Before They 100x This Weekend',
    description: 'Shiba Inu and Pepe coin to the moon.',
    publishedAt: new Date().toISOString()
  };
  const clickbaitEval = evaluateArticle(clickbaitTest);
  assert.strictEqual(clickbaitEval.passed, false, 'Clickbait should not pass');
  console.log('  ✅ Clickbait and meme shilling correctly rejected (Score: 0)');

  const genericPredictionTest = {
    title: 'Bitcoin Price Prediction: Analyst Predicts BTC Will Reach $200k',
    description: 'Expert says is it time to buy right now.',
    publishedAt: new Date().toISOString()
  };
  const predictionEval = evaluateArticle(genericPredictionTest);
  assert.strictEqual(predictionEval.passed, false, 'Generic price prediction spam should be rejected');
  console.log('  ✅ Generic price prediction spam correctly rejected');

  const highSignalEtfTest = {
    title: 'Spot Bitcoin ETFs See Strongest Inflows in Weeks',
    description: 'Spot Bitcoin ETFs recorded strong inflows, pointing to renewed institutional demand as BTC trades near recent highs.',
    source: 'CoinDesk',
    url: 'https://coindesk.com/etf-test',
    publishedAt: new Date().toISOString()
  };
  const etfEval = evaluateArticle(highSignalEtfTest);
  assert.ok(etfEval.passed && etfEval.score >= 70, `High-signal ETF story should pass and score >= 70, got ${etfEval.score}`);
  console.log(`  ✅ High-signal institutional ETF story passed with score: ${etfEval.score}`);

  const macroFedStory = {
    title: 'Fed Officials Push Back Against Near-Term Rate Cuts',
    description: 'Several Fed officials signaled that inflation remains a concern, reducing expectations for an imminent easing cycle.',
    source: 'Reuters',
    url: 'https://reuters.com/fed-test',
    publishedAt: new Date().toISOString()
  };
  const fedEval = evaluateArticle(macroFedStory);
  assert.ok(fedEval.passed && fedEval.score >= 60, `High-signal Fed macro story should pass and score >= 60, got ${fedEval.score}`);
  console.log(`  ✅ High-signal Federal Reserve macro story passed with score: ${fedEval.score}`);

  console.log('\n🧪 Running Suite 2: Multi-Source Deduplication & Clustering Tests...');

  const simulatedCoverage = [
    {
      title: 'Bitcoin ETFs See Strongest Inflows in Weeks - Reuters',
      source: 'Reuters',
      url: 'https://reuters.com/article1',
      publishedAt: new Date().toISOString(),
      relevanceScore: 85
    },
    {
      title: 'Spot Bitcoin ETFs Attract Fresh Institutional Demand - CoinDesk',
      source: 'CoinDesk',
      url: 'https://coindesk.com/article2',
      publishedAt: new Date().toISOString(),
      relevanceScore: 80
    },
    {
      title: 'Bitcoin Funds Record Strong Inflows - CNBC',
      source: 'CNBC',
      url: 'https://cnbc.com/article3',
      publishedAt: new Date().toISOString(),
      relevanceScore: 75
    },
    {
      title: 'Federal Reserve Holds Interest Rates Steady Amid Sticky Inflation',
      source: 'Bloomberg',
      url: 'https://bloomberg.com/article4',
      publishedAt: new Date().toISOString(),
      relevanceScore: 90
    }
  ];

  const deduplicator = new Deduplicator(null);
  const deduped = deduplicator.deduplicateBatch(simulatedCoverage);

  assert.strictEqual(deduped.length, 2, `Expected 2 distinct events (1 ETF cluster + 1 Fed event), got ${deduped.length}`);
  const etfCluster = deduped.find(d => d.title.includes('Bitcoin ETF') || d.title.includes('Inflows'));
  assert.ok(etfCluster, 'ETF cluster should exist');
  assert.strictEqual(etfCluster.relatedCoverageCount, 3, 'All 3 overlapping ETF headlines should be clustered into one');
  console.log(`  ✅ Successfully collapsed 3 overlapping Reuters/CoinDesk/CNBC stories into 1 single event alert!`);

  console.log('\n🧪 Running Suite 3: Market Bias Classification & Output Formatting Tests...');

  const classifier = new NewsClassifier({});
  const bullishClassification = await classifier.classifyAndSummarize(highSignalEtfTest);
  assert.strictEqual(bullishClassification.biasType, 'BULLISH', 'ETF inflows should be classified as BULLISH');
  assert.strictEqual(bullishClassification.bias, '🟢 BULLISH');
  console.log(`  ✅ Bullish classification verified: ${bullishClassification.bias}`);

  const bearishClassification = await classifier.classifyAndSummarize(macroFedStory);
  assert.strictEqual(bearishClassification.biasType, 'BEARISH', 'Higher-for-longer rate pushback should be classified as BEARISH');
  assert.strictEqual(bearishClassification.bias, '🔴 BEARISH');
  console.log(`  ✅ Bearish classification verified: ${bearishClassification.bias}`);

  const formattedMsg = formatStoryMessage(highSignalEtfTest, bullishClassification);
  console.log('\n--- Output Telegram Message Sample ---');
  console.log(formattedMsg.replace(/<[^>]*>/g, ''));
  console.log('--------------------------------------');

  assert.ok(formattedMsg.includes('🟢 BULLISH'));
  assert.ok(formattedMsg.includes('⚡ <b>Why it matters:</b>'));
  assert.ok(formattedMsg.includes('📰 CoinDesk ·'));
  assert.ok(formattedMsg.includes('Read the full story →'));

  console.log('\n🎉 ALL UNIT & INTEGRATION TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
