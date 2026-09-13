import { NewsAggregator } from '../providers/NewsAggregator.js';
import { filterFreshNewsArticles, parseUtcTimestamp, calculateAgeMinutes } from '../pipeline/filterEngine.js';
import { Deduplicator } from '../pipeline/deduplicator.js';
import { NewsClassifier } from '../pipeline/classifier.js';
import { PublishedStore } from '../storage/publishedStore.js';
import { formatStoryMessage } from '../bot/formatter.js';

export class NewsDeliveryPipeline {
  constructor(config) {
    this.config = config;
    this.aggregator = new NewsAggregator(config.newsApiKey);
    this.publishedStore = new PublishedStore();
    this.deduplicator = new Deduplicator(this.publishedStore);
    this.classifier = new NewsClassifier(config);
  }

  /**
   * Enforces the complete pipeline:
   * FETCH
   * → NORMALIZE
   * → REMOVE INVALID DATES
   * → REMOVE ARTICLES >12 HOURS OLD (and low signal)
   * → DEDUPLICATE
   * → SORT BY publishedAt DESC (newest first)
   * → RANK & SELECT
   * → SUMMARIZE
   * → SEND
   */
  async runCycle(maxToDeliver = 5) {
    const currentUtcMs = Date.now();
    console.log(`\n================== [Pipeline Cycle Start - UTC ${new Date(currentUtcMs).toISOString()}] ==================`);

    // 1. FETCH
    const rawStories = await this.aggregator.fetchAllCandidateStories();
    console.log(`[Pipeline] 1. Fetched ${rawStories.length} candidate stories across sources.`);

    // 2. NORMALIZE, REMOVE INVALID DATES, REMOVE ARTICLES >12 HOURS OLD
    console.log('[Pipeline] 2. Applying Hard 12-Hour Freshness & Signal Filter...');
    const freshStories = filterFreshNewsArticles(rawStories, this.config.minRelevanceScore || 60, currentUtcMs);
    console.log(`[Pipeline] Passed freshness & relevance filter: ${freshStories.length} articles.`);

    // 3. DEDUPLICATE against seen history & cluster overlapping coverage
    console.log('[Pipeline] 3. Deduplicating coverage & checking persistent history...');
    const dedupedStories = this.deduplicator.deduplicateBatch(freshStories);
    console.log(`[Pipeline] Unique unseen events remaining: ${dedupedStories.length}.`);

    // 4. SORT BY publishedAt DESC (strict UTC timestamp comparison, newest first)
    const sortedStories = [...dedupedStories].sort((a, b) => {
      const timeA = a.pubTimestamp || parseUtcTimestamp(a.publishedAt) || 0;
      const timeB = b.pubTimestamp || parseUtcTimestamp(b.publishedAt) || 0;
      return timeB - timeA;
    });

    // 5. RANK & SELECT: Send only fresh stories (if only 2 fresh stories, send 2)
    const toDeliver = sortedStories.slice(0, maxToDeliver);
    const messages = [];

    // 6. SUMMARIZE & CLASSIFY
    console.log(`[Pipeline] 5. Classifying and formatting ${toDeliver.length} top stories...`);
    for (const story of toDeliver) {
      try {
        const classification = await this.classifier.classifyAndSummarize(story);
        const html = formatStoryMessage(story, classification);

        messages.push({
          story,
          classification,
          html
        });

        // 7. PERSIST: Mark as published so it is NEVER sent again
        this.publishedStore.markPublished(story);
      } catch (err) {
        console.error(`[Pipeline] Error formatting story "${story.title}":`, err.message);
      }
    }

    console.log(`================== [Pipeline Cycle End - Delivered ${messages.length} Stories] ==================\n`);
    return messages;
  }

  /**
   * Helper for on-demand /latest command: returns top curated stories adhering to the 12-hour limit
   */
  async getLatestCuratedStories(count = 3) {
    const currentUtcMs = Date.now();
    const rawStories = await this.aggregator.fetchAllCandidateStories();
    const freshStories = filterFreshNewsArticles(rawStories, this.config.minRelevanceScore || 60, currentUtcMs);

    // In-memory deduplication for on-demand inspection
    const tempDeduplicator = new Deduplicator(null);
    const deduped = tempDeduplicator.deduplicateBatch(freshStories);

    // Sort newest first
    const sorted = [...deduped].sort((a, b) => {
      const timeA = a.pubTimestamp || parseUtcTimestamp(a.publishedAt) || 0;
      const timeB = b.pubTimestamp || parseUtcTimestamp(b.publishedAt) || 0;
      return timeB - timeA;
    });

    const results = [];
    for (const story of sorted.slice(0, count)) {
      const classification = await this.classifier.classifyAndSummarize(story);
      const html = formatStoryMessage(story, classification);
      results.push({ story, classification, html });
    }
    return results;
  }
}
