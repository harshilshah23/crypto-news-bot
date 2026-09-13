import { NewsApiProvider } from './NewsApiProvider.js';
import { RssFallbackProvider } from './RssFallbackProvider.js';

export class NewsAggregator {
  constructor(apiKey) {
    this.primaryProvider = new NewsApiProvider(apiKey);
    this.fallbackProvider = new RssFallbackProvider();
  }

  async fetchAllCandidateStories() {
    let stories = [];

    // 1. Try primary provider (NewsAPI)
    if (this.primaryProvider.isAvailable()) {
      try {
        const primaryStories = await this.primaryProvider.fetchLatestStories();
        if (primaryStories.length > 0) {
          stories.push(...primaryStories);
        }
      } catch (err) {
        console.warn('[Aggregator] Primary provider encountered error:', err.message);
      }
    }

    // 2. Supplement or fallback with RSS feeds (ensures coverage and backup if rate limited)
    try {
      const rssStories = await this.fallbackProvider.fetchLatestStories();
      if (rssStories.length > 0) {
        stories.push(...rssStories);
      }
    } catch (err) {
      console.warn('[Aggregator] RSS provider encountered error:', err.message);
    }

    return stories;
  }
}
