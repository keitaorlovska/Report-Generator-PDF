export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
// @ts-ignore
import PDFDocument from "pdfkit";
import { PDFDocument as PDFLib } from "pdf-lib";

// ── Palette ──────────────────────────────────────────────────────────────────
const SAGE       = "#1C3A2E";
const CREAM      = "#F7F4EF";
const BORDER     = "#DDD8CF";
const TEXT_DARK  = "#1C1810";
const TEXT_MID   = "#5A554E";
const TEXT_LIGHT = "#8A8580";
const WHITE      = "#FFFFFF";

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Low:      { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Medium:   { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  High:     { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  Critical: { bg: "#F3E8FF", text: "#6B21A8", dot: "#9333EA" },
};

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function initials(name: string) {
  return (name || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
}

function inferRisk(report: any): string {
  const rs = report?.riskScore;
  if (["Low","Medium","High","Critical"].includes(rs?.overall)) return rs.overall;
  const stored = report?.riskLevel;
  if (["Low","Medium","High","Critical"].includes(stored)) return stored;
  const text = JSON.stringify(report || "").toLowerCase();
  const score =
    (text.includes("attack")||text.includes("crisis")||text.includes("fraud")||text.includes("scandal")||text.includes("criminal")||text.includes("arrested")) ? 4
    : (text.includes("lawsuit")||text.includes("investigation")||text.includes("breach")||text.includes("threat")||text.includes("hack")||text.includes("violation")) ? 3
    : (text.includes("pressure")||text.includes("concern")||text.includes("regulatory")||text.includes("scrutiny")||text.includes("warning")) ? 2
    : 1;
  return ["Low","Low","Medium","High","Critical"][score];
}

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;

function makePdf(drawFn: (doc: any) => void): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Linq Advisors", Author: "Linq Advisors" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    drawFn(doc);
    doc.end();
  });
}

