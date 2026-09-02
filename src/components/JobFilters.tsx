"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Filters sit in one row above the list and write to the URL, so a filtered
// view is linkable and survives a refresh.

export function JobFilters({
  query,
  status,
  sort,
  min,
}: {
  query: string;
  status: string;
  sort: string;
  min: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/jobs?${next.toString()}`);
    },
    [params, router]
  );

  const active = Boolean(query || status || min);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        defaultValue={query}
        onChange={(e) => {
          const value = e.target.value;
          window.clearTimeout((window as unknown as { __jobSearch?: number }).__jobSearch);
          (window as unknown as { __jobSearch?: number }).__jobSearch = window.setTimeout(
            () => update("q", value),
            250
          );
        }}
        placeholder="Search title, employer, location…"
        className="field max-w-xs flex-1"
      />

      <select value={status} onChange={(e) => update("status", e.target.value)} className="field w-auto">
        <option value="">All stages</option>
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {JOB_STATUS_LABELS[s as JobStatus]}
          </option>
        ))}
      </select>

      <select value={min} onChange={(e) => update("min", e.target.value)} className="field w-auto">
        <option value="">Any score</option>
        <option value="75">75+ (strong)</option>
        <option value="55">55+ (worth it)</option>
        <option value="35">35+ (stretch)</option>
      </select>

      <select value={sort} onChange={(e) => update("sort", e.target.value)} className="field w-auto">
        <option value="score">Sort: match score</option>
        <option value="deadline">Sort: deadline</option>
        <option value="recent">Sort: recently added</option>
      </select>

      {active && (
        <button
          onClick={() => router.push("/jobs")}
          className={cn(
            "rounded-md px-2 py-1.5 text-[12px] text-[var(--muted)] transition-colors",
            "hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          )}
        >
          Clear
        </button>
      )}
    </div>
  );
}
