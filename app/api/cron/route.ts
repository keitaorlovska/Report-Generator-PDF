export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const companiesRes = await fetch(`${baseUrl}/api/companies`);
    const companies = await companiesRes.json();
    return NextResponse.json({ ok: true, message: "Cron triggered", companies: companies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
