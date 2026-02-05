"use server";

import OpenAI from "openai";
import { setArticles, type StoredArticle } from "@/lib/memory-store";

const COMPANIES = [
  "Europol",
  "Saudi Aramco",
  "Statens vegvesen",
  "AG Insurance",
  "Huseierne",
  "Kystverket",
  "ING Romania",
  "Marynissen",
  "Miltenyi Biomedicine",
  "Magnum Ice Cream Company",
  "Unilever",
  "BGTS",
  "Randstad",
  "Bauer Media Outdoor",
] as const;

const QUERY_OVERRIDES: Record<string, string> = {
  "AG Insurance": "AG Insurance Belgium",
  "Huseierne": "Huseierne Norge",
};

type PerplexityResult = {
  company?: string;
  mentions?: Array<{
    headline?: string;
    source?: string;
    published_at?: string;
    link?: string;
    summary?: string;
    tone?: "positive" | "neutral" | "negative";
    tags?: string[];
  }>;
};

function extractJson(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  return match ? match[0] : content;
}

export async function scrapeNewsAction() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing PERPLEXITY_API_KEY" as const };
  }

  const perplexity = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const allArticles: StoredArticle[] = [];

  // Scrape each company (sequential to be safe)
  for (const company of COMPANIES) {
    const query = QUERY_OVERRIDES[company] ?? company;

    const response = await perplexity.chat.completions.create({
      model: "sonar",
      temperature: 0.2,
      max_tokens: 3500,
      messages: [
        {
          role: "system",
          content: `You are a media intelligence analyst.
Return STRICT JSON only:
{
  "company": "string",
  "mentions": [
    {
      "headline": "string",
      "source": "string",
      "published_at": "string",
      "link": "string",
      "summary": "string",
      "tone": "positive|neutral|negative",
      "tags": ["string"]
    }
  ]
}

Rules:
- Focus on the last 24 hours. If fewer than 8 items exist, expand to last 7 days.
- Every mention MUST have a direct public link.
- Deduplicate similar stories.
- Aim for 10–15 mentions when possible.`,
        },
        {
          role: "user",
          content: `Collect recent news mentions about: ${query}. Return only valid JSON.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    if (!content) continue;

    let parsed: PerplexityResult | null = null;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      parsed = null;
    }

    const mentions = parsed?.mentions ?? [];
    for (const m of mentions) {
      if (!m?.link) continue;
      allArticles.push({
        company,
        title: m.headline ?? "(No headline)",
        url: m.link,
        source: m.source ?? "Unknown",
        publishedAt: m.published_at ?? new Date().toISOString(),
        snippet: m.summary ?? "",
        tone: m.tone ?? "neutral",
        tags: m.tags ?? [],
      });
    }
  }

  // Save for Step 2
  setArticles(allArticles);

  return {
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10), // send back small preview
  };
}