async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFLib.create();
  for (const buf of buffers) {
    const doc = await PDFLib.load(buf);
    const pages = await merged.copyPages(doc, Array.from({ length: doc.getPageCount() }, (_, i) => i));
    pages.forEach(p => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawPageBackground(doc: any) {
  doc.fillColor(WHITE).rect(0,0,PAGE_W,PAGE_H).fill();
}

function drawHeader(doc: any, companyName: string, dateStr: string) {
  doc.fillColor(SAGE).rect(0,0,PAGE_W,72).fill();
  doc.opacity(0.55).fontSize(8).font("Helvetica").fillColor(WHITE)
     .text("LINQ ADVISORS", MARGIN, 20, { characterSpacing: 2 }).opacity(1);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(WHITE)
     .text(companyName || "", MARGIN, 32, { lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(WHITE).opacity(0.55)
     .text(dateStr, 0, 54, { align: "right", width: PAGE_W - MARGIN, lineBreak: false }).opacity(1);
}

function drawRiskBadge(doc: any, risk: string, x: number, y: number) {
  const colors = RISK_COLORS[risk] || RISK_COLORS.Low;
  doc.roundedRect(x, y, 90, 20, 4).fill(hexToRgb(colors.bg));
  doc.circle(x+10, y+10, 3).fill(hexToRgb(colors.dot));
  doc.fontSize(7).font("Helvetica-Bold").fillColor(hexToRgb(colors.text))
     .text(risk.toUpperCase()+" RISK", x+18, y+6, { lineBreak: false, characterSpacing: 0.5 });
}

function drawRiskBreakdown(doc: any, riskScore: any, x: number, y: number): number {
  if (!riskScore) return y;
  const dims = [
    { label: "Reputational", value: riskScore.reputational ?? "Low" },
    { label: "Regulatory",   value: riskScore.regulatory   ?? "Low" },
    { label: "Operational",  value: riskScore.operational  ?? "Low" },
    { label: "Financial",    value: riskScore.financial    ?? "Low" },
  ];
  const colW = (CONTENT_W - 12) / 4;
  dims.forEach((dim, i) => {
    const cx = x + i * (colW + 4);
    const colors = RISK_COLORS[dim.value] || RISK_COLORS.Low;
    doc.roundedRect(cx, y, colW, 28, 5).fill(hexToRgb(colors.bg));
    doc.fontSize(7).font("Helvetica-Bold").fillColor(hexToRgb(colors.text))
       .text(dim.label.toUpperCase(), cx, y+5, { width: colW, align: "center", characterSpacing: 0.4, lineBreak: false });
    doc.fontSize(9).font("Helvetica-Bold").fillColor(hexToRgb(colors.text))
       .text(dim.value, cx, y+15, { width: colW, align: "center", lineBreak: false });
  });
  return y + 36;
}

function drawSectionLabel(doc: any, label: string, y: number): number {
  doc.fontSize(7).font("Helvetica-Bold").fillColor(SAGE).opacity(0.7)
     .text(label.toUpperCase(), MARGIN, y, { characterSpacing: 1.5, lineBreak: false }).opacity(1);
  return y + 13;
}

function drawDivider(doc: any, y: number): number {
  doc.fillColor(BORDER).rect(MARGIN, y, CONTENT_W, 0.5).fill();
  return y + 12;
}

function drawBullets(doc: any, items: string[], y: number, maxItems = 4): number {
  if (!items || items.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN+8, y);
    return doc.y + 8;
  }
  items.slice(0, maxItems).forEach(item => {
    const text = String(item).replace(/\[[\d,]+\]/g,"").trim();
    doc.fillColor(SAGE).circle(MARGIN+5, y+5, 2).fill();
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
       .text(text, MARGIN+14, y, { width: CONTENT_W-14 });
    y = doc.y + 4;
  });
  return y;
}

function drawKeyStories(doc: any, stories: any[], y: number, maxStories = 3): number {
  if (!stories || stories.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN+8, y);
    return doc.y + 8;
  }
  stories.slice(0, maxStories).forEach((s, i) => {
    const title = String(s.title || "Story").trim();
    const reason = String(s.reason || "").trim();
    doc.circle(MARGIN+7, y+6, 7).fill(hexToRgb(SAGE));
    doc.fontSize(7).font("Helvetica-Bold").fillColor(WHITE)
       .text(String(i+1), MARGIN+4, y+3, { lineBreak: false });
    if (s.url) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(SAGE)
         .text(title, MARGIN+18, y, { width: CONTENT_W-18, link: s.url });
    } else {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT_DARK)
         .text(title, MARGIN+18, y, { width: CONTENT_W-18 });
    }
    y = doc.y;
    if (reason) {
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_LIGHT)
         .text(reason, MARGIN+18, y, { width: CONTENT_W-18 });
      y = doc.y;
    }
    if (s.url) {
      const domain = (() => { try { return new URL(s.url).hostname.replace("www.",""); } catch { return s.url; } })();
      doc.fontSize(7.5).font("Helvetica").fillColor(SAGE).opacity(0.7)
         .text(domain, MARGIN+18, y, { width: CONTENT_W-18, link: s.url, lineBreak: false }).opacity(1);
      y = doc.y;
    }
    y += 8;
  });
  return y;
}

// ── Cover page ────────────────────────────────────────────────────────────────

