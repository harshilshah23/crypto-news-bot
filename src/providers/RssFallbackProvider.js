import { XMLParser } from 'fast-xml-parser';
import { INewsProvider } from './INewsProvider.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

export class RssFallbackProvider extends INewsProvider {
  constructor() {
    super();
    this.feeds = [
      {
        name: 'CoinDesk RSS',
        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        defaultSource: 'CoinDesk'
      },
      {
        name: 'Google News - Crypto Market',
        url: 'https://news.google.com/rss/search?q=crypto+market+bitcoin+ethereum&hl=en-US&gl=US&ceid=US:en',
        defaultSource: 'Google News'
      },
      {
        name: 'Google News - Federal Reserve Inflation',
        url: 'https://news.google.com/rss/search?q=Federal+Reserve+interest+rates+inflation&hl=en-US&gl=US&ceid=US:en',
        defaultSource: 'Google News'
      },
      {
        name: 'Yahoo Finance Crypto RSS',
        url: 'https://finance.yahoo.com/news/rssindex',
        defaultSource: 'Yahoo Finance'
      }
    ];
  }

  getName() {
    return 'RSS Fallback';
  }

  isAvailable() {
    return true;
  }

  async fetchLatestStories() {
    const stories = [];
    const seenUrls = new Set();

    for (const feed of this.feeds) {
      try {
        const res = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) continue;

        const xml = await res.text();
        const parsed = xmlParser.parse(xml);
        const channel = parsed?.rss?.channel || parsed?.feed;
        if (!channel) continue;

        const rawItems = channel.item || channel.entry || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];

        for (const item of items) {
          const title = (item.title?.['#text'] || item.title || '').toString().trim();
          let link = (item.link?.['@_href'] || item.link || '').toString().trim();
          if (typeof link === 'object' && link['#text']) link = link['#text'];

          if (!title || !link || seenUrls.has(link)) continue;
          seenUrls.add(link);

          let sourceName = feed.defaultSource;
          if (typeof item.source === 'string') {
            sourceName = item.source;
          } else if (item.source && item.source['#text']) {
            sourceName = item.source['#text'];
          } else if (title.includes(' - ')) {
            const parts = title.split(' - ');
            sourceName = parts[parts.length - 1].trim();
          }

          const description = (item.description || item.summary || '').toString().replace(/<[^>]*>/g, '').trim();
          const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();

          stories.push({
            id: `rss:${link}`,
            title,
            description,
            url: link,
            source: sourceName,
            publishedAt: pubDate
          });
        }
      } catch (err) {
        // Continue with other feeds if one times out or errors
      }
    }

    return stories;
  }
}
