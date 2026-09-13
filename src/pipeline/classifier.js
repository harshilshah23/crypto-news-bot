/**
 * News Summarizer & Market Bias Classifier
 * Produces:
 * 1. Market Bias: 🟢 BULLISH | 🔴 BEARISH | ⚪ NEUTRAL
 * 2. 1–3 sentence concise summary
 * 3. "Why it matters" short editorial explanation
 */

// Negations / Dampeners around easing
const BEARISH_PATTERNS = [
  /push(es|ed|ing)? back against (rate cut|easing)/i,
  /reduc(es|ed|ing)? expectations for (rate cut|easing)/i,
  /diminish(es|ed|ing)? (rate cut|easing)/i,
  /delay(s|ed|ing)? (rate cut|easing)/i,
  /rule(s|d)? out (rate cut|easing)/i,
  /higher[- ]for[- ]longer/i,
  /rate hike/i,
  /hawkish/i,
  /inflation remains a concern/i,
  /sticky inflation/i,
  /hot inflation/i,
  /cpi (heats up|accelerates|rises more than expected)/i,
  /sec sues/i,
  /charges filed/i,
  /regulatory crackdown/i,
  /hack(ed)?|exploit(ed)?|stolen/i,
  /bankruptcy|insolvent/i,
  /sell-off|plunges|tumbles|drags down/i,
  /outflows accelerate|record outflows/i,
  /etf outflows/i
];

const BULLISH_PATTERNS = [
  /rate cut (expected|announced|delivered|nears)/i,
  /cuts rates/i,
  /dovish/i,
  /cooling inflation|inflation cools/i,
  /cpi slows/i,
  /etf (inflows|approval|approved|demands?)/i,
  /spot (bitcoin|ethereum) etf/i,
  /record inflows/i,
  /institutional (demand|adoption|inflows)/i,
  /accumulat(e|es|ing|ion)/i,
  /all-time high|new highs/i,
  /liquidity boost|easing liquidity/i,
  /drops (charges|lawsuit)/i,
  /sec approves/i,
  /clarity act|regulatory approval/i,
  /treasury allocation/i
];

export class NewsClassifier {
  constructor(config = {}) {
    this.geminiApiKey = config.geminiApiKey || '';
    this.openRouterApiKey = config.openRouterApiKey || '';
    this.openRouterModel = config.openRouterModel || 'inclusionai/ling-3.0-flash-fin:free';
  }

  async classifyAndSummarize(article) {
    // 1. If LLM is configured (OpenRouter or Gemini), attempt institutional editorial synthesis
    if (this.openRouterApiKey || this.geminiApiKey) {
      try {
        const aiResult = await this._classifyWithAI(article);
        if (aiResult) return aiResult;
      } catch (err) {
        // Fall back seamlessly to deterministic rules
      }
    }

    // 2. Deterministic Financial Heuristic Engine
    return this._classifyWithHeuristics(article);
  }

  _classifyWithHeuristics(article) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();

    let bearScore = 0;
    let bullScore = 0;

    for (const pattern of BEARISH_PATTERNS) {
      if (pattern.test(text)) bearScore += 2;
    }

    for (const pattern of BULLISH_PATTERNS) {
      if (pattern.test(text)) bullScore += 2;
    }

    // Fallback keyword checks if patterns didn't match
    if (bearScore === 0 && bullScore === 0) {
      if (/inflows|expansion|adopted|partners with/i.test(text)) bullScore += 1;
      if (/outflows|lawsuit|investigation|losses/i.test(text)) bearScore += 1;
    }

    let bias = '⚪ NEUTRAL';
    let biasType = 'NEUTRAL';
    let whyItMatters = '';

    if (bearScore > bullScore) {
      bias = '🔴 BEARISH';
      biasType = 'BEARISH';
      if (/rate|fed|inflation|cpi/i.test(text)) {
        whyItMatters = 'Higher-for-longer rate expectations can weigh on risk assets, including crypto.';
      } else if (/sec|lawsuit|crackdown|regulatory/i.test(text)) {
        whyItMatters = 'Heightened regulatory scrutiny can trigger defensive positioning and short-term capital contraction across market makers.';
      } else if (/outflow/i.test(text)) {
        whyItMatters = 'Sustained fund outflows indicate institutional de-risking and near-term absorption pressure on market prices.';
      } else {
        whyItMatters = 'Adverse market developments elevate risk premiums and may prompt short-term defensive de-risking.';
      }
    } else if (bullScore > bearScore) {
      bias = '🟢 BULLISH';
      biasType = 'BULLISH';
      if (/etf|inflow/i.test(text)) {
        whyItMatters = 'Stronger ETF demand provides a positive demand signal for Bitcoin and suggests institutional interest is recovering.';
      } else if (/rate cut|easing|dovish|cooling/i.test(text)) {
        whyItMatters = 'Monetary easing expectations improve global liquidity conditions, which historically supports high-beta risk assets including crypto.';
      } else if (/sec|regulation|clarity|court/i.test(text)) {
        whyItMatters = 'Regulatory clarity and reduced legal overhang lower systemic risk, encouraging long-term capital deployment.';
      } else {
        whyItMatters = 'The development reflects expanding ecosystem adoption and constructive capital flows across digital assets.';
      }
    } else {
      bias = '⚪ NEUTRAL';
      biasType = 'NEUTRAL';
      if (/tokeniz|infrastructure/i.test(text)) {
        whyItMatters = 'The development expands tokenized-asset infrastructure but does not create an immediate clear directional signal for the broader crypto market.';
      } else if (/fed|central bank/i.test(text)) {
        whyItMatters = 'Markets are absorbing macroeconomic data without a decisive shift in baseline rate or liquidity expectations.';
      } else {
        whyItMatters = 'The news adds constructive operational color to the industry but has limited direct directional impact on broader token prices.';
      }
    }

    // Clean summary: 1-3 sentences
    let summary = (article.description || article.title || '').trim();
    const sentences = summary.split(/(?<=[.?!])\s+/).filter(s => s.length > 15);
    if (sentences.length > 0) {
      summary = sentences.slice(0, 2).join(' ');
    }
    if (!summary.endsWith('.')) summary += '.';

    return {
      bias,
      biasType,
      summary,
      whyItMatters
    };
  }

  async _classifyWithAI(article) {
    const prompt = `You are an elite, institutional crypto and financial market editor.
Analyze this news story:
Headline: "${article.title}"
Description: "${article.description || ''}"
Source: "${article.source || ''}"

Return a valid JSON object matching EXACTLY this structure:
{
  "biasType": "BULLISH" | "BEARISH" | "NEUTRAL",
  "summary": "1 to 2 factual, concise sentences summarizing the news.",
  "whyItMatters": "1 to 2 sentences explaining the economic/market impact on crypto and liquidity."
}

Guidelines:
- Maintain an objective, institutional tone.
- Do NOT give financial advice.
- Return ONLY valid JSON, without any markdown fences.`;

    if (this.openRouterApiKey) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.openRouterModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 250
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(content);
          const biasMap = {
            'BULLISH': '🟢 BULLISH',
            'BEARISH': '🔴 BEARISH',
            'NEUTRAL': '⚪ NEUTRAL'
          };
          const bType = parsed.biasType?.toUpperCase() || 'NEUTRAL';
          return {
            bias: biasMap[bType] || '⚪ NEUTRAL',
            biasType: bType,
            summary: parsed.summary,
            whyItMatters: parsed.whyItMatters
          };
        }
      }
    }

    return null;
  }
}