function generateCoverPage(companies: string[], dateStr: string, totalPages: number): Promise<Buffer> {
  return makePdf((doc) => {
    drawPageBackground(doc);
    doc.fillColor(SAGE).rect(0,0,220,PAGE_H).fill();
    doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.5)
       .text("LINQ ADVISORS", 36, 48, { characterSpacing: 2.5 }).opacity(1);
    doc.fontSize(28).font("Helvetica-Bold").fillColor(WHITE)
       .text("Daily\nIntelligence\nBriefing", 36, 80);
    doc.fontSize(10).font("Helvetica").fillColor(WHITE).opacity(0.6)
       .text("Reputation Management\n& Corporate Intelligence", 36, 185).opacity(1);
    doc.roundedRect(36, PAGE_H-100, 148, 28, 6).fill(hexToRgb("#254D3A"));
    doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.8)
       .text(dateStr, 36, PAGE_H-93, { width: 148, align: "center" }).opacity(1);

    const rx = 260;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_LIGHT).opacity(0.7)
       .text("ENTITIES COVERED", rx, 60, { characterSpacing: 1.5 }).opacity(1);
    doc.fontSize(7).font("Helvetica").fillColor(TEXT_LIGHT)
       .text(`${companies.length} companies · Last 24 hours`, rx, 76);
    doc.fillColor(BORDER).rect(rx, 92, PAGE_W-rx-MARGIN, 0.5).fill();

    let ey = 106;
    companies.forEach((name, i) => {
      if (ey > PAGE_H-80) return;
      const ini = initials(name);
      doc.rect(rx, ey, PAGE_W-rx-MARGIN, 22).fill(WHITE);
      doc.circle(rx+12, ey+10, 10).fill(hexToRgb(SAGE));
      doc.fontSize(7).font("Helvetica-Bold").fillColor(WHITE)
         .text(ini, rx+6, ey+6, { lineBreak: false });
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT_DARK)
         .text(name, rx+26, ey+5, { lineBreak: false });
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
         .text(String(i+2).padStart(2,"0"), PAGE_W-MARGIN-14, ey+6, { lineBreak: false });
      ey += 26;
      if (i < companies.length-1) {
        doc.fillColor(BORDER).rect(rx+26, ey-4, PAGE_W-rx-MARGIN-26, 0.4).fill();
      }
    });

    // Appendix entry
    if (ey <= PAGE_H-80) {
      doc.fillColor(BORDER).rect(rx+26, ey-4, PAGE_W-rx-MARGIN-26, 0.4).fill();
      doc.circle(rx+12, ey+10, 10).fill(hexToRgb(SAGE));
      doc.fontSize(7).font("Helvetica-Bold").fillColor(WHITE).text("A", rx+9, ey+6, { lineBreak: false });
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT_MID)
         .text("Appendix — Risk Grading Methodology", rx+26, ey+5, { lineBreak: false });
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
         .text(String(totalPages).padStart(2,"0"), PAGE_W-MARGIN-14, ey+6, { lineBreak: false });
    }

    doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_LIGHT).opacity(0.6)
       .text("CONFIDENTIAL — For authorised recipients only.", MARGIN+180, PAGE_H-30, { align: "center", width: PAGE_W-(MARGIN+180)-MARGIN })
       .opacity(1);
  });
}

// ── Company page ──────────────────────────────────────────────────────────────

