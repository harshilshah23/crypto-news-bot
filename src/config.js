import dotenv from 'dotenv';
dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  newsApiKey: process.env.NEWS_API_KEY || '',
  newsChannelId: process.env.NEWS_CHANNEL_ID || '',
  pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '180', 10),
  minRelevanceScore: parseInt(process.env.MIN_RELEVANCE_SCORE || '65', 10),
  maxArticleAgeMinutes: parseInt(process.env.MAX_ARTICLE_AGE_MINUTES || '60', 10), // Strict 1 hour (60 min)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash-fin:free',
  port: parseInt(process.env.PORT || '3000', 10),
};
