import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, LinkButton, ScoreChip, Badge, Tag, EmptyState, StatTile } from "@/components/ui";
import { IconPlus, IconSearch, IconAlert } from "@/components/icons";
import { JobFilters } from "@/components/JobFilters";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";
import { parseJson, relativeDays, formatDate, truncate, formatSalary } from "@/lib/utils";
import { scoreBand } from "@/lib/matching";
import type { RedFlag } from "@/lib/redflags";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; min?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const statusFilter = params.status ?? "";
  const minScore = Number(params.min) || 0;
  const sort = params.sort ?? "score";

  const jobs = await prisma.job.findMany({
    include: { domains: true, _count: { select: { documents: true } } },
  });

  const filtered = jobs
    .filter((job) => {
      if (statusFilter && job.status !== statusFilter) return false;
      if (minScore && (job.matchScore ?? 0) < minScore) return false;
      if (query) {
        const haystack = `${job.title} ${job.companyName} ${job.location} ${job.source}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "score") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (sort === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (sort === "recent") return b.createdAt.getTime() - a.createdAt.getTime();
      return 0;
    });

  const unanalysed = jobs.filter((j) => !j.analysedAt).length;
  const strong = jobs.filter((j) => (j.matchScore ?? 0) >= 75).length;
  const withFlags = jobs.filter((j) => parseJson<RedFlag[]>(j.redFlags, []).length > 0).length;

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Every role you have captured, scored against your experience bank. Sorted by match by default — the ones worth your time first."
        actions={
          <LinkButton href="/jobs/new" variant="primary">
            <IconPlus size={14} /> Capture a job
          </LinkButton>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Captured" value={jobs.length} sub={`${filtered.length} shown`} />
        <StatTile label="Strong matches" value={strong} sub="75+ score" tone={strong > 0 ? "good" : undefined} />
        <StatTile label="Carrying red flags" value={withFlags} tone={withFlags > 0 ? "warning" : undefined} />
        <StatTile
          label="Not analysed"
          value={unanalysed}
          tone={unanalysed > 0 ? "warning" : undefined}
          sub={unanalysed > 0 ? "no score yet" : "all scored"}
        />
      </div>

      <JobFilters
        query={params.q ?? ""}
        status={statusFilter}
        sort={sort}
        min={String(minScore || "")}
      />

      {filtered.length === 0 ? (
        <Panel className="mt-4">
          <EmptyState
            icon={<IconSearch size={26} />}
            title={jobs.length === 0 ? "No jobs captured yet" : "Nothing matches those filters"}
            detail={
              jobs.length === 0
                ? "Paste a job description and you get a match score, a gap list, red flags and a one-click route into tailoring."
                : "Try widening the score threshold or clearing the status filter."
            }
            action={
              jobs.length === 0 ? (
                <LinkButton href="/jobs/new" variant="primary">
                  <IconPlus size={14} /> Capture your first job
                </LinkButton>
              ) : (
                <LinkButton href="/jobs">Clear filters</LinkButton>
              )
            }
          />
        </Panel>
      ) : (
        <Panel className="mt-4" padded={false}>
          <ul className="divide-y divide-[var(--line)]">
            {filtered.map((job) => {
              const flags = parseJson<RedFlag[]>(job.redFlags, []);
              const criticalFlags = flags.filter((f) => f.severity === "critical" || f.severity === "serious");
              const gaps = parseJson<{ skill: string; required: boolean }[]>(job.gaps, []);
              const essentialGaps = gaps.filter((g) => g.required);
              const band = scoreBand(job.matchScore);

              return (
                <li key={job.id} className="hover-row px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                      <ScoreChip score={job.matchScore} />
                      <span className="text-[10px] text-[var(--muted)]">{band.label}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/jobs/${job.id}`} className="text-[13.5px] font-medium hover:underline">
                          {job.title}
                        </Link>
                        <Badge tone={badgeToneForStatus(job.status as JobStatus)}>
                          {JOB_STATUS_LABELS[job.status as JobStatus]}
                        </Badge>
                        {job._count.documents > 0 && <Tag>{job._count.documents} draft</Tag>}
                      </div>

                      <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                        {[job.companyName || "Unknown employer", job.location, formatSalary(job.salaryMin, job.salaryMax, job.salaryText)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      {job.fitSummary && (
                        <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-2)]">
                          {truncate(job.fitSummary, 190)}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {job.domains.slice(0, 3).map((d) => (
                          <Tag key={d.id}>{d.name}</Tag>
                        ))}
                        {essentialGaps.length > 0 && (
                          <Badge tone="serious">
                            {essentialGaps.length} essential gap{essentialGaps.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {criticalFlags.length > 0 && (
                          <Badge tone="critical" icon={<IconAlert size={11} />}>
                            {criticalFlags.length} red flag{criticalFlags.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right text-[11px] text-[var(--muted)]">
                      {job.deadline ? (
                        <span
                          style={{
                            color:
                              job.deadline.getTime() - Date.now() < 3 * 86400000
                                ? "var(--critical)"
                                : job.deadline.getTime() - Date.now() < 7 * 86400000
                                  ? "var(--serious)"
                                  : undefined,
                          }}
                          title={`Closes ${formatDate(job.deadline)}`}
                        >
                          closes {relativeDays(job.deadline)}
                        </span>
                      ) : (
                        <span>added {relativeDays(job.createdAt)}</span>
                      )}
                      {job.source && <div className="mt-1">{job.source}</div>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

function badgeToneForStatus(status: JobStatus) {
  if (status === "OFFER") return "good" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "neutral" as const;
  if (["INTERVIEW", "FINAL", "SCREENING"].includes(status)) return "accent" as const;
  return "neutral" as const;
}
