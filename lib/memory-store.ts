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

const DATA_PATH = "/tmp/articles-cache.json";

export function setArticles(articles: StoredArticle[]) {
  globalThis.__ARTICLES__ = articles;
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(articles, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write articles cache:", e);
  }
}

export function getArticles(): StoredArticle[] {
  if (globalThis.__ARTICLES__ && globalThis.__ARTICLES__.length > 0) {
    return globalThis.__ARTICLES__;
  }
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
