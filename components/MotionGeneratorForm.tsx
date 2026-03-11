"use client"

console.log("✅ MotionGeneratorForm loaded from /components")

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateMotions } from "@/app/actions/generate-motions"
import type { Motion } from "@/types/actions"
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, ExternalLink,
  FileText, TrendingUp, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Plus, Pencil, Trash2, GripVertical, X, Save, Settings2, Wand2
} from "lucide-react"

import { scrapeNewsAction, scrapeOneCompanyAction } from "@/app/actions/scrape-news"
import { generateReportAction } from "@/app/actions/generate-report"
import type { Company } from "@/data/companies"

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

type ModalMode = "manager" | "add" | "edit" | null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

const EMPTY_FORM = { name: "", ticker: "", country: "", market: "", industry: "", tags: "" }

export function MotionGeneratorForm() {
  // ── Companies (loaded from API) ───────────────────────────────────────────
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setAllCompanies(data)
        setSelectedIds(new Set(data.map((c: Company) => c.id)))
        setReports(data.map((c: Company) => ({
          company: c.name, context: "", motions: [], error: "", isLoading: false, brief: null, done: false,
        })))
      })
      .catch(() => {})
      .finally(() => setCompaniesLoading(false))
  }, [])

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState("")
  const [savingCompany, setSavingCompany] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillError, setAutoFillError] = useState("")

  function openManager() { setModalMode("manager") }

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError("")
    setAutoFillError("")
    setEditingId(null)
    setModalMode("add")
  }

  function openEdit(company: Company) {
    setForm({
      name: company.name,
      ticker: company.ticker ?? "",
      country: company.country ?? "",
      market: company.market ?? "",
      industry: company.industry ?? "",
      tags: (company.tags ?? []).join(", "),
    })
    setFormError("")
    setAutoFillError("")
    setEditingId(company.id)
    setModalMode("edit")
  }

  function closeModal() {
    setModalMode(null)
    setEditingId(null)
    setFormError("")
    setAutoFillError("")
  }

  function backToManager() {
    setModalMode("manager")
    setEditingId(null)
    setFormError("")
    setAutoFillError("")
  }

  // ── AI Auto-fill ──────────────────────────────────────────────────────────
  async function autoFill() {
    if (!form.name.trim()) {
      setAutoFillError("Please enter a company name first.")
      return
    }
    setAutoFilling(true)
    setAutoFillError("")

    try {
      const res = await fetch("/api/autofill-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim() }),
      })
      const parsed = await res.json()
      if (!res.ok) {
        setAutoFillError("Auto-fill failed. Please fill in the details manually.")
        return
      }
      setForm((f) => ({
        ...f,
        ticker: parsed.ticker ?? f.ticker,
        country: parsed.country ?? f.country,
        market: parsed.market ?? f.market,
        industry: parsed.industry ?? f.industry,
        tags: Array.isArray(parsed.tags) ? parsed.tags.join(", ") : f.tags,
      }))
    } catch (e: any) {
      setAutoFillError("Auto-fill failed. Please fill in the details manually.")
    } finally {
      setAutoFilling(false)
    }
  }

  async function saveCompany() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSavingCompany(true)
    setFormError("")

    const isNew = !(modalMode === "edit" && editingId)
    const payload: Company = {
      id: modalMode === "edit" && editingId ? editingId : slugify(form.name),
      name: form.name.trim(),
      ...(form.ticker && { ticker: form.ticker.trim() }),
      ...(form.country && { country: form.country.trim() }),
      ...(form.market && { market: form.market.trim() }),
      ...(form.industry && { industry: form.industry.trim() }),
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      ...(isNew && { addedAt: new Date().toISOString() }),
    }

    try {
      if (modalMode === "add") {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? "Failed to add company"); return }
        setAllCompanies((prev) => [...prev, payload])
        setNewIds((prev) => new Set([...prev, payload.id]))
        setSelectedIds((prev) => new Set([...prev, payload.id]))
        setReports((prev) => [...prev, {
          company: payload.name, context: "", motions: [], error: "", isLoading: false, brief: null, done: false,
        }])
      } else {
        const res = await fetch(`/api/companies/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? "Failed to update company"); return }
        setAllCompanies((prev) => prev.map((c) => c.id === editingId ? payload : c))
        setReports((prev) => prev.map((r) => {
          const old = allCompanies.find((c) => c.id === editingId)
          return old && r.company === old.name ? { ...r, company: payload.name } : r
        }))
      }
      backToManager()
    } finally {
      setSavingCompany(false)
    }
  }

  async function deleteCompany(id: string) {
    if (!confirm("Are you sure you want to delete this company?")) return
    setDeletingId(id)
    try {
      await fetch(`/api/companies/${id}`, { method: "DELETE" })
      const removed = allCompanies.find((c) => c.id === id)
      setAllCompanies((prev) => prev.filter((c) => c.id !== id))
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      if (removed) setReports((prev) => prev.filter((r) => r.company !== removed.name))
    } finally {
      setDeletingId(null)
    }
  }

  function onDragStart(index: number) { setDragIndex(index) }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const next = [...allCompanies]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setAllCompanies(next)
    setDragIndex(index)
  }
  async function onDragEnd() {
    setDragIndex(null)
    await fetch("/api/companies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(allCompanies),
    })
  }

  // ── Picker state ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerQuery, setPickerQuery] = useState("")
  const [expandedArticles, setExpandedArticles] = useState(false)
  const [progressCount, setProgressCount] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [retryCompany, setRetryCompany] = useState<string | null>(null)

  const selectedCompanies = useMemo(
    () => allCompanies.filter((c) => selectedIds.has(c.id)),
    [allCompanies, selectedIds]
  )

  const filteredCompanies = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return allCompanies
    return allCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.ticker && c.ticker.toLowerCase().includes(q)) ||
        (c.industry && c.industry.toLowerCase().includes(q)) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)))
    )
  }, [pickerQuery, allCompanies])

  const filteredIds = filteredCompanies.map((c) => c.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (allFilteredSelected) filteredIds.forEach((id) => n.delete(id))
      else filteredIds.forEach((id) => n.add(id))
      return n
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  // ── Reports state ─────────────────────────────────────────────────────────
  const [reports, setReports] = useState<CompanyReport[]>([])
  const [isRunningAll, setIsRunningAll] = useState(false)
  const cancelRef = useRef(false)
  const [scrapeError, setScrapeError] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeCount, setScrapeCount] = useState<number | null>(null)
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false)
  const [scrapedArticles, setScrapedArticles] = useState<any[]>([])
  const [scrapeElapsed, setScrapeElapsed] = useState(0)
  const scrapeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrapeStartRef = useRef<number>(0)

  const resetAll = () => {
    cancelRef.current = true
    setIsRunningAll(false)
    setReports(allCompanies.map((c) => ({
      company: c.name, context: "", motions: [], error: "", isLoading: false, brief: null, done: false,
    })))
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
    setScrapeElapsed(0)
    scrapeStartRef.current = Date.now()
    scrapeTimerRef.current = setInterval(() => {
      setScrapeElapsed(Math.floor((Date.now() - scrapeStartRef.current) / 1000))
    }, 1000)
    try {
      const res = await scrapeNewsAction(Array.from(selectedIds))
      if (res?.ok) {
        setScrapeCount(res.count ?? 0)
        setScrapedArticles(res.articles ?? [])
      } else {
        setScrapeError("Scrape failed — no response returned. Please try again.")
      }
    } catch (e: any) {
      setScrapeError(e?.message ?? "An unexpected error occurred while fetching articles.")
    } finally {
      if (scrapeTimerRef.current) clearInterval(scrapeTimerRef.current)
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
        setReports((prev) => prev.map((r) =>
          r.company === company.name ? { ...r, isLoading: true, error: "", motions: [], context: "", done: false } : r
        ))
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
              text: s.title ?? "Story", reasoning: s.reason ?? "", link: s.url ?? "", category: "daily brief",
            }))
            setReports((prev) => prev.map((r) =>
              r.company === company.name ? {
                ...r, brief: rep, context: contextText, motions: motionsFromStories,
                error: motionsFromStories.length === 0 && !contextText ? "No meaningful coverage found in the last 24 hours." : "",
                isLoading: false, done: true,
              } : r
            ))
          } else {
            setReports((prev) => prev.map((r) =>
              r.company === company.name ? { ...r, error: out?.error || "Failed to generate daily report", isLoading: false } : r
            ))
          }
        } catch {
          if (cancelRef.current) return
          setReports((prev) => prev.map((r) =>
            r.company === company.name ? { ...r, error: "Unexpected error. Please try again.", isLoading: false } : r
          ))
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
    setReports((prev) => prev.map((r) =>
      r.company === companyName ? { ...r, isLoading: true, error: "", motions: [], context: "", brief: null, done: false } : r
    ))
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
          setReports((prev) => prev.map((r) =>
            r.company === companyName ? { ...r, error: "No meaningful coverage found in the last 24 hours.", isLoading: false } : r
          ))
          return
        }
        setReports((prev) => prev.map((r) =>
          r.company === companyName ? { ...r, motions, context: result.data?.context ?? "", error: "", isLoading: false, done: true } : r
        ))
      } else {
        setReports((prev) => prev.map((r) =>
          r.company === companyName ? { ...r, error: result.error || "Failed to generate report", isLoading: false } : r
        ))
      }
    } catch {
      if (cancelRef.current) return
      setReports((prev) => prev.map((r) =>
        r.company === companyName ? { ...r, error: "Unexpected error. Please try again.", isLoading: false } : r
      ))
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
    const company = allCompanies.find((c) => c.name === companyName)
    if (!company) return
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCompanyIds: [company.id], report }),
    })
    if (!res.ok) { alert("PDF export failed. Please try again."); return }
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
  const visibleReports = reports.filter((r) => selectedCompanies.some((c) => c.name === r.company))
  const doneCount = visibleReports.filter((r) => r.done).length
  const errorCount = visibleReports.filter((r) => r.error && !r.isLoading).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-5">

      {/* ══ Manager modal ═══════════════════════════════════════════════════ */}
      {modalMode === "manager" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold">Manage Companies</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder · hover to edit or delete</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={openAdd} className="h-8 text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Add company
                </Button>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ul className="divide-y divide-border overflow-y-auto flex-1">
              {allCompanies.map((company, index) => (
                <li key={company.id} draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-3 px-6 py-3 group hover:bg-accent transition-colors ${dragIndex === index ? "opacity-40" : ""}`}>
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{company.name}</p>
                      {(company as any).addedAt && (Date.now() - new Date((company as any).addedAt).getTime()) < 7 * 24 * 60 * 60 * 1000 ? (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-xs font-medium text-primary">New</span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Existing</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {[company.country, company.industry].filter(Boolean).join(" · ")}
                      {company.ticker && <span className="ml-1.5 font-mono">{company.ticker}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(company)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="h-3 w-3" />Edit
                    </button>
                    <button onClick={() => deleteCompany(company.id)} disabled={deletingId === company.id}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      {deletingId === company.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><Trash2 className="h-3 w-3" />Delete</>}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{allCompanies.length} companies total</p>
              <Button variant="outline" size="sm" onClick={closeModal}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Add / Edit modal ════════════════════════════════════════════════ */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <button onClick={backToManager} className="text-xs text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1">
                  ← Back to list
                </button>
                <h2 className="text-base font-semibold">
                  {modalMode === "add" ? "Add company" : "Edit company"}
                </h2>
              </div>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Name + Auto-fill */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Apple"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && autoFill()}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFill}
                  disabled={autoFilling || !form.name.trim()}
                  className="shrink-0 gap-1.5 h-9"
                  title="Auto-fill company details with AI"
                >
                  {autoFilling
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Wand2 className="h-3.5 w-3.5" />}
                  {autoFilling ? "Filling…" : "Auto-fill"}
                </Button>
              </div>
              {autoFillError && <p className="text-xs text-destructive">{autoFillError}</p>}
              {!autoFillError && (
                <p className="text-xs text-muted-foreground">Type a company name and click Auto-fill to populate the fields below automatically.</p>
              )}
            </div>

            {/* Rest of fields */}
            <div className="space-y-3">
              {[
                { key: "ticker", label: "Ticker", placeholder: "e.g. AAPL" },
                { key: "country", label: "Country code", placeholder: "e.g. US, GB, NO" },
                { key: "market", label: "Market", placeholder: "e.g. NASDAQ, NYSE" },
                { key: "industry", label: "Industry", placeholder: "e.g. Technology" },
                { key: "tags", label: "Tags (comma separated)", placeholder: "e.g. software, cloud" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors ${autoFilling ? "opacity-60" : ""}`}
                  />
                </div>
              ))}
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={backToManager}>Cancel</Button>
              <Button size="sm" onClick={saveCompany} disabled={savingCompany}>
                {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" />Save</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN CARD ═══════════════════════════════════════════════════════ */}
      <Card className="border border-border shadow-md overflow-hidden">
        <div className="h-1 w-full bg-primary" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Daily Report Generator
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openManager} className="h-8 text-xs gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Manage companies
            </Button>
          </div>
          <CardDescription className="text-sm">
            Select companies, fetch articles, then generate reports.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {companiesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
            </div>
          ) : (
            <>
              <input
                type="search"
                placeholder="Search by name, ticker, or industry…"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span>{filteredCompanies.length} / {allCompanies.length} shown</span>
                <div className="flex gap-3">
                  <button type="button" onClick={toggleAllFiltered} className="text-primary hover:underline font-medium">
                    {allFilteredSelected ? "Deselect filtered" : "Select all filtered"}
                  </button>
                  <button type="button" onClick={clearSelection} className="text-muted-foreground hover:underline">Clear</button>
                </div>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border max-h-56 overflow-y-auto bg-card">
                {filteredCompanies.length === 0 && (
                  <li className="px-4 py-4 text-sm text-muted-foreground text-center">No companies match your search.</li>
                )}
                {filteredCompanies.map((company) => {
                  const checked = selectedIds.has(company.id)
                  return (
                    <li key={company.id} onClick={() => toggleOne(company.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none transition-colors ${checked ? "bg-primary/5" : "hover:bg-accent"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleOne(company.id)}
                        onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-border accent-primary" />
                      <div className="flex flex-1 items-center justify-between min-w-0">
                        <span className="text-sm font-medium truncate">{company.name}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {company.ticker && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">{company.ticker}</span>}
                          {company.country && <span className="text-xs text-muted-foreground">{company.country}</span>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-muted-foreground px-0.5">
                Selected: <span className="font-semibold text-foreground">{selectedIds.size}</span>
              </p>
            </>
          )}

          {isShowingProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{isGeneratingDaily ? "Generating" : "Running"} — {progressCount} of {progressTotal}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {!isShowingProgress && (doneCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-3 text-xs">
              {doneCount > 0 && <span className="flex items-center gap-1.5 text-primary font-medium"><CheckCircle2 className="h-3.5 w-3.5" />{doneCount} report{doneCount > 1 ? "s" : ""} ready</span>}
              {errorCount > 0 && <span className="flex items-center gap-1.5 text-destructive font-medium"><XCircle className="h-3.5 w-3.5" />{errorCount} failed</span>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" onClick={scrapeAll} disabled={anyLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isScraping ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching…</> : <>Fetch latest articles</>}
            </Button>
            {isScraping && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                ~ {Math.max(0, Math.round(selectedIds.size * 9) - scrapeElapsed)}s left
              </span>
            )}
            <Button type="button" onClick={generateAllFromScrape} disabled={anyLoading || !scrapeCount || selectedIds.size === 0}>
              {isGeneratingDaily ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><TrendingUp className="mr-2 h-4 w-4" />Generate daily report</>}
            </Button>
            <Button type="button" onClick={runAll} disabled={anyLoading || selectedIds.size === 0} variant="outline">
              {isRunningAll ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate all (old)</>}
            </Button>
            <Button type="button" variant="ghost" onClick={resetAll} disabled={anyLoading} className="text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4" />Reset
            </Button>
          </div>

          {scrapeError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Failed to fetch articles</p>
                <p className="text-xs text-muted-foreground">{scrapeError}</p>
                <button type="button" onClick={scrapeAll} className="text-xs text-destructive hover:underline font-medium">Try again →</button>
              </div>
            </div>
          )}

          {scrapedArticles.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
              <button type="button" onClick={() => setExpandedArticles((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {scrapedArticles.length} article{scrapedArticles.length > 1 ? "s" : ""} fetched
                </span>
                {expandedArticles ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedArticles && (
                <div className="divide-y divide-border">
                  {scrapedArticles.map((a, i) => (
                    <div key={i} className="px-4 py-3 space-y-1">
                      <a href={a.url} target="_blank" rel="noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary flex items-start gap-1.5 group">
                        <span className="flex-1 leading-snug">{a.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {a.source && <span className="font-medium">{a.source}</span>}
                        {a.source && a.publishedAt && <span>·</span>}
                        {a.publishedAt && <span>{a.publishedAt}</span>}
                      </div>
                      {a.snippet && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{a.snippet}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ REPORT CARDS ════════════════════════════════════════════════════ */}
      {visibleReports.map((r) => (
        <Card key={r.company} className={`border transition-all duration-200 ${
          r.done ? "border-primary/30 bg-primary/5"
          : r.error && !r.isLoading ? "border-destructive/20 bg-destructive/5"
          : "border-border"}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {r.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  : r.done ? <CheckCircle2 className="h-4 w-4 text-primary" />
                  : r.error ? <XCircle className="h-4 w-4 text-destructive" />
                  : <Sparkles className="h-4 w-4 text-muted-foreground" />}
                {r.company}
              </CardTitle>
              {r.brief && (
                <Button type="button" variant="outline" size="sm" onClick={() => downloadPdf(r.company, r.brief)} className="h-7 text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />PDF
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.error && !r.isLoading ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">{r.error}</p>
                  <button type="button" onClick={() => generateOne(r.company)} disabled={anyLoading}
                    className="text-xs text-destructive hover:underline font-medium disabled:opacity-50">
                    {retryCompany === r.company ? "Retrying…" : "Retry →"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {r.context && <p className="text-sm text-muted-foreground leading-relaxed">{r.context}</p>}
                {r.motions.map((item, idx) => (
                  <Card key={idx} className="group border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-background">
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-sm leading-snug font-semibold">{item.text}</CardTitle>
                        {item.category && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary whitespace-nowrap shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.reasoning}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-primary hover:underline underline-offset-4">
                          Read full article <ExternalLink className="h-3 w-3" />
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