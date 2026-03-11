// data/companies.ts
// Type definition only — safe to import in both client and server components.
// The live list is fetched from /api/companies at runtime.

export interface Company {
  id: string        // stable unique slug — never rename once deployed
  name: string
  ticker?: string
  country?: string
  market?: string
  industry?: string
  tags?: string[]
  addedAt?: string  // ISO timestamp, set when company is added via UI
}

// Fallback static list used only as initial state before API loads.
export const COMPANIES: Company[] = []

/** O(1) lookup map: id → Company */
export const COMPANY_MAP: ReadonlyMap<string, Company> = new Map(
  COMPANIES.map((c) => [c.id, c])
)

/**
 * Resolve an array of IDs to Company objects.
 * Unknown IDs are silently dropped.
 */
export function resolveCompanyIds(ids: string[], map: ReadonlyMap<string, Company> = COMPANY_MAP): Company[] {
  return ids.flatMap((id) => {
    const c = map.get(id)
    return c ? [c] : []
  })
}