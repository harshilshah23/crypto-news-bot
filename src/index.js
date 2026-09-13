import http from 'http';
import { createNewsBot, runMonitoringLoop } from './bot/bot.js';
import { config } from './config.js';

async function main() {
  console.log('🚀 Launching Crypto Market News Telegram Bot...');
  console.log('   "The news you need. Without the noise."');

  const botInstance = createNewsBot();
  if (!botInstance) {
    process.exit(1);
  }

  const { bot, pipeline, subscriptionStore } = botInstance;

  // Lightweight healthcheck server
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'crypto-market-news-telegram-bot',
      status: 'active',
      subscribers: subscriptionStore.getAll().length,
      pollInterval: `${config.pollIntervalSeconds}s`
    }));
  });

  server.listen(config.port, () => {
    console.log(`🌐 Healthcheck endpoint listening on port ${config.port}`);
  });

  try {
    const me = await bot.api.getMe();
    console.log(`✅ Connected to Telegram as @${me.username} (${me.first_name})`);
  } catch (err) {
    console.error('❌ Failed to connect to Telegram:', err.message);
    process.exit(1);
  }

  // Start continuous monitoring and broadcasting loop
  runMonitoringLoop(bot, pipeline, subscriptionStore);

  // Start receiving user commands
  await bot.start();
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
