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

(async () => {
  try {
    const inputRaw = await readStdin();
    const { company, report } = JSON.parse(inputRaw || "{}");

    const doc = new PDFDocument({ margin: 48 });

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "Inter-VariableFont_opsz,wght.ttf"
    );

    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    }

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    const done = new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // ===== PDF CONTENT =====
    doc.fontSize(18).text(`Daily Brief — ${company || ""}`);
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor("gray").text(new Date().toLocaleString());
    doc.moveDown(1);

    const section = (title, items) => {
      doc.fillColor("black").fontSize(13).text(title);
      doc.moveDown(0.25);
      doc.fontSize(11);

      if (!items || items.length === 0) {
        doc.fillColor("gray").text("—");
        doc.fillColor("black");
      } else {
        items.forEach((x) => doc.text(`• ${x}`));
      }

      doc.moveDown(0.8);
    };

    section("What changed", report?.what_changed ?? []);
    section("Why it matters", report?.why_it_matters ?? []);
    section("Watchpoints", report?.watchpoints ?? []);

    doc.fillColor("black").fontSize(13).text("Key stories");
    doc.moveDown(0.25);

    (report?.key_stories ?? []).forEach((s) => {
      doc.fontSize(11).fillColor("black").text(`• ${s.title ?? "Story"}`);
      if (s.url) doc.fillColor("blue").text(s.url).fillColor("black");
      if (s.reason) doc.fillColor("gray").text(s.reason).fillColor("black");
      doc.moveDown(0.5);
    });

    doc.end();
    const pdf = await done;

    // Output base64 so Next can read it safely
    process.stdout.write(pdf.toString("base64"));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
