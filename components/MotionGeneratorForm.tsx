"use client"

console.log("✅ MotionGeneratorForm loaded from /components")

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateMotions } from "@/app/actions/generate-motions"
import type { Motion } from "@/types/actions"
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react"

import { scrapeNewsAction } from "@/app/actions/scrape-news"
import { generateReportAction } from "@/app/actions/generate-report"

// ✅ CHANGED: companies now come from the single source of truth
import { COMPANIES as ALL_COMPANIES } from "@/data/companies"

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
  // ✅ Selected company IDs from the picker, defaults to all
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(ALL_COMPANIES.map((c) => c.id))
  )
  const [pickerQuery, setPickerQuery] = useState("")

  // Derived: Company objects that are currently selected
  const selectedCompanies = useMemo(
    () => ALL_COMPANIES.filter((c) => selectedIds.has(c.id)),
    [selectedIds]
  )

  // Filtered list for the picker UI
  const filteredCompanies = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return ALL_COMPANIES
    return ALL_COMPANIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.ticker && c.ticker.toLowerCase().includes(q)) ||
        (c.industry && c.industry.toLowerCase().includes(q)) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)))
    )
  }, [pickerQuery])

  const filteredIds = filteredCompanies.map((c) => c.id)
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id))
      } else {
        filteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ── Reports state ─────────────────────────────────────────────────────────

  const makeInitialReports = (companies: typeof ALL_COMPANIES): CompanyReport[] =>
    companies.map((c) => ({
      company: c.name,
      context: "",
      motions: [],
      error: "",
      isLoading: false,
      brief: null,
    }))

  const [reports, setReports] = useState<CompanyReport[]>(() =>
    makeInitialReports(ALL_COMPANIES)
  )
  const [isRunningAll, setIsRunningAll] = useState(false)
  const cancelRef = useRef(false)

  const [scrapeError, setScrapeError] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeCount, setScrapeCount] = useState<number | null>(null)
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false)
  const [scrapedArticles, setScrapedArticles] = useState<any[]>([])

  const resetAll = () => {
    cancelRef.current = true
    setIsRunningAll(false)
    setReports(makeInitialReports(ALL_COMPANIES))
    setIsScraping(false)
    setScrapeCount(null)
    setIsGeneratingDaily(false)
    setScrapeError("")
  }

  // ── Step 1: scrape ────────────────────────────────────────────────────────

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

  // ── Step 2: generate reports for SELECTED companies only ──────────────────

  async function generateAllFromScrape() {
    if (isGeneratingDaily) return
    cancelRef.current = false
    setIsGeneratingDaily(true)

    try {
      for (const company of selectedCompanies) {
        if (cancelRef.current) return

        const query = QUERY_OVERRIDES[company.name] ?? company.name

        setReports((prev) =>
          prev.map((r) =>
            r.company === company.name
              ? { ...r, isLoading: true, error: "", motions: [], context: "" }
              : r
          )
        )

        try {
          const out = await generateReportAction(query, 24)

          if (cancelRef.current) return

          if (out?.ok && out.saved?.report) {
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
                r.company === company.name
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
                r.company === company.name
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
              r.company === company.name
                ? { ...r, error: "Unexpected error. Please try again.", isLoading: false }
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

  // ── Single company (old flow) ─────────────────────────────────────────────

  async function generateOne(companyName: string) {
    const query = QUERY_OVERRIDES[companyName] ?? companyName

    setReports((prev) =>
      prev.map((r) =>
        r.company === companyName
          ? { ...r, isLoading: true, error: "", motions: [], context: "", brief: null }
          : r
      )
    )

    const attempt = async () => generateMotions({ topic: query })

    try {
      let result = await attempt()
      let motions = result.success ? result.data?.motions ?? [] : []

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
              r.company === companyName
                ? { ...r, error: "No meaningful coverage found in the last 24 hours.", isLoading: false }
                : r
            )
          )
          return
        }

        setReports((prev) =>
          prev.map((r) =>
            r.company === companyName
              ? { ...r, motions, context: result.data?.context ?? "", error: "", isLoading: false }
              : r
          )
        )
      } else {
        setReports((prev) =>
          prev.map((r) =>
            r.company === companyName
              ? { ...r, error: result.error || "Failed to generate report", isLoading: false }
              : r
          )
        )
      }
    } catch (err) {
      if (cancelRef.current) return
      setReports((prev) =>
        prev.map((r) =>
          r.company === companyName
            ? { ...r, error: "Unexpected error. Please try again.", isLoading: false }
            : r
        )
      )
    }
  }

  // ── Run all (old flow) ────────────────────────────────────────────────────

  async function runAll() {
    if (isRunningAll) return
    cancelRef.current = false
    setIsRunningAll(true)

    try {
      for (const company of selectedCompanies) {
        if (cancelRef.current) return
        await generateOne(company.name)
        await sleep(300)
      }
    } finally {
      setIsRunningAll(false)
    }
  }

  // ── PDF download ──────────────────────────────────────────────────────────

  async function downloadPdf(companyName: string, report: any) {
    const company = ALL_COMPANIES.find((c) => c.name === companyName)
    if (!company) return

    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedCompanyIds: [company.id],
        report,
      }),
    })

    if (!res.ok) {
      alert("PDF export failed")
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${companyName}-daily-brief.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const anyLoading =
    isRunningAll ||
    isScraping ||
    isGeneratingDaily ||
    reports.some((r) => r.isLoading)

  // Only show report cards for selected companies
  const visibleReports = reports.filter((r) =>
    selectedCompanies.some((c) => c.name === r.company)
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6">
      {/* ── Control card ── */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Daily report generator
          </CardTitle>
          <CardDescription>
            Select companies, fetch articles, then generate reports.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Company picker ── */}
          <div className="flex flex-col gap-3">
            <input
              type="search"
              placeholder="Search by name, ticker, or industry…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {filteredCompanies.length} / {ALL_COMPANIES.length} shown
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="text-primary hover:underline text-sm"
                >
                  {allFilteredSelected ? "Deselect filtered" : "Select all filtered"}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:underline text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            <ul className="divide-y divide-border rounded-md border border-border max-h-56 overflow-y-auto bg-card">
              {filteredCompanies.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No companies match your search.
                </li>
              )}
              {filteredCompanies.map((company) => {
                const checked = selectedIds.has(company.id)
                return (
                  <li
                    key={company.id}
                    onClick={() => toggleOne(company.id)}
                    className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(company.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border accent-primary"
                      aria-label={`Select ${company.name}`}
                    />
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {company.name}
                      </span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {company.ticker && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            {company.ticker}
                          </span>
                        )}
                        {company.country && (
                          <span className="text-xs text-muted-foreground">{company.country}</span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <p className="text-sm text-muted-foreground">
              Selected: <span className="font-bold text-foreground">{selectedIds.size}</span>
            </p>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex flex-wrap gap-3 items-center">
            <Button type="button" onClick={scrapeAll} disabled={anyLoading}>
              {isScraping ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching…</>
              ) : (
                <>Fetch latest articles</>
              )}
            </Button>

            <Button
              type="button"
              onClick={generateAllFromScrape}
              disabled={anyLoading || !scrapeCount || selectedIds.size === 0}
            >
              {isGeneratingDaily ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating from scrape…</>
              ) : (
                <>Generate daily report</>
              )}
            </Button>

            <Button
              type="button"
              onClick={runAll}
              disabled={anyLoading || selectedIds.size === 0}
              variant="outline"
            >
              {isRunningAll ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Generate all reports (old)</>
              )}
            </Button>

            <Button type="button" variant="outline" onClick={resetAll} disabled={anyLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>

            {scrapeCount !== null && (
              <span className="text-sm text-muted-foreground">
                Fetched {scrapeCount} articles.
              </span>
            )}
          </div>

          {scrapeError && (
            <p className="text-sm text-destructive">{scrapeError}</p>
          )}

          {scrapedArticles.length > 0 && (
            <div className="w-full mt-2 space-y-2">
              <div className="text-sm font-medium">Fetched articles (preview)</div>
              {scrapedArticles.map((a, i) => (
                <div key={i} className="text-sm">
                  <a className="underline" href={a.url} target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {a.source ? `${a.source} • ` : ""}{a.publishedAt}
                  </div>
                  {a.snippet && (
                    <div className="text-xs text-muted-foreground">{a.snippet}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Company report cards (only selected companies) ── */}
      {visibleReports.map((r) => (
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
                        {item.category && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary whitespace-nowrap">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.reasoning}</p>
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