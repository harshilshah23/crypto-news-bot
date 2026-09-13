import { NewsAggregator } from '../providers/NewsAggregator.js';
import { filterNewsArticles } from '../pipeline/filterEngine.js';
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
   * Runs one full cycle of Find -> Filter -> Deduplicate -> Classify -> Format
   * Returns formatted messages ready to broadcast.
   */
  async runCycle(maxToDeliver = 5) {
    console.log('[Pipeline] 1. Finding candidate stories across NewsAPI and RSS...');
    const rawStories = await this.aggregator.fetchAllCandidateStories();
    console.log(`[Pipeline] Retrieved ${rawStories.length} total candidate articles.`);

    console.log('[Pipeline] 2. Filtering low-signal / clickbait / spam / off-topic news...');
    const filteredStories = filterNewsArticles(rawStories, this.config.minRelevanceScore);
    console.log(`[Pipeline] Filter passed ${filteredStories.length} high-signal stories.`);

    console.log('[Pipeline] 3. Deduplicating coverage across outlets & checking history...');
    const deduplicatedStories = this.deduplicator.deduplicateBatch(filteredStories);
    console.log(`[Pipeline] Deduplicated into ${deduplicatedStories.length} unique new stories.`);

    const toProcess = deduplicatedStories.slice(0, maxToDeliver);
    const messages = [];

    console.log(`[Pipeline] 4. Classifying bias and summarizing ${toProcess.length} top stories...`);
    for (const story of toProcess) {
      try {
        const classification = await this.classifier.classifyAndSummarize(story);
        const html = formatStoryMessage(story, classification);

        messages.push({
          story,
          classification,
          html
        });

        // Mark as published so it will not be sent again in future cycles
        this.publishedStore.markPublished(story);
      } catch (err) {
        console.error(`[Pipeline] Error processing story "${story.title}":`, err.message);
      }
    }

    return messages;
  }

  /**
   * Helper for on-demand /latest command: returns top 3 recent stories without marking as published
   */
  async getLatestCuratedStories(count = 3) {
    const rawStories = await this.aggregator.fetchAllCandidateStories();
    const filtered = filterNewsArticles(rawStories, this.config.minRelevanceScore);
    // Temporary deduplication without state check
    const tempDeduplicator = new Deduplicator(null);
    const deduped = tempDeduplicator.deduplicateBatch(filtered);

    const results = [];
    for (const story of deduped.slice(0, count)) {
      const classification = await this.classifier.classifyAndSummarize(story);
      const html = formatStoryMessage(story, classification);
      results.push({ story, classification, html });
    }
    return results;
  }
}
