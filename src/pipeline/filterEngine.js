/**
 * Relevance & Signal Filter Engine with Strict UTC Freshness
 * Rejects low-value noise: clickbait, SEO spam, meme coin shilling, price predictions, irrelevant stocks, and STALE articles.
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
  'defi', 'binance', 'coinbase', 'blackrock', 'fidelity',
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

/**
 * Parses any publication date into a valid UTC timestamp.
 * Returns null if the date is missing or invalid.
 */
export function parseUtcTimestamp(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  const time = d.getTime();
  if (isNaN(time)) return null;
  return time;
}

/**
 * Calculates age in minutes from the current UTC time.
 */
export function calculateAgeMinutes(pubTimestamp, currentUtcMs = Date.now()) {
  if (!pubTimestamp) return null;
  const diffMs = currentUtcMs - pubTimestamp;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Calculates relevance score and enforces hard UTC freshness (<= 12 hours / 720 minutes)
 */
export function evaluateArticle(article, currentUtcMs = Date.now()) {
  const source = article.source || 'Unknown';
  const headline = article.title || '';
  const pubTimestamp = parseUtcTimestamp(article.publishedAt);

  // 1. Validate date
  if (!pubTimestamp) {
    const logEntry = {
      source,
      headline,
      publishedAt: article.publishedAt,
      ageMinutes: null,
      status: 'REJECTED',
      reason: 'Invalid or missing publication date'
    };
    return { passed: false, score: 0, ageMinutes: null, pubTimestamp: null, logEntry };
  }

  const ageMinutes = calculateAgeMinutes(pubTimestamp, currentUtcMs);

  // 2. HARD FRESHNESS FILTER: <= 12 hours (720 minutes)
  if (ageMinutes > 720) {
    const logEntry = {
      source,
      headline,
      publishedAt: new Date(pubTimestamp).toISOString(),
      ageMinutes,
      status: 'REJECTED',
      reason: 'older than 12h'
    };
    return { passed: false, score: 0, ageMinutes, pubTimestamp, logEntry };
  }

  // 3. Spam / Clickbait / Prediction patterns
  const title = headline.toLowerCase();
  const desc = (article.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(title) || pattern.test(desc)) {
      const logEntry = {
        source,
        headline,
        publishedAt: new Date(pubTimestamp).toISOString(),
        ageMinutes,
        status: 'REJECTED',
        reason: `Matches noise pattern: ${pattern.toString()}`
      };
      return { passed: false, score: 0, ageMinutes, pubTimestamp, logEntry };
    }
  }

  // 4. Entity matching
  let cryptoHits = 0;
  for (const kw of HIGH_SIGNAL_CRYPTO_KEYWORDS) {
    if (text.includes(kw)) cryptoHits++;
  }

  let macroHits = 0;
  for (const kw of HIGH_SIGNAL_MACRO_KEYWORDS) {
    if (text.includes(kw)) macroHits++;
  }

  if (cryptoHits === 0 && macroHits === 0) {
    const logEntry = {
      source,
      headline,
      publishedAt: new Date(pubTimestamp).toISOString(),
      ageMinutes,
      status: 'REJECTED',
      reason: 'No crypto or relevant macro keywords found'
    };
    return { passed: false, score: 0, ageMinutes, pubTimestamp, logEntry };
  }

  // 5. Score calculation
  let score = 20;
  score += Math.min(cryptoHits * 15, 45);
  score += Math.min(macroHits * 15, 30);

  // Freshness priority ranking:
  // 0–2 hours (0–120m) = highest priority (+25 pts)
  // 2–6 hours (120–360m) = high priority (+15 pts)
  // 6–12 hours (360–720m) = acceptable (+5 pts)
  if (ageMinutes <= 120) {
    score += 25;
  } else if (ageMinutes <= 360) {
    score += 15;
  } else {
    score += 5;
  }

  // Event bonus
  if (
    /etf (inflows|outflows|demand|records|surpass|approval)/i.test(text) ||
    /spot (bitcoin|ethereum) etf/i.test(text) ||
    /sec (approves|rejects|lawsuit|settles|dismisses)/i.test(text) ||
    /(rate cut|rate hike|fomc decision|cpi prints|cpi rises|cpi falls)/i.test(text) ||
    /treasury bill|tokenized bond/i.test(text)
  ) {
    score += 20;
  }

  // Reputable source bonus
  const srcLower = source.toLowerCase();
  for (const rep of REPUTABLE_SOURCES) {
    if (srcLower.includes(rep)) {
      score += 15;
      break;
    }
  }

  score = Math.min(score, 100);

  const passed = score >= 60;
  const logEntry = {
    source,
    headline,
    publishedAt: new Date(pubTimestamp).toISOString(),
    ageMinutes,
    status: passed ? 'FRESH' : 'REJECTED',
    reason: passed ? `Passed filter (score: ${score})` : `Score ${score} below threshold 60`
  };

  return { passed, score, ageMinutes, pubTimestamp, logEntry };
}

/**
 * Filter, log, and return only verified fresh high-signal articles
 */
export function filterFreshNewsArticles(articles, minScore = 60, currentUtcMs = Date.now()) {
  const passed = [];

  for (const article of articles) {
    const evaluation = evaluateArticle(article, currentUtcMs);
    const { logEntry } = evaluation;

    // Structured internal debug logging
    console.log(`[NEWS] ${logEntry.source} | ${logEntry.headline}`);
    console.log(`publishedAt: ${logEntry.publishedAt || 'N/A'}`);
    console.log(`age: ${logEntry.ageMinutes !== null ? logEntry.ageMinutes + ' minutes' : 'UNKNOWN'}`);
    console.log(`status: ${logEntry.status}`);
    if (logEntry.status === 'REJECTED') {
      console.log(`reason: ${logEntry.reason}`);
    }
    console.log(''); // newline

    if (evaluation.passed && evaluation.score >= minScore) {
      passed.push({
        ...article,
        relevanceScore: evaluation.score,
        ageMinutes: evaluation.ageMinutes,
        pubTimestamp: evaluation.pubTimestamp
      });
    }
  }

  return passed;
}
