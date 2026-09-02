import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Presentational primitives. Deliberately server-safe (no hooks) so pages can
// stay server components and fetch directly.

export type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "accent";

const TONE_COLOR: Record<Tone, string> = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
  accent: "var(--accent)",
  neutral: "var(--muted)",
};

/** Status colours never carry meaning alone — every use pairs with a label. */
export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: TONE_COLOR[tone] }}
      aria-hidden
    />
  );
}

export function Panel({
  children,
  className,
  title,
  subtitle,
  action,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        className
      )}
      style={{
        borderColor: tone === "neutral" ? "var(--line)" : `color-mix(in srgb, ${color} 40%, transparent)`,
        background: tone === "neutral" ? "transparent" : `color-mix(in srgb, ${color} 12%, transparent)`,
        color: tone === "neutral" ? "var(--ink-2)" : undefined,
      }}
    >
      {icon ?? (tone !== "neutral" && <Dot tone={tone} />)}
      <span style={{ color: tone === "neutral" ? undefined : "var(--ink)" }}>{children}</span>
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--ink-2)] whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(buttonClass(variant, size), className)} {...rest}>
      {children}
    </button>
  );
}

export function buttonClass(
  variant: "default" | "primary" | "ghost" | "danger" = "default",
  size: "sm" | "md" = "md"
) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer";
  const sizing = size === "sm" ? "px-2 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]";
  const variants = {
    default: "border border-[var(--line-strong)] bg-[var(--panel)] hover:bg-[var(--raised)]",
    primary: "bg-[var(--accent)] text-white hover:opacity-90 border border-transparent",
    ghost: "hover:bg-[var(--accent-soft)] border border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]",
    danger:
      "border border-[color-mix(in_srgb,var(--critical)_40%,transparent)] text-[var(--critical)] hover:bg-[color-mix(in_srgb,var(--critical)_10%,transparent)]",
  };
  return cn(base, sizing, variants[variant]);
}

export function LinkButton({
  href,
  children,
  variant = "default",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonClass(variant, size), className)}>
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  detail,
  action,
  icon,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-[var(--line-strong)]">{icon}</div>}
      <div>
        <p className="text-sm font-medium">{title}</p>
        {detail && <p className="mx-auto mt-1 max-w-md text-xs text-[var(--muted)]">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A single headline number. This is the right form for one current value —
 * a one-bar bar chart is not.
 */
export function StatTile({
  label,
  value,
  sub,
  tone,
  href,
  hero = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  href?: string;
  hero?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        {tone && tone !== "neutral" && <Dot tone={tone} />}
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</span>
      </div>
      <div className={cn("mt-1.5 font-semibold leading-none", hero ? "text-[40px]" : "text-[26px]")}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--ink-2)]">{sub}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card block p-3.5 transition-colors hover:border-[var(--line-strong)]">
        {body}
      </Link>
    );
  }
  return <div className="card p-3.5">{body}</div>;
}

/** A single ratio against a limit. Same-ramp track, never a two-slice pie. */
export function Meter({
  value,
  max = 100,
  tone = "accent",
  label,
  showValue = true,
  size = "md",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md";
}) {
  const pctValue = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          {label && <span className="text-[var(--ink-2)]">{label}</span>}
          {showValue && (
            <span className="tnum font-medium text-[var(--ink)]">
              {Math.round(value)}
              <span className="text-[var(--muted)]">/{max}</span>
            </span>
          )}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-[var(--line)]", size === "sm" ? "h-1" : "h-1.5")}
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pctValue}%`, background: TONE_COLOR[tone] }}
        />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-[var(--ink-2)]">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Labelled({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-t border-[var(--line)]" />;
  return (
    <div className="my-4 flex items-center gap-3">
      <hr className="flex-1 border-t border-[var(--line)]" />
      <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <hr className="flex-1 border-t border-[var(--line)]" />
    </div>
  );
}

/** Key/value rows for detail panes. */
export function DataList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-2 text-[13px]">
      {rows.map((row, i) => (
        <div key={i} className="contents">
          <dt className="text-[var(--muted)]">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ScoreChip({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" }) {
  if (score === null || score === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-dashed border-[var(--line-strong)] text-[var(--muted)]",
          size === "sm" ? "h-6 px-1.5 text-[11px]" : "h-8 px-2 text-xs"
        )}
        title="Not analysed yet"
      >
        —
      </span>
    );
  }
  const tone: Tone = score >= 75 ? "good" : score >= 55 ? "warning" : score >= 35 ? "serious" : "critical";
  const color = TONE_COLOR[tone];
  return (
    <span
      className={cn(
        "tnum inline-flex items-center justify-center rounded-md border font-semibold",
        size === "sm" ? "h-6 min-w-[2rem] px-1.5 text-[12px]" : "h-8 min-w-[2.5rem] px-2 text-[15px]"
      )}
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={`Match score ${score}/100`}
    >
      {score}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    critical: { tone: "critical", label: "Critical" },
    serious: { tone: "serious", label: "Serious" },
    warning: { tone: "warning", label: "Warning" },
    good: { tone: "good", label: "Good" },
  };
  const entry = map[severity] ?? { tone: "neutral" as Tone, label: severity };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
