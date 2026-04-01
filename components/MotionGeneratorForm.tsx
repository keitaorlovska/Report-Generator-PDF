"use client"

console.log("✅ MotionGeneratorForm loaded from /components")

import { useEffect, useMemo, useRef, useState } from "react"
import { generateMotions } from "@/app/actions/generate-motions"
import type { Motion } from "@/types/actions"
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, ExternalLink,
  FileText, TrendingUp, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Plus, Pencil, Trash2, GripVertical, X, Save, Wand2,
  Bell, UserCircle, Download, Settings2
} from "lucide-react"
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

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }
  catch { return iso }
}

const EMPTY_FORM = { name: "", ticker: "", country: "", market: "", industry: "", tags: "" }

const SAGE = "#1C3A2E"
const CREAM = "#F7F4EF"
const BORDER = "#DDD8CF"

export function MotionGeneratorForm() {

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
  function openAdd() { setForm(EMPTY_FORM); setFormError(""); setAutoFillError(""); setEditingId(null); setModalMode("add") }
  function openEdit(company: Company) {
    setForm({ name: company.name, ticker: company.ticker ?? "", country: company.country ?? "", market: company.market ?? "", industry: company.industry ?? "", tags: (company.tags ?? []).join(", ") })
    setFormError(""); setAutoFillError(""); setEditingId(company.id); setModalMode("edit")
  }
  function closeModal() { setModalMode(null); setEditingId(null); setFormError(""); setAutoFillError("") }
  function backToManager() { setModalMode("manager"); setEditingId(null); setFormError(""); setAutoFillError("") }

  async function autoFill() {
    if (!form.name.trim()) { setAutoFillError("Please enter a company name first."); return }
    setAutoFilling(true); setAutoFillError("")
    try {
      const res = await fetch("/api/autofill-company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim() }) })
      const parsed = await res.json()
      if (!res.ok) { setAutoFillError("Auto-fill failed. Please fill in the details manually."); return }
      setForm((f) => ({ ...f, ticker: parsed.ticker ?? f.ticker, country: parsed.country ?? f.country, market: parsed.market ?? f.market, industry: parsed.industry ?? f.industry, tags: Array.isArray(parsed.tags) ? parsed.tags.join(", ") : f.tags }))
    } catch { setAutoFillError("Auto-fill failed. Please fill in the details manually.") }
    finally { setAutoFilling(false) }
  }

  async function saveCompany() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSavingCompany(true); setFormError("")
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
        const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? "Failed to add company"); return }
        setAllCompanies((prev) => [...prev, payload])
        setNewIds((prev) => new Set([...prev, payload.id]))
        setSelectedIds((prev) => new Set([...prev, payload.id]))
        setReports((prev) => [...prev, { company: payload.name, context: "", motions: [], error: "", isLoading: false, brief: null, done: false }])
      } else {
        const res = await fetch(`/api/companies/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) { setFormError(data.error ?? "Failed to update company"); return }
        setAllCompanies((prev) => prev.map((c) => c.id === editingId ? payload : c))
        setReports((prev) => prev.map((r) => { const old = allCompanies.find((c) => c.id === editingId); return old && r.company === old.name ? { ...r, company: payload.name } : r }))
      }
      backToManager()
    } finally { setSavingCompany(false) }
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
    } finally { setDeletingId(null) }
  }

  function onDragStart(index: number) { setDragIndex(index) }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const next = [...allCompanies]; const [moved] = next.splice(dragIndex, 1); next.splice(index, 0, moved)
    setAllCompanies(next); setDragIndex(index)
  }
  async function onDragEnd() {
    setDragIndex(null)
    await fetch("/api/companies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(allCompanies) })
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerQuery, setPickerQuery] = useState("")
  const [expandedArticles, setExpandedArticles] = useState(false)
  const [progressCount, setProgressCount] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [retryCompany, setRetryCompany] = useState<string | null>(null)

  const selectedCompanies = useMemo(() => allCompanies.filter((c) => selectedIds.has(c.id)), [allCompanies, selectedIds])
  const filteredCompanies = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return allCompanies
    return allCompanies.filter((c) => c.name.toLowerCase().includes(q) || (c.ticker && c.ticker.toLowerCase().includes(q)) || (c.industry && c.industry.toLowerCase().includes(q)) || (c.tags && c.tags.some((t) => t.toLowerCase().includes(q))))
  }, [pickerQuery, allCompanies])

  const filteredIds = filteredCompanies.map((c) => c.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  function toggleOne(id: string) { setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAllFiltered() { setSelectedIds((prev) => { const n = new Set(prev); if (allFilteredSelected) filteredIds.forEach((id) => n.delete(id)); else filteredIds.forEach((id) => n.add(id)); return n }) }
  function clearSelection() { setSelectedIds(new Set()) }

  const [reports, setReports] = useState<CompanyReport[]>([])
  const [isRunningAll, setIsRunningAll] = useState(false)
  const cancelRef = useRef(false)
  const [scrapeError, setScrapeError] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeCount, setScrapeCount] = useState<number | null>(null)
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false)
  const [scrapedArticles, setScrapedArticles] = useState<any[]>([])
  const [scrapeElapsed, setScrapeElapsed] = useState(0)
  const [isExportingAll, setIsExportingAll] = useState(false)
  const [isExportingConcise, setIsExportingConcise] = useState(false)
  const [isSendingBriefing, setIsSendingBriefing] = useState(false)
  const scrapeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrapeStartRef = useRef<number>(0)

  const resetAll = () => {
    cancelRef.current = true; setIsRunningAll(false)
    setReports(allCompanies.map((c) => ({ company: c.name, context: "", motions: [], error: "", isLoading: false, brief: null, done: false })))
    setIsScraping(false); setScrapeCount(null); setIsGeneratingDaily(false); setScrapeError(""); setProgressCount(0); setProgressTotal(0)
  }

  async function scrapeAll() {
    setIsScraping(true); setScrapeError(""); setScrapedArticles([]); setScrapeCount(null); setScrapeElapsed(0)
    scrapeStartRef.current = Date.now()
    scrapeTimerRef.current = setInterval(() => { setScrapeElapsed(Math.floor((Date.now() - scrapeStartRef.current) / 1000)) }, 1000)

    const allArticles: any[] = []
    let totalCount = 0

    try {
      const ids = Array.from(selectedIds)
      for (const id of ids) {
        if (cancelRef.current) break
        try {
          const res = await fetch("/api/scrape-news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedCompanyIds: [id] }),
          }).then((r) => r.json())

          if (res?.ok) {
            totalCount += res.count ?? 0
            allArticles.push(...(res.articles ?? []))
          }
        } catch {
          // skip failed individual company, continue with rest
        }
      }

      if (allArticles.length > 0) {
        setScrapeCount(totalCount)
        setScrapedArticles(allArticles.slice(0, 10))
      } else if (!cancelRef.current) {
        setScrapeError("No articles found. Please try again.")
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
    cancelRef.current = false; setIsGeneratingDaily(true); setProgressCount(0); setProgressTotal(selectedCompanies.length)
    try {
      for (const company of selectedCompanies) {
        if (cancelRef.current) return
        const query = QUERY_OVERRIDES[company.name] ?? company.name
        setReports((prev) => prev.map((r) => r.company === company.name ? { ...r, isLoading: true, error: "", motions: [], context: "", done: false } : r))
        try {
          const out = await generateReportAction(query, 24)
          if (cancelRef.current) return
          if (out?.ok && out.saved?.report) {
            const rep = out.saved.report
            const contextText = [...(rep.what_changed ?? []).slice(0, 3), ...(rep.why_it_matters ?? []).slice(0, 3)].filter(Boolean).join(" ")
            const motionsFromStories: Motion[] = (rep.key_stories ?? []).map((s: any) => ({ text: s.title ?? "Story", reasoning: s.reason ?? "", link: s.url ?? "", category: "daily brief" }))
            setReports((prev) => prev.map((r) => r.company === company.name ? { ...r, brief: rep, context: contextText, motions: motionsFromStories, error: motionsFromStories.length === 0 && !contextText ? "No meaningful coverage found in the last 24 hours." : "", isLoading: false, done: true } : r))
          } else {
            setReports((prev) => prev.map((r) => r.company === company.name ? { ...r, error: out?.error || "Failed to generate daily report", isLoading: false } : r))
          }
        } catch {
          if (cancelRef.current) return
          setReports((prev) => prev.map((r) => r.company === company.name ? { ...r, error: "Unexpected error. Please try again.", isLoading: false } : r))
        }
        setProgressCount((prev) => prev + 1); await sleep(250)
      }
    } finally { setIsGeneratingDaily(false) }
  }

  async function generateOne(companyName: string) {
    const query = QUERY_OVERRIDES[companyName] ?? companyName
    setRetryCompany(companyName)
    setReports((prev) => prev.map((r) => r.company === companyName ? { ...r, isLoading: true, error: "", motions: [], context: "", brief: null, done: false } : r))
    const attempt = async () => generateMotions({ topic: query })
    try {
      let result = await attempt(); let motions = result.success ? result.data?.motions ?? [] : []
      if ((motions.length === 0 || !result.success) && !cancelRef.current) { await sleep(1200); result = await attempt(); motions = result.success ? result.data?.motions ?? [] : [] }
      if (cancelRef.current) return
      if (result.success && result.data) {
        if (motions.length === 0 && !result.data.context) { setReports((prev) => prev.map((r) => r.company === companyName ? { ...r, error: "No meaningful coverage found in the last 24 hours.", isLoading: false } : r)); return }
        setReports((prev) => prev.map((r) => r.company === companyName ? { ...r, motions, context: result.data?.context ?? "", error: "", isLoading: false, done: true } : r))
      } else { setReports((prev) => prev.map((r) => r.company === companyName ? { ...r, error: result.error || "Failed to generate report", isLoading: false } : r)) }
    } catch {
      if (cancelRef.current) return
      setReports((prev) => prev.map((r) => r.company === companyName ? { ...r, error: "Unexpected error. Please try again.", isLoading: false } : r))
    } finally { setRetryCompany(null) }
  }

  async function runAll() {
    if (isRunningAll) return
    cancelRef.current = false; setIsRunningAll(true); setProgressCount(0); setProgressTotal(selectedCompanies.length)
    try { for (const company of selectedCompanies) { if (cancelRef.current) return; await generateOne(company.name); setProgressCount((prev) => prev + 1); await sleep(300) } }
    finally { setIsRunningAll(false) }
  }

  async function downloadPdf(companyName: string, report: any) {
    const company = allCompanies.find((c) => c.name === companyName)
    if (!company) return
    const res = await fetch("/api/export/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedCompanyIds: [company.id], report }) })
    if (!res.ok) { alert("PDF export failed. Please try again."); return }
    const blob = await res.blob(); const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `${companyName}-daily-brief.pdf`; a.click(); URL.revokeObjectURL(url)
  }

  async function downloadAllPdf() {
    const doneReports = visibleReports.filter((r) => r.done && r.brief)
    if (doneReports.length === 0) return
    setIsExportingAll(true)
    try {
      const res = await fetch("/api/export/pdf/combined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: doneReports.map((r) => ({
            companyId: allCompanies.find((c) => c.name === r.company)?.id ?? "",
            companyName: r.company,
            report: r.brief,
          }))
        }),
      })
      if (!res.ok) { alert("Combined PDF export failed. Please try again."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `daily-intelligence-briefing-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExportingAll(false)
    }
  }

  async function sendBriefing() {
    const doneReports = visibleReports.filter((r) => r.done && r.brief)
    if (doneReports.length === 0) return
    setIsSendingBriefing(true)
    try {
      const res = await fetch("/api/send-briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reports: doneReports.map((r) => ({ company: r.company, brief: r.brief })) }) })
      if (!res.ok) { alert("Failed to send briefing. Please try again."); return }
      alert("Briefing sent!")
    } finally { setIsSendingBriefing(false) }
  }

  async function downloadConcisePdf() {
    const doneReports = visibleReports.filter((r) => r.done && r.brief)
    if (doneReports.length === 0) return
    setIsExportingConcise(true)
    try {
      const res = await fetch("/api/export/pdf-concise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: doneReports.map((r) => ({
            company: r.company,
            brief: r.brief,
          }))
        }),
      })
      if (!res.ok) { alert("Morning brief PDF export failed. Please try again."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `morning-brief-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExportingConcise(false)
    }
  }

  const anyLoading = isRunningAll || isScraping || isGeneratingDaily || reports.some((r) => r.isLoading)
  const isShowingProgress = (isRunningAll || isGeneratingDaily) && progressTotal > 0
  const progressPercent = progressTotal > 0 ? Math.round((progressCount / progressTotal) * 100) : 0
  const visibleReports = reports.filter((r) => selectedCompanies.some((c) => c.name === r.company))
  const doneCount = visibleReports.filter((r) => r.done).length
  const errorCount = visibleReports.filter((r) => r.error && !r.isLoading).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
        .f-serif { font-family: 'Playfair Display', Georgia, serif !important; }
        .f-sans  { font-family: 'DM Sans', system-ui, sans-serif !important; }
        * { font-family: 'DM Sans', system-ui, sans-serif; }
        .chip-btn { transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .chip-btn:hover { border-color: #1C3A2E !important; background: rgba(28,58,46,0.05) !important; }
        .briefing-card { transition: box-shadow 0.2s, transform 0.2s; }
        .briefing-card:hover { box-shadow: 0 6px 24px rgba(28,58,46,0.09); transform: translateY(-1px); }
        .motion-inner { transition: box-shadow 0.15s; }
        .motion-inner:hover { box-shadow: 0 2px 10px rgba(28,58,46,0.1); }
        .sage-btn { background: #1C3A2E !important; }
        .sage-btn:hover { background: #2A5240 !important; }
        .sage-btn:disabled { opacity: 0.45; }
        .outline-sage { border: 1px solid #1C3A2E !important; color: #1C3A2E !important; }
        .outline-sage:hover { background: rgba(28,58,46,0.06) !important; }
        .outline-sage:disabled { opacity: 0.4; }
        .muted-btn { border: 1px solid #DDD8CF; color: #6B6560; background: white; }
        .muted-btn:hover { background: #F7F4EF; }
        .muted-btn:disabled { opacity: 0.4; }
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{ backgroundColor: SAGE }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }} className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles style={{ width: 14, height: 14, color: "rgba(255,255,255,0.9)" }} />
            </div>
            <span className="f-serif" style={{ color: "white", fontSize: 17, fontWeight: 500, letterSpacing: "0.02em" }}>Linq Advisors</span>
          </div>
          <div className="flex items-center gap-2">
            <button style={{ color: "rgba(255,255,255,0.55)", padding: "6px", borderRadius: 8, transition: "color 0.15s" }} className="hover:text-white">
              <Bell style={{ width: 16, height: 16 }} />
            </button>
            <button
              onClick={openManager}
              style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.22)", transition: "all 0.15s" }}
              className="hover:border-white/40 hover:text-white"
            >
              <Settings2 style={{ width: 13, height: 13 }} /> Entities
            </button>
            <button style={{ color: "rgba(255,255,255,0.55)", padding: "6px", borderRadius: 8 }}>
              <UserCircle style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: SAGE, paddingBottom: 40, paddingTop: 8 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Strategic Overview</p>
          <h1 className="f-serif" style={{ color: "white", fontSize: 38, fontWeight: 500, lineHeight: 1.15, marginBottom: 6 }}>Intelligence Feed</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Curated daily briefings and corporate risk assessments.</p>
        </div>
      </div>

      {/* ══ CONTENT ═════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px", marginTop: -16 }}>

        {/* ── Active Entities card ─────────────────────────────────────────── */}
        <div className="briefing-card" style={{ background: "white", borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 20 }}>

          <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: SAGE, marginBottom: 3 }}>Active Entities</p>
              <p style={{ fontSize: 12, color: "#8A8580" }}>{selectedIds.size} of {allCompanies.length} selected</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={toggleAllFiltered} className="muted-btn" style={{ fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 20, cursor: "pointer" }}>
                {allFilteredSelected ? "Deselect all" : "Select all"}
              </button>
              <button onClick={clearSelection} className="muted-btn" style={{ fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 20, cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </div>

          <div style={{ padding: "0 24px 14px" }}>
            <input
              type="search"
              placeholder="Search entities…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              style={{ width: "100%", borderRadius: 12, padding: "9px 16px", fontSize: 13, border: `1px solid ${BORDER}`, background: CREAM, color: "#2C2820", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {companiesLoading ? (
            <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 8, color: "#8A8580", fontSize: 13 }}>
              <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Loading entities…
            </div>
          ) : (
            <div style={{ padding: "0 24px 20px", display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {filteredCompanies.map((company) => {
                const selected = selectedIds.has(company.id)
                const isNew = (company as any).addedAt && (Date.now() - new Date((company as any).addedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
                return (
                  <button
                    key={company.id}
                    onClick={() => toggleOne(company.id)}
                    className="chip-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 12px 7px 8px", borderRadius: 12,
                      border: `1px solid ${selected ? SAGE : BORDER}`,
                      background: selected ? "rgba(28,58,46,0.07)" : "white",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600,
                      background: selected ? SAGE : "#EAE6DF",
                      color: selected ? "white" : "#6B6560",
                    }}>
                      {initials(company.name)}
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: selected ? SAGE : "#2C2820", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</span>
                      {company.country && <span style={{ display: "block", fontSize: 10, color: "#8A8580", marginTop: 1 }}>{company.country}{company.industry ? ` · ${company.industry}` : ""}</span>}
                    </span>
                    {isNew && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 20, background: "rgba(28,58,46,0.12)", color: SAGE }}>New</span>
                    )}
                  </button>
                )
              })}
              {filteredCompanies.length === 0 && (
                <p style={{ fontSize: 13, color: "#8A8580", padding: "8px 0" }}>No entities match your search.</p>
              )}
            </div>
          )}

          {isShowingProgress && (
            <div style={{ padding: "0 24px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A8580", marginBottom: 6 }}>
                <span>{isGeneratingDaily ? "Generating briefings" : "Running"} — {progressCount} of {progressTotal}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: "#EAE6DF", overflow: "hidden" }}>
                <div style={{ height: 4, borderRadius: 4, background: SAGE, width: `${progressPercent}%`, transition: "width 0.5s ease" }} />
              </div>
            </div>
          )}

          {!isShowingProgress && (doneCount > 0 || errorCount > 0) && (
            <div style={{ padding: "0 24px 16px", display: "flex", gap: 16, fontSize: 12 }}>
              {doneCount > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, color: SAGE, fontWeight: 500 }}><CheckCircle2 style={{ width: 13, height: 13 }} />{doneCount} briefing{doneCount > 1 ? "s" : ""} ready</span>}
              {errorCount > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#EF4444", fontWeight: 500 }}><XCircle style={{ width: 13, height: 13 }} />{errorCount} failed</span>}
            </div>
          )}

          {/* Action bar */}
          <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, background: "#FAFAF8", display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 10 }}>
            <button onClick={scrapeAll} disabled={anyLoading} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 500, color: "white", border: "none", cursor: "pointer" }}>
              {isScraping ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />Fetching…</> : <>Fetch latest articles</>}
            </button>

            {isScraping && (
              <span style={{ fontSize: 11, color: "#8A8580", display: "flex", alignItems: "center", gap: 5 }}>
                <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} />
                ~{Math.max(0, Math.round(selectedIds.size * 9) - scrapeElapsed)}s left
              </span>
            )}

            <button onClick={generateAllFromScrape} disabled={anyLoading || !scrapeCount || selectedIds.size === 0} className="outline-sage" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 500, background: "transparent", cursor: "pointer" }}>
              {isGeneratingDaily ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />Generating…</> : <><TrendingUp style={{ width: 14, height: 14 }} />Generate Daily Report</>}
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {doneCount > 0 && (
                <>
                  <button onClick={downloadAllPdf} disabled={anyLoading || isExportingAll} className="muted-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                    {isExportingAll ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 12, height: 12 }} />}
                    {isExportingAll ? "Exporting…" : `Export all (${doneCount})`}
                  </button>
                  <button onClick={downloadConcisePdf} disabled={anyLoading || isExportingConcise} className="muted-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer", borderColor: SAGE, color: SAGE }}>
                    {isExportingConcise ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <FileText style={{ width: 12, height: 12 }} />}
                    {isExportingConcise ? "Building…" : "Morning Brief"}
                  </button>
                  <button onClick={sendBriefing} disabled={anyLoading || isSendingBriefing} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer", color: "white", border: "none" }}>
                    {isSendingBriefing ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Bell style={{ width: 12, height: 12 }} />}
                    {isSendingBriefing ? "Sending..." : "Send Briefing"}
                  </button>
                </>
              )}
              <button onClick={runAll} disabled={anyLoading || selectedIds.size === 0} className="muted-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                <Sparkles style={{ width: 12, height: 12 }} />Legacy
              </button>
              <button onClick={resetAll} disabled={anyLoading} className="muted-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                <RefreshCw style={{ width: 12, height: 12 }} />Reset
              </button>
            </div>
          </div>

          {scrapeError && (
            <div style={{ margin: "0 24px 16px", borderRadius: 12, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", gap: 10 }}>
              <AlertCircle style={{ width: 15, height: 15, color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#B91C1C", marginBottom: 3 }}>Failed to fetch articles</p>
                <p style={{ fontSize: 11, color: "#EF4444" }}>{scrapeError}</p>
                <button onClick={scrapeAll} style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 4 }}>Try again →</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Fetched articles ─────────────────────────────────────────────── */}
        {scrapedArticles.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 20 }}>
            <button
              onClick={() => setExpandedArticles((v) => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", fontSize: 13, fontWeight: 500, color: "#2C2820", background: "none", border: "none", cursor: "pointer" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText style={{ width: 15, height: 15, color: SAGE }} />
                {scrapedArticles.length} article{scrapedArticles.length > 1 ? "s" : ""} fetched
              </span>
              {expandedArticles ? <ChevronUp style={{ width: 15, height: 15, color: "#8A8580" }} /> : <ChevronDown style={{ width: 15, height: 15, color: "#8A8580" }} />}
            </button>
            {expandedArticles && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {scrapedArticles.map((a, i) => (
                  <div key={i} style={{ padding: "14px 24px", borderBottom: i < scrapedArticles.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "flex-start", gap: 6, textDecoration: "none" }} className="group">
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#1C1810", lineHeight: 1.4, flex: 1 }}>{a.title}</span>
                      <ExternalLink style={{ width: 12, height: 12, color: SAGE, flexShrink: 0, marginTop: 3, opacity: 0.7 }} />
                    </a>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 11, color: "#8A8580" }}>
                      {a.source && <span style={{ fontWeight: 500 }}>{a.source}</span>}
                      {a.source && a.publishedAt && <span>·</span>}
                      {a.publishedAt && <span>{formatDate(a.publishedAt)}</span>}
                    </div>
                    {a.snippet && <p style={{ fontSize: 11, color: "#8A8580", marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.snippet}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleReports.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 8 }}>
            <h2 className="f-serif" style={{ fontSize: 26, fontWeight: 500, color: "#1C1810" }}>Recent Briefings</h2>
            {doneCount > 0 && <span style={{ fontSize: 11, color: "#8A8580" }}>Updated just now</span>}
          </div>
        )}

        {/* ══ BRIEFING CARDS ══════════════════════════════════════════════ */}
        {visibleReports.map((r) => (
          <div
            key={r.company}
            className="briefing-card"
            style={{
              background: r.done ? "rgba(28,58,46,0.02)" : r.error && !r.isLoading ? "#FFFBFB" : "white",
              borderRadius: 16,
              border: `1px solid ${r.done ? "rgba(28,58,46,0.22)" : r.error && !r.isLoading ? "#FECACA" : BORDER}`,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ marginTop: 2 }}>
                  {r.isLoading
                    ? <Loader2 style={{ width: 15, height: 15, color: SAGE, animation: "spin 1s linear infinite" }} />
                    : r.done ? <CheckCircle2 style={{ width: 15, height: 15, color: SAGE }} />
                    : r.error ? <XCircle style={{ width: 15, height: 15, color: "#EF4444" }} />
                    : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DDD8CF", marginTop: 4 }} />}
                </div>
                <div>
                  <h3 className="f-serif" style={{ fontSize: 20, fontWeight: 500, color: "#1C1810", lineHeight: 1.2 }}>{r.company}</h3>
                  <p style={{ fontSize: 11, color: "#8A8580", marginTop: 2 }}>Last 24 hours</p>
                </div>
              </div>
              {r.brief && (
                <button
                  onClick={() => downloadPdf(r.company, r.brief)}
                  className="muted-btn"
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer" }}
                >
                  <Download style={{ width: 12, height: 12 }} />PDF
                </button>
              )}
            </div>

            <div style={{ padding: "16px 24px 20px" }}>
              {r.error && !r.isLoading ? (
                <div style={{ borderRadius: 10, padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", gap: 10 }}>
                  <AlertCircle style={{ width: 14, height: 14, color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 13, color: "#6B7280" }}>{r.error}</p>
                    <button onClick={() => generateOne(r.company)} disabled={anyLoading} style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "none", border: "none", padding: "4px 0 0", cursor: "pointer" }}>
                      {retryCompany === r.company ? "Retrying…" : "Retry →"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {r.context && (
                    <p style={{ fontSize: 13, color: "#5A554E", lineHeight: 1.65 }}>{r.context}</p>
                  )}
                  {r.isLoading && !r.motions.length && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", fontSize: 13, color: "#8A8580" }}>
                      <Loader2 style={{ width: 14, height: 14, color: SAGE, animation: "spin 1s linear infinite" }} />
                      Generating briefing…
                    </div>
                  )}
                  {r.motions.map((item, idx) => (
                    <div
                      key={idx}
                      className="motion-inner"
                      style={{ borderRadius: 12, padding: "14px 16px", background: CREAM, border: `1px solid ${BORDER}` }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                        <h4 className="f-serif" style={{ fontSize: 15, fontWeight: 500, color: "#1C1810", lineHeight: 1.4 }}>{item.text}</h4>
                        {item.category && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 20, flexShrink: 0, background: "rgba(28,58,46,0.1)", color: SAGE }}>
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#7A7570", lineHeight: 1.6 }}>{item.reasoning}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: SAGE, textDecoration: "none", marginTop: 8 }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
                          Read full article <ExternalLink style={{ width: 11, height: 11 }} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ══ MANAGER MODAL ═══════════════════════════════════════════════════ */}
      {modalMode === "manager" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", padding: "0 16px" }}>
          <div style={{ background: "white", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: "100%", maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", border: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div>
                <h2 className="f-serif" style={{ fontSize: 20, fontWeight: 500, color: "#1C1810" }}>Manage Entities</h2>
                <p style={{ fontSize: 11, color: "#8A8580", marginTop: 2 }}>Drag to reorder · hover to edit or delete</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={openAdd} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 500, color: "white", border: "none", cursor: "pointer" }}>
                  <Plus style={{ width: 13, height: 13 }} />Add entity
                </button>
                <button onClick={closeModal} style={{ padding: 6, borderRadius: 8, color: "#8A8580", background: "none", border: "none", cursor: "pointer" }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            <ul style={{ overflowY: "auto", flex: 1, listStyle: "none", margin: 0, padding: 0 }}>
              {allCompanies.map((company, index) => (
                <li
                  key={company.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderBottom: `1px solid ${BORDER}`, cursor: "grab", opacity: dragIndex === index ? 0.4 : 1, transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAF8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <GripVertical style={{ width: 14, height: 14, color: "#C5C0B8", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#1C1810", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</span>
                      {(company as any).addedAt && (Date.now() - new Date((company as any).addedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
                        ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 20, background: "rgba(28,58,46,0.1)", color: SAGE }}>New</span>
                        : <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 6px", borderRadius: 20, background: "#EAE6DF", color: "#8A8580" }}>Existing</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#8A8580", marginTop: 2 }}>
                      {[company.country, company.industry].filter(Boolean).join(" · ")}
                      {company.ticker && <span style={{ fontFamily: "monospace", marginLeft: 6 }}>{company.ticker}</span>}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openEdit(company)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, fontSize: 11, color: "#6B6560", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F4F6")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                      <Pencil style={{ width: 11, height: 11 }} />Edit
                    </button>
                    <button onClick={() => deleteCompany(company.id)} disabled={deletingId === company.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, fontSize: 11, color: "#8A8580", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444" }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#8A8580" }}>
                      {deletingId === company.id ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> : <><Trash2 style={{ width: 11, height: 11 }} />Delete</>}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: "#8A8580" }}>{allCompanies.length} entities total</p>
              <button onClick={closeModal} className="muted-btn" style={{ padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD / EDIT MODAL ════════════════════════════════════════════════ */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", padding: "0 16px" }}>
          <div style={{ background: "white", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", width: "100%", maxWidth: 460, padding: "24px", border: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <button onClick={backToManager} style={{ fontSize: 11, color: "#8A8580", background: "none", border: "none", cursor: "pointer", padding: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>← Back to list</button>
                <h2 className="f-serif" style={{ fontSize: 20, fontWeight: 500, color: "#1C1810" }}>{modalMode === "add" ? "Add entity" : "Edit entity"}</h2>
              </div>
              <button onClick={closeModal} style={{ padding: 6, borderRadius: 8, color: "#8A8580", background: "none", border: "none", cursor: "pointer" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A8580", display: "block", marginBottom: 6 }}>Name *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. Apple"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && autoFill()}
                  style={{ flex: 1, borderRadius: 10, padding: "10px 14px", fontSize: 13, border: `1px solid ${BORDER}`, background: CREAM, color: "#2C2820", outline: "none" }}
                />
                <button onClick={autoFill} disabled={autoFilling || !form.name.trim()} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 500, color: "white", border: "none", cursor: "pointer", flexShrink: 0 }}>
                  {autoFilling ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Wand2 style={{ width: 13, height: 13 }} />}
                  {autoFilling ? "Filling…" : "Auto-fill"}
                </button>
              </div>
              {autoFillError
                ? <p style={{ fontSize: 11, color: "#EF4444", marginTop: 5 }}>{autoFillError}</p>
                : <p style={{ fontSize: 11, color: "#8A8580", marginTop: 5 }}>Type a name and click Auto-fill to populate fields automatically.</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[
                { key: "ticker", label: "Ticker", placeholder: "AAPL" },
                { key: "country", label: "Country code", placeholder: "US" },
                { key: "market", label: "Market", placeholder: "NASDAQ" },
                { key: "industry", label: "Industry", placeholder: "Technology" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A8580", display: "block", marginBottom: 5 }}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ width: "100%", borderRadius: 10, padding: "9px 12px", fontSize: 13, border: `1px solid ${BORDER}`, background: CREAM, color: "#2C2820", outline: "none", opacity: autoFilling ? 0.6 : 1, boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A8580", display: "block", marginBottom: 5 }}>Tags (comma separated)</label>
              <input
                type="text"
                placeholder="software, cloud, enterprise"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                style={{ width: "100%", borderRadius: 10, padding: "10px 14px", fontSize: 13, border: `1px solid ${BORDER}`, background: CREAM, color: "#2C2820", outline: "none", opacity: autoFilling ? 0.6 : 1, boxSizing: "border-box" }}
              />
            </div>

            {formError && <p style={{ fontSize: 11, color: "#EF4444", marginBottom: 12 }}>{formError}</p>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button onClick={backToManager} className="muted-btn" style={{ padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveCompany} disabled={savingCompany} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "white", border: "none", cursor: "pointer" }}>
                {savingCompany ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <><Save style={{ width: 14, height: 14 }} />Save entity</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}