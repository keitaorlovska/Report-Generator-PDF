with open("components/MotionGeneratorForm.tsx", encoding="utf-8") as f:
    content = f.read()
content = content.replace("const [isExportingConcise, setIsExportingConcise] = useState(false)","const [isExportingConcise, setIsExportingConcise] = useState(false)\n  const [isSendingBriefing, setIsSendingBriefing] = useState(false)")
fn = '  async function sendBriefing() {\n    const doneReports = visibleReports.filter((r) => r.done && r.brief)\n    if (doneReports.length === 0) return\n    setIsSendingBriefing(true)\n    try {\n      const res = await fetch("/api/send-briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reports: doneReports.map((r) => ({ company: r.company, brief: r.brief })) }) })\n      if (!res.ok) { alert("Failed to send briefing. Please try again."); return }\n      alert("Briefing sent!")\n    } finally { setIsSendingBriefing(false) }\n  }\n\n  async function downloadConcisePdf() {'
content = content.replace("  async function downloadConcisePdf() {", fn, 1)
btn = '{isExportingConcise ? "Building\u2026" : "Morning Brief"}\n                  </button>\n                  <button onClick={sendBriefing} disabled={anyLoading || isSendingBriefing} className="sage-btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 500, cursor: "pointer", color: "white", border: "none" }}>\n                    {isSendingBriefing ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Bell style={{ width: 12, height: 12 }} />}\n                    {isSendingBriefing ? "Sending..." : "Send Briefing"}\n                  </button>'
content = content.replace('{isExportingConcise ? "Building\u2026" : "Morning Brief"}\n                  </button>', btn, 1)
with open("components/MotionGeneratorForm.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done!")
