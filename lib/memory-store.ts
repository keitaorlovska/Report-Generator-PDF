import fs from "fs";
import path from "path";

export type StoredArticle = {
  company: string;
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
  tone?: "positive" | "neutral" | "negative";
  tags?: string[];
};

const DATA_PATH = path.join(process.cwd(), "data", "articles-cache.json");

export function setArticles(articles: StoredArticle[]) {
  // Keep in-memory for fast access in same instance
  globalThis.__ARTICLES__ = articles;
  // Persist to disk so other instances can read it
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(articles, null, 2), "utf-8");
  } catch {}
}

export function getArticles(): StoredArticle[] {
  // Try in-memory first
  if (globalThis.__ARTICLES__ && globalThis.__ARTICLES__.length > 0) {
    return globalThis.__ARTICLES__;
  }
  // Fall back to disk
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const articles = JSON.parse(raw);
    globalThis.__ARTICLES__ = articles;
    return articles;
  } catch {
    return [];
  }
}

declare global {
  var __ARTICLES__: StoredArticle[] | undefined;
}
