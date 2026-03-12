// app/api/export/pdf/combined/route.ts
export const runtime = "nodejs";
import "pdfkit";
import { NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";

interface ReportEntry {
  companyId: string;
  companyName: string;
  report: any;
}

interface CombinedPdfRequest {
  reports: ReportEntry[];
}

async function generatePdfForCompany(companyName: string, reportData: any): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: companyName, report: reportData ?? {} };

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("close", (code: number | null) => {
      if (code !== 0) return reject(new Error(err || `Script exited ${code}`));
      resolve(Buffer.from(out.trim(), "base64"));
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reports } = body as CombinedPdfRequest;

  if (!Array.isArray(reports) || reports.length === 0) {
    return NextResponse.json({ error: "No reports provided." }, { status: 400 });
  }

  try {
    // Generate all PDFs in parallel
    const pdfBuffers = await Promise.all(
      reports.map((r) => generatePdfForCompany(r.companyName, r.report))
    );

    // Concatenate all PDF buffers into one
    const combined = Buffer.concat(pdfBuffers);

    return new NextResponse(new Uint8Array(combined), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daily-intelligence-briefing.pdf"`,
      },
    });
  } catch (err) {
    console.error("Combined PDF export error:", err);
    return NextResponse.json({ error: "Combined PDF export failed" }, { status: 500 });
  }
}