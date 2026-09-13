# 📰 Crypto Market News Telegram Bot

> **"The news you need. Without the noise."**

A production-quality, hyper-focused Telegram bot engineered solely to monitor, filter, deduplicate, summarize, classify, and continuously deliver high-signal cryptocurrency and financial-market intelligence.

---

## ⚡ Core Philosophy & Strict Focus

This is an editorial market news intelligence bot, **NOT** a terminal.
- ❌ No ticker commands (`/ticker`, `/quote`)
- ❌ No price tables or 24h charts
- ❌ No backtesting or trading tools
- ❌ No portfolio trackers or watchlists
- ❌ No community polls or sentiment gambling
- ✅ **100% focused on signal-rich market news**

---

## 📸 Output Format

Every news alert follows the exact human market editor format:

```text
🟢 BULLISH

Bitcoin ETFs See Strongest Inflows in Weeks

Spot Bitcoin ETFs recorded strong inflows, pointing to renewed institutional demand as BTC trades near recent highs.

⚡ Why it matters:
Stronger ETF demand provides a positive demand signal for Bitcoin and suggests institutional interest is recovering.

📰 CoinDesk · 18 min ago

Read the full story →
```

---

## 🏗️ Architectural Overview

```
                          ┌───────────────────────────┐
                          │   News Sources & Feeds    │
                          │   • NewsAPI (Primary)     │
                          │   • CoinDesk RSS          │
                          │   • Google News RSS       │
                          │   • Yahoo Finance RSS     │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   Filter Engine           │
                          │   • Multi-Factor Scoring  │
                          │   • Rejects Clickbait     │
                          │   • Drops Price Spam      │
                          │   • Rejects Stale News    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   Deduplication Engine    │
                          │   • Entity Extraction     │
                          │   • Jaccard Token Sim     │
                          │   • Clusters Outlets      │
                          │   • Rolling 48h Store     │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   Editorial Classifier    │
                          │   • 🟢 / 🔴 / ⚪ Bias     │
                          │   • 1–3 Sentence Summary  │
                          │   • "⚡ Why it matters"    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   Telegram Broadcaster    │
                          │   • Auto-Stream to Chats  │
                          │   • Dedicated Channel ID  │
                          │   • On-demand /latest     │
                          └───────────────────────────┘
```

---

## 🚀 Quickstart & Setup

### 1. Requirements
- Node.js 18+
- Active Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- NewsAPI Key (from [newsapi.org](https://newsapi.org/))

### 2. Environment Variables (`.env`)
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEWS_API_KEY=your_newsapi_key
NEWS_CHANNEL_ID=  # Optional: @channel_name or -100xxxxxxxxxx
POLL_INTERVAL_SECONDS=180
MIN_RELEVANCE_SCORE=65
```

### 3. Running the Bot
```bash
# Run automated verification suite
npm test

# Launch production bot & scheduler
npm start
```

### 4. Telegram Commands
- `/start` — Subscribe to live continuous news alerts
- `/latest` — Pull the top 3 curated stories immediately
- `/status` — View monitoring health, providers, and settings
- `/stop` — Unsubscribe from automatic broadcasting
