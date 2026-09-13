import fs from 'fs';
import path from 'path';

export class SubscriptionStore {
  constructor(filePath) {
    this.filePath = filePath || path.resolve(process.cwd(), 'src/storage/subscribers.json');
    this.subscribers = new Set();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.subscribers = new Set(data);
        }
      }
    } catch (err) {
      console.warn('[SubscriptionStore] Error reading file:', err.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify([...this.subscribers], null, 2), 'utf-8');
    } catch (err) {
      console.warn('[SubscriptionStore] Error saving file:', err.message);
    }
  }

  add(chatId) {
    const id = String(chatId);
    if (!this.subscribers.has(id)) {
      this.subscribers.add(id);
      this.save();
      return true;
    }
    return false;
  }

  remove(chatId) {
    const id = String(chatId);
    if (this.subscribers.has(id)) {
      this.subscribers.delete(id);
      this.save();
      return true;
    }
    return false;
  }

  has(chatId) {
    return this.subscribers.has(String(chatId));
  }

  getAll() {
    return [...this.subscribers];
  }
}
