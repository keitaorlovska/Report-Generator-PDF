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

export async function setArticles(articles: StoredArticle[]) {
  globalThis.__ARTICLES__ = articles;
}

export async function getArticles(): Promise<StoredArticle[]> {
  return globalThis.__ARTICLES__ ?? [];
}

declare global {
  var __ARTICLES__: StoredArticle[] | undefined;
}