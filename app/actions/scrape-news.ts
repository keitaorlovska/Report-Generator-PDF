"use server";

import OpenAI from "openai";
import { setArticles, type StoredArticle } from "@/lib/memory-store";
import type { Company } from "@/data/companies";

const COUNTRY_NAMES: Record<string, string> = {
  GB: "UK", US: "United States", DE: "Germany", BE: "Belgium",
  NL: "Netherlands", NO: "Norway", RO: "Romania", SA: "Saudi Arabia",
  EU: "Europe",
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

function buildQuery(company: Company): string {
  const parts = [company.name];
  if (company.ticker) parts.push(`(${company.ticker})`);
  if (company.country) {
    const countryName = COUNTRY_NAMES[company.country] ?? company.country;
    parts.push(countryName);
  }
  if (company.industry) parts.push(company.industry);
  return parts.join(" ");
}

export async function scrapeNewsAction(selectedCompanyIds?: string[]) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing PERPLEXITY_API_KEY" as const };
  }

  const perplexity = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  // Load companies from Supabase via API
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/companies`);
  const allCompanies: Company[] = await res.json();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const companiesToScrape: Company[] =
    selectedCompanyIds && selectedCompanyIds.length > 0
      ? selectedCompanyIds.map((id) => companyMap.get(id)).filter((c): c is Company => c !== undefined)
      : allCompanies;

  const allArticles: StoredArticle[] = [];

  for (const company of companiesToScrape) {
    const query = buildQuery(company);

    const response = await (perplexity.chat.completions.create as any)({
      model: "sonar-pro",
      temperature: 0.1,
      max_tokens: 4000,
      search_recency_filter: "week",
      messages: [
        {
          role: "system",
          content: `You are a media intelligence analyst specializing in corporate news monitoring.
Return STRICT JSON only:
{
  "company": "string",
  "mentions": [
    {
      "headline": "string",
      "source": "string",
      "published_at": "ISO date string",
      "link": "string",
      "summary": "string",
      "tone": "positive|neutral|negative",
      "tags": ["string"]
    }
  ]
}

Rules:
- Focus on the last 7 days. Prioritize the most recent items first.
- Every mention MUST have a real, direct, publicly accessible URL.
- Include financial news, regulatory news, partnerships, leadership changes, controversies.
- Deduplicate — do not include the same story from multiple sources.
- Aim for 10–15 high quality mentions.
- Never invent or hallucinate URLs or headlines.`,
        },
        {
          role: "user",
          content: `Find the most recent and important news about: ${query}. Return only valid JSON.`,
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
        company: company.name,
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

  setArticles(allArticles);

  return {
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10),
  };
}