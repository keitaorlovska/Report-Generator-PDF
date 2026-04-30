"use server";

import OpenAI from "openai";
import { setArticles, type StoredArticle } from "@/lib/memory-store";
import type { Company } from "@/data/companies";

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
  if (company.ticker) return `${company.name} ${company.ticker}`;
  return company.name;
}

// ── NewsAPI fetch (real-time, minutes delay) ──────────────────────────────
async function fetchFromNewsAPI(company: Company): Promise<StoredArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];

  const query = encodeURIComponent(buildQuery(company));
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=15&from=${from}&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.articles)) return [];

    return data.articles
      .filter((a: any) => a.url && a.title && !a.title.includes("[Removed]"))
      .map((a: any) => ({
        company: company.name,
        title: a.title,
        url: a.url,
        source: a.source?.name ?? "Unknown",
        publishedAt: a.publishedAt ?? new Date().toISOString(),
        snippet: a.description ?? "",
        tone: "neutral" as const,
        tags: [],
      }));
  } catch {
    return [];
  }
}

// ── Perplexity fetch (fallback, broader search) ───────────────────────────
async function fetchFromPerplexity(
  company: Company,
  perplexity: OpenAI
): Promise<StoredArticle[]> {
  const query = buildQuery(company);

  const response = await (perplexity.chat.completions.create as any)({
    model: "sonar-pro",
    temperature: 0.1,
    max_tokens: 4000,
    search_recency_filter: "week",
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
      "published_at": "ISO date string",
      "link": "string",
      "summary": "string",
      "tone": "positive|neutral|negative",
      "tags": ["string"]
    }
  ]
}

Rules:
- Focus on the last 7 days. Most recent first.
- PRIORITIZE: Reuters, Bloomberg, Financial Times, Yahoo Finance, BBC, AP, CNBC, Forbes.
- Every mention MUST have a real, direct, publicly accessible URL.
- Include financial, regulatory, partnerships, leadership changes, controversies.
- Deduplicate similar stories. Aim for 10–15 mentions.
- Never invent URLs or headlines.`,
      },
      {
        role: "user",
        content: `Find the most recent and important news about: ${query}. Return only valid JSON.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  if (!content) return [];

  let parsed: PerplexityResult | null = null;
  try {
    parsed = JSON.parse(extractJson(content));
  } catch {
    return [];
  }

  return (parsed?.mentions ?? [])
    .filter((m: any) => m?.link)
    .map((m: any) => ({
      company: company.name,
      title: m.headline ?? "(No headline)",
      url: m.link,
      source: m.source ?? "Unknown",
      publishedAt: m.published_at ?? new Date().toISOString(),
      snippet: m.summary ?? "",
      tone: m.tone ?? "neutral",
      tags: m.tags ?? [],
    }));
}

// ── Main export ───────────────────────────────────────────────────────────
export async function scrapeNewsAction(selectedCompanyIds?: string[]) {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    return { ok: false, error: "Missing PERPLEXITY_API_KEY" as const };
  }

  const perplexity = new OpenAI({
    apiKey: perplexityKey,
    baseURL: "https://api.perplexity.ai",
  });

  // Load companies from API (Supabase-backed)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/companies`);
  const allCompanies: Company[] = await res.json();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const companiesToScrape: Company[] =
    selectedCompanyIds && selectedCompanyIds.length > 0
      ? selectedCompanyIds.map((id) => companyMap.get(id)).filter((c): c is Company => c !== undefined)
      : allCompanies;

  const allArticles: StoredArticle[] = [];

  for (const company of companiesToScrape) {
    // Step 1: Try NewsAPI (real-time)
    const newsApiArticles = await fetchFromNewsAPI(company);

    // Step 2: If NewsAPI returns fewer than 5 articles, also fetch from Perplexity
    const perplexityArticles =
      newsApiArticles.length < 5
        ? await fetchFromPerplexity(company, perplexity)
        : [];

    // Step 3: Merge, deduplicate by URL
    const seen = new Set<string>();
    const merged = [...newsApiArticles, ...perplexityArticles].filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    allArticles.push(...merged);
  }

  setArticles(allArticles);

  return {
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10),
  };
}

export async function scrapeOneCompanyAction(companyName: string) {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) return { ok: false, error: "Missing PERPLEXITY_API_KEY" as const };

  const perplexity = new OpenAI({ apiKey: perplexityKey, baseURL: "https://api.perplexity.ai" });
  const company = { name: companyName, id: companyName } as Company;

  const newsApiArticles = await fetchFromNewsAPI(company);
  const perplexityArticles =
    newsApiArticles.length < 5 ? await fetchFromPerplexity(company, perplexity) : [];

  const seen = new Set<string>();
  const merged = [...newsApiArticles, ...perplexityArticles].filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  const existing = (await import("@/lib/memory-store")).getArticles();
  const updated = [...existing.filter((a) => a.company !== companyName), ...merged];
  (await import("@/lib/memory-store")).setArticles(updated);

  return { ok: true, count: merged.length, articles: merged.slice(0, 10) };
}