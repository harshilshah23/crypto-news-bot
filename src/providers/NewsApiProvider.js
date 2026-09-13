import { INewsProvider } from './INewsProvider.js';

export class NewsApiProvider extends INewsProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = 'https://newsapi.org/v2/everything';
    // Balanced queries covering Crypto, Macro, and Financial Markets affecting Crypto
    this.queries = [
      'bitcoin OR ethereum OR crypto OR "spot ETF" OR stablecoin OR DeFi OR solana',
      '"Federal Reserve" OR "interest rates" OR CPI OR inflation OR "Treasury yields" OR DXY'
    ];
  }

  getName() {
    return 'NewsAPI';
  }

  isAvailable() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async fetchLatestStories() {
    if (!this.isAvailable()) return [];

    const allArticles = [];
    const seenUrls = new Set();

    for (const query of this.queries) {
      try {
        // Explicitly sort by publishedAt and retrieve 30 items per query
        const url = `${this.baseUrl}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${encodeURIComponent(this.apiKey)}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'CryptoMarketNewsBot/1.0' },
          signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) {
          console.warn(`[NewsAPI] Request failed with status ${res.status} for query: ${query}`);
          continue;
        }

        const data = await res.json();
        if (data.status === 'ok' && Array.isArray(data.articles)) {
          for (const item of data.articles) {
            if (!item.title || !item.url || seenUrls.has(item.url)) continue;
            // Filter out [Removed] items returned by NewsAPI
            if (item.title === '[Removed]' || item.description === '[Removed]') continue;

            seenUrls.add(item.url);
            allArticles.push({
              id: `newsapi:${item.url}`,
              title: item.title,
              description: item.description || '',
              content: item.content || '',
              url: item.url,
              source: item.source?.name || 'NewsAPI',
              publishedAt: item.publishedAt || new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.warn(`[NewsAPI] Error fetching query "${query}":`, err.message);
      }
    }

    return allArticles;
  }
}
