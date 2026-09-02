"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, getProfile } from "@/lib/db";
import { computeMatch, type AtomForMatching } from "@/lib/matching";
import { detectRedFlags } from "@/lib/redflags";
import {
  extractSkills, extractYearsRequired, extractSalary, extractWorkMode,
  extractDeadline, guessTitleAndCompany,
} from "@/lib/text";
import { parseJson, toJson } from "@/lib/utils";
import { runAi, extractJson } from "@/lib/ai/client";
import { jobAnalysisPrompt, jobAnalysisSchema } from "@/lib/ai/prompts";
import { buildCandidateSummary, yearsOfExperience } from "@/lib/candidate";

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export async function ingestJob(formData: FormData) {
  const rawDescription = String(formData.get("rawDescription") ?? "").trim();
  if (!rawDescription) return { error: "Paste the job description first." };

  const guessed = guessTitleAndCompany(rawDescription);
  const title = String(formData.get("title") ?? "").trim() || guessed.title || "Untitled role";
  const companyName = String(formData.get("companyName") ?? "").trim() || guessed.company;

  const salary = extractSalary(rawDescription);
  const deadline = extractDeadline(rawDescription);

  // Reuse an existing company record when the name matches, so dossiers and
  // contacts stay attached rather than fragmenting across near-duplicates.
  let companyId: string | null = null;
  if (companyName) {
    const existing = await prisma.company.findFirst({
      where: { name: { equals: companyName } },
    });
    companyId =
      existing?.id ??
      (await prisma.company.create({ data: { name: companyName } })).id;
  }

  const job = await prisma.job.create({
    data: {
      title,
      companyName,
      companyId,
      url: String(formData.get("url") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      contract: String(formData.get("contract") ?? "").trim(),
      workMode: extractWorkMode(rawDescription),
      salaryText: salary.raw,
      salaryMin: salary.min ?? null,
      salaryMax: salary.max ?? null,
      deadline: deadline ?? parseDateInput(formData.get("deadline")),
      rawDescription,
      status: "SAVED",
      stageChangedAt: new Date(),
    },
  });

  await analyseJobInternal(job.id, { withAi: false });

  revalidatePath("/jobs");
  revalidatePath("/");
  redirect(`/jobs/${job.id}`);
}

function parseDateInput(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Deterministic analysis always runs; AI enrichment runs on top when a key is
 * present. Keeping them separate means a match score never depends on a model
 * being available or on a model's mood — re-running gives the same number.
 */
export async function analyseJobInternal(jobId: string, opts: { withAi: boolean }) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { domains: true } });
  if (!job) return { error: "Job not found." };

  const [atoms, skills, profile] = await Promise.all([
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } }, domains: true },
    }),
    prisma.skill.findMany({ where: { proficiency: { gt: 0 } } }),
    getProfile(),
  ]);

  const match = computeMatch(
    {
      title: job.title,
      rawDescription: job.rawDescription,
      domainSlugs: job.domains.map((d) => d.slug),
      sector: undefined,
    },
    atoms as unknown as AtomForMatching[],
    skills.map((s) => s.name),
    {
      targetRoles: parseJson<string[]>(profile.targetRoles, []),
      targetSectors: parseJson<string[]>(profile.targetSectors, []),
      yearsExperience: yearsOfExperience(atoms),
    }
  );

  const redFlags = detectRedFlags(job.rawDescription);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      matchScore: match.score,
      matchBreakdown: toJson(match.components),
      gaps: toJson(match.gaps),
      extractedSkills: toJson(match.extracted),
      yearsRequired: match.yearsRequired,
      redFlags: toJson(redFlags),
      analysedAt: new Date(),
    },
  });

  if (!opts.withAi) return { ok: true, score: match.score };

  const allDomains = await prisma.domain.findMany();
  const prompt = jobAnalysisPrompt({
    title: job.title,
    company: job.companyName,
    description: job.rawDescription,
    candidateSummary: await buildCandidateSummary(),
    matchScore: match.score,
    gaps: match.gaps.map((g) => `${g.skill} (${g.reason.toLowerCase().replace("_", " ")})`),
    availableDomains: allDomains.map((d) => d.name),
  });

  const result = await runAi({
    kind: "JOB_ANALYSIS",
    system: prompt.system,
    user: prompt.user,
    jobId,
    targetType: "job",
    targetId: jobId,
      });

  if (result.status === "COMPLETE" && result.text) {
    await applyJobAnalysis(jobId, result.text);
  }

  return { ok: true, score: match.score, ai: result };
}

