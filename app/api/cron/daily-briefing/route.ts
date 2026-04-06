export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { generateReportAction } from "@/app/actions/generate-report";

// This route is called automatically by Vercel Cron at 8am Oslo time (7am UTC) on weekdays.
// It scrapes news, generates reports for all companies, then sends the briefing email.

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL}`;

    // 1. Fetch all companies
    const companiesRes = await fetch(`${baseUrl}/api/companies`);
    const allCompanies = await companiesRes.json();

    if (!allCompanies || allCompanies.length === 0) {
      return NextResponse.json({ error: "No companies found" }, { status: 400 });
    }

    console.log(`[cron] Generating briefings for ${allCompanies.length} companies`);

    // 2. Generate reports for each company
    const reports: any[] = [];
    for (const company of allCompanies) {
      try {
        const out = await generateReportAction(company.name, 24);
        if (out?.ok && out.saved?.report) {
          reports.push({ company: company.name, brief: out.saved.report });
          console.log(`[cron] ✓ ${company.name}`);
        } else {
          console.warn(`[cron] ✗ ${company.name}: ${out?.error ?? "no report"}`);
        }
      } catch (err: any) {
        console.warn(`[cron] ✗ ${company.name}: ${err.message}`);
      }
    }

    if (reports.length === 0) {
      return NextResponse.json({ error: "No reports generated" }, { status: 500 });
    }

    // 3. Send the briefing email
    const sendRes = await fetch(`${baseUrl}/api/send-briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      console.error("[cron] Failed to send briefing:", sendData);
      return NextResponse.json({ error: sendData.error ?? "Failed to send" }, { status: 500 });
    }

    console.log(`[cron] Briefing sent to ${sendData.recipients?.join(", ")}`);
    return NextResponse.json({ ok: true, companies: reports.length, recipients: sendData.recipients });

  } catch (err: any) {
    console.error("[cron] Unexpected error:", err);
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 });
  }
}