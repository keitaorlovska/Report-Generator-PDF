// app/api/autofill-company/route.ts
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: Request) {
  try {
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are a company data assistant. Given a company name, return a JSON object with these fields:
- ticker: stock ticker symbol (string, or empty string if not publicly traded)
- country: 2-letter ISO country code where the company is headquartered (e.g. "US", "GB", "NO")
- market: stock exchange name (e.g. "NYSE", "NASDAQ", "Euronext") or empty string
- industry: industry category (e.g. "Technology", "Energy", "Banking", "Consumer Goods")
- tags: array of 2-4 relevant lowercase tags (e.g. ["software", "cloud", "US"])

Company name: "${name}"

Respond ONLY with a valid JSON object, no explanation, no markdown, no backticks.`
      }]
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const parsed = JSON.parse(text.trim())
    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error("Autofill error:", err)
    return NextResponse.json({ error: "Auto-fill failed" }, { status: 500 })
  }
}