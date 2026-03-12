// lib/score-risk.ts
// Calls Claude API to score reputation risk across 4 dimensions + 1 combined score.
//
// Usage:
//   import { scoreRisk } from "@/lib/score-risk"
//   const risk = await scoreRisk(companyName, report)
//   report.riskScore = risk   // store on report before saving
//
// Shape of RiskScore:
//   {
//     overall:     "Low" | "Medium" | "High" | "Critical"
//     reputational: "Low" | "Medium" | "High" | "Critical"
//     regulatory:   "Low" | "Medium" | "High" | "Critical"
//     operational:  "Low" | "Medium" | "High" | "Critical"
//     financial:    "Low" | "Medium" | "High" | "Critical"
//   }

export type RiskLevel = "Low" | "Medium" | "High" | "Critical"

export type RiskScore = {
  overall:      RiskLevel
  reputational: RiskLevel
  regulatory:   RiskLevel
  operational:  RiskLevel
  financial:    RiskLevel
}

const VALID: RiskLevel[] = ["Low", "Medium", "High", "Critical"]

const SYSTEM_PROMPT = `You are a senior risk analyst at Linq Advisors, a reputation management consultancy.

Given a daily intelligence brief for a company, score the risk across four dimensions plus an overall combined score.

Dimensions:
- reputational: negative press, brand damage, public perception threats
- regulatory: investigations, fines, compliance issues, legal exposure
- operational: supply chain disruption, leadership instability, business continuity threats
- financial: stock volatility, earnings pressure, investor sentiment, credit risk

Scoring guide:
- Low: No meaningful threat. Routine or positive news.
- Medium: Minor concerns. Worth monitoring but not urgent.
- High: Active threat with potential business impact. Requires attention now.
- Critical: Crisis-level. Immediate threat to brand, operations, or legal standing.

Overall = the highest dimension score, unless the picture is mixed and a lower composite is more accurate.

Respond ONLY with valid JSON in exactly this format, no explanation, no markdown:
{"overall":"Low","reputational":"Low","regulatory":"Low","operational":"Low","financial":"Low"}`

export async function scoreRisk(
  companyName: string,
  report: any
): Promise<RiskScore> {
  const fallback = inferFallback(report)

  try {
    const summary = buildSummary(companyName, report)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: summary }],
      }),
    })

    if (!response.ok) {
      console.warn(`scoreRisk API error ${response.status}, using fallback`)
      return fallback
    }

    const data = await response.json()
    const raw = (data?.content?.[0]?.text ?? "").trim()

    const parsed = JSON.parse(raw)
    const result: RiskScore = {
      overall:      validate(parsed.overall,      fallback.overall),
      reputational: validate(parsed.reputational, fallback.reputational),
      regulatory:   validate(parsed.regulatory,   fallback.regulatory),
      operational:  validate(parsed.operational,  fallback.operational),
      financial:    validate(parsed.financial,     fallback.financial),
    }
    return result
  } catch (err) {
    console.warn("scoreRisk failed, using fallback:", err)
    return fallback
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validate(value: string, fallback: RiskLevel): RiskLevel {
  return VALID.includes(value as RiskLevel) ? (value as RiskLevel) : fallback
}

function buildSummary(companyName: string, report: any): string {
  const lines: string[] = [`Company: ${companyName}`, ""]

  const append = (label: string, items: string[] | undefined) => {
    if (!items || items.length === 0) return
    lines.push(`${label}:`)
    items.slice(0, 4).forEach(item => lines.push(`- ${String(item).replace(/\[[\d,]+\]/g, "").trim()}`))
    lines.push("")
  }

  append("What changed",   report?.what_changed)
  append("Why it matters", report?.why_it_matters)
  append("Watchpoints",    report?.watchpoints)

  if (report?.key_stories?.length) {
    lines.push("Key stories:")
    report.key_stories.slice(0, 3).forEach((s: any) => lines.push(`- ${s.title ?? ""}`))
  }

  return lines.join("\n")
}

// Keyword fallback used when API is unavailable
function inferFallback(report: any): RiskScore {
  const t = JSON.stringify(report || "").toLowerCase()

  const rep = t.includes("scandal") || t.includes("brand damage") || t.includes("negative press") ? "High"
    : t.includes("criticism") || t.includes("backlash") || t.includes("controversy") ? "Medium" : "Low"

  const reg = t.includes("investigation") || t.includes("fine") || t.includes("lawsuit") || t.includes("compliance") ? "High"
    : t.includes("regulatory") || t.includes("legal") || t.includes("probe") ? "Medium" : "Low"

  const ops = t.includes("attack") || t.includes("outage") || t.includes("disruption") || t.includes("crisis") ? "High"
    : t.includes("leadership") || t.includes("supply chain") || t.includes("continuity") ? "Medium" : "Low"

  const fin = t.includes("catastrophic") || t.includes("crash") || t.includes("bankruptcy") ? "High"
    : t.includes("volatile") || t.includes("surge") || t.includes("pressure") || t.includes("earnings") ? "Medium" : "Low"

  const levels: RiskLevel[] = [rep, reg, ops, fin]
  const rank = (l: RiskLevel) => VALID.indexOf(l)
  const overall = levels.reduce((a, b) => rank(a) >= rank(b) ? a : b)

  return { overall, reputational: rep, regulatory: reg, operational: ops, financial: fin }
}