// scripts/make-pdf.cjs
// Linq Advisors — Daily Intelligence Briefing PDF generator
// Drop this file into /scripts/make-pdf.cjs (replaces the existing one)

const fs   = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// ── Palette ──────────────────────────────────────────────────────────────────
const SAGE       = "#1C3A2E";
const CREAM      = "#F7F4EF";
const BORDER     = "#DDD8CF";
const TEXT_DARK  = "#1C1810";
const TEXT_MID   = "#5A554E";
const TEXT_LIGHT = "#8A8580";
const WHITE      = "#FFFFFF";

const RISK_COLORS = {
  Low:      { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Medium:   { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  High:     { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  Critical: { bg: "#F3E8FF", text: "#6B21A8", dot: "#9333EA" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function setFill(doc, hex)   { doc.fillColor(hex); }
function setStroke(doc, hex) { doc.strokeColor(hex); }

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function inferRisk(report) {
  const text = JSON.stringify(report || "").toLowerCase();
  if (text.includes("critical") || text.includes("attack") || text.includes("crisis") || text.includes("catastrophic")) return "Critical";
  if (text.includes("high risk") || text.includes("warning") || text.includes("threat") || text.includes("surge") || text.includes("volatile")) return "High";
  if (text.includes("monitor") || text.includes("watch") || text.includes("pressure") || text.includes("concern")) return "Medium";
  return "Low";
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

// ── Layout constants ──────────────────────────────────────────────────────────
const PAGE_W  = 595.28;   // A4
const PAGE_H  = 841.89;
const MARGIN  = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Drawing primitives ────────────────────────────────────────────────────────

function drawPageBackground(doc) {
  setFill(doc, WHITE);
  doc.rect(0, 0, PAGE_W, PAGE_H).fill();
}

function drawHeader(doc, companyName, dateStr) {
  // Dark green header bar
  setFill(doc, SAGE);
  doc.rect(0, 0, PAGE_W, 72).fill();

  // Linq Advisors wordmark (left)
  setFill(doc, "rgba(255,255,255,0.55)");
  doc.fontSize(8).font("Helvetica").fillColor([255, 255, 255, 0.55]);
  doc.opacity(0.55).text("LINQ ADVISORS", MARGIN, 20, { characterSpacing: 2 }).opacity(1);

  // Company name (left, large)
  doc.fontSize(18).font("Helvetica-Bold").fillColor(WHITE)
     .text(companyName || "", MARGIN, 32, { lineBreak: false });

  // Date (right)
  doc.fontSize(8).font("Helvetica").fillColor(WHITE).opacity(0.55)
     .text(dateStr, 0, 54, { align: "right", width: PAGE_W - MARGIN, lineBreak: false })
     .opacity(1);
}

function drawFooter(doc, pageNum) {
  const y = PAGE_H - 36;
  setFill(doc, BORDER);
  doc.rect(MARGIN, y, CONTENT_W, 0.5).fill();

  doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_LIGHT).opacity(0.8)
     .text("Linq Advisors · Confidential · Daily Intelligence Briefing", MARGIN, y + 8, { lineBreak: false })
     .text(`Page ${pageNum}`, 0, y + 8, { align: "right", width: PAGE_W - MARGIN, lineBreak: false })
     .opacity(1);
}

function drawRiskBadge(doc, risk, x, y) {
  const colors = RISK_COLORS[risk] || RISK_COLORS.Low;
  const label  = `${risk.toUpperCase()} RISK`;
  const badgeW = 90;
  const badgeH = 20;

  const [br, bg, bb] = hexToRgb(colors.bg);
  doc.roundedRect(x, y, badgeW, badgeH, 4).fill([br, bg, bb]);

  // dot
  const [dr, dg, db] = hexToRgb(colors.dot);
  doc.circle(x + 10, y + badgeH / 2, 3).fill([dr, dg, db]);

  // label
  const [tr, tg, tb] = hexToRgb(colors.text);
  doc.fontSize(7).font("Helvetica-Bold").fillColor([tr, tg, tb])
     .text(label, x + 18, y + 6, { lineBreak: false, characterSpacing: 0.5 });
}

function drawSectionLabel(doc, label, y) {
  doc.fontSize(7).font("Helvetica-Bold").fillColor(SAGE).opacity(0.7)
     .text(label.toUpperCase(), MARGIN, y, { characterSpacing: 1.5, lineBreak: false })
     .opacity(1);
  return y + 13;
}

function drawDivider(doc, y) {
  setFill(doc, BORDER);
  doc.rect(MARGIN, y, CONTENT_W, 0.5).fill();
  return y + 12;
}

function drawBullets(doc, items, y, maxItems = 4) {
  if (!items || items.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN + 8, y);
    return y + 16;
  }
  const list = items.slice(0, maxItems);
  list.forEach(item => {
    const text = String(item).replace(/\[[\d,]+\]/g, "").trim(); // strip citation refs
    setFill(doc, SAGE);
    doc.circle(MARGIN + 5, y + 5, 2).fill();
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
       .text(text, MARGIN + 14, y, { width: CONTENT_W - 14, lineBreak: true });
    y = doc.y + 4;
  });
  return y;
}

function drawKeyStories(doc, stories, y, maxStories = 3) {
  if (!stories || stories.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN + 8, y);
    return y + 16;
  }
  stories.slice(0, maxStories).forEach((s, i) => {
    const title = String(s.title || "Story").trim();
    const reason = String(s.reason || "").trim();

    // Story number circle
    const [sr, sg, sb] = hexToRgb(SAGE);
    doc.circle(MARGIN + 7, y + 6, 7).fill([sr, sg, sb, 0.12]);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(SAGE)
       .text(String(i + 1), MARGIN + 4, y + 3, { lineBreak: false });

    doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT_DARK)
       .text(title, MARGIN + 18, y, { width: CONTENT_W - 18 });
    y = doc.y;

    if (reason) {
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_LIGHT)
         .text(reason, MARGIN + 18, y, { width: CONTENT_W - 18 });
      y = doc.y;
    }
    y += 8;
  });
  return y;
}

// ── Cover page ────────────────────────────────────────────────────────────────

function drawCoverPage(doc, companies, dateStr) {
  drawPageBackground(doc);

  // Full-height sage sidebar
  setFill(doc, SAGE);
  doc.rect(0, 0, 220, PAGE_H).fill();

  // Linq Advisors logo area
  doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.5)
     .text("LINQ ADVISORS", 36, 48, { characterSpacing: 2.5 }).opacity(1);

  doc.fontSize(28).font("Helvetica-Bold").fillColor(WHITE)
     .text("Daily\nIntelligence\nBriefing", 36, 80, { lineBreak: true });

  doc.fontSize(10).font("Helvetica").fillColor(WHITE).opacity(0.6)
     .text("Reputation Management\n& Corporate Intelligence", 36, 185).opacity(1);

  // Date pill on sidebar
  setFill(doc, "rgba(255,255,255,0.12)");
  doc.roundedRect(36, PAGE_H - 100, 148, 28, 6).fill();
  doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.8)
     .text(dateStr, 36, PAGE_H - 93, { width: 148, align: "center" }).opacity(1);

  // Right side — entity list
  const rx = 260;
  doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT_LIGHT).opacity(0.7)
     .text("ENTITIES COVERED", rx, 60, { characterSpacing: 1.5 }).opacity(1);

  doc.fontSize(7).font("Helvetica").fillColor(TEXT_LIGHT)
     .text(`${companies.length} companies · Last 24 hours`, rx, 76);

  // Horizontal rule
  setFill(doc, BORDER);
  doc.rect(rx, 92, PAGE_W - rx - MARGIN, 0.5).fill();

  let ey = 106;
  companies.forEach((name, i) => {
    if (ey > PAGE_H - 80) return;
    const ini = initials(name);

    // Avatar circle
    const [ar, ag, ab] = hexToRgb(SAGE);
    doc.circle(rx + 12, ey + 10, 10).fill([ar, ag, ab, 0.1]);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(SAGE)
       .text(ini, rx + 6, ey + 6, { lineBreak: false });

    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT_DARK)
       .text(name, rx + 26, ey + 5, { lineBreak: false });

    // subtle number
    doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
       .text(String(i + 1).padStart(2, "0"), PAGE_W - MARGIN - 10, ey + 6, { lineBreak: false });

    ey += 26;

    if (i < companies.length - 1) {
      setFill(doc, BORDER);
      doc.rect(rx + 26, ey - 4, PAGE_W - rx - MARGIN - 26, 0.4).fill();
    }
  });

  // Confidential footer
  doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_LIGHT).opacity(0.6)
     .text("CONFIDENTIAL — For authorised recipients only. Not for distribution.", MARGIN + 180, PAGE_H - 30, { align: "center", width: PAGE_W - (MARGIN + 180) - MARGIN })
     .opacity(1);
}

