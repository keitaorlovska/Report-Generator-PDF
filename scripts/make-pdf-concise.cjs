// scripts/make-pdf-concise.cjs
// Drop-in alongside make-pdf.cjs — same stdin/stdout contract, same PDFKit dep.
// Input:  { reports: [{ company, brief, overall, risks }] }  (JSON via stdin)
// Output: base64-encoded PDF on stdout

"use strict";

const path = require("path");
const fs   = require("fs");
const PDFDocument = require("pdfkit");

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  dark:    "#1A1A2E",   // deep navy  — header bg
  mid:     "#2E2E4E",   // mid navy   — intro strip bg
  accent:  "#C8A96E",   // gold       — labels, dividers
  white:   "#FFFFFF",
  offwhite:"#F5F5F0",
  text:    "#222222",
  muted:   "#666666",
  border:  "#DDDDDD",
  high:    "#C0392B",
  medium:  "#D4820A",
  low:     "#27AE60",
  none:    "#AAAAAA",
};

function riskColor(level = "") {
  switch (level.toUpperCase()) {
    case "HIGH":     return C.high;
    case "MEDIUM":   return C.medium;
    case "LOW":      return C.low;
    case "CRITICAL": return "#7B0000";
    default:         return C.none;
  }
}

// ── Stdin helper ──────────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end",  () => resolve(data));
    process.stdin.on("error", reject);
  });
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
const PAGE_W = 595.28;  // A4 points
const PAGE_H = 841.89;
const M      = 40;      // margin
const COL_W  = PAGE_W - M * 2;

