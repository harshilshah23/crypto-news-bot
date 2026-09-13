import { Bot } from 'grammy';
import { config } from '../config.js';
import { NewsDeliveryPipeline } from '../pipeline/pipeline.js';
import { SubscriptionStore } from '../storage/subscriptionStore.js';

export function createNewsBot() {
  if (!config.telegramBotToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing. Please check .env file.');
    return null;
  }

  const bot = new Bot(config.telegramBotToken);
  const pipeline = new NewsDeliveryPipeline(config);
  const subscriptionStore = new SubscriptionStore();

  // /start command
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    subscriptionStore.add(chatId);

    const welcome =
      `🟢 <b>Crypto Market News</b>\n\n` +
      `<i>"The news you need. Without the noise."</i>\n\n` +
      `You are subscribed to high-signal crypto and financial-market news alerts.\n\n` +
      `Every alert includes:\n` +
      `• Clear Market Bias (🟢 Bullish / 🔴 Bearish / ⚪ Neutral)\n` +
      `• 1–3 sentence editorial summary\n` +
      `• ⚡ Why it matters (institutional market impact)\n` +
      `• Direct source attribution and article link\n\n` +
      `<b>Commands:</b>\n` +
      `• <code>/latest</code> — Get the top 3 latest curated stories immediately\n` +
      `• <code>/status</code> — Check your subscription status\n` +
      `• <code>/stop</code> — Unsubscribe from real-time alerts`;

    await ctx.reply(welcome, { parse_mode: 'HTML', disable_web_page_preview: true });
  });

  // /latest command - delivers top curated stories immediately
  bot.command('latest', async (ctx) => {
    const loadingMsg = await ctx.reply('🔍 <i>Curating the latest high-signal crypto and market news...</i>', {
      parse_mode: 'HTML'
    });

    try {
      const latest = await pipeline.getLatestCuratedStories(3);
      await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

      if (latest.length === 0) {
        return ctx.reply('<i>No major breaking market news at this exact moment. Monitoring active.</i>', {
          parse_mode: 'HTML'
        });
      }

      for (const item of latest) {
        await ctx.reply(item.html, {
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });
      }
    } catch (err) {
      console.error('[Bot] Error handling /latest:', err.message);
      await ctx.reply('⚠️ <i>Unable to fetch latest news right now. Please try again in a few moments.</i>', {
        parse_mode: 'HTML'
      });
    }
  });

  // /status command
  bot.command('status', async (ctx) => {
    const isSubscribed = subscriptionStore.has(ctx.chat.id);
    const text =
      `📡 <b>Market News Monitor Status</b>\n\n` +
      `• Subscribed: <b>${isSubscribed ? 'YES (Active)' : 'NO'}</b>\n` +
      `• Primary Provider: <b>NewsAPI (Active)</b>\n` +
      `• Fallbacks: <b>CoinDesk, Google News, Yahoo Finance RSS</b>\n` +
      `• Update Frequency: <b>Every ${config.pollIntervalSeconds} seconds</b>\n` +
      `• Deduplication & Anti-Spam: <b>Enabled</b>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // /stop or /unsubscribe
  bot.command(['stop', 'unsubscribe'], async (ctx) => {
    subscriptionStore.remove(ctx.chat.id);
    await ctx.reply('⏸ <i>You have unsubscribed from real-time news alerts. Send /start anytime to resubscribe.</i>', {
      parse_mode: 'HTML'
    });
  });

  // Reject any ticker or terminal commands to maintain 100% laser focus
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      // Unrecognized command
      return ctx.reply(
        `ℹ️ <i>This bot's only purpose is continuous crypto & financial-market news.</i>\n\n` +
        `Send <code>/latest</code> to see recent stories or <code>/start</code> to manage subscription.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  return {
    bot,
    pipeline,
    subscriptionStore
  };
}

export async function runMonitoringLoop(bot, pipeline, subscriptionStore) {
  console.log(`📡 Starting continuous news monitoring loop (Interval: ${config.pollIntervalSeconds}s)...`);

  const pollAndBroadcast = async () => {
    try {
      const messages = await pipeline.runCycle(3);
      if (messages.length === 0) {
        console.log(`[Monitor] Cycle complete at ${new Date().toLocaleTimeString()} - No new unseen high-signal stories.`);
        return;
      }

      console.log(`[Monitor] Found ${messages.length} new stories to broadcast.`);

      // Target chats: Subscribed users + Optional configured broadcast channel
      const targetChats = new Set(subscriptionStore.getAll());
      if (config.newsChannelId) {
        targetChats.add(config.newsChannelId);
      }

      for (const msg of messages) {
        for (const chatId of targetChats) {
          try {
            await bot.api.sendMessage(chatId, msg.html, {
              parse_mode: 'HTML',
              disable_web_page_preview: false
            });
          } catch (err) {
            console.warn(`[Broadcast] Failed to send message to ${chatId}:`, err.message);
            // If user blocked the bot, remove them from subscribers
            if (err.description && err.description.includes('bot was blocked by the user')) {
              subscriptionStore.remove(chatId);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Monitor] Error during polling cycle:', err.message);
    }
  };

  // Run first cycle shortly after start
  setTimeout(pollAndBroadcast, 5000);

  // Set recurring interval
  setInterval(pollAndBroadcast, config.pollIntervalSeconds * 1000);
}
