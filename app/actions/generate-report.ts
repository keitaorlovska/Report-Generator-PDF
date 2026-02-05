"use server";

import OpenAI from "openai";
import { getArticles } from "@/lib/memory-store";

function compactMentions(articles: any[], limit = 18) {
  // Keep the prompt short: take top N and only essential fields
  return articles.slice(0, limit).map((a: any) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    publishedAt: a.publishedAt,
    snippet: a.snippet,
    tone: a.tone,
    tags: a.tags,
  }));
}

function safeJsonParse(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  const json = match ? match[0] : text;
  return JSON.parse(json);
}

export async function generateReportAction(company: string, hours: number = 24) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing PERPLEXITY_API_KEY" as const };
  }

  const perplexity = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const all = getArticles();

  // Filter by company (if your stored articles include company). If not, it will still work but be noisier.
  const filteredByCompany = all.filter((a: any) => {
    if (!a.company) return true;
    return String(a.company).toLowerCase() === String(company).toLowerCase();
  });

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const filtered = filteredByCompany.filter((a: any) => {
    const t = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    return t >= cutoff;
  });

  // If no articles, return a clean response (so your UI shows a useful message)
  if (filtered.length === 0) {
    return {
      ok: true,
      saved: {
        company,
        hours,
        report: {
          what_changed: [],
          why_it_matters: [],
          key_stories: [],
          watchpoints: ["No articles found in the selected time window."],
        },
      },
    };
  }

  const mentions = compactMentions(filtered, 18);

  // Ask Perplexity to summarize *only* what we already scraped
  const response = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0.2,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content: `You are a media intelligence analyst.
You will be given a list of news mentions (already collected). Do NOT browse the web.
Write an executive-friendly daily brief.

Return STRICT JSON only in this format:
{
  "what_changed": ["string", "string", "string"],
  "why_it_matters": ["string", "string", "string"],
  "key_stories": [
    { "title": "string", "url": "string", "reason": "string" }
  ],
  "watchpoints": ["string", "string", "string"]
}

Rules:
- Base your output ONLY on the provided mentions.
- Keep each bullet 1 sentence, concrete, non-hype.
- "key_stories" should include 5–8 items, deduplicated, with the original URLs.
- If mentions are thin, be transparent in watchpoints.`,
      },
      {
        role: "user",
        content: `Company: ${company}
Time window: last ${hours} hours
Mentions (JSON):
${JSON.stringify(mentions, null, 2)}

Now produce the JSON brief.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { ok: false, error: "No response from Perplexity" as const };
  }

  let report: any;
  try {
    report = safeJsonParse(content);
  } catch (e) {
    return { ok: false, error: "Failed to parse Perplexity JSON" as const };
  }

  // Final small safety: ensure URLs exist in key_stories
  if (Array.isArray(report.key_stories)) {
    report.key_stories = report.key_stories
      .filter((s: any) => s?.url)
      .slice(0, 8);
  } else {
    report.key_stories = [];
  }

  return { ok: true, saved: { company, hours, report } };
}