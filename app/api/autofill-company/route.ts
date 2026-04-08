// app/api/autofill-company/route.ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a company data assistant. Always respond with valid JSON only, no explanation, no markdown, no backticks.",
          },
          {
            role: "user",
            content: `Given the company name "${name}", return a JSON object with these fields:
- ticker: stock ticker symbol (string, or empty string if not publicly traded)
- country: 2-letter ISO country code where the company is headquartered (e.g. "US", "GB", "NO")
- market: stock exchange name (e.g. "NYSE", "NASDAQ", "Euronext") or empty string
- industry: industry category (e.g. "Technology", "Energy", "Banking", "Consumer Goods")
- tags: array of 2-4 relevant lowercase tags (e.g. ["software", "cloud", "enterprise"])

Respond ONLY with a valid JSON object.`,
          }
        ],
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("Perplexity autofill error:", err)
      return NextResponse.json({ error: "Auto-fill failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ""
    const clean = text.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)

  } catch (err: any) {
    console.error("Autofill error:", err)
    return NextResponse.json({ error: "Auto-fill failed" }, { status: 500 })
  }
}