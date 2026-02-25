"use client";

// components/CompanyPicker.tsx
import * as React from "react";
import { COMPANIES, Company } from "@/data/companies";
import { Button } from "@/components/ui/button";

interface CompanyPickerProps {
  /** Called after a successful PDF download */
  onSuccess?: () => void;
  onError?: (msg: string) => void;
}

export function CompanyPicker({ onSuccess, onError }: CompanyPickerProps) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filter companies by name, ticker, or industry
  const filtered = React.useMemo<Company[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMPANIES;
    return COMPANIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.ticker && c.ticker.toLowerCase().includes(q)) ||
        (c.industry && c.industry.toLowerCase().includes(q)) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [query]);

  const filteredIds = filtered.map((c) => c.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
    setError(null);
  }

  async function handleGenerate() {
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one company.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCompanyIds: Array.from(selected) }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`);
      }

      // Route returns a raw PDF binary — trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "daily-brief.pdf";
      a.click();
      URL.revokeObjectURL(url);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Search input */}
      <input
        type="search"
        placeholder="Search by name, ticker, or industry…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {filtered.length} / {COMPANIES.length} shown
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={toggleAllFiltered}
            className="text-primary hover:underline text-sm"
          >
            {allFilteredSelected ? "Deselect filtered" : "Select all filtered"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:underline text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Company list */}
      <ul className="divide-y divide-border rounded-md border border-border max-h-72 overflow-y-auto bg-card">
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground text-center">
            No companies match your search.
          </li>
        )}
        {filtered.map((company) => {
          const checked = selected.has(company.id);
          return (
            <li
              key={company.id}
              onClick={() => toggleOne(company.id)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent select-none"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(company.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-border accent-primary"
                aria-label={`Select ${company.name}`}
              />
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {company.name}
                </span>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {company.ticker && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      {company.ticker}
                    </span>
                  )}
                  {company.country && (
                    <span className="text-xs text-muted-foreground">
                      {company.country}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">
          Selected:{" "}
          <span className="font-bold text-foreground">{selected.size}</span>
        </span>
        <Button
          onClick={handleGenerate}
          disabled={loading || selected.size === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? "Generating…" : "Generate PDF"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}