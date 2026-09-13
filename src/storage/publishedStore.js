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
            if (item.url) this.publishedUrls.add(item.url);
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

  generateSignature(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 40);
  }

  hasBeenPublished(article) {
    if (this.publishedUrls.has(article.url)) return true;
    const sig = this.generateSignature(article.title);
    if (this.publishedSignatures.has(sig)) return true;
    return false;
  }

  markPublished(article) {
    const sig = this.generateSignature(article.title);
    this.publishedUrls.add(article.url);
    this.publishedSignatures.add(sig);

    this.history.push({
      url: article.url,
      title: article.title,
      sig,
      publishedAt: new Date().toISOString()
    });

    // Prune history older than 7 days or keep last 1,000 items
    if (this.history.length > 1000) {
      this.history = this.history.slice(-800);
      this.publishedUrls = new Set(this.history.map(h => h.url));
      this.publishedSignatures = new Set(this.history.map(h => h.sig));
    }

    this.save();
  }
}
