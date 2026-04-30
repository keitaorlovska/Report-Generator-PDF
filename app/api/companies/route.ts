// app/api/companies/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function readFallback() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "companies.json"), "utf-8"))
  } catch {
    return []
  }
}

async function readCompanies() {
  const { data, error } = await supabase.from("companies").select("data")
  if (error) throw error
  const companies = data.map((row: any) => row.data)
  if (companies.length === 0) return readFallback()
  return companies
}

async function writeCompanies(companies: any[]) {
  await supabase.from("companies").delete().neq("id", "")
  if (companies.length > 0) {
    const rows = companies.map((c: any) => ({ id: c.id, data: c }))
    const { error } = await supabase.from("companies").insert(rows)
    if (error) throw error
  }
}

export async function GET() {
  try {
    return NextResponse.json(await readCompanies())
  } catch {
    return NextResponse.json(readFallback())
  }
}

export async function PUT(req: Request) {
  try {
    const companies = await req.json()
    if (!Array.isArray(companies)) return NextResponse.json({ error: "Expected array" }, { status: 400 })
    await writeCompanies(companies)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to write companies" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const company = await req.json()
    if (!company.id || !company.name) return NextResponse.json({ error: "id and name required" }, { status: 400 })
    const { data: existing } = await supabase.from("companies").select("id").eq("id", company.id).single()
    if (existing) return NextResponse.json({ error: "Already exists" }, { status: 409 })
    const { error } = await supabase.from("companies").insert({ id: company.id, data: company })
    if (error) throw error
    return NextResponse.json({ ok: true, company })
  } catch {
    return NextResponse.json({ error: "Failed to add company" }, { status: 500 })
  }
}