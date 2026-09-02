// Small shared helpers. Deliberately dependency-free.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Parse a JSON column, never throwing. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

// --- Dates ------------------------------------------------------------------

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS
  );
}

export function daysAgo(date: Date | null | undefined, now = new Date()): number {
  if (!date) return 0;
  return Math.max(0, daysBetween(new Date(date), now));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Monday-anchored week start, matching UK convention. */
export function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const day = (copy.getDay() + 6) % 7; // Mon = 0
  return addDays(copy, -day);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMonthYear(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** "3 days ago", "in 2 days", "today". */
export function relativeDays(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = daysBetween(now, date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/** Format a date range as it would appear on a CV. */
export function dateRange(
  start: Date | null | undefined,
  end: Date | null | undefined,
  ongoing = false
): string {
  const from = formatMonthYear(start);
  if (ongoing) return from ? `${from} – present` : "Present";
  const to = formatMonthYear(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || "";
}

// --- Numbers ----------------------------------------------------------------

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatSalary(min?: number | null, max?: number | null, text?: string): string {
  if (min && max) return `£${min.toLocaleString()} – £${max.toLocaleString()}`;
  if (min) return `£${min.toLocaleString()}+`;
  if (max) return `up to £${max.toLocaleString()}`;
  return text || "Not stated";
}

// --- Strings ----------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + "…";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
      .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function wordCount(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

/** Stable pseudo-random id for client-side optimistic rows. */
export function tempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}