function generateCompanyPage(companyName: string, report: any, dateStr: string): Promise<Buffer> {
  return makePdf((doc) => {
    drawPageBackground(doc);
    drawHeader(doc, companyName, dateStr);
    const risk = inferRisk(report);
    let y = 92;

    drawRiskBadge(doc, risk, MARGIN, y);
    doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
       .text("INTELLIGENCE SUMMARY", MARGIN+100, y+6, { characterSpacing: 1, lineBreak: false });
    y += 30;

    if (report?.riskScore) { y = drawRiskBreakdown(doc, report.riskScore, MARGIN, y); y += 4; }
    else { y += 6; }

    y = drawSectionLabel(doc, "Key Development", y);
    const changed = report?.what_changed ?? [];
    const noMentionsRe = /no (new |recent |meaningful )?(mention|coverage|article|update|news)|(no .{0,40}(last|past) \d+ hour)/i;
    const hasNoMentions = changed.some((s: string) => noMentionsRe.test(String(s)));
    const meaningful = changed.filter((s: string) => !noMentionsRe.test(String(s)));
    const lead = meaningful[0] ? String(meaningful[0]).replace(/\[[\d,]+\]/g,"").trim() : "";

    if (hasNoMentions) {
      doc.roundedRect(MARGIN, y, CONTENT_W, 22, 5).fill(hexToRgb("#FEF9EC"));
      doc.fontSize(8.5).font("Helvetica").fillColor("#92400E")
         .text("No new mentions in the last 24 hours — showing most recent known activity.", MARGIN+10, y+7, { width: CONTENT_W-20, lineBreak: false });
      y += 30;
    }
    if (lead) {
      doc.fillColor(SAGE).rect(MARGIN, y, 3, 0).fill();
      doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT_DARK).text(lead, MARGIN+12, y, { width: CONTENT_W-12 });
      const barH = doc.y - y + 4;
      doc.fillColor(SAGE).rect(MARGIN, y, 3, barH).fill();
      y = doc.y + 8;
    } else {
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("No recent activity to report.", MARGIN, y);
      y = doc.y + 8;
    }
    y = drawDivider(doc, y);

    y = drawSectionLabel(doc, "Recent Activity", y);
    y = drawBullets(doc, meaningful.slice(1), y, 3);
    y += 4;
    y = drawDivider(doc, y);

    y = drawSectionLabel(doc, "Analyst Commentary", y);
    const commentary = (report?.why_it_matters ?? []).slice(0, 3);
    if (commentary.length === 0) {
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN+8, y);
      y = doc.y + 8;
    } else {
      const boxY = y;
      let tempY = y;
      commentary.forEach((line: string, i: number) => {
        const text = String(line).replace(/\[[\d,]+\]/g,"").trim();
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID).text(text, MARGIN+10, tempY, { width: CONTENT_W-20 });
        tempY = doc.y + (i < commentary.length-1 ? 5 : 0);
      });
      const boxH = tempY - boxY + 8;
      doc.roundedRect(MARGIN, boxY-4, CONTENT_W, boxH+4, 6).fill(hexToRgb(CREAM));
      y = boxY;
      commentary.forEach((line: string, i: number) => {
        const text = String(line).replace(/\[[\d,]+\]/g,"").trim();
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID).text(text, MARGIN+10, y, { width: CONTENT_W-20 });
        y = doc.y + (i < commentary.length-1 ? 5 : 0);
      });
      y += 12;
    }
    y = drawDivider(doc, y);

    y = drawSectionLabel(doc, "Recommended Actions & Watchpoints", y);
    y = drawBullets(doc, report?.watchpoints ?? [], y, 4);
    y += 8;
    y = drawDivider(doc, y);

    y = drawSectionLabel(doc, "Key Stories", y);
    drawKeyStories(doc, report?.key_stories ?? [], y, 3);
  });
}

// ── Appendix page ─────────────────────────────────────────────────────────────

