"use server";

import type { Company } from "@/data/companies";

export async function scrapeNewsAction(selectedCompanyIds?: string[]) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/scrape-news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedCompanyIds }),
  });

  if (!res.ok) {
    return { ok: false, error: "Scrape request failed" };
  }

  return res.json();
}