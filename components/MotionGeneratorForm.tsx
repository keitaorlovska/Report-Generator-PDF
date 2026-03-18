"use client"

console.log("✅ MotionGeneratorForm loaded from /components")

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateMotions } from "@/app/actions/generate-motions"
import type { Motion } from "@/types/actions"
import { Sparkles, Loader2, AlertCircle, RefreshCw, ExternalLink, FileText, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"

import { scrapeNewsAction } from "@/app/actions/scrape-news"
import { generateReportAction } from "@/app/actions/generate-report"
import { COMPANIES as ALL_COMPANIES } from "@/data/companies"

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
  done?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function MotionGeneratorForm() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(ALL_COMPANIES.map((c) => c.id))
  )
  const [pickerQuery, setPickerQuery] = useState("")
  const [expandedArticles, setExpandedArticles] = useState(false)
  const [progressCount, setProgressCount] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [retryCompany, setRetryCompany] = useState<string | null>(null)

  const selectedCompanies = useMemo(
    () => ALL_COMPANIES.filter((c) => selectedIds.has(c.id)),
    [selectedIds]
  )

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

  const makeInitialReports = (companies: typeof ALL_COMPANIES): CompanyReport[] =>
    companies.map((c) => ({
      company: c.name,
      context: "",
      motions: [],
      error: "",
      isLoading: false,
      brief: null,
      done: false,
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
    setProgressCount(0)
    setProgressTotal(0)
  }

  async function scrapeAll() {
    setIsScraping(true)
    setScrapeError("")
    setScrapedArticles([])
    setScrapeCount(null)
    try {
      const res = await scrapeNewsAction(Array.from(selectedIds))
      if (res?.ok) {
        setScrapeCount(res.count ?? 0)
        setScrapedArticles(res.articles ?? [])
      } else {
        setScrapeError("Scrape failed — no response returned. Please try again.")
        setScrapeCount(null)
      }
    } catch (e: any) {
      setScrapeError(e?.message ?? "An unexpected error occurred while fetching articles.")
      setScrapeCount(null)
    } finally {
      setIsScraping(false)
    }
  }

  async function generateAllFromScrape() {
    if (isGeneratingDaily) return
    cancelRef.current = false
    setIsGeneratingDaily(true)
    setProgressCount(0)
    setProgressTotal(selectedCompanies.length)

    try {
      for (const company of selectedCompanies) {
        if (cancelRef.current) return
        const query = QUERY_OVERRIDES[company.name] ?? company.name

        setReports((prev) =>
          prev.map((r) =>
            r.company === company.name
              ? { ...r, isLoading: true, error: "", motions: [], context: "", done: false }
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
            ].filter(Boolean).join(" ")

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
                      error: motionsFromStories.length === 0 && !contextText
                        ? "No meaningful coverage found in the last 24 hours."
                        : "",
                      isLoading: false,
                      done: true,
                    }
                  : r
              )
            )
          } else {
            setReports((prev) =>
              prev.map((r) =>
                r.company === company.name
                  ? { ...r, error: out?.error || "Failed to generate daily report", isLoading: false, done: false }
                  : r
              )
            )
          }
        } catch (err) {
          if (cancelRef.current) return
          setReports((prev) =>
            prev.map((r) =>
              r.company === company.name
                ? { ...r, error: "Unexpected error. Please try again.", isLoading: false, done: false }
                : r
            )
          )
        }

        setProgressCount((prev) => prev + 1)
        await sleep(250)
      }
    } finally {
      setIsGeneratingDaily(false)
    }
  }

  async function generateOne(companyName: string) {
    const query = QUERY_OVERRIDES[companyName] ?? companyName
    setRetryCompany(companyName)

    setReports((prev) =>
      prev.map((r) =>
        r.company === companyName
          ? { ...r, isLoading: true, error: "", motions: [], context: "", brief: null, done: false }
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
              ? { ...r, motions, context: result.data?.context ?? "", error: "", isLoading: false, done: true }
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
    } finally {
      setRetryCompany(null)
    }
  }

  async function runAll() {
    if (isRunningAll) return
    cancelRef.current = false
    setIsRunningAll(true)
    setProgressCount(0)
    setProgressTotal(selectedCompanies.length)

    try {
      for (const company of selectedCompanies) {
        if (cancelRef.current) return
        await generateOne(company.name)
        setProgressCount((prev) => prev + 1)
        await sleep(300)
      }
    } finally {
      setIsRunningAll(false)
    }
  }

  async function downloadPdf(companyName: string, report: any) {
    const company = ALL_COMPANIES.find((c) => c.name === companyName)
    if (!company) return

    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCompanyIds: [company.id], report }),
    })

    if (!res.ok) {
      alert("PDF export failed. Please try again.")
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

  const anyLoading = isRunningAll || isScraping || isGeneratingDaily || reports.some((r) => r.isLoading)
  const isShowingProgress = (isRunningAll || isGeneratingDaily) && progressTotal > 0
  const progressPercent = progressTotal > 0 ? Math.round((progressCount / progressTotal) * 100) : 0

  const visibleReports = reports.filter((r) =>
    selectedCompanies.some((c) => c.name === r.company)
  )

  const doneCount = visibleReports.filter((r) => r.done).length
  const errorCount = visibleReports.filter((r) => r.error && !r.isLoading).length

  return (
    <div className="w-full space-y-5">

      {/* ── Control card ── */}
      <Card className="border border-border shadow-md overflow-hidden">
        {/* Colored top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Daily Report Generator
          </CardTitle>
          <CardDescription className="text-sm">
            Select companies, fetch articles, then generate reports.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Company picker ── */}
          <div className="flex flex-col gap-2">
            <input
              type="search"
              placeholder="Search by name, ticker, or industry…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <span>{filteredCompanies.length} / {ALL_COMPANIES.length} shown</span>
              <div className="flex gap-3">
                <button type="button" onClick={toggleAllFiltered} className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                  {allFilteredSelected ? "Deselect filtered" : "Select all filtered"}
                </button>
                <button type="button" onClick={clearSelection} className="text-muted-foreground hover:underline">
                  Clear
                </button>
              </div>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border max-h-56 overflow-y-auto bg-card">
              {filteredCompanies.length === 0 && (
                <li className="px-4 py-4 text-sm text-muted-foreground text-center">
                  No companies match your search.
                </li>
              )}
              {filteredCompanies.map((company) => {
                const checked = selectedIds.has(company.id)
                return (
                  <li
                    key={company.id}
                    onClick={() => toggleOne(company.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors ${checked ? "bg-emerald-50/50 dark:bg-emerald-950/30" : "hover:bg-accent"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(company.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border accent-emerald-600"
                      aria-label={`Select ${company.name}`}
                    />
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{company.name}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {company.ticker && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
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

            <p className="text-xs text-muted-foreground px-0.5">
              Selected: <span className="font-semibold text-foreground">{selectedIds.size}</span>
            </p>
          </div>

          {/* ── Progress bar ── */}
          {isShowingProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  {isGeneratingDaily ? "Generating reports" : "Running"} — {progressCount} of {progressTotal}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Summary badges (after completion) ── */}
          {!isShowingProgress && (doneCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-3 text-xs">
              {doneCount > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {doneCount} report{doneCount > 1 ? "s" : ""} ready
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <XCircle className="h-3.5 w-3.5" />
                  {errorCount} failed
                </span>
              )}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              onClick={scrapeAll}
              disabled={anyLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
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
              variant="default"
            >
              {isGeneratingDaily ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
              ) : (
                <><TrendingUp className="mr-2 h-4 w-4" />Generate daily report</>
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
                <><Sparkles className="mr-2 h-4 w-4" />Generate all (old)</>
              )}
            </Button>

            <Button type="button" variant="ghost" onClick={resetAll} disabled={anyLoading} className="text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* ── Scrape error ── */}
          {scrapeError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Failed to fetch articles</p>
                <p className="text-xs text-muted-foreground">{scrapeError}</p>
                <button
                  type="button"
                  onClick={scrapeAll}
                  className="text-xs text-destructive hover:underline font-medium"
                >
                  Try again →
                </button>
              </div>
            </div>
          )}

          {/* ── Fetched articles preview ── */}
          {scrapedArticles.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedArticles((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {scrapedArticles.length} article{scrapedArticles.length > 1 ? "s" : ""} fetched
                </span>
                {expandedArticles
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {expandedArticles && (
                <div className="divide-y divide-border">
                  {scrapedArticles.map((a, i) => (
                    <div key={i} className="px-4 py-3 space-y-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 flex items-start gap-1.5 group"
                      >
                        <span className="flex-1 leading-snug">{a.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {a.source && <span className="font-medium">{a.source}</span>}
                        {a.source && a.publishedAt && <span>·</span>}
                        {a.publishedAt && <span>{a.publishedAt}</span>}
                      </div>
                      {a.snippet && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{a.snippet}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Company report cards ── */}
      {visibleReports.map((r) => (
        <Card
          key={r.company}
          className={`border transition-all duration-200 ${
            r.done
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20"
              : r.error && !r.isLoading
              ? "border-destructive/20 bg-destructive/5"
              : "border-border"
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {r.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                ) : r.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : r.error ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                )}
                {r.company}
              </CardTitle>
              {r.brief && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPdf(r.company, r.brief)}
                  className="h-7 text-xs gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">Last 24 hours</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Error state with retry */}
            {r.error && !r.isLoading ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">{r.error}</p>
                  <button
                    type="button"
                    onClick={() => generateOne(r.company)}
                    disabled={anyLoading}
                    className="text-xs text-destructive hover:underline font-medium disabled:opacity-50"
                  >
                    {retryCompany === r.company ? "Retrying…" : "Retry →"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {r.context && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.context}</p>
                )}

                {r.motions.map((item, idx) => (
                  <Card
                    key={idx}
                    className="group border border-border hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-200 bg-background"
                  >
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-sm leading-snug font-semibold">{item.text}</CardTitle>
                        {item.category && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.reasoning}</p>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-4"
                        >
                          Read full article
                          <ExternalLink className="h-3 w-3" />
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
