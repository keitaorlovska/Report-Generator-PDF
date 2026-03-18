const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function deriveRisk(brief) {
  const text = [
    ...(brief?.what_changed ?? []),
    ...(brief?.why_it_matters ?? []),
    ...(brief?.watchpoints ?? []),
    ...(brief?.key_stories ?? []).map(s => (s.title || "") + " " + (s.reason || "")),
  ].join(" ").toLowerCase();

  const criticalWords = ["criminal", "fraud", "scandal", "collapse", "indicted", "arrested", "bankrupt", "sanction"];
  const highWords = ["lawsuit", "investigation", "breach", "fine", "violation", "recall", "strike", "hack", "data leak", "regulatory action"];
  const medWords = ["warning", "decline", "concern", "uncertainty", "risk", "challenge", "pressure", "scrutiny", "probe"];

  if (criticalWords.some(w => text.includes(w))) return "CRITICAL";
  if (highWords.some(w => text.includes(w))) return "HIGH";
  if (medWords.some(w => text.includes(w))) return "MEDIUM";
  return "LOW";
}

const RISK_COLORS = { CRITICAL: "#7B0000", HIGH: "#C0392B", MEDIUM: "#D4820A", LOW: "#27AE60" };
const NAVY = "#1A1A2E";
const GOLD = "#C8A96E";
const MID_NAVY = "#2E2E4E";
const CREAM = "#F5F4F0";
const LIGHT_GREY = "#E8E6E0";

