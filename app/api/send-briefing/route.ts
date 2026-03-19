export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import path from "path";
import { spawn } from "child_process";

const resend = new Resend(process.env.RESEND_API_KEY);
const RECIPIENTS: string[] = (process.env.BRIEFING_RECIPIENTS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
const FROM = process.env.BRIEFING_FROM ?? "onboarding@resend.dev";

async function runScript(scriptName: string, payload: object): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), "scripts", scriptName);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Timeout: ${scriptName}`)); }, 120_000);
    let out = ""; let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(err || `Script exited ${code}`));
      resolve(Buffer.from(out.trim(), "base64"));
    });
    child.on("error", reject);
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function POST(req: Request) {
  try {
    const { reports } = await req.json();
    if (!reports || reports.length === 0) return NextResponse.json({ error: "No reports provided" }, { status: 400 });
    if (RECIPIENTS.length === 0) return NextResponse.json({ error: "No recipients configured" }, { status: 400 });

    const morningBriefPdf = await runScript("make-pdf-concise.cjs", {
      reports: reports.map((r: any) => ({ company: r.company, brief: r.brief })),
    });

    const { PDFDocument } = require("pdf-lib");
    const totalPages = reports.length + 2;
    const pdfBuffers: Buffer[] = [];

    pdfBuffers.push(await runScript("make-pdf.cjs", { company: "__COVER__", report: {}, companyNames: reports.map((r: any) => r.company), pageNum: 1, totalPages }));
    for (let i = 0; i < reports.length; i++) {
      pdfBuffers.push(await runScript("make-pdf.cjs", { company: reports[i].company, report: reports[i].brief, pageNum: i + 2, totalPages }));
    }
    pdfBuffers.push(await runScript("make-pdf.cjs", { company: "__APPENDIX__", report: {}, companyNames: [], pageNum: totalPages, totalPages }));

    const merged = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const doc = await PDFDocument.load(buf);
      const pages = await merged.copyPages(doc, Array.from({ length: doc.getPageCount() }, (_, i) => i));
      pages.forEach((p: any) => merged.addPage(p));
    }
    const fullPdf = Buffer.from(await merged.save());
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    await resend.emails.send({
      from: FROM,
      to: RECIPIENTS,
      subject: `Linq Advisors — Daily Intelligence Briefing · ${dateStr}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#1C3A2E;padding:24px 32px;border-radius:8px 8px 0 0"><h1 style="color:white;margin:0;font-size:20px">Daily Intelligence Briefing</h1><p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">${dateStr} · Linq Advisors</p></div><div style="background:#F7F4EF;padding:24px 32px;border-radius:0 0 8px 8px"><p style="color:#1C1810;font-size:14px">Your daily intelligence briefing covering <strong>${reports.length} entities</strong> is attached.</p><ul style="color:#5A554E;font-size:13px"><li><strong>Morning Brief</strong> — concise summary</li><li><strong>Full Intelligence Report</strong> — detailed analysis</li></ul><p style="color:#8A8580;font-size:11px;border-top:1px solid #DDD8CF;padding-top:12px;margin-top:16px">CONFIDENTIAL — For authorised recipients only.</p></div></div>`,
      attachments: [
        { filename: `morning-brief-${new Date().toISOString().slice(0, 10)}.pdf`, content: morningBriefPdf },
        { filename: `daily-intelligence-briefing-${new Date().toISOString().slice(0, 10)}.pdf`, content: fullPdf },
      ],
    });

    return NextResponse.json({ ok: true, recipients: RECIPIENTS, count: reports.length });
  } catch (err: any) {
    console.error("Send briefing error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to send" }, { status: 500 });
  }
}
