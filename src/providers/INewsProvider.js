/**
 * INewsProvider interface representation
 * Every news provider must implement:
 *   getName(): string
 *   isAvailable(): boolean
 *   fetchLatestStories(): Promise<Array<{
 *     id: string,
 *     title: string,
 *     description: string,
 *     content?: string,
 *     url: string,
 *     source: string,
 *     publishedAt: string | Date
 *   }>>
 */
export class INewsProvider {
  getName() {
    throw new Error('getName() must be implemented');
  }

  isAvailable() {
    return true;
  }

  async fetchLatestStories() {
    throw new Error('fetchLatestStories() must be implemented');
  }
}
