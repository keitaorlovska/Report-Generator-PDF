// app/api/export/pdf-concise/route.ts
// Mirrors the pattern of app/api/export/pdf/route.ts
// Accepts: { reports: [{ company, brief, overall, risks }] }
// Returns: raw PDF binary

import { NextResponse } from "next/server";
import { spawn }         from "child_process";
import path              from "path";

function runScript(input: object): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "make-pdf-concise.cjs");

    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("make-pdf-concise stderr:", stderr);
        return reject(new Error(`Script exited with code ${code}: ${stderr}`));
      }
      try {
        resolve(Buffer.from(stdout.trim(), "base64"));
      } catch (e) {
        reject(new Error("Failed to decode base64 PDF output"));
      }
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // body shape: { reports: [{ company, brief, overall, risks }] }
    if (!body || (!Array.isArray(body.reports) && !body.company)) {
      return NextResponse.json(
        { error: "Expected { reports: [...] } or { company, brief, overall, risks }" },
        { status: 400 }
      );
    }

    const pdfBuffer = await runScript(body);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="morning-brief-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length":      String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error("PDF concise export error:", err);
    return NextResponse.json({ error: err.message ?? "Export failed" }, { status: 500 });
  }
}