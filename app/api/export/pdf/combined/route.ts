// app/api/export/pdf/combined/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";
import { PDFDocument } from "pdf-lib";

interface ReportEntry {
  companyId: string;
  companyName: string;
  report: any;
}

interface CombinedPdfRequest {
  reports: ReportEntry[];
}

// Generates one company page via the make-pdf.cjs script
async function generatePdfForCompany(companyName: string, reportData: any, pageNum: number, totalPages: number): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: companyName, report: reportData ?? {}, pageNum, totalPages };

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout generating PDF for ${companyName}`));
    }, 30_000);

    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(err || `Script exited ${code}`));
      const trimmed = out.trim();
      if (!trimmed) return reject(new Error(`Empty output for ${companyName}`));
      resolve(Buffer.from(trimmed, "base64"));
    });
    child.on("error", (e) => { clearTimeout(timeout); reject(e); });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

// Generates a cover page via the make-pdf.cjs script (company = "__COVER__")
async function generateCoverPage(companyNames: string[], totalPages: number): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: "__COVER__", report: {}, companyNames, pageNum: 1, totalPages };

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => { child.kill(); reject(new Error("Timeout on cover page")); }, 30_000);
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(err || `Cover script exited ${code}`));
      const trimmed = out.trim();
      if (!trimmed) return reject(new Error("Empty cover output"));
      resolve(Buffer.from(trimmed, "base64"));
    });
    child.on("error", (e) => { clearTimeout(timeout); reject(e); });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const doc = await PDFDocument.load(buf);
    const pageIndices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
    const pages = await merged.copyPages(doc, pageIndices);
    pages.forEach((page) => merged.addPage(page));
  }
  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes);
}


async function stampFooterAndLinks(pdfBuffer: Buffer, reports: ReportEntry[]): Promise<Buffer> {
  const { PDFDocument: Doc, rgb, StandardFonts, PDFPageLeaf } = await import("pdf-lib");
  const doc = await Doc.load(pdfBuffer);
  const pages = doc.getPages();
  const total = pages.length;
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // 1. Stamp footer on every page
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const text = `Page ${i + 1} of ${total}`;
    const fontSize = 7.5;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: width - 52 - textWidth, y: 22,
      size: fontSize, font, color: rgb(0.54, 0.52, 0.50),
    });
    page.drawText("Linq Advisors  ·  Confidential  ·  Daily Intelligence Briefing", {
      x: 52, y: 22,
      size: fontSize, font, color: rgb(0.54, 0.52, 0.50),
    });
    page.drawLine({
      start: { x: 52, y: 32 }, end: { x: width - 52, y: 32 },
      thickness: 0.5, color: rgb(0.87, 0.85, 0.81),
    });
  });

  // 2. Add clickable links on the cover page (page index 0)
  // Cover layout: entities list starts at y=106 from top, each row = 26pt tall
  // PDF y-axis is bottom-up, page height = 841.89
  const coverPage = pages[0];
  const { height: pH } = coverPage.getSize();
  const rxLeft = 260;   // rx from make-pdf.cjs
  const rowH = 26;
  const listStartY = 106;
  const MARGIN = 52;

  // Company entries: page indices 1..N (0-based), cover=0, appendix=last
  reports.forEach((r, i) => {
    const targetPageIndex = i + 1; // 0-based: cover=0, first company=1
    if (targetPageIndex >= pages.length) return;

    const rowTop = listStartY + i * rowH;
    // Convert top-down y to PDF bottom-up y
    const pdfY = pH - rowTop - rowH;

    coverPage.drawRectangle({
      x: rxLeft,
      y: pdfY,
      width: coverPage.getSize().width - rxLeft - MARGIN,
      height: rowH,
      opacity: 0,
      borderOpacity: 0,
    });

    const linkAnnotation = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rxLeft, pdfY, coverPage.getSize().width - MARGIN, pdfY + rowH],
      Border: [0, 0, 0],
      Dest: [pages[targetPageIndex].ref, "XYZ", null, null, null],
    });
    const annotRef = doc.context.register(linkAnnotation);
    const existingAnnots = coverPage.node.get(doc.context.obj("Annots") as any);
    if (existingAnnots) {
      (existingAnnots as any).push(annotRef);
    } else {
      coverPage.node.set(doc.context.obj("Annots") as any, doc.context.obj([annotRef]));
    }
  });

  // Appendix link (last entry, after all companies)
  const appendixRowTop = listStartY + reports.length * rowH + 4;
  const appendixPdfY = pH - appendixRowTop - rowH;
  const appendixPageIndex = pages.length - 1;
  const appendixAnnotation = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rxLeft, appendixPdfY, coverPage.getSize().width - MARGIN, appendixPdfY + rowH],
    Border: [0, 0, 0],
    Dest: [pages[appendixPageIndex].ref, "XYZ", null, null, null],
  });
  const appendixRef = doc.context.register(appendixAnnotation);
  try {
    const annots = coverPage.node.get(doc.context.obj("Annots") as any) as any;
    if (annots) { annots.push(appendixRef); }
    else { coverPage.node.set(doc.context.obj("Annots") as any, doc.context.obj([appendixRef])); }
  } catch {}

  return Buffer.from(await doc.save());
}
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { reports } = body as CombinedPdfRequest;
  if (!Array.isArray(reports) || reports.length === 0) {
    return NextResponse.json({ error: "No reports provided." }, { status: 400 });
  }

  try {
    const pdfBuffers: Buffer[] = [];

    // 1. Cover + appendix = +2 pages
    const totalPages = reports.length + 2;
    console.log("Generating cover page...");
    const cover = await generateCoverPage(reports.map((r) => r.companyName), totalPages);
    pdfBuffers.push(cover);

    // 2. One page per company, sequentially
    // Cover is page 1, so company pages start at 2
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      console.log(`Generating PDF for: ${r.companyName}`);
      const buf = await generatePdfForCompany(r.companyName, r.report, i + 2, totalPages);
      pdfBuffers.push(buf);
    }

    // 3. Appendix page (last)
    console.log("Generating appendix...");
    const appendixPayload = { company: "__APPENDIX__", report: {}, companyNames: [], pageNum: totalPages, totalPages };
    const appendixBuf = await new Promise<Buffer>((resolve, reject) => {
      const scriptPath = require("path").join(process.cwd(), "scripts", "make-pdf.cjs");
      const child = require("child_process").spawn(process.execPath, [scriptPath], { cwd: process.cwd(), stdio: ["pipe","pipe","pipe"] });
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Timeout on appendix")); }, 30_000);
      let out = ""; let err = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr.on("data", (d: Buffer) => (err += d.toString()));
      child.on("close", (code: number | null) => {
        clearTimeout(timeout);
        if (code !== 0) return reject(new Error(err || `Appendix script exited ${code}`));
        resolve(Buffer.from(out.trim(), "base64"));
      });
      child.on("error", (e: Error) => { clearTimeout(timeout); reject(e); });
      child.stdin.write(JSON.stringify(appendixPayload));
      child.stdin.end();
    });
    pdfBuffers.push(appendixBuf);

    // 4. Merge all into one PDF
    console.log(`Merging ${pdfBuffers.length} pages...`);
    const merged = await mergePdfs(pdfBuffers);

    // 5. Stamp correct page numbers across the full merged document
    console.log("Stamping page numbers...");
    const combined = await stampFooterAndLinks(merged, reports);
    console.log(`Done. Combined PDF: ${combined.length} bytes`);

    return new NextResponse(new Uint8Array(combined), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="linq-intelligence-briefing.pdf"`,
      },
    });
  } catch (err) {
    console.error("Combined PDF export error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}