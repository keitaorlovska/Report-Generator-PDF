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
async function generatePdfForCompany(companyName: string, reportData: any): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: companyName, report: reportData ?? {} };

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
async function generateCoverPage(companyNames: string[]): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: "__COVER__", report: {}, companyNames };

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

    // 1. Cover page first
    console.log("Generating cover page...");
    const cover = await generateCoverPage(reports.map((r) => r.companyName));
    pdfBuffers.push(cover);

    // 2. One page per company, sequentially
    for (const r of reports) {
      console.log(`Generating PDF for: ${r.companyName}`);
      const buf = await generatePdfForCompany(r.companyName, r.report);
      pdfBuffers.push(buf);
    }

    // 3. Merge all into one PDF
    console.log(`Merging ${pdfBuffers.length} pages...`);
    const combined = await mergePdfs(pdfBuffers);
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