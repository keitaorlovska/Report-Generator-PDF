export type StoredArticle = {
  company: string;              // ✅ important
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
  tone?: "positive" | "neutral" | "negative";
  tags?: string[];
};

declare global {
  // eslint-disable-next-line no-var
  var __ARTICLES__: StoredArticle[] | undefined;
}

export function setArticles(articles: StoredArticle[]) {
  globalThis.__ARTICLES__ = articles;
}

export function getArticles(): StoredArticle[] {
  return globalThis.__ARTICLES__ ?? [];
}