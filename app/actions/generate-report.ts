"use server";

import OpenAI from "openai";
import { getArticles } from "@/lib/memory-store";

function compactMentions(articles: any[], limit = 18) {
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

  // Match articles by company name.
  // Articles are stored under the original name (e.g. "AG Insurance"),
  // but this function may be called with a query override (e.g. "AG Insurance Belgium").
  // So we match if the stored name is contained within the requested query.
  const normalise = (s: string) => s.toLowerCase().trim();
  const filteredByCompany = all.filter((a: any) => {
    if (!a.company) return true;
    const stored = normalise(String(a.company));
    const requested = normalise(String(company));
    return stored === requested || requested.startsWith(stored) || requested.includes(stored);
  });

  // Use a 30-day window — Perplexity sometimes returns dates older than 7 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filtered = filteredByCompany.filter((a: any) => {
    if (!a.publishedAt) return true;
    const t = new Date(a.publishedAt).getTime();
    return isNaN(t) ? true : t >= cutoff;
  });

  // Always fall back to all company articles if date filter removes everything
  const finalArticles = filtered.length > 0 ? filtered : filteredByCompany;
  const mentions = compactMentions(finalArticles, 18);

  console.log(`[${company}] total:${all.length} byCompany:${filteredByCompany.length} filtered:${filtered.length} sending:${mentions.length}`);

  if (mentions.length === 0) {
    return {
      ok: true,
      saved: {
        company,
        hours,
        report: {
          what_changed: [],
          why_it_matters: [],
          key_stories: [],
          watchpoints: ["No articles found for this company."],
        },
      },
    };
  }

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
- "key_stories" should include 5-8 items, deduplicated, with the original URLs.
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

  if (Array.isArray(report.key_stories)) {
    report.key_stories = report.key_stories
      .filter((s: any) => s?.url)
      .slice(0, 8);
  } else {
    report.key_stories = [];
  }

  return { ok: true, saved: { company, hours, report } };
}