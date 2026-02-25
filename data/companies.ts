// data/companies.ts
// Single source of truth for all companies.
// Add/remove companies here — never hardcode them elsewhere.

export interface Company {
  id: string;       // stable unique slug — never rename once deployed
  name: string;
  ticker?: string;
  country?: string;
  market?: string;
  industry?: string;
  tags?: string[];
}

export const COMPANIES: Company[] = [
  {
    id: "europol",
    name: "Europol",
    country: "EU",
    industry: "Law Enforcement",
    tags: ["government", "security", "EU"],
  },
  {
    id: "saudi-aramco",
    name: "Saudi Aramco",
    ticker: "2222.SR",
    country: "SA",
    market: "Tadawul",
    industry: "Energy",
    tags: ["oil & gas", "state-owned"],
  },
  {
    id: "statens-vegvesen",
    name: "Statens vegvesen",
    country: "NO",
    industry: "Government",
    tags: ["roads", "transport", "Norway"],
  },
  {
    id: "ag-insurance",
    name: "AG Insurance",
    country: "BE",
    industry: "Insurance",
    tags: ["insurance", "Belgium", "finance"],
  },
  {
    id: "huseierne",
    name: "Huseierne",
    country: "NO",
    industry: "Real Estate",
    tags: ["homeowners", "Norway", "housing"],
  },
  {
    id: "kystverket",
    name: "Kystverket",
    country: "NO",
    industry: "Government",
    tags: ["coastal", "maritime", "Norway"],
  },
  {
    id: "ing-romania",
    name: "ING Romania",
    country: "RO",
    industry: "Banking",
    tags: ["banking", "Romania", "finance"],
  },
  {
    id: "marynissen",
    name: "Marynissen",
    country: "BE",
    industry: "Construction",
    tags: ["construction", "Belgium"],
  },
  {
    id: "miltenyi-biomedicine",
    name: "Miltenyi Biomedicine",
    country: "DE",
    industry: "Healthcare",
    tags: ["biotech", "cell therapy", "Germany"],
  },
  {
    id: "magnum-ice-cream",
    name: "Magnum Ice Cream Company",
    country: "GB",
    industry: "Consumer Goods",
    tags: ["ice cream", "FMCG", "Unilever"],
  },
  {
    id: "unilever",
    name: "Unilever",
    ticker: "UL",
    country: "GB",
    market: "NYSE",
    industry: "Consumer Goods",
    tags: ["FMCG", "consumer goods", "global"],
  },
  {
    id: "bgts",
    name: "BGTS",
    country: "BE",
    industry: "Technology",
    tags: ["technology", "services"],
  },
  {
    id: "randstad",
    name: "Randstad",
    ticker: "RAND.AS",
    country: "NL",
    market: "Euronext",
    industry: "Staffing",
    tags: ["recruitment", "HR", "Netherlands"],
  },
  {
    id: "bauer-media-outdoor",
    name: "Bauer Media Outdoor",
    country: "DE",
    industry: "Media",
    tags: ["outdoor advertising", "media", "Germany"],
  },
  {
    id: "bp",
    name: "BP",
    ticker: "BP",
    country: "GB",
    market: "NYSE",
    industry: "Energy",
    tags: ["oil & gas", "energy", "renewables"],
  },
  {
    id: "aquora",
    name: "Aquora",
    industry: "Technology",
    tags: ["technology", "services"],
  },
  {
    id: "lloyds",
    name: "Lloyds Banking Group",
    ticker: "LYG",
    country: "GB",
    market: "NYSE",
    industry: "Banking",
    tags: ["banking", "UK", "finance"],
  },
];

/** O(1) lookup map: id → Company */
export const COMPANY_MAP: ReadonlyMap<string, Company> = new Map(
  COMPANIES.map((c) => [c.id, c])
);

/**
 * Resolve an array of IDs to Company objects.
 * Unknown IDs are silently dropped.
 */
export function resolveCompanyIds(ids: string[]): Company[] {
  return ids.flatMap((id) => {
    const c = COMPANY_MAP.get(id);
    return c ? [c] : [];
  });
}