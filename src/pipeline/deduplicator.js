/**
 * Deduplication Engine
 * Identifies and clusters overlapping news coverage across outlets (e.g. Reuters, CoinDesk, CNBC)
 * so multiple articles on the same event produce ONLY ONE message.
 *
 * Uses:
 * 1. Normalized headline token similarity
 * 2. Financial entity extraction (e.g., Bitcoin ETFs, Federal Reserve, CPI)
 * 3. Semantic action overlap (inflows, rate cuts, lawsuits, etc.)
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was',
  'were', 'be', 'been', 'with', 'by', 'about', 'as', 'into', 'after', 'will', 'why', 'what',
  'how', 'this', 'that', 'from', 'stock', 'shares', 'stocks', 'today', 'price', 'here',
  'says', 'said', 'new', 'over', 'more', 'its', 'their', 'see', 'sees', 'record', 'amid',
  'fresh', 'recent', 'could', 'may', 'first', 'day', 'days', 'week', 'weeks'
]);

// Entity synonyms to harmonize coverage
const SYNONYMS = {
  'funds': 'etfs',
  'fund': 'etf',
  'etf': 'etfs',
  'inflow': 'inflows',
  'outflow': 'outflows',
  'strong': 'strongest',
  'fed': 'federal reserve',
  'powell': 'federal reserve',
  'rate': 'rates'
};

export function cleanHeadline(title) {
  if (!title) return '';
  return title
    .replace(/\s*-\s*[A-Za-z0-9\s.,&]+$/, '') // strip publisher ending like " - CoinDesk"
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function extractTokens(text) {
  return cleanHeadline(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => SYNONYMS[w] || w)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function extractEntities(text) {
  const lower = text.toLowerCase();
  const entities = new Set();

  if (lower.includes('bitcoin') || lower.includes('btc')) entities.add('BTC');
  if (lower.includes('ethereum') || lower.includes('eth')) entities.add('ETH');
  if (lower.includes('solana') || lower.includes('sol')) entities.add('SOL');
  if (lower.includes('etf') || lower.includes('funds')) entities.add('ETF');
  if (lower.includes('fed') || lower.includes('federal reserve') || lower.includes('powell')) entities.add('FED');
  if (lower.includes('inflation') || lower.includes('cpi') || lower.includes('ppi')) entities.add('INFLATION');
  if (lower.includes('interest rate') || lower.includes('rate cut') || lower.includes('rate hike')) entities.add('RATES');
  if (lower.includes('inflow') || lower.includes('outflow')) entities.add('FLOWS');
  if (lower.includes('sec') || lower.includes('cftc') || lower.includes('lawsuit')) entities.add('REGULATION');
  if (lower.includes('stablecoin') || lower.includes('tether') || lower.includes('usdc')) entities.add('STABLECOIN');

  return entities;
}

export function calculateStorySimilarity(articleA, articleB) {
  const tokensA = extractTokens(articleA.title);
  const tokensB = extractTokens(articleB.title);

  // 1. Jaccard word overlap
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  const wordSim = union === 0 ? 0 : intersection / union;

  // 2. Entity overlap
  const entA = extractEntities(articleA.title + ' ' + (articleA.description || ''));
  const entB = extractEntities(articleB.title + ' ' + (articleB.description || ''));
  let sharedEntities = 0;
  for (const e of entA) {
    if (entB.has(e)) sharedEntities++;
  }

  // If two articles share 2+ core financial entities (e.g. BTC + ETF + FLOWS) and have at least 1 shared word
  if (sharedEntities >= 2 && intersection >= 1) {
    return Math.max(wordSim, 0.45);
  }

  return wordSim;
}

export class Deduplicator {
  constructor(seenStore) {
    this.seenStore = seenStore;
  }

  deduplicateBatch(articles, similarityThreshold = 0.35) {
    const sorted = [...articles].sort((a, b) => {
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    const clusters = [];

    for (const article of sorted) {
      const cleaned = cleanHeadline(article.title);
      if (!cleaned || cleaned.length < 10) continue;

      if (this.seenStore && this.seenStore.hasBeenPublished(article)) {
        continue;
      }

      let matchedCluster = null;

      for (const cluster of clusters) {
        const sim = calculateStorySimilarity(article, cluster.leadArticle);
        if (sim >= similarityThreshold) {
          matchedCluster = cluster;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.relatedSources.push({
          source: article.source,
          url: article.url,
          title: article.title
        });
      } else {
        clusters.push({
          leadArticle: {
            ...article,
            title: cleaned
          },
          relatedSources: [{
            source: article.source,
            url: article.url,
            title: article.title
          }]
        });
      }
    }

    return clusters.map(c => ({
      ...c.leadArticle,
      relatedCoverageCount: c.relatedSources.length,
      allSources: c.relatedSources
    }));
  }
}
