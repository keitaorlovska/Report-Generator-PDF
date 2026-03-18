// scripts/make-pdf-concise.cjs
const fs   = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

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

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function inferRisk(report) {
  const rs = report?.riskScore;
  if (["Low","Medium","High","Critical"].includes(rs?.overall)) return rs.overall;
  const stored = report?.riskLevel;
  if (["Low","Medium","High","Critical"].includes(stored)) return stored;
  const text = JSON.stringify(report||"").toLowerCase();
  const score =
    (text.includes("attack")||text.includes("crisis")||text.includes("fraud")||text.includes("scandal")||text.includes("criminal")||text.includes("arrested")) ? 4
    : (text.includes("lawsuit")||text.includes("investigation")||text.includes("breach")||text.includes("threat")||text.includes("hack")||text.includes("violation")) ? 3
    : (text.includes("pressure")||text.includes("concern")||text.includes("regulatory")||text.includes("scrutiny")||text.includes("warning")) ? 2
    : 1;
  return ["Low","Low","Medium","High","Critical"][score];
}

function drawRiskBreakdown(doc, riskScore, x, y, contentW) {
  if (!riskScore) return y;
  const dims = [
    { label: "Reputational", value: riskScore.reputational ?? "Low" },
    { label: "Regulatory",   value: riskScore.regulatory   ?? "Low" },
    { label: "Operational",  value: riskScore.operational  ?? "Low" },
    { label: "Financial",    value: riskScore.financial    ?? "Low" },
  ];
  const colW = (contentW - 12) / 4;
  dims.forEach((dim, i) => {
    const cx = x + i * (colW + 4);
    const colors = RISK_COLORS[dim.value] || RISK_COLORS.Low;
    const [br,bg,bb] = hexToRgb(colors.bg);
    doc.roundedRect(cx, y, colW, 28, 5).fill([br,bg,bb]);
    const [tr,tg,tb] = hexToRgb(colors.text);
    doc.fontSize(7).font("Helvetica-Bold").fillColor([tr,tg,tb])
       .text(dim.label.toUpperCase(), cx, y+5, { width: colW, align: "center", characterSpacing: 0.4, lineBreak: false });
    doc.fontSize(9).font("Helvetica-Bold").fillColor([tr,tg,tb])
       .text(dim.value, cx, y+15, { width: colW, align: "center", lineBreak: false });
  });
  return y + 36;
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

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 52;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawPageBackground(doc) {
  doc.fillColor(WHITE).rect(0,0,PAGE_W,PAGE_H).fill();
}

function drawCoverHeader(doc, dateStr, totalEntities, riskCounts) {
  doc.fillColor(SAGE).rect(0,0,PAGE_W,110).fill();
  doc.opacity(0.55).fontSize(8).font("Helvetica").fillColor(WHITE)
     .text("LINQ ADVISORS  -  MORNING BRIEF", MARGIN, 20, { characterSpacing: 2 }).opacity(1);
  doc.fontSize(22).font("Helvetica-Bold").fillColor(WHITE).text("Daily Intelligence Briefing", MARGIN, 34);
  doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.6).text("MORNING EDITION  -  CONCISE READ", MARGIN, 62).opacity(1);
  doc.fontSize(8).font("Helvetica").fillColor(WHITE).opacity(0.55).text(dateStr + "  -  Reputation Management & Corporate Intelligence", MARGIN, 78).opacity(1);
  doc.fontSize(7).font("Helvetica").fillColor(WHITE).opacity(0.5).text("RISK SNAPSHOT", PAGE_W-190, 20, { characterSpacing: 1 }).opacity(1);
  const pills = [
    { label: ((riskCounts.High||0)+(riskCounts.Critical||0)) + " HIGH", color: RISK_COLORS.High },
    { label: (riskCounts.Medium||0) + " MED",  color: RISK_COLORS.Medium },
    { label: (riskCounts.Low||0) + " LOW",     color: RISK_COLORS.Low },
  ];
  let pillX = PAGE_W-190;
  pills.forEach(({ label, color }) => {
    const [br,bg,bb] = hexToRgb(color.bg);
    const [tr,tg,tb] = hexToRgb(color.text);
    doc.roundedRect(pillX, 34, 54, 18, 4).fill([br,bg,bb]);
    doc.fontSize(8).font("Helvetica-Bold").fillColor([tr,tg,tb]).text(label, pillX, 40, { width: 54, align: "center", lineBreak: false });
    pillX += 60;
  });
  const highCount = (riskCounts.High||0)+(riskCounts.Critical||0);
  const introText = "Today's briefing covers " + totalEntities + " entit" + (totalEntities===1?"y":"ies") + ". " +
    (highCount > 0 ? highCount + " HIGH risk signal" + (highCount>1?"s":"") + " require immediate attention." : "No HIGH risk signals today.");
  doc.fillColor("#2E4A3E").rect(0,110,PAGE_W,30).fill();
  doc.fontSize(9).font("Helvetica").fillColor(WHITE).opacity(0.85).text(introText, MARGIN, 120, { width: CONTENT_W }).opacity(1);
  return 158;
}

