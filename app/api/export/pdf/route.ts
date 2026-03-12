// app/api/export/pdf/route.ts
export const runtime = "nodejs";
// Force Vercel to include pdfkit in the serverless bundle
import "pdfkit";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import type { Company } from "@/data/companies";

// ---------- Types ----------
interface PdfRequestBody {
  selectedCompanyIds: string[];
  report?: any;
}

function loadCompanies(): Company[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "companies.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function resolveCompanyIds(ids: string[]): Company[] {
  const all = loadCompanies();
  const map = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is Company => c !== undefined);
}

// ---------- Route handler ----------
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as PdfRequestBody).selectedCompanyIds) ||
    !(body as PdfRequestBody).selectedCompanyIds.every((v) => typeof v === "string")
  ) {
    return NextResponse.json({ error: "`selectedCompanyIds` must be an array of strings." }, { status: 400 });
  }

  const { selectedCompanyIds, report } = body as PdfRequestBody;
  console.log("PDF route report:", JSON.stringify(report));

  const companies = resolveCompanyIds(selectedCompanyIds);
  if (companies.length === 0) {
    return NextResponse.json({ error: "No valid company IDs provided." }, { status: 400 });
  }

  try {
    const pdfBuffers = await Promise.all(
      companies.map((c) => generatePdfForCompany(c, report))
    );

    if (pdfBuffers.length === 1) {
      return new NextResponse(new Uint8Array(pdfBuffers[0]), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${companies[0].name}-daily-brief.pdf"`,
        },
      });
    }

    const results = companies.map((c, i) => ({
      company: c.name,
      pdf: pdfBuffers[i].toString("base64"),
    }));
    return NextResponse.json({ reports: results });
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 });
  }
}

// ---------- PDF generation ----------
async function generatePdfForCompany(company: Company, reportData?: any): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");
  const payload = { company: company.name, report: reportData ?? {} };

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