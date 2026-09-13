/**
 * Relevance & Signal Filter Engine
 * Rejects low-value noise: clickbait, SEO spam, meme coin shilling, price predictions, irrelevant stocks.
 */

// Low-value spam / clickbait patterns that should be immediately rejected
const REJECT_PATTERNS = [
  /price prediction/i,
  /here'?s why/i,
  /why is .* (dropping|crashing|surging|pumping|down today|up today)\??$/i,
  /3 (meme coins|altcoins|cryptos) to buy/i,
  /top \d+ (coins|cryptos|tokens) to/i,
  /could hit \$?\d+/i,
  /will .* reach \$?\d+/i,
  /next 100x/i,
  /next 10x/i,
  /presale/i,
  /airdrop/i,
  /memecoin/i,
  /meme coin/i,
  /shiba inu/i,
  /dogecoin.*to the moon/i,
  /pepe.*rally/i,
  /analyst predicts/i,
  /expert says/i,
  /is it time to buy/i,
  /should you invest/i,
  /fortune teller/i,
  /zodiac/i,
  /get rich/i,
  /sponsored/i,
  /promoted/i,
  /press release/i,
  /wire service/i,
  /lottery/i,
  /casino/i,
  /gambling/i,
  /robinhood penny stock/i,
  /motley fool/i
];

// High-signal keywords: Crypto core, institutional adoption, macro, regulation, liquidity
const HIGH_SIGNAL_CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'etf', 'etfs',
  'inflows', 'outflows', 'sec', 'cftc', 'stablecoin', 'usdt', 'usdc',
  'defi', 'binance', 'coinbase', 'blackrock', 'fidelity', 'fidelity',
  'grayscale', 'tether', 'circle', 'microstrategy', 'tokenized', 'tokenization',
  'custody', 'liquidity', 'validator', 'layer 2', 'treasury', 'reserves'
];

const HIGH_SIGNAL_MACRO_KEYWORDS = [
  'federal reserve', 'fed', 'jerome powell', 'rate cut', 'rate hike',
  'interest rates', 'cpi', 'ppi', 'inflation', 'treasury yields',
  '10-year yield', 'dxy', 'dollar index', 'unemployment', 'jobs report',
  'nonfarm payrolls', 'fomc', 'monetary policy', 'quantitative easing', 'qt'
];

const REPUTABLE_SOURCES = new Set([
  'reuters', 'bloomberg', 'coindesk', 'cointelegraph', 'cnbc', 'the block',
  'financial times', 'wsj', 'wall street journal', 'barron\'s', 'forbes',
  'decrypt', 'dl news', 'marketwatch', 'associated press', 'ap news'
]);

export function calculateRelevanceScore(article) {
  const title = (article.title || '').toLowerCase();
  const desc = (article.description || '').toLowerCase();
  const text = `${title} ${desc}`;
  const source = (article.source || '').toLowerCase();

  // 1. Immediate rejection check (Spam / Clickbait / Price Predictions)
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(title) || pattern.test(desc)) {
      return { score: 0, reason: `Matches noise pattern: ${pattern.toString()}` };
    }
  }

  // 2. Max age check (must be fresh within 24 hours)
  if (article.publishedAt) {
    const pubTime = new Date(article.publishedAt).getTime();
    if (!isNaN(pubTime)) {
      const ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
      if (ageHours > 24) {
        return { score: 0, reason: 'Too old (>24 hours)' };
      }
    }
  }

  let score = 20; // Base score

  // 3. Check Crypto entity signals
  let cryptoHits = 0;
  for (const kw of HIGH_SIGNAL_CRYPTO_KEYWORDS) {
    if (text.includes(kw)) cryptoHits++;
  }

  // 4. Check Macro entity signals
  let macroHits = 0;
  for (const kw of HIGH_SIGNAL_MACRO_KEYWORDS) {
    if (text.includes(kw)) macroHits++;
  }

  if (cryptoHits === 0 && macroHits === 0) {
    return { score: 10, reason: 'No crypto or relevant macro keywords found' };
  }

  // Add points for entity strength
  score += Math.min(cryptoHits * 15, 45);
  score += Math.min(macroHits * 15, 30);

  // Bonus for High-Impact events: ETF inflows, Fed policy, regulatory decisions
  if (
    /etf (inflows|outflows|demand|records|surpass|approval)/i.test(text) ||
    /spot (bitcoin|ethereum) etf/i.test(text) ||
    /sec (approves|rejects|lawsuit|settles|dismisses)/i.test(text) ||
    /(rate cut|rate hike|fomc decision|cpi prints|cpi rises|cpi falls)/i.test(text) ||
    /treasury bill|tokenized bond/i.test(text)
  ) {
    score += 25;
  }

  // Source Reputation Bonus
  for (const repSource of REPUTABLE_SOURCES) {
    if (source.includes(repSource)) {
      score += 15;
      break;
    }
  }

  // Cap score at 100
  return { score: Math.min(score, 100), reason: `CryptoHits: ${cryptoHits}, MacroHits: ${macroHits}` };
}

export function filterNewsArticles(articles, minScore = 65) {
  const passed = [];

  for (const article of articles) {
    const { score, reason } = calculateRelevanceScore(article);
    if (score >= minScore) {
      passed.push({
        ...article,
        relevanceScore: score,
        filterReason: reason
      });
    }
  }

  return passed;
}
