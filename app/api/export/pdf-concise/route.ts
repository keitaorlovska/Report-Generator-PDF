import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const input = JSON.stringify(body)
    const scriptPath = path.join(process.cwd(), "scripts", "make-pdf-concise.cjs")

    const pdf = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd() })
      let stdout = ""
      let stderr = ""
      child.stdin.write(input)
      child.stdin.end()
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })
      child.on("close", (code) => {
        if (code !== 0) { reject(new Error(`Script exited with code ${code}: ${stderr}`)) }
        else { resolve(Buffer.from(stdout.trim(), "base64")) }
      })
      child.on("error", reject)
    })

    const date = new Date().toISOString().slice(0, 10)
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="morning-brief-${date}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error("pdf-concise route error:", err)
    return NextResponse.json({ error: err.message ?? "Failed to generate PDF" }, { status: 500 })
  }
}
