// app/api/companies/[id]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const updates = await req.json()
    const { data: row, error: fetchError } = await supabase
      .from("companies").select("data").eq("id", params.id).single()
    if (fetchError || !row) return NextResponse.json({ error: "Company not found" }, { status: 404 })
    const updated = { ...row.data, ...updates }
    const { error } = await supabase.from("companies").update({ data: updated }).eq("id", params.id)
    if (error) throw error
    return NextResponse.json({ ok: true, company: updated })
  } catch {
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("companies").delete().eq("id", params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}