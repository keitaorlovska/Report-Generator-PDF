// ─────────────────────────────────────────────────────────────────────────────
// PATCH: MotionGeneratorForm.tsx
// Add a "Morning Brief PDF" button that bundles all done reports into one
// concise Linq-branded PDF and downloads it.
//
// 1. Add this function alongside the existing `downloadPdf` function:
// ─────────────────────────────────────────────────────────────────────────────

  async function downloadConcisePdf() {
    // Collect all reports that have a completed brief
    const doneReports = reports
      .filter((r) => r.done && r.brief)
      .map((r) => {
        const company = allCompanies.find((c) => c.name === r.company)
        return {
          company: r.company,
          overall: company?.overall ?? "LOW",   // add `overall` to your Company type if not present
          risks:   company?.risks   ?? {},       // add `risks`   to your Company type if not present
          brief:   r.brief,
        }
      })

    if (doneReports.length === 0) {
      alert("No completed reports to export yet.")
      return
    }

    const res = await fetch("/api/export/pdf-concise", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reports: doneReports }),
    })

    if (!res.ok) { alert("Morning brief PDF export failed. Please try again."); return }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `morning-brief-${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

// ─────────────────────────────────────────────────────────────────────────────
// 2. Add this button in the JSX, next to the existing "Run All" / generate
//    buttons. Find the section that renders the action buttons (roughly around
//    the `runAll` button) and add:
// ─────────────────────────────────────────────────────────────────────────────

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadConcisePdf}
                disabled={anyLoading || doneCount === 0}
                className="h-8 text-xs gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Morning Brief PDF
              </Button>

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: `FileText` is already imported in your file from lucide-react.
// `doneCount` is already computed as:
//   const doneCount = visibleReports.filter((r) => r.done).length
//
// If your Company type doesn't have `overall` and `risks` fields yet,
// either add them or pass sensible defaults in the map above.
// The script gracefully falls back to "LOW" / {} if missing.
// ─────────────────────────────────────────────────────────────────────────────