// Draw a filled rectangle
function rect(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

// Draw a horizontal rule
function hRule(doc, y, color = C.border, thickness = 0.5) {
  doc.save()
    .moveTo(M, y).lineTo(PAGE_W - M, y)
    .lineWidth(thickness).strokeColor(color).stroke()
    .restore();
}

// Render a small coloured pill (background rect + white label)
function pill(doc, x, y, label, bgColor, pillW = 52, pillH = 13) {
  doc.save()
    .rect(x, y, pillW, pillH)
    .fill(bgColor)
    .restore();
  doc.save()
    .fontSize(6.5).fillColor(C.white)
    .font("Helvetica-Bold")
    .text(label, x, y + 2.5, { width: pillW, align: "center" })
    .restore();
  return pillW + 4; // spacing after pill
}

// Footer on every page
function drawFooter(doc, pageNum) {
  const y = PAGE_H - 28;
  hRule(doc, y - 4);
  doc.save()
    .fontSize(6.5).fillColor(C.muted).font("Helvetica")
    .text(
      `CONFIDENTIAL — For authorised recipients only. Not for distribution.   Linq Advisors · Daily Intelligence Briefing (Morning Edition) · Page ${pageNum}`,
      M, y, { width: COL_W, align: "center" }
    )
    .restore();
}

// ── Header (first page only) ──────────────────────────────────────────────────
function drawHeader(doc, date, counts) {
  const h = 88;
  rect(doc, 0, 0, PAGE_W, h, C.dark);

  // Gold accent bar
  rect(doc, 0, h - 2, PAGE_W, 2, C.accent);

  // Title
  doc.save()
    .font("Helvetica-Bold").fontSize(20).fillColor(C.white)
    .text("Daily Intelligence Briefing", M, 18, { width: 300 })
    .restore();

  doc.save()
    .font("Helvetica").fontSize(8).fillColor(C.accent)
    .text("MORNING EDITION  ·  CONCISE READ", M, 42)
    .restore();

  doc.save()
    .font("Helvetica").fontSize(7.5).fillColor("#CCCCCC")
    .text(`${date}  ·  Reputation Management & Corporate Intelligence`, M, 56)
    .restore();

  // Risk snapshot (right side)
  const snapX = PAGE_W - M - 160;
  doc.save()
    .font("Helvetica-Bold").fontSize(7).fillColor(C.accent)
    .text("RISK SNAPSHOT", snapX, 20, { width: 160, align: "right" })
    .restore();

  const snapY = 33;
  const snapLabels = [
    { label: `${counts.HIGH} HIGH`,   color: C.high   },
    { label: `${counts.MEDIUM} MED`,  color: C.medium },
    { label: `${counts.LOW} LOW`,     color: C.low    },
  ];
  let sx = snapX;
  snapLabels.forEach(({ label, color }) => {
    pill(doc, sx, snapY, label, color, 46, 14);
    sx += 50;
  });

  return h + 2; // return y after header
}

// ── Intro strip ───────────────────────────────────────────────────────────────
function drawIntro(doc, y, text) {
  const padV = 10, padH = M;
  // measure height
  const fakeH = 40; // estimated; PDFKit doesn't pre-measure easily
  rect(doc, 0, y, PAGE_W, fakeH, C.mid);
  doc.save()
    .font("Helvetica").fontSize(8).fillColor("#DDDDDD")
    .text(text, padH, y + padV, { width: COL_W, align: "left" })
    .restore();
  return y + fakeH + 8;
}

// ── Entity card ───────────────────────────────────────────────────────────────
// Returns y after the card
function drawEntityCard(doc, y, entity) {
  const { name, overall = "LOW", risks = {}, brief = {} } = entity;

  // Light background stripe on alternating cards handled externally if needed
  const startY = y;

  // ── Entity name + overall risk badge ─────────────────────────────────────
  doc.save()
    .font("Helvetica-Bold").fontSize(10).fillColor(C.dark)
    .text(name, M, y, { width: COL_W - 70, lineBreak: false })
    .restore();

  // Overall badge (right-aligned)
  const badgeW = 56, badgeH = 14;
  pill(doc, PAGE_W - M - badgeW, y - 1, overall.toUpperCase(), riskColor(overall), badgeW, badgeH);

  y += 17;

  // ── Four dimension pills (REP / REG / OPS / FIN) ──────────────────────────
  const dims = [
    { label: "REP", value: risks.REP ?? risks.rep ?? "—" },
    { label: "REG", value: risks.REG ?? risks.reg ?? "—" },
    { label: "OPS", value: risks.OPS ?? risks.ops ?? "—" },
    { label: "FIN", value: risks.FIN ?? risks.fin ?? "—" },
  ];

  let px = M;
  dims.forEach(({ label, value }) => {
    const pW = 62;
    doc.save()
      .rect(px, y, pW, 13)
      .fill(riskColor(value))
      .restore();
    doc.save()
      .font("Helvetica-Bold").fontSize(6).fillColor(C.white)
      .text(`${label}  ${(value || "—").toUpperCase()}`, px + 1, y + 2.5, { width: pW - 2, align: "center" })
      .restore();
    px += pW + 3;
  });

  y += 18;

  // ── Key Development ───────────────────────────────────────────────────────
  const keyDev = brief?.key_dev
    ?? (brief?.what_changed ?? [])[0]
    ?? "No key development reported.";

  doc.save()
    .font("Helvetica-Bold").fontSize(6.5).fillColor(C.accent)
    .text("KEY DEVELOPMENT", M, y)
    .restore();
  y += 9;

  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(C.dark)
    .text(keyDev, M, y, { width: COL_W })
    .restore();
  y += doc.heightOfString(keyDev, { width: COL_W, font: "Helvetica-Bold", fontSize: 8 }) + 5;

  // ── Analyst Commentary (condensed to first 2 bullets) ─────────────────────
  const commentaryItems = [
    ...(brief?.why_it_matters ?? []).slice(0, 1),
    ...(brief?.what_changed   ?? []).slice(1, 2),
  ].filter(Boolean);

  if (commentaryItems.length > 0) {
    doc.save()
      .font("Helvetica-Bold").fontSize(6.5).fillColor(C.accent)
      .text("ANALYST COMMENTARY", M, y)
      .restore();
    y += 9;

    commentaryItems.forEach((item) => {
      doc.save()
        .font("Helvetica").fontSize(7.5).fillColor(C.text)
        .text(`${item}`, M, y, { width: COL_W })
        .restore();
      y += doc.heightOfString(item, { width: COL_W, font: "Helvetica", fontSize: 7.5 }) + 3;
    });
  }

  // ── Top watchpoint ────────────────────────────────────────────────────────
  const watchpoint = (brief?.watchpoints ?? [])[0] ?? "";
  if (watchpoint) {
    doc.save()
      .font("Helvetica-Oblique").fontSize(7.5).fillColor(C.muted)
      .text(`▶  ${watchpoint}`, M, y, { width: COL_W })
      .restore();
    y += doc.heightOfString(`▶  ${watchpoint}`, { width: COL_W, font: "Helvetica-Oblique", fontSize: 7.5 }) + 4;
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  y += 4;
  hRule(doc, y);
  y += 8;

  return y;
}

// ── Page management ───────────────────────────────────────────────────────────
function needsNewPage(doc, y, needed = 80) {
  return y + needed > PAGE_H - 40;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const raw = await readStdin();
    const input = JSON.parse(raw || "{}");

    // Support two input shapes:
    //   1. { reports: [...] }           — multi-company morning briefing
    //   2. { company, report, overall, risks } — single company (from existing downloadPdf flow)
    let entities = [];

    if (Array.isArray(input.reports)) {
      entities = input.reports;
    } else if (input.company) {
      entities = [{
        name:    input.company,
        overall: input.overall ?? "LOW",
        risks:   input.risks   ?? {},
        brief:   input.report  ?? {},
      }];
    }

    // Count risk levels for header snapshot
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    entities.forEach(({ overall = "LOW" }) => {
      const k = overall.toUpperCase();
      if (k in counts) counts[k]++;
    });

    // Font path (same as make-pdf.cjs)
    const fontPath = path.join(
      process.cwd(),
      "public", "fonts", "Inter-VariableFont_opsz,wght.ttf"
    );

    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    if (fs.existsSync(fontPath)) doc.font(fontPath);

    // ── Page 1 header ──────────────────────────────────────────────────────
    const date = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    let y = drawHeader(doc, date, counts);
    y += 6;

    // Intro strip
    const highNames = entities
      .filter((e) => (e.overall ?? "").toUpperCase() === "HIGH")
      .map((e) => e.name)
      .join(", ");

    const introText = highNames
      ? `Today's briefing covers ${entities.length} entities. HIGH risk: ${highNames}. Scroll for full entity analysis.`
      : `Today's briefing covers ${entities.length} entities. No HIGH risk signals today.`;

    y = drawIntro(doc, y, introText);

    // ── Entity cards ───────────────────────────────────────────────────────
    let pageNum = 1;
    drawFooter(doc, pageNum);

    for (const entity of entities) {
      // Estimate card height conservatively (80–130 pts)
      if (needsNewPage(doc, y, 100)) {
        doc.addPage({ size: "A4", margin: 0 });
        pageNum++;
        // Repeat slim header bar on continuation pages
        rect(doc, 0, 0, PAGE_W, 28, C.dark);
        doc.save()
          .font("Helvetica-Bold").fontSize(10).fillColor(C.white)
          .text("Daily Intelligence Briefing  —  Morning Edition", M, 8)
          .restore();
        doc.save()
          .font("Helvetica").fontSize(7.5).fillColor(C.accent)
          .text(date, PAGE_W - M - 100, 10, { width: 100, align: "right" })
          .restore();
        rect(doc, 0, 28, PAGE_W, 1.5, C.accent);
        drawFooter(doc, pageNum);
        y = 38;
      }

      y = drawEntityCard(doc, y, entity);
    }

    // Disclaimer
    if (needsNewPage(doc, y, 30)) {
      doc.addPage({ size: "A4", margin: 0 });
      pageNum++;
      drawFooter(doc, pageNum);
      y = 50;
    }
    doc.save()
      .font("Helvetica-Oblique").fontSize(6.5).fillColor(C.muted)
      .text(
        "Risk scores generated by Claude (Anthropic) based on news coverage within the reporting window. Analyst review recommended before acting on any High signal.",
        M, y, { width: COL_W, align: "center" }
      )
      .restore();

    doc.end();
    const pdf = await done;
    process.stdout.write(pdf.toString("base64"));

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
