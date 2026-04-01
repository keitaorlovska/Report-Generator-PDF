export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { setArticles, type StoredArticle } from "@/lib/memory-store";
import type { Company } from "@/data/companies";

const QUERY_OVERRIDES: Record<string, string> = {
  "AG Insurance": "AG Insurance Belgium",
  "Huseierne": "Huseierne Norge",
};

function loadCompanies(): Company[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "companies.json"), "utf-8");
    return JSON.parse(raw);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const { selectedCompanyIds } = await req.json();
  const client = new Anthropic({ apiKey });

  const allCompanies = loadCompanies();
  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  const companiesToScrape: Company[] =
    selectedCompanyIds && selectedCompanyIds.length > 0
      ? selectedCompanyIds.map((id: string) => companyMap.get(id)).filter((c: any): c is Company => !!c)
      : allCompanies;

  const allArticles: StoredArticle[] = [];

  for (const company of companiesToScrape) {
    const query = QUERY_OVERRIDES[company.name] ?? company.name;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }] as any,
        messages: [{
          role: "user",
          content: `Search for recent news about "${query}" from the last 24-48 hours.

Then return a JSON array ONLY — no explanation, no markdown, just raw JSON:
[
  {
    "title": "Article headline",
    "url": "https://...",
    "source": "Publication name",
    "publishedAt": "2026-04-01T08:00:00Z",
    "snippet": "Brief summary of the article",
    "tone": "positive" | "neutral" | "negative"
  }
]

Rules:
- Include 5-10 articles maximum
- Every article MUST have a real URL
- Only include articles from the last 48 hours
- Return ONLY the JSON array, nothing else`
        }]
      });

      // Find the text block in the response
      const textBlock = response.content.find((b: any) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;

      let articles: any[] = [];
      try {
        const match = textBlock.text.match(/\[[\s\S]*\]/);
        articles = match ? JSON.parse(match[0]) : [];
      } catch { continue; }

      for (const a of articles) {
        if (!a?.url) continue;
        allArticles.push({
          company: company.name,
          title: a.title ?? "(No headline)",
          url: a.url,
          source: a.source ?? "Unknown",
          publishedAt: a.publishedAt ?? new Date().toISOString(),
          snippet: a.snippet ?? "",
          tone: a.tone ?? "neutral",
          tags: [],
        });
      }
    } catch (e: any) {
      console.error(`Failed to scrape ${company.name}:`, e?.message);
      continue;
    }
  }

  await setArticles(allArticles);

  return NextResponse.json({
    ok: true,
    count: allArticles.length,
    articles: allArticles.slice(0, 10),
  });
}