function generateAppendixPage(): Promise<Buffer> {
  return makePdf((doc) => {
    drawPageBackground(doc);
    doc.fillColor(SAGE).rect(0,0,PAGE_W,72).fill();
    doc.opacity(0.55).fontSize(8).font("Helvetica").fillColor(WHITE)
       .text("LINQ ADVISORS", MARGIN, 20, { characterSpacing: 2 }).opacity(1);
    doc.fontSize(18).font("Helvetica-Bold").fillColor(WHITE)
       .text("Appendix — Risk Grading Methodology", MARGIN, 32);

    let y = 92;
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
       .text("This briefing uses a structured four-dimension risk model to assess each entity's reputational exposure. Each dimension is scored independently by AI analysis of the latest intelligence, then combined into an overall risk signal.", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 20;

    y = drawSectionLabel(doc, "Risk Levels", y);
    y += 2;

    const levels = [
      { level: "Low",      color: RISK_COLORS.Low,      desc: "No meaningful threat identified. Coverage is routine or positive. No immediate action required." },
      { level: "Medium",   color: RISK_COLORS.Medium,   desc: "Minor concerns identified. Situation warrants monitoring but does not require escalation at this time." },
      { level: "High",     color: RISK_COLORS.High,     desc: "Active threat with clear evidence of reputational, regulatory, operational or financial exposure. Attention and response planning recommended." },
      { level: "Critical", color: RISK_COLORS.Critical, desc: "Crisis-level event. Immediate threat to brand integrity, operations, or legal standing. Escalation and active response required." },
    ];

    levels.forEach(({ level, color, desc }) => {
      doc.roundedRect(MARGIN, y, 80, 22, 5).fill(hexToRgb(color.bg));
      doc.circle(MARGIN+10, y+11, 3).fill(hexToRgb(color.dot));
      doc.fontSize(8).font("Helvetica-Bold").fillColor(hexToRgb(color.text))
         .text(level.toUpperCase(), MARGIN+18, y+7, { lineBreak: false, characterSpacing: 0.5 });
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
         .text(desc, MARGIN+92, y+4, { width: CONTENT_W-92 });
      y = Math.max(doc.y, y+28) + 8;
    });

    y = drawDivider(doc, y+4);
    y = drawSectionLabel(doc, "Risk Dimensions", y);
    y += 2;

    const dimensions = [
      { name: "Reputational Risk", icon: "R", desc: "Assesses exposure from negative press coverage, brand damage, public perception threats, and crisis communications risk." },
      { name: "Regulatory & Legal Risk", icon: "L", desc: "Evaluates signals of regulatory investigations, fines, sanctions, compliance failures, litigation, and legal exposure." },
      { name: "Operational Risk", icon: "O", desc: "Covers threats to business continuity including supply chain disruptions, leadership instability, cybersecurity incidents, and operational outages." },
      { name: "Financial Risk", icon: "F", desc: "Reflects market and financial exposure including stock price volatility, earnings pressure, analyst downgrades, and investor sentiment shifts." },
    ];

    dimensions.forEach(({ name, icon, desc }, idx) => {
      doc.circle(MARGIN+12, y+12, 12).fill(hexToRgb(SAGE));
      doc.fontSize(9).font("Helvetica-Bold").fillColor(WHITE).text(icon, MARGIN+8, y+7, { lineBreak: false });
      doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT_DARK).text(name, MARGIN+30, y, { width: CONTENT_W-30 });
      y = doc.y + 2;
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID).text(desc, MARGIN+30, y, { width: CONTENT_W-30 });
      y = doc.y + 14;
      if (idx < dimensions.length-1) {
        doc.fillColor(BORDER).rect(MARGIN+30, y-6, CONTENT_W-30, 0.5).fill();
        y += 4;
      }
    });

    y = drawDivider(doc, y+8);
    y = drawSectionLabel(doc, "Scoring Methodology", y);
    y += 4;
    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT_MID)
       .text("Risk scores are generated automatically by Claude (Anthropic) based on structured analysis of the news mentions collected for each entity within the reporting window. Scores reflect the content of the brief period only and should be interpreted in context. Linq Advisors recommends analyst review before acting on any Critical or High signal.", MARGIN, y, { width: CONTENT_W });
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────

interface ReportEntry { companyId: string; companyName: string; report: any; }

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const reports: ReportEntry[] = body.reports;
  if (!Array.isArray(reports) || reports.length === 0) {
    return NextResponse.json({ error: "No reports provided." }, { status: 400 });
  }

  try {
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const totalPages = reports.length + 2; // cover + companies + appendix
    const buffers: Buffer[] = [];

    buffers.push(await generateCoverPage(reports.map(r => r.companyName), dateStr, totalPages));

    for (const r of reports) {
      buffers.push(await generateCompanyPage(r.companyName, r.report, dateStr));
    }

    buffers.push(await generateAppendixPage());

    const combined = await mergePdfs(buffers);

    return new NextResponse(new Uint8Array(combined), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="linq-intelligence-briefing.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("Combined PDF export error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}