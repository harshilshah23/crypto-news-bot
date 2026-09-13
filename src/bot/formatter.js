/**
 * Telegram Message Formatter
 * Formats curated news stories matching the exact required product spec:
 *
 * 🟢 BULLISH
 *
 * Headline
 *
 * 1–3 sentence summary
 *
 * ⚡ Why it matters:
 * Short explanation of the bias
 *
 * 📰 Source · 18 min ago
 *
 * Read the full story →
 */

export function formatTimeAgo(dateInput) {
  if (!dateInput) return 'recently';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'recently';

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';

  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 60) {
    return `${Math.max(1, diffMin)} min ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatStoryMessage(story, classification) {
  const bias = classification.bias; // e.g. 🟢 BULLISH
  const headline = escapeHtml(story.title);
  const summary = escapeHtml(classification.summary);
  const whyItMatters = escapeHtml(classification.whyItMatters);
  const source = escapeHtml(story.source || 'Market News');
  const timeAgo = formatTimeAgo(story.publishedAt);
  const fullArticleUrl = story.url;

  return (
    `<b>${bias}</b>\n\n` +
    `<b>${headline}</b>\n\n` +
    `${summary}\n\n` +
    `⚡ <b>Why it matters:</b>\n` +
    `${whyItMatters}\n\n` +
    `📰 ${source} · ${timeAgo}\n\n` +
    `<a href="${fullArticleUrl}">Read the full story →</a>`
  );
}
