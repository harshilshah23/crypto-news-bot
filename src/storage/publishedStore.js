import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class PublishedStore {
  constructor(storageFilePath) {
    this.filePath = storageFilePath || path.resolve(process.cwd(), 'src/storage/published_history.json');
    this.publishedUrls = new Set();
    this.publishedSignatures = new Set();
    this.history = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.history = data;
          for (const item of data) {
            if (item.url) this.publishedUrls.add(item.canonicalUrl || item.url);
            if (item.sig) this.publishedSignatures.add(item.sig);
          }
        }
      }
    } catch (err) {
      console.warn('[PublishedStore] Error reading storage file:', err.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[PublishedStore] Error writing storage file:', err.message);
    }
  }

  /**
   * Normalizes canonical URL (strips tracking query params)
   */
  getCanonicalUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      // Strip Google News RSS redirect wrappers or common tracking params
      parsed.searchParams.delete('utm_source');
      parsed.searchParams.delete('utm_medium');
      parsed.searchParams.delete('utm_campaign');
      parsed.searchParams.delete('oc');
      return parsed.origin + parsed.pathname;
    } catch (e) {
      return url.split('?')[0].trim();
    }
  }

  /**
   * Generates a stable hash based on normalized headline + source
   */
  generateSignature(title, source = '') {
    const normalized = `${(title || '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${(source || '').toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }

  hasBeenPublished(article) {
    const canonical = this.getCanonicalUrl(article.url);
    if (canonical && this.publishedUrls.has(canonical)) return true;
    if (article.url && this.publishedUrls.has(article.url)) return true;

    const sig = this.generateSignature(article.title, article.source);
    if (this.publishedSignatures.has(sig)) return true;

    return false;
  }

  markPublished(article) {
    const canonical = this.getCanonicalUrl(article.url);
    const sig = this.generateSignature(article.title, article.source);

    if (canonical) this.publishedUrls.add(canonical);
    if (article.url) this.publishedUrls.add(article.url);
    this.publishedSignatures.add(sig);

    this.history.push({
      canonicalUrl: canonical || article.url,
      title: article.title,
      source: article.source,
      sig,
      publishedAt: article.publishedAt,
      recordedAt: new Date().toISOString()
    });

    // Prune history older than 7 days or keep last 1,000 items
    if (this.history.length > 1000) {
      this.history = this.history.slice(-800);
      this.publishedUrls = new Set(this.history.map(h => h.canonicalUrl || h.url));
      this.publishedSignatures = new Set(this.history.map(h => h.sig));
    }

    this.save();
  }
}
