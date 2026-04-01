export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
// @ts-ignore
import PDFDocument from "pdfkit";

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

function inferRisk(report: any): string {
  const rs = report?.riskScore;
  if (["Low","Medium","High","Critical"].includes(rs?.overall)) return rs.overall;
  const stored = report?.riskLevel;
  if (["Low","Medium","High","Critical"].includes(stored)) return stored;
  const text = JSON.stringify(report || "").toLowerCase();
  const score =
    (text.includes("attack")||text.includes("crisis")||text.includes("fraud")||text.includes("scandal")) ? 4
    : (text.includes("lawsuit")||text.includes("investigation")||text.includes("breach")||text.includes("threat")) ? 3
    : (text.includes("pressure")||text.includes("concern")||text.includes("regulatory")) ? 2
    : 1;
  return ["Low","Low","Medium","High","Critical"][score];
}

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;

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
     .text(dateStr, 0, 54, { align: "right", width: PAGE_W-MARGIN, lineBreak: false }).opacity(1);
}

function drawFooter(doc: any) {
  const y = PAGE_H - 36;
  doc.fillColor(BORDER).rect(MARGIN, y, CONTENT_W, 0.5).fill();
  doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_LIGHT).opacity(0.8)
     .text("Linq Advisors · Confidential · Daily Intelligence Briefing", MARGIN, y+8, { lineBreak: false }).opacity(1);
}

function drawRiskBadge(doc: any, risk: string, x: number, y: number) {
  const colors = RISK_COLORS[risk] || RISK_COLORS.Low;
  doc.roundedRect(x, y, 90, 20, 4).fill(hexToRgb(colors.bg));
  doc.circle(x+10, y+10, 3).fill(hexToRgb(colors.dot));
  doc.fontSize(7).font("Helvetica-Bold").fillColor(hexToRgb(colors.text))
     .text(risk.toUpperCase()+" RISK", x+18, y+6, { lineBreak: false, characterSpacing: 0.5 });
}

function drawRiskBreakdown(doc: any, riskScore: any, y: number): number {
  if (!riskScore) return y;
  const dims = [
    { label: "Reputational", value: riskScore.reputational ?? "Low" },
    { label: "Regulatory",   value: riskScore.regulatory   ?? "Low" },
    { label: "Operational",  value: riskScore.operational  ?? "Low" },
    { label: "Financial",    value: riskScore.financial    ?? "Low" },
  ];
  const colW = (CONTENT_W - 12) / 4;
  dims.forEach((dim, i) => {
    const cx = MARGIN + i * (colW + 4);
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
    doc.fontSize(7).font("Helvetica-Bold").fillColor(WHITE).text(String(i+1), MARGIN+4, y+3, { lineBreak: false });
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName: string = body.companyName ?? body.company ?? "Company";
    const report: any = body.report ?? {};
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const pdf = await new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Daily Brief — ${companyName}`, Author: "Linq Advisors" } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      drawPageBackground(doc);
      drawHeader(doc, companyName, dateStr);
      const risk = inferRisk(report);
      let y = 92;

      drawRiskBadge(doc, risk, MARGIN, y);
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
         .text("INTELLIGENCE SUMMARY", MARGIN+100, y+6, { characterSpacing: 1, lineBreak: false });
      y += 30;

      if (report?.riskScore) { y = drawRiskBreakdown(doc, report.riskScore, y); y += 4; }
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

      drawFooter(doc);
      doc.end();
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${companyName}-daily-brief.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to generate PDF" }, { status: 500 });
  }
}