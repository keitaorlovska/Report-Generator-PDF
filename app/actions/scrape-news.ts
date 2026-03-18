"use server";

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { setArticles, type StoredArticle } from "@/lib/memory-store";
import type { Company } from "@/data/companies";

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

function loadCompanies(): Company[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "companies.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
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

  const allCompanies = loadCompanies();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const companiesToScrape: Company[] =
    selectedCompanyIds && selectedCompanyIds.length > 0
      ? selectedCompanyIds
          .map((id) => companyMap.get(id))
          .filter((c): c is Company => c !== undefined)
      : allCompanies;

  const allArticles: StoredArticle[] = [];

  for (const company of companiesToScrape) {
    const query = QUERY_OVERRIDES[company.name] ?? company.name;

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
- Aim for 10â€“15 mentions when possible.`,
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

  await setArticles(allArticles);

  return {
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10),
  };
}

