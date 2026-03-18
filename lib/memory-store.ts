import { Redis } from "@upstash/redis";

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

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY = "articles-cache";

export async function setArticles(articles: StoredArticle[]) {
  globalThis.__ARTICLES__ = articles;
  await redis.set(KEY, JSON.stringify(articles));
}

export async function getArticles(): Promise<StoredArticle[]> {
  if (globalThis.__ARTICLES__ && globalThis.__ARTICLES__.length > 0) {
    return globalThis.__ARTICLES__;
  }
  try {
    const raw = await redis.get<string>(KEY);
    if (!raw) return [];
    const articles = typeof raw === "string" ? JSON.parse(raw) : raw;
    globalThis.__ARTICLES__ = articles;
    return articles;
  } catch {
    return [];
  }
}

declare global {
  var __ARTICLES__: StoredArticle[] | undefined;
}
