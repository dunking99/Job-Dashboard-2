"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Charts.
//
// Every chart here is single-series or ordinal, so no categorical legend is
// needed — the title names the series. Ramp steps come from the validated
// ordinal ramp (never lighter than step 250 on light, never darker than 600 on
// dark), so the step nearest the surface still clears 2:1.
//
// All marks are thin, data-ends are rounded, fills carry a 2px surface gap, and
// axes/gridlines are recessive. Hover is present by default, not an extra.

const RAMP = [
  "var(--ramp-7)",
  "var(--ramp-6)",
  "var(--ramp-5)",
  "var(--ramp-4)",
  "var(--ramp-3)",
  "var(--ramp-2)",
  "var(--ramp-1)",
];

function Tooltip({ children, x, y }: { children: React.ReactNode; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-[var(--line-strong)] bg-[var(--raised)] px-2 py-1.5 text-[11px] shadow-[var(--shadow-pop)]"
      style={{ left: x, top: y, transform: "translate(-50%, -110%)" }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export interface FunnelDatum {
  label: string;
  reached: number;
  current: number;
  conversion: number | null;
}

/**
 * Horizontal funnel. Horizontal because the stage names are long — a vertical
 * funnel would rotate the labels, which is the most common way these get made
 * unreadable.
 */
export function Funnel({ data }: { data: FunnelDatum[] }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const max = Math.max(1, ...data.map((d) => d.reached));

  if (!data.some((d) => d.reached > 0)) {
    return (
      <p className="py-8 text-center text-xs text-[var(--muted)]">
        No applications yet — the funnel fills in as jobs move through the pipeline.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => {
          const widthPct = (d.reached / max) * 100;
          const isHovered = hover?.i === i;
          return (
            <div
              key={d.label}
              className="group relative"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const parent = e.currentTarget.parentElement!.getBoundingClientRect();
                setHover({ i, x: rect.width / 2, y: rect.top - parent.top });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex items-center gap-3">
                <span className="w-[86px] shrink-0 text-right text-[11px] text-[var(--ink-2)]">
                  {d.label}
                </span>

                <div className="relative h-6 flex-1">
                  {/* Track */}
                  <div className="absolute inset-y-0 left-0 w-full rounded-r-[4px] bg-[var(--line)] opacity-30" />
                  {/* Bar — rounded data-end, anchored to the baseline at left */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,opacity] duration-500"
                    style={{
                      width: `${Math.max(widthPct, d.reached > 0 ? 2 : 0)}%`,
                      background: RAMP[Math.min(i, RAMP.length - 1)],
                      opacity: isHovered ? 1 : 0.92,
                    }}
                  />
                  {/* Direct label — identity is never colour-alone */}
                  <span
                    className="tnum absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold"
                    style={{ color: widthPct > 12 ? "#fff" : "var(--ink)" }}
                  >
                    {widthPct > 12 ? d.reached : ""}
                  </span>
                  {widthPct <= 12 && (
                    <span
                      className="tnum absolute inset-y-0 flex items-center text-[11px] font-semibold"
                      style={{ left: `calc(${Math.max(widthPct, 2)}% + 6px)` }}
                    >
                      {d.reached}
                    </span>
                  )}
                </div>

                <span className="tnum w-11 shrink-0 text-right text-[11px] text-[var(--muted)]">
                  {d.conversion !== null ? `${d.conversion}%` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        <span>Stage</span>
        <span>Reached · conversion from previous</span>
      </div>

      {hover && (
        <Tooltip x={hover.x + 100} y={hover.y}>
          <div className="font-semibold">{data[hover.i].label}</div>
          <div className="mt-0.5 text-[var(--ink-2)]">
            {data[hover.i].reached} reached · {data[hover.i].current} sitting here now
          </div>
          {data[hover.i].conversion !== null && (
            <div className="text-[var(--ink-2)]">
              {data[hover.i].conversion}% conversion from {data[hover.i - 1]?.label}
            </div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity columns
// ---------------------------------------------------------------------------

export interface ActivityDatum {
  label: string;
  value: number;
  /** ISO week start, for the tooltip. */
  detail?: string;
}

/** Weekly applications against a target. Single series, so one hue and no legend. */
export function ActivityChart({
  data,
  target,
  height = 120,
}: {
  data: ActivityDatum[];
  target?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));

  return (
    <div className="relative" style={{ height: height + 22 }}>
      {/* Target line — recessive, dashed, labelled */}
      {target !== undefined && target > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
          style={{ bottom: 22 + (target / max) * height }}
        >
          <div className="h-px flex-1 border-t border-dashed border-[var(--line-strong)]" />
          <span className="ml-1.5 shrink-0 text-[10px] text-[var(--muted)]">target {target}</span>
        </div>
      )}

      <div className="flex h-full items-end gap-[3px]" style={{ paddingBottom: 22 }}>
        {data.map((d, i) => {
          const h = (d.value / max) * height;
          const isHovered = hover?.i === i;
          const meetsTarget = target !== undefined && d.value >= target;
          return (
            <div
              key={i}
              className="group relative flex flex-1 cursor-default flex-col justify-end"
              style={{ height }}
              onMouseEnter={(e) => setHover({ i, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })}
              onMouseLeave={() => setHover(null)}
            >
              {/* Enlarged hit target above the mark */}
              <div className="absolute inset-x-0 bottom-0 top-0" />
              <div
                className="w-full rounded-t-[4px] transition-[height,opacity] duration-500"
                style={{
                  height: Math.max(h, d.value > 0 ? 3 : 1),
                  background: d.value === 0 ? "var(--line)" : meetsTarget ? "var(--accent)" : "var(--ramp-3)",
                  opacity: isHovered ? 1 : 0.9,
                }}
              />
              <span className="absolute -bottom-[19px] left-0 right-0 truncate text-center text-[10px] text-[var(--muted)]">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {hover && (
        <Tooltip x={hover.x} y={height - 4}>
          <div className="font-semibold">
            {data[hover.i].value} application{data[hover.i].value === 1 ? "" : "s"}
          </div>
          <div className="mt-0.5 text-[var(--ink-2)]">{data[hover.i].detail ?? data[hover.i].label}</div>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component score breakdown
// ---------------------------------------------------------------------------

/**
 * The match score decomposed. This exists because a single number is not
 * actionable — seeing that evidence depth is the weak component tells you to go
 * write bullets, which "62% match" does not.
 */
export function ScoreBreakdown({
  components,
}: {
  components: { key: string; label: string; score: number; max: number; detail: string }[];
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {components.map((c) => {
        const ratio = c.max > 0 ? c.score / c.max : 0;
        const tone =
          ratio >= 0.75 ? "var(--good)" : ratio >= 0.5 ? "var(--warning)" : ratio >= 0.25 ? "var(--serious)" : "var(--critical)";
        return (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium">{c.label}</span>
              <span className="tnum shrink-0 text-[11px] text-[var(--ink-2)]">
                {c.score}
                <span className="text-[var(--muted)]">/{c.max}</span>
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${ratio * 100}%`, background: tone }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{c.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Distribution strip
// ---------------------------------------------------------------------------

/** Compact horizontal distribution — used for score bands and stage mixes. */
export function StackedStrip({
  segments,
  height = 8,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return <div className="rounded-full bg-[var(--line)]" style={{ height }} />;
  }
  return (
    <div className="flex w-full overflow-hidden rounded-full" style={{ height, gap: 2 }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
    </div>
  );
}

export function Sparkline({
  values,
  width = 90,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 3) - 1.5}`);

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(values.length - 1) * step}
        cy={height - (values[values.length - 1] / max) * (height - 3) - 1.5}
        r={3}
        fill="var(--accent)"
        stroke="var(--panel)"
        strokeWidth={2}
      />
    </svg>
  );
}

/** Small inline label + value row used inside dense panels. */
export function MiniStat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="tnum text-[15px] font-semibold leading-none">{value}</span>
    </div>
  );
}