function drawSlimHeader(doc) {
  doc.fillColor(SAGE).rect(0,0,PAGE_W,32).fill();
  doc.opacity(0.55).fontSize(7).font("Helvetica").fillColor(WHITE)
     .text("LINQ ADVISORS  -  DAILY INTELLIGENCE BRIEFING  -  MORNING EDITION", MARGIN, 12, { characterSpacing: 1 }).opacity(1);
  return 48;
}

function drawFooter(doc, pageNum) {
  const y = PAGE_H - 36;
  doc.fillColor(BORDER).rect(MARGIN, y, CONTENT_W, 0.5).fill();
  doc.fontSize(7.5).font("Helvetica").fillColor(TEXT_LIGHT).opacity(0.8)
     .text("Linq Advisors - Confidential - Daily Intelligence Briefing", MARGIN, y+8, { lineBreak: false })
     .text("Page " + pageNum, 0, y+8, { align: "right", width: PAGE_W-MARGIN, lineBreak: false }).opacity(1);
}

function drawRiskBadge(doc, risk, x, y) {
  const colors = RISK_COLORS[risk] || RISK_COLORS.Low;
  const [br,bg,bb] = hexToRgb(colors.bg);
  doc.roundedRect(x, y, 90, 20, 4).fill([br,bg,bb]);
  const [dr,dg,db] = hexToRgb(colors.dot);
  doc.circle(x+10, y+10, 3).fill([dr,dg,db]);
  const [tr,tg,tb] = hexToRgb(colors.text);
  doc.fontSize(7).font("Helvetica-Bold").fillColor([tr,tg,tb])
     .text(risk.toUpperCase()+" RISK", x+18, y+6, { lineBreak: false, characterSpacing: 0.5 });
}

function drawSectionLabel(doc, label, y) {
  doc.fontSize(7).font("Helvetica-Bold").fillColor(SAGE).opacity(0.7)
     .text(label.toUpperCase(), MARGIN, y, { characterSpacing: 1.5, lineBreak: false }).opacity(1);
  return y + 13;
}

function drawDivider(doc, y) {
  doc.fillColor(BORDER).rect(MARGIN, y, CONTENT_W, 0.5).fill();
  return y + 10;
}

