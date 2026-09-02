// The action queue.
//
// Derived at read time from pipeline state. Deliberately NOT a stored to-do
// list: stored to-dos drift out of sync with reality and then get ignored,
// which is worse than having none. If the underlying fact changes, the item
// disappears on its own.
//
// Manual Tasks (the Task model) are merged in — those are the things the system
// cannot infer.

import { prisma } from "./db";
import { AWAITING_STATUSES, STALE_DAYS, VERY_STALE_DAYS, JOB_STATUS_LABELS, type JobStatus } from "./constants";
import { daysAgo, daysBetween, startOfDay } from "./utils";

export interface ActionItem {
  id: string;
  /** Sort key. Lower is more urgent. */
  urgency: number;
  severity: "critical" | "serious" | "warning" | "neutral";
  title: string;
  detail: string;
  href: string;
  cta: string;
  kind:
    | "DEADLINE"
    | "INTERVIEW"
    | "STALE"
    | "UNTAILORED"
    | "UNANALYSED"
    | "PREP"
    | "FOLLOW_UP"
    | "MANUAL"
    | "NO_EVIDENCE";
  /** Present for manual tasks so they can be ticked off. */
  taskId?: string;
}

export async function buildActionQueue(now = new Date()): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  const [jobs, interviews, tasks, atomCount] = await Promise.all([
    prisma.job.findMany({
      where: { status: { notIn: ["REJECTED", "WITHDRAWN", "ARCHIVED"] } },
      include: { documents: { select: { id: true, kind: true } } },
    }),
    prisma.interviewEvent.findMany({
      where: { scheduledAt: { gte: startOfDay(now) } },
      include: { job: { select: { id: true, title: true, companyName: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.task.findMany({ where: { done: false }, orderBy: { dueAt: "asc" } }),
    prisma.experienceAtom.count({ where: { archived: false } }),
  ]);

  // --- Upcoming interviews -------------------------------------------------
  for (const iv of interviews) {
    const days = daysBetween(now, iv.scheduledAt);
    if (days > 14) continue;
    const notReady = iv.prepStatus !== "READY";
    items.push({
      id: `iv_${iv.id}`,
      urgency: days * 10 + (notReady ? 0 : 5),
      severity: days <= 1 ? "critical" : days <= 3 && notReady ? "serious" : "warning",
      title:
        days === 0
          ? `Interview today — ${iv.job.title}`
          : days === 1
            ? `Interview tomorrow — ${iv.job.title}`
            : `Interview in ${days} days — ${iv.job.title}`,
      detail: notReady
        ? `${iv.job.companyName || "Unknown employer"} · prep is ${iv.prepStatus === "NOT_STARTED" ? "not started" : "in progress"}`
        : `${iv.job.companyName || "Unknown employer"} · prep marked ready`,
      href: `/interview?job=${iv.jobId}`,
      cta: notReady ? "Prep now" : "Review prep",
      kind: notReady ? "PREP" : "INTERVIEW",
    });
  }

  // --- Deadlines -----------------------------------------------------------
  for (const job of jobs) {
    if (!job.deadline) continue;
    if (["APPLIED", "SCREENING", "INTERVIEW", "FINAL", "OFFER"].includes(job.status)) continue;
    const days = daysBetween(now, job.deadline);
    if (days < 0 || days > 21) continue;
    items.push({
      id: `dl_${job.id}`,
      urgency: days * 10 - 5,
      severity: days <= 2 ? "critical" : days <= 6 ? "serious" : "warning",
      title:
        days === 0
          ? `Closes today — ${job.title}`
          : `Closes in ${days} day${days === 1 ? "" : "s"} — ${job.title}`,
      detail: `${job.companyName || "Unknown employer"} · still at "${JOB_STATUS_LABELS[job.status as JobStatus]}"`,
      href: `/jobs/${job.id}`,
      cta: "Open",
      kind: "DEADLINE",
    });
  }

  // --- Stale applications --------------------------------------------------
  for (const job of jobs) {
    if (!AWAITING_STATUSES.includes(job.status as JobStatus)) continue;
    const idle = daysAgo(job.stageChangedAt, now);
    if (idle < STALE_DAYS) continue;
    items.push({
      id: `stale_${job.id}`,
      urgency: 200 - idle,
      severity: idle >= VERY_STALE_DAYS ? "serious" : "warning",
      title: `No movement in ${idle} days — ${job.title}`,
      detail: `${job.companyName || "Unknown employer"} · sat at "${JOB_STATUS_LABELS[job.status as JobStatus]}" since ${job.stageChangedAt.toLocaleDateString("en-GB")}`,
      href: `/jobs/${job.id}`,
      cta: idle >= VERY_STALE_DAYS ? "Chase or archive" : "Follow up",
      kind: "STALE",
    });
  }

  // --- Captured but not analysed ------------------------------------------
  const unanalysed = jobs.filter((j) => !j.analysedAt && j.status === "SAVED");
  if (unanalysed.length) {
    items.push({
      id: "unanalysed",
      urgency: 300,
      severity: "neutral",
      title: `${unanalysed.length} saved job${unanalysed.length === 1 ? "" : "s"} not yet analysed`,
      detail: "Run analysis to get match scores, gaps and red flags.",
      href: "/jobs",
      cta: "Review",
      kind: "UNANALYSED",
    });
  }

  // --- In tailoring with nothing drafted ----------------------------------
  for (const job of jobs) {
    if (job.status !== "TAILORING") continue;
    const hasCv = job.documents.some((d) => d.kind === "CV");
    const idle = daysAgo(job.stageChangedAt, now);
    if (hasCv && idle < 5) continue;
    items.push({
      id: `tailor_${job.id}`,
      urgency: 250 - idle,
      severity: idle > 7 ? "serious" : "warning",
      title: hasCv
        ? `Tailored ${idle} days ago, not sent — ${job.title}`
        : `Tailoring not started — ${job.title}`,
      detail: `${job.companyName || "Unknown employer"}${job.deadline ? ` · closes ${job.deadline.toLocaleDateString("en-GB")}` : ""}`,
      href: `/jobs/${job.id}/tailor`,
      cta: hasCv ? "Finish and apply" : "Start tailoring",
      kind: "UNTAILORED",
    });
  }

  // --- Empty bank ----------------------------------------------------------
  if (atomCount === 0) {
    items.push({
      id: "empty_bank",
      urgency: -100,
      severity: "critical",
      title: "Your experience bank is empty",
      detail:
        "Nothing downstream works until this is populated — match scores, tailoring and interview prep all read from it.",
      href: "/experience",
      cta: "Set it up",
      kind: "NO_EVIDENCE",
    });
  } else if (atomCount < 6) {
    items.push({
      id: "thin_bank",
      urgency: 400,
      severity: "warning",
      title: `Only ${atomCount} experience entries`,
      detail: "Tailoring gets sharply better past about 10–12 entries — there's more to select from.",
      href: "/experience",
      cta: "Add more",
      kind: "NO_EVIDENCE",
    });
  }

  // --- Manual tasks --------------------------------------------------------
  for (const task of tasks) {
    const days = task.dueAt ? daysBetween(now, task.dueAt) : 999;
    if (days > 14) continue;
    items.push({
      id: `task_${task.id}`,
      taskId: task.id,
      urgency: task.dueAt ? days * 10 : 500,
      severity: days < 0 ? "critical" : days <= 1 ? "serious" : "neutral",
      title: task.title,
      detail:
        task.detail ||
        (task.dueAt
          ? days < 0
            ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
            : `Due ${task.dueAt.toLocaleDateString("en-GB")}`
          : "No due date"),
      href: task.jobId ? `/jobs/${task.jobId}` : "/pipeline",
      cta: "Open",
      kind: "MANUAL",
    });
  }

  return items.sort((a, b) => a.urgency - b.urgency);
}

// ---------------------------------------------------------------------------
// Funnel & analytics
// ---------------------------------------------------------------------------

export interface FunnelStage {
  status: JobStatus;
  label: string;
  /** Jobs currently sitting at this stage. */
  current: number;
  /** Jobs that have ever reached this stage or beyond. */
  reached: number;
  /** Conversion from the previous stage, as a percentage. */
  conversion: number | null;
}

/**
 * "Reached" is inferred from current position: a job at INTERVIEW must have
 * passed APPLIED. Rejections are attributed to the furthest stage they got to,
 * which is why the closed job's `outcome` and last status both matter.
 */
export function buildFunnel(
  jobs: { status: string; appliedAt: Date | null }[],
  stages: JobStatus[]
): FunnelStage[] {
  const rank = new Map(stages.map((s, i) => [s, i]));

  const currentCounts = new Map<JobStatus, number>();
  const reachedCounts = new Map<JobStatus, number>();
  for (const stage of stages) {
    currentCounts.set(stage, 0);
    reachedCounts.set(stage, 0);
  }

  for (const job of jobs) {
    const status = job.status as JobStatus;
    let effectiveRank: number | undefined = rank.get(status);

    // A closed job still counts as having reached the stages it passed. We
    // approximate the furthest stage from whether it was ever applied to.
    if (effectiveRank === undefined) {
      effectiveRank = job.appliedAt ? rank.get("APPLIED") : rank.get("SAVED");
    } else {
      currentCounts.set(status, (currentCounts.get(status) ?? 0) + 1);
    }
    if (effectiveRank === undefined) continue;

    for (let i = 0; i <= effectiveRank; i++) {
      const stage = stages[i];
      reachedCounts.set(stage, (reachedCounts.get(stage) ?? 0) + 1);
    }
  }

  return stages.map((stage, i) => {
    const reached = reachedCounts.get(stage) ?? 0;
    const prevReached = i > 0 ? (reachedCounts.get(stages[i - 1]) ?? 0) : null;
    return {
      status: stage,
      label: JOB_STATUS_LABELS[stage],
      current: currentCounts.get(stage) ?? 0,
      reached,
      conversion: prevReached && prevReached > 0 ? Math.round((reached / prevReached) * 100) : null,
    };
  });
}
