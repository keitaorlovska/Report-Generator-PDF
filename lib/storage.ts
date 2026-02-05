import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const ARTICLES_PATH = path.join(DATA_DIR, "articles.json");
const REPORTS_PATH = path.join(DATA_DIR, "reports.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
}

export type StoredArticle = {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
  text?: string;
};

export function saveArticles(articles: StoredArticle[]) {
  ensureDir();
  fs.writeFileSync(
    ARTICLES_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 2)
  );
}

export function loadArticles(): { updatedAt: string | null; articles: StoredArticle[] } {
  ensureDir();
  if (!fs.existsSync(ARTICLES_PATH)) return { updatedAt: null, articles: [] };
  return JSON.parse(fs.readFileSync(ARTICLES_PATH, "utf-8"));
}

export function saveReport(report: any) {
  ensureDir();
  const existing = fs.existsSync(REPORTS_PATH)
    ? JSON.parse(fs.readFileSync(REPORTS_PATH, "utf-8"))
    : [];
  existing.unshift(report);
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(existing, null, 2));
}

export function loadReports(): any[] {
  ensureDir();
  if (!fs.existsSync(REPORTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(REPORTS_PATH, "utf-8"));
}