(async () => {
  try {
    const inputRaw = await readStdin();
    const input = JSON.parse(inputRaw || "{}");
    const reports = input.reports ? input.reports : [{ company: input.company, brief: input.report ?? input.brief }];
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    reports.forEach(r => { const k = inferRisk(r.brief); riskCounts[k] = (riskCounts[k]||0)+1; });

    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Linq Advisors - Morning Brief", Author: "Linq Advisors" } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    const done = new Promise(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const FOOTER_Y = PAGE_H - 50;
    let pageNum = 1;
    let currentY = 0;

    const startPage = (isFirst) => {
      drawPageBackground(doc);
      currentY = isFirst ? drawCoverHeader(doc, dateStr, reports.length, riskCounts) : drawSlimHeader(doc);
    };

    const checkNewPage = (neededH) => {
      if (currentY + neededH > FOOTER_Y) {
        drawFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        startPage(false);
      }
    };

    startPage(true);

    for (const entry of reports) {
      const companyName = entry.company || "Unknown Entity";
      const report = entry.brief || {};
      const risk = inferRisk(report);
      const whatChanged = report?.what_changed ?? [];
      const whyMatters  = report?.why_it_matters ?? [];
      const watchpoints = report?.watchpoints ?? [];
      const noMentionsRe = /no (new |recent |meaningful )?(mention|coverage|article|update|news)|(no .{0,40}(last|past) \d+ hour)|(as of .{0,20}\d{4})/i;
      const meaningful = whatChanged.filter(s => !noMentionsRe.test(String(s)));
      const hasNoMentions = whatChanged.some(s => noMentionsRe.test(String(s)));
      const lead = meaningful[0] ? String(meaningful[0]).replace(/\[[\d,]+\]/g,"").trim() : "";
      const commentary = whyMatters.slice(0,2);
      const watchpoint = watchpoints[0] || null;
      const estH = 80 + (report?.riskScore?40:0) + (hasNoMentions?32:0) + (lead?50:20) + (commentary.length>0?20+commentary.length*22:0) + (watchpoint?30:0) + 30;

      checkNewPage(estH);

      // Company header bar
      doc.fillColor(SAGE).rect(MARGIN, currentY, CONTENT_W, 44).fill();
      doc.fontSize(16).font("Helvetica-Bold").fillColor(WHITE)
         .text(companyName, MARGIN+12, currentY+8, { width: CONTENT_W-110, lineBreak: false });
      doc.fontSize(8).font("Helvetica").fillColor(WHITE).opacity(0.55)
         .text(dateStr, MARGIN+12, currentY+30, { lineBreak: false }).opacity(1);
      drawRiskBadge(doc, risk, MARGIN+CONTENT_W-98, currentY+12);
      currentY += 52;

      // Risk badge + Intelligence Summary label
      drawRiskBadge(doc, risk, MARGIN, currentY);
      doc.fontSize(8).font("Helvetica").fillColor(TEXT_LIGHT)
         .text("INTELLIGENCE SUMMARY", MARGIN+100, currentY+6, { characterSpacing: 1, lineBreak: false });
      currentY += 28;

      // 4-dimension pills if scored
      if (report?.riskScore) {
        currentY = drawRiskBreakdown(doc, report.riskScore, MARGIN, currentY, CONTENT_W);
        currentY += 4;
      } else { currentY += 4; }

      // KEY DEVELOPMENT
      currentY = drawSectionLabel(doc, "Key Development", currentY);
      if (hasNoMentions) {
        const [nr,ng,nb] = hexToRgb("#FEF9EC");
        doc.roundedRect(MARGIN, currentY, CONTENT_W, 22, 5).fill([nr,ng,nb]);
        doc.fontSize(8.5).font("Helvetica").fillColor("#92400E")
           .text("No new mentions in the last 24 hours - showing most recent known activity.", MARGIN+10, currentY+7, { width: CONTENT_W-20, lineBreak: false });
        currentY += 30;
      }
      if (lead) {
        doc.fillColor(SAGE).rect(MARGIN, currentY, 3, 0).fill();
        doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT_DARK).text(lead, MARGIN+12, currentY, { width: CONTENT_W-12 });
        const barH = doc.y - currentY + 4;
        doc.fillColor(SAGE).rect(MARGIN, currentY, 3, barH).fill();
        currentY = doc.y + 8;
      } else {
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_LIGHT).text("No recent activity to report.", MARGIN, currentY);
        currentY = doc.y + 8;
      }
      currentY = drawDivider(doc, currentY);

      // ANALYST COMMENTARY
      if (commentary.length > 0) {
        currentY = drawSectionLabel(doc, "Analyst Commentary", currentY);
        const boxY = currentY;
        let tempY = currentY;
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID);
        commentary.forEach((line, i) => {
          const text = String(line).replace(/\[[\d,]+\]/g,"").trim();
          doc.text(text, MARGIN+10, tempY, { width: CONTENT_W-20 });
          tempY = doc.y + (i < commentary.length-1 ? 5 : 0);
        });
        const boxH = tempY - boxY + 8;
        const [cr,cg,cb] = hexToRgb(CREAM);
        doc.roundedRect(MARGIN, boxY-4, CONTENT_W, boxH+4, 6).fill([cr,cg,cb]);
        currentY = boxY;
        commentary.forEach((line, i) => {
          const text = String(line).replace(/\[[\d,]+\]/g,"").trim();
          doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID).text(text, MARGIN+10, currentY, { width: CONTENT_W-20 });
          currentY = doc.y + (i < commentary.length-1 ? 5 : 0);
        });
        currentY += 12;
        currentY = drawDivider(doc, currentY);
      }

      // WATCHPOINTS
      if (watchpoint) {
        currentY = drawSectionLabel(doc, "Recommended Actions & Watchpoints", currentY);
        doc.fillColor(SAGE).circle(MARGIN+5, currentY+5, 2).fill();
        doc.fontSize(10).font("Helvetica").fillColor(TEXT_MID)
           .text(String(watchpoint).replace(/\[[\d,]+\]/g,"").trim(), MARGIN+14, currentY, { width: CONTENT_W-14 });
        currentY = doc.y + 8;
        currentY = drawDivider(doc, currentY);
      }

      currentY += 8;
    }

    drawFooter(doc, pageNum);
    doc.end();
    const pdf = await done;
    process.stdout.write(pdf.toString("base64"));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
