"use server";

import OpenAI from "openai";
import { scoreRisk } from "@/lib/score-risk";

const QUERY_OVERRIDES: Record<string, string> = {
  "AG Insurance": "AG Insurance Belgium",
  "Huseierne": "Huseierne Norge",
};

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

  const query = QUERY_OVERRIDES[company] ?? company;

  const response = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0.2,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content: `You are a media intelligence analyst with real-time web access.
Search the web for recent news about the company provided, focusing on the last ${hours} hours.
Then write an executive-friendly daily brief.

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
- Actively search for and use the most recent news you can find.
- Keep each bullet 1 sentence, concrete, non-hype.
- "key_stories" should include 3-5 items with real URLs.
- If coverage is thin, be transparent in watchpoints.
- NEVER put "no new mentions" or "no coverage" in what_changed or why_it_matters.
- what_changed bullets must describe actual developments.`,
      },
      {
        role: "user",
        content: `Search for and summarise the latest news about: ${query}. Focus on the last ${hours} hours. Return only the JSON brief.`,
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

  try {
    report.riskScore = await scoreRisk(company, report);
  } catch {
    console.error("scoreRisk API error");
  }

  return { ok: true, saved: { company, hours, report } };
}