// ── Company page ──────────────────────────────────────────────────────────────

function drawCompanyPage(doc, companyName, report, pageNum, dateStr) {
  drawPageBackground(doc);
  drawHeader(doc, companyName, dateStr);
  drawFooter(doc, pageNum);

  const risk = inferRisk(report);
  let y = 92;

  // Risk badge + "Intelligence Summary" label
  drawRiskBadge(doc, risk, MARGIN, y);
  doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
     .text("INTELLIGENCE SUMMARY", MARGIN + 100, y + 6, { characterSpacing: 1, lineBreak: false });
  y += 32;

  // ── KEY DEVELOPMENT ────────────────────────────────────────────────────────
  y = drawSectionLabel(doc, "Key Development", y);

  // Pull top 1-2 bullet from what_changed as the lead
  const changed = report?.what_changed ?? [];
  const lead = changed.slice(0, 1).map(s => String(s).replace(/\[[\d,]+\]/g, "").trim()).join(" ");

  if (lead) {
    // Accent left bar
    setFill(doc, SAGE);
    doc.rect(MARGIN, y, 3, 0).fill(); // will grow with text height
    doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT_DARK)
       .text(lead, MARGIN + 12, y, { width: CONTENT_W - 12 });
    // Draw bar to actual height
    const barH = doc.y - y + 4;
    doc.rect(MARGIN, y, 3, barH).fill();
    y = doc.y + 8;
  } else {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("No key developments reported.", MARGIN, y);
    y = doc.y + 8;
  }

  y = drawDivider(doc, y);

  // ── WHAT CHANGED ──────────────────────────────────────────────────────────
  y = drawSectionLabel(doc, "What Changed", y);
  y = drawBullets(doc, changed.slice(1), y, 3);
  y += 4;

  y = drawDivider(doc, y);

  // ── ANALYST COMMENTARY ────────────────────────────────────────────────────
  y = drawSectionLabel(doc, "Analyst Commentary", y);

  // why_it_matters = analyst commentary
  const commentary = (report?.why_it_matters ?? []).slice(0, 3);
  if (commentary.length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("—", MARGIN + 8, y);
    y = doc.y + 8;
  } else {
    // Light cream box
    const boxY = y;
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID);
    commentary.forEach((line, i) => {
      const text = String(line).replace(/\[[\d,]+\]/g, "").trim();
      doc.text(`${text}`, MARGIN + 10, y, { width: CONTENT_W - 20 });
      y = doc.y + (i < commentary.length - 1 ? 5 : 0);
    });
    const boxH = y - boxY + 8;
    const [cr, cg, cb] = hexToRgb(CREAM);
    doc.roundedRect(MARGIN, boxY - 4, CONTENT_W, boxH + 4, 6).fill([cr, cg, cb]);
    // Re-draw text on top
    y = boxY;
    commentary.forEach((line, i) => {
      const text = String(line).replace(/\[[\d,]+\]/g, "").trim();
      doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
         .text(text, MARGIN + 10, y, { width: CONTENT_W - 20 });
      y = doc.y + (i < commentary.length - 1 ? 5 : 0);
    });
    y += 12;
  }

  y = drawDivider(doc, y);

  // ── RECOMMENDED ACTIONS / WATCHPOINTS ─────────────────────────────────────
  y = drawSectionLabel(doc, "Recommended Actions & Watchpoints", y);
  y = drawBullets(doc, report?.watchpoints ?? [], y, 4);
  y += 8;

  y = drawDivider(doc, y);

  // ── KEY STORIES ───────────────────────────────────────────────────────────
  y = drawSectionLabel(doc, "Key Stories", y);
  drawKeyStories(doc, report?.key_stories ?? [], y, 3);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    const inputRaw = await readStdin();
    const { company, report, companyNames } = JSON.parse(inputRaw || "{}");

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title:   company === "__COVER__" ? "Linq Advisors — Daily Intelligence Briefing" : `Daily Intelligence Brief — ${company}`,
        Author:  "Linq Advisors",
        Subject: "Reputation Intelligence",
      },
    });

    const chunks = [];
    doc.on("data", c => chunks.push(c));
    const done = new Promise(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

    if (company === "__COVER__") {
      drawCoverPage(doc, companyNames || [], dateStr);
    } else {
      drawCompanyPage(doc, company || "", report || {}, 1, dateStr);
    }

    doc.end();
    const pdf = await done;
    process.stdout.write(pdf.toString("base64"));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
