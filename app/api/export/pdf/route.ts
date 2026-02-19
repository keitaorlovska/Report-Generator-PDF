export const runtime = "nodejs"; // ensure Node runtime (not Edge)

// Force Vercel to include pdfkit in the serverless bundle:
import "pdfkit";

import { NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const scriptPath = path.join(process.cwd(), "scripts", "make-pdf.cjs");

    const pdfBase64: string = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      let out = "";
      let err = "";

      child.stdout.on("data", (d) => (out += d.toString()));
      child.stderr.on("data", (d) => (err += d.toString()));

      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(err || `Exited ${code}`));
        resolve(out.trim());
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });

    const pdf = Buffer.from(pdfBase64, "base64");

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${payload.company}-daily-brief.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 });
  }
}