(async () => {
  try {
    const inputRaw = await readStdin();
    const input = JSON.parse(inputRaw || "{}");
    const reports = input.reports
      ? input.reports
      : [{ company: input.company, brief: input.report ?? input.brief }];

    const fontPath = path.join(process.cwd(), "public", "fonts", "Inter-VariableFont_opsz,wght.ttf");
    const hasFont = fs.existsSync(fontPath);

    const doc = new PDFDocument({ margin: 0, size: "A4" });
    if (hasFont) doc.font(fontPath);

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));

    const PW = 595.28;
    const PH = 841.89;
    const MARGIN = 40;
    const CONTENT_W = PW - MARGIN * 2;
    const FOOTER_Y = PH - 40;

    const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    reports.forEach(r => { const k = deriveRisk(r.brief); riskCounts[k]++; });

    let pageNum = 1;

    const drawPageHeader = (isFirst) => {
      if (isFirst) {
        doc.rect(0, 0, PW, 130).fill(NAVY);
        doc.rect(0, 130, PW, 4).fill(GOLD);
        doc.fillColor(GOLD).fontSize(8).text("LINQ ADVISORS  ·  DAILY INTELLIGENCE BRIEFING", MARGIN, 22, { characterSpacing: 1.5 });
        doc.fillColor("white").fontSize(22).text("Daily Intelligence Briefing", MARGIN, 38);
        doc.fillColor(GOLD).fontSize(8).text("MORNING EDITION  ·  CONCISE READ", MARGIN, 68, { characterSpacing: 1 });
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
        doc.fillColor("rgba(255,255,255,0.55)").fontSize(9).text(`${dateStr}  ·  Reputation Management & Corporate Intelligence`, MARGIN, 84);
        doc.fillColor("rgba(255,255,255,0.45)").fontSize(7).text("RISK SNAPSHOT", PW - 160, 22, { width: 120, align: "right", characterSpacing: 1 });
        let pillX = PW - 170;
        [
          { label: `${riskCounts.HIGH + riskCounts.CRITICAL} HIGH`, color: RISK_COLORS.HIGH },
          { label: `${riskCounts.MEDIUM} MED`, color: RISK_COLORS.MEDIUM },
          { label: `${riskCounts.LOW} LOW`, color: RISK_COLORS.LOW },
        ].forEach(({ label, color }) => {
          doc.roundedRect(pillX, 36, 48, 18, 3).fill(color);
          doc.fillColor("white").fontSize(8).text(label, pillX, 41, { width: 48, align: "center" });
          pillX += 54;
        });
        doc.rect(0, 134, PW, 36).fill(MID_NAVY);
        const highCount = riskCounts.HIGH + riskCounts.CRITICAL;
        const introText = `Today's briefing covers ${reports.length} entit${reports.length === 1 ? "y" : "ies"}. ${
          highCount > 0 ? `${highCount} HIGH risk signal${highCount > 1 ? "s" : ""} require immediate attention.` : "No HIGH risk signals today."
        }`;
        doc.fillColor("rgba(255,255,255,0.8)").fontSize(9).text(introText, MARGIN, 148, { width: CONTENT_W });
        return 185;
      } else {
        doc.rect(0, 0, PW, 28).fill(NAVY);
        doc.rect(0, 28, PW, 2).fill(GOLD);
        doc.fillColor(GOLD).fontSize(7).text("LINQ ADVISORS  ·  DAILY INTELLIGENCE BRIEFING  ·  CONFIDENTIAL", MARGIN, 10, { characterSpacing: 1 });
        return 42;
      }
    };

    const drawFooter = (pNum) => {
      doc.rect(0, PH - 24, PW, 24).fill(NAVY);
      doc.fillColor("rgba(255,255,255,0.35)").fontSize(7).text("CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY", MARGIN, PH - 15);
      doc.fillColor("rgba(255,255,255,0.5)").fontSize(7).text(`Page ${pNum}`, PW - MARGIN - 30, PH - 15, { width: 30, align: "right" });
    };

    let currentY = drawPageHeader(true);

    for (const entry of reports) {
      const companyName = entry.company || "Unknown Entity";
      const brief = entry.brief || {};
      const risk = deriveRisk(brief);
      const riskColor = RISK_COLORS[risk];

      const whatChanged = brief.what_changed ?? [];
      const whyMatters = brief.why_it_matters ?? [];
      const keyStories = brief.key_stories ?? [];
      const watchpoints = brief.watchpoints ?? [];

      const keyDev = whatChanged[0] || keyStories[0]?.title || "No significant developments reported.";
      const commentary = whyMatters.slice(0, 2);
      const watchpoint = watchpoints[0] || null;

      // Measure heights
      const keyDevH = doc.heightOfString(keyDev, { width: CONTENT_W - 24 });
      const commentaryH = commentary.reduce((acc, line) => acc + doc.heightOfString(`• ${line}`, { width: CONTENT_W - 24 }) + 2, 0);
      const watchH = watchpoint ? doc.heightOfString(`¶  ${watchpoint}`, { width: CONTENT_W - 24 }) + 6 : 0;
      // Card: top-bar(28) + name-row(24) + divider(8) + keydev-label(12) + keydev-text + gap(8) + commentary + watchpoint + bottom-pad(12)
      const cardH = 28 + 24 + 8 + 12 + keyDevH + 8 + (commentary.length > 0 ? 14 + commentaryH : 0) + watchH + 12;

      if (currentY + cardH + 12 > FOOTER_Y) {
        drawFooter(pageNum);
        doc.addPage();
        pageNum++;
        currentY = drawPageHeader(false);
      }

      // ── Card background ──
      doc.rect(MARGIN, currentY, CONTENT_W, cardH).fillAndStroke(CREAM, LIGHT_GREY);

      // ── Coloured top bar with entity name ──
      doc.rect(MARGIN, currentY, CONTENT_W, 28).fill(NAVY);

      // Entity name in top bar
      doc.fillColor("white").fontSize(11)
        .text(companyName, MARGIN + 12, currentY + 8, { width: CONTENT_W - 90 });

      // Risk badge in top bar
      const badgeW = 60;
      const badgeX = MARGIN + CONTENT_W - badgeW - 8;
      doc.roundedRect(badgeX, currentY + 6, badgeW, 16, 3).fill(riskColor);
      doc.fillColor("white").fontSize(8)
        .text(risk, badgeX, currentY + 11, { width: badgeW, align: "center" });

      let cardY = currentY + 28 + 8; // below top bar + padding

      // ── KEY DEVELOPMENT label ──
      doc.fillColor(GOLD).fontSize(7)
        .text("KEY DEVELOPMENT", MARGIN + 12, cardY, { characterSpacing: 1 });
      cardY += 12;

      // Key development text
      doc.fillColor(NAVY).fontSize(9)
        .text(keyDev, MARGIN + 12, cardY, { width: CONTENT_W - 24 });
      cardY += keyDevH + 8;

      // ── ANALYST COMMENTARY ──
      if (commentary.length > 0) {
        doc.fillColor(GOLD).fontSize(7)
          .text("ANALYST COMMENTARY", MARGIN + 12, cardY, { characterSpacing: 1 });
        cardY += 12;
        commentary.forEach((line) => {
          doc.fillColor("#4A4540").fontSize(8)
            .text(`• ${line}`, MARGIN + 12, cardY, { width: CONTENT_W - 24 });
          cardY += doc.heightOfString(`• ${line}`, { width: CONTENT_W - 24 }) + 2;
        });
        cardY += 4;
      }

      // ── WATCHPOINT ──
      if (watchpoint) {
        doc.fillColor("#8A8580").fontSize(7.5)
          .text(`¶  ${watchpoint}`, MARGIN + 12, cardY, { width: CONTENT_W - 24 });
      }

      currentY += cardH + 10;
    }

    drawFooter(pageNum);
    doc.end();

    const pdf = await done;
    process.stdout.write(pdf.toString("base64"));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