/** Shared by API responses and pasted bridge responses. */
export async function applyJobAnalysis(jobId: string, responseText: string) {
  const parsed = jobAnalysisSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the analysis JSON from that response." };

  const data = parsed.data;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: "Job not found." };

  const domains = await prisma.domain.findMany();
  const matchedDomains = domains.filter((d) =>
    data.domains.some((name) => name.toLowerCase().trim() === d.name.toLowerCase())
  );

  // The AI may spot flags the regex rules miss; merge rather than replace so
  // deterministic findings are never silently dropped.
  const existingFlags = parseJson<{ label: string }[]>(job.redFlags, []);
  const existingLabels = new Set(existingFlags.map((f) => f.label.toLowerCase()));
  const merged = [
    ...existingFlags,
    ...data.redFlags
      .filter((f) => !existingLabels.has(f.label.toLowerCase()))
      .map((f) => ({
        label: f.label,
        severity: ["warning", "serious", "critical"].includes(f.severity) ? f.severity : "warning",
        explanation: f.explanation,
        evidence: "",
        fromAi: true,
      })),
  ];

  await prisma.job.update({
    where: { id: jobId },
    data: {
      fitSummary: data.fitSummary,
      positioningAngle: data.positioningAngle,
      riskNotes: data.riskNotes,
      redFlags: toJson(merged),
      domains: { set: matchedDomains.map((d) => ({ id: d.id })) },
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function analyseJob(jobId: string, withAi: boolean) {
  const result = await analyseJobInternal(jobId, { withAi });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
  return result;
}

/** Re-score every job — used after the experience bank changes materially. */
export async function reanalyseAllJobs() {
  const jobs = await prisma.job.findMany({ select: { id: true } });
  for (const job of jobs) {
    await analyseJobInternal(job.id, { withAi: false });
  }
  revalidatePath("/jobs");
  revalidatePath("/");
  revalidatePath("/analytics");
  return { ok: true, count: jobs.length };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function updateJobStatus(jobId: string, status: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: "Job not found." };
  if (job.status === status) return { ok: true };

  const data: Record<string, unknown> = { status, stageChangedAt: new Date() };

  // Timestamps that analytics depend on are set once, when the transition
  // actually happens — recomputing them later from status alone loses history.
  if (status === "APPLIED" && !job.appliedAt) data.appliedAt = new Date();
  if (["REJECTED", "WITHDRAWN", "ARCHIVED"].includes(status)) {
    data.closedAt = new Date();
    data.outcome = status === "REJECTED" ? "REJECTED" : status === "WITHDRAWN" ? "WITHDRAWN" : "";
  } else {
    data.closedAt = null;
    if (status === "OFFER") data.outcome = "OFFER";
  }

  await prisma.job.update({ where: { id: jobId }, data });

  await prisma.interaction.create({
    data: {
      jobId,
      kind: "NOTE",
      direction: "NA",
      subject: `Moved to ${status.toLowerCase().replace("_", " ")}`,
      occurredAt: new Date(),
    },
  });

  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateJobFields(jobId: string, formData: FormData) {
  const salaryMin = Number(formData.get("salaryMin"));
  const salaryMax = Number(formData.get("salaryMax"));

  await prisma.job.update({
    where: { id: jobId },
    data: {
      title: String(formData.get("title") ?? "").trim(),
      companyName: String(formData.get("companyName") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      url: String(formData.get("url") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      contract: String(formData.get("contract") ?? "").trim(),
      workMode: String(formData.get("workMode") ?? "UNKNOWN"),
      salaryText: String(formData.get("salaryText") ?? "").trim(),
      salaryMin: Number.isFinite(salaryMin) && salaryMin > 0 ? salaryMin : null,
      salaryMax: Number.isFinite(salaryMax) && salaryMax > 0 ? salaryMax : null,
      deadline: parseDateInput(formData.get("deadline")),
      priority: Number(formData.get("priority")) || 3,
      notes: String(formData.get("notes") ?? ""),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

export async function setJobDomains(jobId: string, domainIds: string[]) {
  await prisma.job.update({
    where: { id: jobId },
    data: { domains: { set: domainIds.map((id) => ({ id })) } },
  });
  // Domain alignment is a scored component, so re-run the deterministic pass.
  await analyseJobInternal(jobId, { withAi: false });
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteJob(jobId: string) {
  await prisma.job.delete({ where: { id: jobId } });
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath("/");
  redirect("/jobs");
}

export async function reorderJob(jobId: string, status: string, boardOrder: number) {
  await prisma.job.update({ where: { id: jobId }, data: { boardOrder } });
  await updateJobStatus(jobId, status);
  return { ok: true };
}
