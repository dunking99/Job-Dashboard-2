import Link from "next/link";
import { getProfile, prisma } from "@/lib/db";
import { buildActionQueue } from "@/lib/actionQueue";
import { getDashboardStats, getWeeklyActivity, getFunnelData, getAwaitingBreakdown } from "@/lib/analytics";
import { Panel, StatTile, Badge, EmptyState, LinkButton, Dot, Meter, ScoreChip, Tag } from "@/components/ui";
import { Funnel, ActivityChart, MiniStat } from "@/components/charts";
import { IconArrowRight, IconPlus, IconCheck, IconClock, IconSparkle } from "@/components/icons";
import { CompleteTaskButton } from "@/components/TaskActions";
import { formatDate, relativeDays, truncate } from "@/lib/utils";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";

export default async function CommandCenter() {
  const profile = await getProfile();

  const [queue, stats, activity, funnel, awaiting, recentCaptures, nextInterviews] = await Promise.all([
    buildActionQueue(),
    getDashboardStats(profile.weeklyApplicationTarget),
    getWeeklyActivity(12),
    getFunnelData(),
    getAwaitingBreakdown(),
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, title: true, companyName: true, matchScore: true,
        status: true, createdAt: true, analysedAt: true,
      },
    }),
    prisma.interviewEvent.findMany({
      where: { scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: { job: { select: { id: true, title: true, companyName: true } } },
    }),
  ]);

  const urgent = queue.filter((i) => i.severity === "critical" || i.severity === "serious");
  const firstName = profile.fullName.split(" ")[0];

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting()}
            {firstName && firstName !== "Your" ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-2)]">
            {urgent.length > 0 ? (
              <>
                <span className="font-medium text-[var(--ink)]">{urgent.length} thing{urgent.length === 1 ? "" : "s"}</span>{" "}
                need attention today.
              </>
            ) : queue.length > 0 ? (
              <>Nothing urgent. {queue.length} item{queue.length === 1 ? "" : "s"} in the queue.</>
            ) : (
              <>Queue is clear. Good time to capture new roles.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/jobs/new" variant="primary">
            <IconPlus size={14} /> Capture a job
          </LinkButton>
          <LinkButton href="/pipeline">Open pipeline</LinkButton>
        </div>
      </header>

      {/* KPI row — headline numbers, not a grouped bar chart */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Live applications"
          value={stats.activeJobs}
          sub={`${stats.applied} sent all time`}
          href="/pipeline"
        />
        <StatTile
          label="Response rate"
          value={stats.applied ? `${stats.responseRate}%` : "—"}
          sub={stats.applied ? `${stats.responses} of ${stats.applied} replied` : "no applications yet"}
          tone={stats.applied >= 5 ? (stats.responseRate >= 25 ? "good" : stats.responseRate >= 10 ? "warning" : "serious") : undefined}
        />
        <StatTile
          label="Interviews"
          value={stats.interviewsReached}
          sub={stats.upcomingInterviews ? `${stats.upcomingInterviews} scheduled` : "none scheduled"}
          tone={stats.upcomingInterviews > 0 ? "good" : undefined}
          href="/interview"
        />
        <StatTile
          label="This week"
          value={`${stats.appliedThisWeek}`}
          sub={
            <span className="block w-full">
              <Meter
                value={stats.appliedThisWeek}
                max={stats.weeklyTarget}
                showValue={false}
                size="sm"
                tone={stats.appliedThisWeek >= stats.weeklyTarget ? "good" : "accent"}
              />
              <span className="mt-1 block text-[var(--muted)]">target {stats.weeklyTarget}/week</span>
            </span>
          }
        />
        <StatTile
          label="Experience bank"
          value={stats.atomCount}
          sub={`${stats.atomsWithMetrics} with a metric`}
          tone={stats.atomCount === 0 ? "critical" : stats.atomCount < 6 ? "warning" : undefined}
          href="/experience"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* Action queue */}
        <Panel
          title="What needs doing"
          subtitle="Derived from your pipeline — items disappear on their own when the underlying fact changes."
          padded={false}
          action={
            queue.length > 8 ? (
              <span className="text-[11px] text-[var(--muted)]">showing 8 of {queue.length}</span>
            ) : null
          }
        >
          {queue.length === 0 ? (
            <EmptyState
              icon={<IconCheck size={26} />}
              title="Nothing outstanding"
              detail="No deadlines, stale applications or unprepped interviews. Capture new roles to keep the pipeline moving."
              action={<LinkButton href="/jobs/new" size="sm"><IconPlus size={13} /> Capture a job</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {queue.slice(0, 8).map((item) => (
                <li key={item.id} className="hover-row flex items-start gap-3 px-4 py-3">
                  <Dot tone={item.severity} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} className="block text-[13px] font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">{item.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.taskId && <CompleteTaskButton taskId={item.taskId} />}
                    <Link
                      href={item.href}
                      className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--ink-2)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                    >
                                            {item.cta} <IconArrowRight size={11} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {/* Funnel */}
          <Panel title="Pipeline funnel" subtitle="Jobs that reached each stage, and conversion from the one before.">
            <Funnel data={funnel.map((f) => ({ label: f.label, reached: f.reached, current: f.current, conversion: f.conversion }))} />
          </Panel>

          {/* Next interviews */}
          {nextInterviews.length > 0 && (
            <Panel title="Next up" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {nextInterviews.map((iv) => (
                  <li key={iv.id} className="hover-row flex items-center gap-3 px-4 py-2.5">
                    <IconClock size={14} className="shrink-0 text-[var(--muted)]" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/interview?job=${iv.jobId}`} className="block truncate text-[13px] font-medium hover:underline">
                        {iv.job.title}
                      </Link>
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {iv.job.companyName} · {formatDate(iv.scheduledAt)}
                      </p>
                    </div>
                    <Badge tone={iv.prepStatus === "READY" ? "good" : iv.prepStatus === "IN_PROGRESS" ? "warning" : "serious"}>
                      {iv.prepStatus === "READY" ? "Ready" : iv.prepStatus === "IN_PROGRESS" ? "Prepping" : "Not started"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        {/* Activity */}
        <Panel title="Applications per week" subtitle="Last 12 weeks against your target.">
          <ActivityChart data={activity} target={stats.weeklyTarget} />
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3">
            <MiniStat label="Median reply" value={stats.medianDaysToResponse !== null ? `${stats.medianDaysToResponse}d` : "—"} />
            <MiniStat label="Avg match" value={stats.avgMatchScore !== null ? stats.avgMatchScore : "—"} />
            <MiniStat label="No reply 28d+" value={stats.ghosted} />
          </div>
        </Panel>

        {/* Waiting on them */}
        <Panel
          title="Waiting on them"
          subtitle="Where the ball is with the employer, oldest first."
          padded={false}
        >
          {awaiting.length === 0 ? (
            <EmptyState title="Nothing outstanding" detail="No applications are currently awaiting a reply." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {awaiting.slice(0, 6).map((job) => (
                <li key={job.id} className="hover-row flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${job.id}`} className="block truncate text-[13px] hover:underline">
                      {job.title}
                    </Link>
                    <p className="truncate text-[11px] text-[var(--muted)]">
                      {job.companyName || "—"} · {JOB_STATUS_LABELS[job.status as JobStatus]}
                    </p>
                  </div>
                  <span
                    className="tnum shrink-0 text-[11px]"
                    style={{
                      color: job.idleDays >= 21 ? "var(--serious)" : job.idleDays >= 10 ? "var(--warning)" : "var(--muted)",
                    }}
                    title={`No movement for ${job.idleDays} days`}
                  >
                    {job.idleDays}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent captures */}
        <Panel title="Recently captured" padded={false} action={<Link href="/jobs" className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">All jobs</Link>}>
          {recentCaptures.length === 0 ? (
            <EmptyState
              title="No jobs captured yet"
              detail="Paste a job description to get a match score, gap analysis and red flags."
              action={<LinkButton href="/jobs/new" size="sm"><IconPlus size={13} /> Capture one</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recentCaptures.map((job) => (
                <li key={job.id} className="hover-row flex items-center gap-3 px-4 py-2.5">
                  <ScoreChip score={job.matchScore} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${job.id}`} className="block truncate text-[13px] hover:underline">
                      {truncate(job.title, 42)}
                    </Link>
                    <p className="truncate text-[11px] text-[var(--muted)]">
                      {job.companyName || "—"} · {relativeDays(job.createdAt)}
                    </p>
                  </div>
                  {!job.analysedAt && <Tag>new</Tag>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {stats.atomCount === 0 && (
        <Panel className="mt-4 border-[color-mix(in_srgb,var(--accent)_40%,transparent)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconSparkle size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <div>
                <p className="text-[13px] font-medium">Start with your experience bank</p>
                <p className="mt-0.5 max-w-xl text-[12px] text-[var(--ink-2)]">
                  Match scores, tailoring and interview prep are all projections of it. Paste an existing CV and it
                  will be split into taggable entries automatically.
                </p>
              </div>
            </div>
            <LinkButton href="/experience/import" variant="primary">Import a CV</LinkButton>
          </div>
        </Panel>
      )}
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
