// app/api/companies/[id]/route.ts
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

// PATCH /api/companies/[id] — update a single company
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const updates = await req.json()
    const companies = readCompanies()
    const index = companies.findIndex((c: any) => c.id === params.id)
    if (index === -1) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }
    companies[index] = { ...companies[index], ...updates }
    writeCompanies(companies)
    return NextResponse.json({ ok: true, company: companies[index] })
  } catch (err) {
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 })
  }
}

// DELETE /api/companies/[id] — remove a company
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const companies = readCompanies()
    const filtered = companies.filter((c: any) => c.id !== params.id)
    if (filtered.length === companies.length) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }
    writeCompanies(filtered)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}