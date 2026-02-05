"use client"

console.log("✅ MotionGeneratorForm loaded from /components")

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateMotions } from "@/app/actions/generate-motions"
import type { Motion } from "@/types/actions"
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react"

// ✅ NEW: import the two-step actions
import { scrapeNewsAction } from "@/app/actions/scrape-news"
import { generateReportAction } from "@/app/actions/generate-report"

const COMPANIES = [
  "Europol",
  "Saudi Aramco",
  "Statens vegvesen",
  "AG Insurance",
  "Huseierne",
  "Kystverket",
  "ING Romania",
  "Marynissen",
  "Miltenyi Biomedicine",
  "Magnum Ice Cream Company",
  "Unilever",
  "BGTS",
  "Randstad",
  "Bauer Media Outdoor",
] as const

// Improve ambiguous searches
const QUERY_OVERRIDES: Record<string, string> = {
  "AG Insurance": "AG Insurance Belgium",
  "Huseierne": "Huseierne Norge",
}

type CompanyReport = {
  company: string
  context: string
  motions: Motion[]
  error: string
  isLoading: boolean
  brief?: any | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function MotionGeneratorForm() {
  const initialReports = useMemo<CompanyReport[]>(
    () =>
      COMPANIES.map((company) => ({
        company,
        context: "",
        motions: [],
        error: "",
        isLoading: false,
        brief: null,
      })),
    []
  )

  const [reports, setReports] = useState<CompanyReport[]>(initialReports)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const cancelRef = useRef(false)

  const [scrapeError, setScrapeError] = useState("")

  // ✅ NEW: state for the 2-step flow
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeCount, setScrapeCount] = useState<number | null>(null)
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false)

  const [scrapedArticles, setScrapedArticles] = useState<any[]>([])

  const resetAll = () => {
    cancelRef.current = true
    setIsRunningAll(false)
    setReports(initialReports)

    // ✅ NEW: reset daily flow state too
    setIsScraping(false)
    setScrapeCount(null)
    setIsGeneratingDaily(false)
  }

  // ✅ NEW: Step 1 — scrape (collect articles once)
async function scrapeAll() {
  setIsScraping(true)
  setScrapeError("")
  try {
    const res = await scrapeNewsAction()
    if (res?.ok) {
      setScrapeCount(res.count ?? 0)
      setScrapedArticles(res.articles ?? [])
    } else {
      setScrapeError("Scrape failed: no ok response returned.")
      setScrapeCount(null)
      setScrapedArticles([])
    }
  } catch (e: any) {
    setScrapeError(e?.message ?? String(e))
    setScrapeCount(null)
    setScrapedArticles([])
  } finally {
    setIsScraping(false)
  }
}

  // ✅ NEW: Step 2 — generate all reports based on stored articles
  async function generateAllFromScrape() {
    if (isGeneratingDaily) return
    cancelRef.current = false
    setIsGeneratingDaily(true)

    try {
      for (const company of COMPANIES) {
        if (cancelRef.current) return

        const query = QUERY_OVERRIDES[company] ?? company

        // set loading state for that company card
        setReports((prev) =>
          prev.map((r) =>
            r.company === company
              ? { ...r, isLoading: true, error: "", motions: [], context: "" }
              : r
          )
        )

        try {
          // This action should generate a daily brief from the scraped articles
          const out = await generateReportAction(query, 24)

          if (cancelRef.current) return

          if (out?.ok && out.saved?.report) {
            // We map the daily report format into your existing UI:
            // - context = short executive summary (why_it_matters + what_changed)
            // - motions = key stories list, reusing Motion cards (title + reason + link)
            const rep = out.saved.report

            const contextText = [
              ...(rep.what_changed ?? []).slice(0, 3),
              ...(rep.why_it_matters ?? []).slice(0, 3),
            ]
              .filter(Boolean)
              .join(" ")

            const motionsFromStories: Motion[] = (rep.key_stories ?? []).map((s: any) => ({
              text: s.title ?? "Story",
              reasoning: s.reason ?? "",
              link: s.url ?? "",
              category: "daily brief",
            }))

            setReports((prev) =>
              prev.map((r) =>
                r.company === company
                  ? {
                      ...r,
                      brief: rep,
                      context: contextText,
                      motions: motionsFromStories,
                      error:
                        motionsFromStories.length === 0 && !contextText
                          ? "No meaningful coverage found in the last 24 hours."
                          : "",
                      isLoading: false,
                    }
                  : r
              )
            )
          } else {
            setReports((prev) =>
              prev.map((r) =>
                r.company === company
                  ? {
                      ...r,
                      error: out?.error || "Failed to generate daily report",
                      isLoading: false,
                    }
                  : r
              )
            )
          }
        } catch (err) {
          if (cancelRef.current) return
          setReports((prev) =>
            prev.map((r) =>
              r.company === company
                ? {
                    ...r,
                    error: "Unexpected error. Please try again.",
                    isLoading: false,
                  }
                : r
            )
          )
        }

        await sleep(250)
      }
    } finally {
      setIsGeneratingDaily(false)
    }
  }

  async function generateOne(company: string) {
    const query = QUERY_OVERRIDES[company] ?? company

    setReports((prev) =>
      prev.map((r) =>
        r.company === company
          ? { ...r, isLoading: true, error: "", motions: [], context: "", brief: null }
          : r
      )
    )

    const attempt = async () => generateMotions({ topic: query })

    try {
      let result = await attempt()
      let motions = result.success ? result.data?.motions ?? [] : []

      // Retry once if empty / flaky
      if ((motions.length === 0 || !result.success) && !cancelRef.current) {
        await sleep(1200)
        result = await attempt()
        motions = result.success ? result.data?.motions ?? [] : []
      }

      if (cancelRef.current) return

      if (result.success && result.data) {
        if (motions.length === 0 && !result.data.context) {
          setReports((prev) =>
            prev.map((r) =>
              r.company === company
                ? {
                    ...r,
                    error: "No meaningful coverage found in the last 24 hours.",
                    isLoading: false,
                  }
                : r
            )
          )
          return
        }

        setReports((prev) =>
          prev.map((r) =>
            r.company === company
              ? {
                  ...r,
                  motions,
                  context: result.data?.context ?? "",
                  error: "",
                  isLoading: false,
                }
              : r
          )
        )
      } else {
        setReports((prev) =>
          prev.map((r) =>
            r.company === company
              ? {
                  ...r,
                  error: result.error || "Failed to generate report",
                  isLoading: false,
                }
              : r
          )
        )
      }
    } catch (err) {
      if (cancelRef.current) return
      setReports((prev) =>
        prev.map((r) =>
          r.company === company
            ? {
                ...r,
                error: "Unexpected error. Please try again.",
                isLoading: false,
              }
            : r
        )
      )
    }
  }

  async function runAll() {
    if (isRunningAll) return
    cancelRef.current = false
    setIsRunningAll(true)

    try {
      for (const company of COMPANIES) {
        if (cancelRef.current) return
        await generateOne(company)
        await sleep(300) // be nice to APIs
      }
    } finally {
      setIsRunningAll(false)
    }
  }

  const anyLoading =
    isRunningAll ||
    isScraping ||
    isGeneratingDaily ||
    reports.some((r) => r.isLoading)

