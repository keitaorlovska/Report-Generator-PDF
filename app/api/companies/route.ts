// app/api/companies/route.ts
import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_PATH = path.join(process.cwd(), "data", "companies.json")

function readCompanies() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8")
  return JSON.parse(raw)
}

function writeCompanies(companies: any[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(companies, null, 2), "utf-8")
}

// GET /api/companies — return full list
export async function GET() {
  try {
    const companies = readCompanies()
    return NextResponse.json(companies)
  } catch (err) {
    return NextResponse.json({ error: "Failed to read companies" }, { status: 500 })
  }
}

// PUT /api/companies — replace full list (for reorder)
export async function PUT(req: Request) {
  try {
    const companies = await req.json()
    if (!Array.isArray(companies)) {
      return NextResponse.json({ error: "Expected an array" }, { status: 400 })
    }
    writeCompanies(companies)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to write companies" }, { status: 500 })
  }
}

// POST /api/companies — add a new company
export async function POST(req: Request) {
  try {
    const company = await req.json()
    if (!company.id || !company.name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 })
    }
    const companies = readCompanies()
    if (companies.find((c: any) => c.id === company.id)) {
      return NextResponse.json({ error: "Company with this ID already exists" }, { status: 409 })
    }
    companies.push(company)
    writeCompanies(companies)
    return NextResponse.json({ ok: true, company })
  } catch (err) {
    return NextResponse.json({ error: "Failed to add company" }, { status: 500 })
  }
}