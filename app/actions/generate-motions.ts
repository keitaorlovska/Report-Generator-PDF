"use server"

import { z } from "zod"
import OpenAI from "openai"
import type { GenerateMotionsResponse, Motion } from "@/types/actions"

const generateMotionsSchema = z.object({
  topic: z.string().optional(),
})

export async function generateMotions(
  input: z.infer<typeof generateMotionsSchema>
): Promise<GenerateMotionsResponse> {
  try {
    // Validate input
    const validatedInput = generateMotionsSchema.parse(input)
    
    // Check for API key
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: "Perplexity API key is not configured. Please add PERPLEXITY_API_KEY to your environment variables.",
      }
    }

    // Initialize Perplexity client using OpenAI SDK
    const perplexity = new OpenAI({
      apiKey,
      baseURL: "https://api.perplexity.ai",
    })

    // Construct the search query
    const searchQuery = validatedInput.topic
      ? `Recent news and developments about ${validatedInput.topic}`
      : "Latest trending news today across politics, technology, environment, and society"

    // Generate debate motions using Perplexity
    const response = await perplexity.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: `You are a media intelligence analyst. Create a DAILY NEWS COVERAGE REPORT about a company based on the most recent available information.

Requirements:
- Primary time window: last 24 hours. If fewer than 12 relevant items exist, expand to last 7 days. If still fewer than 12, expand to last 30 days and say so in "time_window".
- Include AT LEAST 12 items in "mentions" (aim for 15–20).
- Every mention MUST have a direct link.
- Deduplicate similar stories.
- Keep it executive-friendly (1–2 sentence summaries per item).

Social & community signals:
- Also include relevant public social/community discussions when available (e.g., X/Twitter, Reddit, Hacker News, YouTube, public blog posts).
- ONLY include items with direct links that are publicly accessible (no paywalls/login-required pages).
- Aim for 5–10 items in "social_mentions" when available; if none are available, return an empty array.

Return STRICT JSON only in this format:
{
  "company": "string",
  "time_window": "string",
  "executive_summary": "string",
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
  ],
  "social_mentions": [
    {
      "platform": "X|Reddit|Hacker News|YouTube|Blog|LinkedIn",
      "author": "string",
      "published_at": "string",
      "link": "string",
      "summary": "string",
      "tone": "positive|neutral|negative",
      "tags": ["string"]
    }
  ],
  "watchlist": ["string"]
}`,
        },
        {
          role: "user",
           content: `Create a daily news coverage report for the following company:
${validatedInput.topic ?? "Trending news"}

Return only valid JSON.`,        },
      ],
      temperature: 0.7,
      max_tokens: 6000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        success: false,
        error: "No response received from Perplexity API",
      }
    }

    // Parse the JSON response
    let parsedData: { context?: string; motions: Motion[] }
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : content
      parsedData = JSON.parse(jsonString)
    } catch (parseError) {
      // If JSON parsing fails, try to extract motions from text
      console.error("Failed to parse JSON:", parseError)
      return {
        success: false,
        error: "Failed to parse AI response. Please try again.",
      }
    }

    // Validate that we have motions
    if (!(parsedData as any).mentions || !Array.isArray((parsedData as any).mentions) || (parsedData as any).mentions.length === 0) {
      return {
        success: false,
        error: "No motions were generated. Please try again.",
      }
    }

    const mentions = (parsedData as any).mentions
    const socialMentions = (parsedData as any).social_mentions
const executiveSummary = (parsedData as any).executive_summary
const company = (parsedData as any).company

// Convert social mentions into the same shape as motions
const socialAsMotions = Array.isArray(socialMentions)
  ? socialMentions.map((s: any) => ({
      text: s.summary ? `[SOCIAL] ${s.summary}` : "[SOCIAL] Mention",
      reasoning: "",
      category: `${s.platform || "Social"}${s.tone ? ` • ${s.tone}` : ""}`,
      link: s.link,
    }))
  : []

// If the new schema is returned (mentions), adapt it to the old UI (motions)
if (Array.isArray(mentions)) {
  return {
    success: true,
    data: {
      context:
        executiveSummary ||
        `News coverage for ${company || validatedInput.topic || "the company"}`,
      motions: mentions.map((m: any) => ({
        text: m.headline || "(No headline)",
        reasoning: m.summary || "",
        category: `${m.source || "Unknown source"}${m.tone ? ` • ${m.tone}` : ""}`,
        link: m.link,
      })),
    },
  }
}

// Fallback: old debate-motions behavior
return {
  success: true,
  data: {
    motions: (parsedData as any).motions ?? [],
    context: (parsedData as any).context ?? "",
  },
}

  } catch (error) {
    console.error("Error generating motions:", error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input provided",
      }
    }

    if (error instanceof Error) {
      // Check for specific API errors
      if (error.message.includes("API key")) {
        return {
          success: false,
          error: "Invalid Perplexity API key. Please check your configuration.",
        }
      }
      
      return {
        success: false,
        error: `Failed to generate motions: ${error.message}`,
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}