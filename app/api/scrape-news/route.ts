export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { setArticles, type StoredArticle } from "@/lib/memory-store";
import type { Company } from "@/data/companies";

const QUERY_OVERRIDES: Record<string, string> = {
  "AG Insurance": "AG Insurance Belgium",
  "Huseierne": "Huseierne Norge",
};

const EXCLUDE_TERMS: Record<string, string[]> = {
  "bgts": [
    "BTS", "BGT", "Britain's Got Talent", "HYBE", "K-pop", "Kpop", "Bang Si-Hyuk",
    "Balai Geoteknik", "Terowongan", "Struktur", "Indonesia", "TAHUN", "Bina Marga",
  ],
}

const REQUIRE_TERMS: Record<string, string[]> = {
  "bgts": ["bgts.com", "bgts.com/", "BGTS software", "BGTS technology", "BGTS engineering", "BGTS IT", "BGTS consulting"],
}

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

function buildCompanyContext(company: Company): string {
  const parts: string[] = []
  if (company.industry) parts.push(company.industry)
  if (company.country) parts.push(`based in ${company.country}`)
  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}

function isRelevant(
  companyId: string,
  headline: string,
  summary: string,
  url: string,
): boolean {
  const text = `${headline} ${summary} ${url}`.toLowerCase()

  const excluded = EXCLUDE_TERMS[companyId] ?? []
  for (const term of excluded) {
    if (text.includes(term.toLowerCase())) return false
  }

  const required = REQUIRE_TERMS[companyId]
  if (required && required.length > 0) {
    // Also treat a bgts.com URL as a pass
    const urlMatch = url.toLowerCase().includes("bgts.com")
    const hasMatch = urlMatch || required.some((t) => text.includes(t.toLowerCase()))
    if (!hasMatch) return false
  }

  return true
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing PERPLEXITY_API_KEY" }, { status: 500 });
  }

  const { selectedCompanyIds } = await req.json();

  const perplexity = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const allCompanies = loadCompanies();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const companiesToScrape: Company[] =
    selectedCompanyIds && selectedCompanyIds.length > 0
      ? selectedCompanyIds
          .map((id: string) => companyMap.get(id))
          .filter((c: Company | undefined): c is Company => c !== undefined)
      : allCompanies;

  const allArticles: StoredArticle[] = [];

  for (const company of companiesToScrape) {
    const query = company.searchQuery ?? QUERY_OVERRIDES[company.name] ?? company.name;
    const context = buildCompanyContext(company)

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
- Aim for 10–15 mentions when possible.
- Only return articles directly about this specific company. Skip unrelated entities with similar names.`,
        },
        {
          role: "user",
          content: `Find recent news about "${company.name}"${context} — a ${company.industry ?? "company"} — using this search: ${query}

Only include articles about this specific organisation. Return only valid JSON.`,
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

      const headline = m.headline ?? ""
      const summary = m.summary ?? ""
      const url = m.link ?? ""

      if (!isRelevant(company.id, headline, summary, url)) continue

      allArticles.push({
        company: company.name,
        title: headline || "(No headline)",
        url,
        source: m.source ?? "Unknown",
        publishedAt: m.published_at ?? new Date().toISOString(),
        snippet: summary,
        tone: m.tone ?? "neutral",
        tags: m.tags ?? [],
      });
    }
  }

  await setArticles(allArticles);

  return NextResponse.json({
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10),
  });
}