import { prisma } from "./db";
import { ACTIVE_STATUSES, AWAITING_STATUSES, FUNNEL_STAGES, type JobStatus } from "./constants";
import { buildFunnel } from "./actionQueue";
import { addDays, daysAgo, pct, startOfWeek } from "./utils";

export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  applied: number;
  responses: number;
  responseRate: number;
  interviewsReached: number;
  interviewRate: number;
  offers: number;
  rejections: number;
  ghosted: number;
  appliedThisWeek: number;
  weeklyTarget: number;
  avgMatchScore: number | null;
  medianDaysToResponse: number | null;
  atomCount: number;
  headlineAtoms: number;
  atomsWithMetrics: number;
  upcomingInterviews: number;
}

export async function getDashboardStats(weeklyTarget: number): Promise<DashboardStats> {
  const [jobs, atoms, upcomingInterviews] = await Promise.all([
    prisma.job.findMany({
      select: {
        status: true, appliedAt: true, stageChangedAt: true, closedAt: true,
        outcome: true, matchScore: true, createdAt: true,
      },
    }),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      select: { isHeadline: true, metric: true },
    }),
    prisma.interviewEvent.count({ where: { scheduledAt: { gte: new Date() } } }),
  ]);

  const applied = jobs.filter((j) => j.appliedAt).length;

  // A "response" is any job that got past APPLIED — reaching screening or
  // beyond, or an explicit rejection after applying. A rejection is still a
  // response; treating it as silence would flatter the response rate.
  const responses = jobs.filter(
    (j) =>
      j.appliedAt &&
      (["SCREENING", "INTERVIEW", "FINAL", "OFFER"].includes(j.status) ||
        (j.status === "REJECTED" && j.closedAt))
  ).length;

  const interviewsReached = jobs.filter(
    (j) => j.appliedAt && ["INTERVIEW", "FINAL", "OFFER"].includes(j.status)
  ).length;

  const offers = jobs.filter((j) => j.status === "OFFER" || j.outcome === "OFFER").length;
  const rejections = jobs.filter((j) => j.status === "REJECTED").length;

  const ghosted = jobs.filter(
    (j) => j.appliedAt && j.status === "APPLIED" && daysAgo(j.stageChangedAt) > 28
  ).length;

  const weekStart = startOfWeek(new Date());
  const appliedThisWeek = jobs.filter((j) => j.appliedAt && j.appliedAt >= weekStart).length;

  const scored = jobs.filter((j) => j.matchScore !== null).map((j) => j.matchScore!);
  const avgMatchScore = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  // Median rather than mean: one employer taking three months should not move
  // the number you use to decide when to chase.
  const responseDays = jobs
    .filter((j) => j.appliedAt && j.stageChangedAt > j.appliedAt && j.status !== "APPLIED")
    .map((j) => daysAgo(j.appliedAt!) - daysAgo(j.stageChangedAt))
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const medianDaysToResponse = responseDays.length
    ? responseDays[Math.floor(responseDays.length / 2)]
    : null;

  return {
    totalJobs: jobs.length,
    activeJobs: jobs.filter((j) => ACTIVE_STATUSES.includes(j.status as JobStatus)).length,
    applied,
    responses,
    responseRate: pct(responses, applied),
    interviewsReached,
    interviewRate: pct(interviewsReached, applied),
    offers,
    rejections,
    ghosted,
    appliedThisWeek,
    weeklyTarget,
    avgMatchScore,
    medianDaysToResponse,
    atomCount: atoms.length,
    headlineAtoms: atoms.filter((a) => a.isHeadline).length,
    atomsWithMetrics: atoms.filter((a) => a.metric.trim()).length,
    upcomingInterviews,
  };
}

/** Applications per week for the last `weeks` weeks, oldest first. */
export async function getWeeklyActivity(weeks = 12) {
  const jobs = await prisma.job.findMany({
    where: { appliedAt: { not: null } },
    select: { appliedAt: true },
  });

  const thisWeek = startOfWeek(new Date());
  const buckets: { label: string; value: number; detail: string }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const count = jobs.filter((j) => j.appliedAt! >= start && j.appliedAt! < end).length;
    buckets.push({
      label: i === 0 ? "now" : start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      value: count,
      detail: `Week of ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    });
  }
  return buckets;
}

export async function getFunnelData() {
  const jobs = await prisma.job.findMany({ select: { status: true, appliedAt: true } });
  return buildFunnel(jobs, FUNNEL_STAGES);
}

/** Where jobs are currently waiting, for the "ball is with them" view. */
export async function getAwaitingBreakdown() {
  const jobs = await prisma.job.findMany({
    where: { status: { in: [...AWAITING_STATUSES] } },
    select: { id: true, title: true, companyName: true, status: true, stageChangedAt: true },
    orderBy: { stageChangedAt: "asc" },
  });
  return jobs.map((j) => ({ ...j, idleDays: daysAgo(j.stageChangedAt) }));
}

/** Which sources actually produce interviews, not just applications. */
export async function getSourcePerformance() {
  const jobs = await prisma.job.findMany({
    select: { source: true, appliedAt: true, status: true },
  });

  const bySource = new Map<string, { total: number; applied: number; responded: number; interviewed: number }>();
  for (const job of jobs) {
    const key = job.source.trim() || "Unrecorded";
    const entry = bySource.get(key) ?? { total: 0, applied: 0, responded: 0, interviewed: 0 };
    entry.total++;
    if (job.appliedAt) entry.applied++;
    if (job.appliedAt && ["SCREENING", "INTERVIEW", "FINAL", "OFFER", "REJECTED"].includes(job.status)) {
      entry.responded++;
    }
    if (["INTERVIEW", "FINAL", "OFFER"].includes(job.status)) entry.interviewed++;
    bySource.set(key, entry);
  }

  return [...bySource.entries()]
    .map(([source, s]) => ({
      source,
      ...s,
      responseRate: pct(s.responded, s.applied),
      interviewRate: pct(s.interviewed, s.applied),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Which skills appear most across saved jobs but have no evidence in the bank.
 * This is the highest-leverage view in the app: it tells you what to go and get
 * experience in, ranked by how often the market is actually asking for it.
 */
export async function getMarketGaps() {
  const [jobs, atoms] = await Promise.all([
    prisma.job.findMany({ select: { extractedSkills: true, status: true } }),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } } },
    }),
  ]);

  const evidenced = new Set<string>();
  for (const atom of atoms) {
    for (const link of atom.skills) evidenced.add(link.skill.name.toLowerCase());
  }

  const demand = new Map<string, { name: string; jobs: number; required: number }>();
  for (const job of jobs) {
    let skills: { name: string; required: boolean }[] = [];
    try {
      skills = JSON.parse(job.extractedSkills) ?? [];
    } catch {
      continue;
    }
    for (const skill of skills) {
      if (!skill?.name) continue;
      const key = skill.name.toLowerCase();
      const entry = demand.get(key) ?? { name: skill.name, jobs: 0, required: 0 };
      entry.jobs++;
      if (skill.required) entry.required++;
      demand.set(key, entry);
    }
  }

  return [...demand.entries()]
    .filter(([key]) => !evidenced.has(key))
    .map(([, v]) => v)
    .sort((a, b) => b.required - a.required || b.jobs - a.jobs);
}