async function downloadPdf(company: string, report: any) {
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, report }),
  });

  if (!res.ok) {
    alert("PDF export failed");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${company}-daily-brief.pdf`;
  a.click();

  URL.revokeObjectURL(url);
}

  return (
    <div className="w-full space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Daily report generator
          </CardTitle>
          <CardDescription>
            Generate executive-friendly daily news coverage for a predefined company list.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3 items-center">
          {/* ✅ NEW: Step 1 */}
          <Button type="button" onClick={scrapeAll} disabled={anyLoading}>
            {isScraping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching…
              </>
            ) : (
              <>Fetch latest articles</>
            )}
          </Button>

          {/* ✅ NEW: Step 2 */}
         <Button type="button" onClick={generateAllFromScrape} disabled={anyLoading || !scrapeCount}>
            {isGeneratingDaily ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating from scrape…
              </>
            ) : (
              <>Generate daily report</>
            )}
          </Button>

          {/* Existing */}
          <Button type="button" onClick={runAll} disabled={anyLoading} variant="outline">
            {isRunningAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate all reports (old)
              </>
            )}
          </Button>

          <Button type="button" variant="outline" onClick={resetAll} disabled={anyLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>

          {/* ✅ NEW: status line */}
          {scrapeCount !== null && (
            <span className="text-sm text-muted-foreground">
              Fetched {scrapeCount} articles.
            </span>
          )}
{scrapedArticles.length > 0 && (
  <div className="w-full mt-4 space-y-2">
    <div className="text-sm font-medium">Fetched articles (preview)</div>

    {scrapedArticles.map((a, i) => (
      <div key={i} className="text-sm">
        <a className="underline" href={a.url} target="_blank" rel="noreferrer">
          {a.title}
        </a>
        <div className="text-xs text-muted-foreground">
          {a.source ? `${a.source} • ` : ""}{a.publishedAt}
        </div>
        {a.snippet && <div className="text-xs text-muted-foreground">{a.snippet}</div>}
      </div>
    ))}
  </div>
)}

        </CardContent>
      </Card>

      {reports.map((r) => (
        <Card key={r.company} className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {r.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {r.company}
            </CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {r.error ? (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <p className="text-sm text-muted-foreground">{r.error}</p>
              </div>
            ) : (
              <>
                {r.context && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.context}</p>
                )}

                {/* ✅ NEW: Export button */}
{r.brief && (
<Button
type="button"
variant="outline"
onClick={() => downloadPdf(r.company, r.brief)}
>
Download PDF
</Button>
)}

                {r.motions.map((item, idx) => (
                  <Card
                    key={idx}
                    className="group hover:shadow-lg transition-all duration-200 hover:border-primary/50"
                  >
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-base leading-snug">{item.text}</CardTitle>

                        {/* sentiment badge */}
                        {item.category && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary whitespace-nowrap">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.reasoning}</p>

                      {/* source link */}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80"
                        >
                          Read full article →
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}