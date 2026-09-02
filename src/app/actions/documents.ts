"use server";

import { revalidatePath } from "next/cache";
import { prisma, getProfile } from "@/lib/db";
import { rankAtomsForJob, type AtomForMatching } from "@/lib/matching";
import { analyseAts } from "@/lib/ats";
import {
  emptyCv, emptyCoverLetter, renderCvText, renderCoverLetterText,
  sectionForCategory, type CvStructure, type CvSection, type CoverLetterStructure,
} from "@/lib/cv";
import { parseJson, toJson, dateRange } from "@/lib/utils";
import { runAi, extractJson } from "@/lib/ai/client";
import { cvTailorPrompt, cvTailorSchema, coverLetterPrompt, coverLetterSchema } from "@/lib/ai/prompts";
import { buildProfileSummary } from "@/lib/candidate";
import type { ExtractedSkill } from "@/lib/text";

// ---------------------------------------------------------------------------
// CV composition
// ---------------------------------------------------------------------------

/**
 * Build a tailored CV from the bank with no AI involved.
 *
 * This is the baseline, not a fallback. Ranking atoms against the JD and taking
 * each one's primary bullet already produces a sensible, honest CV — the AI pass
 * afterwards improves phrasing and ordering, but the tool is useful without it.
 */
export async function composeCv(jobId: string): Promise<CvStructure> {
  const [job, profile, atoms] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { domains: true } }),
    getProfile(),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } }, domains: true, bullets: true },
    }),
  ]);
  if (!job) throw new Error("Job not found");

  const extracted = parseJson<ExtractedSkill[]>(job.extractedSkills, []);
  const ranked = rankAtomsForJob(
    atoms as unknown as AtomForMatching[],
    extracted,
    job.domains.map((d) => d.slug)
  );
  const rankIndex = new Map(ranked.map((r, i) => [r.atomId, i]));

  const cv = emptyCv({
    fullName: profile.fullName,
    headline: profile.headline,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    linkedIn: profile.linkedIn,
    website: profile.website,
  });

  const profileSection = cv.sections.find((s) => s.kind === "PROFILE")!;
  profileSection.body = profile.summary;

  // Education carries the degree even when no academic atom is tagged to it.
  const educationSection = cv.sections.find((s) => s.kind === "EDUCATION")!;
  if (profile.degree || profile.university) {
    educationSection.items.push({
      id: "degree",
      headline: profile.degree || "Degree",
      subheadline: profile.university,
      dates: profile.graduationYear,
      bullets: profile.classification ? [{ text: profile.classification }] : [],
    });
  }

  const sorted = [...atoms].sort(
    (a, b) => (rankIndex.get(a.id) ?? 999) - (rankIndex.get(b.id) ?? 999)
  );

  for (const atom of sorted) {
    const kind = sectionForCategory(atom.category);
    let section: CvSection | undefined = cv.sections.find((s) => s.kind === kind);
    if (!section) {
      section = { id: kind.toLowerCase(), kind, heading: kind[0] + kind.slice(1).toLowerCase(), items: [] };
      cv.sections.push(section);
    }

    // Prefer the bullet marked primary for CV register; fall back to any CV
    // bullet, then to the atom's own summary rather than emitting nothing.
    const cvBullets = atom.bullets.filter((b) => b.register === "CV");
    const primary = cvBullets.find((b) => b.isPrimary) ?? cvBullets[0];
    const text = primary?.text ?? atom.summary;
    if (!text.trim()) continue;

    section.items.push({
      id: atom.id,
      atomId: atom.id,
      headline: atom.role || atom.title,
      subheadline: atom.organisation,
      dates: dateRange(atom.startDate, atom.endDate, atom.ongoing),
      location: atom.location,
      bullets: [{ text, atomId: atom.id }],
    });
  }

  // A skills line built from what the JD actually asked for and the bank can
  // back, rather than an undifferentiated dump of everything claimed.
  const evidenced = new Set<string>();
  for (const atom of atoms) for (const link of atom.skills) evidenced.add(link.skill.name);
  const wanted = extracted.map((s) => s.name).filter((n) => evidenced.has(n));
  const rest = [...evidenced].filter((n) => !wanted.includes(n));
  const skillsSection = cv.sections.find((s) => s.kind === "SKILLS")!;
  skillsSection.body = [...wanted, ...rest].slice(0, 18).join(" · ");

  return cv;
}

export async function createTailoredCv(jobId: string) {
  const cv = await composeCv(jobId);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  const renderedText = renderCvText(cv);
  const report = analyseAts(renderedText, job?.rawDescription ?? "");

  const existing = await prisma.document.count({ where: { jobId, kind: "CV" } });

  const doc = await prisma.document.create({
    data: {
      kind: "CV",
      label: `CV v${existing + 1}`,
      jobId,
      structure: toJson(cv),
      renderedText,
      atsScore: report.score,
      keywordCoverage: toJson(report.coverage),
      atsIssues: toJson(report.issues),
      version: existing + 1,
    },
  });

  if (job?.status === "SAVED") {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "TAILORING", stageChangedAt: new Date() },
    });
  }

  revalidatePath(`/jobs/${jobId}/tailor`);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, documentId: doc.id };
}

export async function saveDocument(documentId: string, structure: unknown, kind: "CV" | "COVER_LETTER") {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { job: true } });
  if (!doc) return { error: "Document not found." };

  const renderedText =
    kind === "CV"
      ? renderCvText(structure as CvStructure)
      : renderCoverLetterText(structure as CoverLetterStructure);

  const report = analyseAts(renderedText, doc.job?.rawDescription ?? "");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      structure: toJson(structure),
      renderedText,
      atsScore: kind === "CV" ? report.score : null,
      keywordCoverage: toJson(report.coverage),
      atsIssues: kind === "CV" ? toJson(report.issues) : "[]",
    },
  });

  if (doc.jobId) revalidatePath(`/jobs/${doc.jobId}/tailor`);
  return { ok: true, atsScore: report.score, coverage: report.coverage, issues: report.issues };
}

export async function deleteDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  await prisma.document.delete({ where: { id: documentId } });
  if (doc?.jobId) revalidatePath(`/jobs/${doc.jobId}/tailor`);
  return { ok: true };
}

export async function markDocumentFinal(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Not found." };
  if (doc.jobId) {
    await prisma.document.updateMany({
      where: { jobId: doc.jobId, kind: doc.kind },
      data: { isFinal: false },
    });
  }
  await prisma.document.update({ where: { id: documentId }, data: { isFinal: true } });
  if (doc.jobId) revalidatePath(`/jobs/${doc.jobId}/tailor`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI tailoring
// ---------------------------------------------------------------------------

export async function tailorWithAi(jobId: string, documentId: string) {
  const [job, profile, atoms] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { domains: true } }),
    getProfile(),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } }, domains: true, bullets: true },
    }),
  ]);
  if (!job) return { error: "Job not found." };

  const gaps = parseJson<{ skill: string; reason: string }[]>(job.gaps, []);

  const prompt = cvTailorPrompt({
    title: job.title,
    company: job.companyName,
    description: job.rawDescription,
    profileSummary: await buildProfileSummary(),
    voiceNotes: profile.voiceNotes,
    atoms: atoms.map((a) => ({
      id: a.id,
      title: a.title,
      organisation: a.organisation,
      role: a.role,
      category: a.category,
      dates: dateRange(a.startDate, a.endDate, a.ongoing),
      summary: a.summary,
      metric: a.metric,
      skills: a.skills.map((s) => s.skill.name),
      existingBullets: a.bullets.filter((b) => b.register === "CV").map((b) => b.text),
    })),
    gaps: gaps.map((g) => g.skill),
    maxBullets: 12,
  });

  const result = await runAi({
    kind: "CV_TAILOR",
    system: prompt.system,
    user: prompt.user,
    jobId,
    maxTokens: 6000,
    targetType: "document",
    targetId: documentId,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyTailoring(documentId, result.text);
  }

  revalidatePath(`/jobs/${jobId}/tailor`);
  return result;
}

export async function applyTailoring(documentId: string, responseText: string) {
  const parsed = cvTailorSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the tailoring JSON from that response." };

  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { job: true } });
  if (!doc) return { error: "Document not found." };

  const atoms = await prisma.experienceAtom.findMany({
    where: { id: { in: parsed.data.selections.map((s) => s.atomId) } },
  });
  const atomById = new Map(atoms.map((a) => [a.id, a]));

  const cv = parseJson<CvStructure>(doc.structure, emptyCv());

  // Rebuild the item lists from the AI's selection, keeping only atoms that
  // really exist — a hallucinated id must never silently become a CV line.
  for (const section of cv.sections) {
    if (section.kind === "PROFILE" || section.kind === "SKILLS" || section.kind === "EDUCATION") continue;
    section.items = [];
  }

  for (const selection of parsed.data.selections) {
    const atom = atomById.get(selection.atomId);
    if (!atom) continue;

    const kind = sectionForCategory(atom.category);
    let section = cv.sections.find((s) => s.kind === kind);
    if (!section) {
      section = { id: kind.toLowerCase(), kind, heading: kind[0] + kind.slice(1).toLowerCase(), items: [] };
      cv.sections.push(section);
    }

    const existing = section.items.find((i) => i.atomId === atom.id);
    const bullet = {
      text: selection.bullet.trim(),
      atomId: atom.id,
      answersRequirement: selection.answersRequirement,
      rationale: selection.rationale,
    };

    if (existing) {
      existing.bullets.push(bullet);
    } else {
      section.items.push({
        id: atom.id,
        atomId: atom.id,
        headline: atom.role || atom.title,
        subheadline: atom.organisation,
        dates: dateRange(atom.startDate, atom.endDate, atom.ongoing),
        location: atom.location,
        bullets: [bullet],
      });
    }
  }

  if (parsed.data.summary.trim()) {
    const profileSection = cv.sections.find((s) => s.kind === "PROFILE");
    if (profileSection) profileSection.body = parsed.data.summary.trim();
  }

  const renderedText = renderCvText(cv);
  const report = analyseAts(renderedText, doc.job?.rawDescription ?? "");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      structure: toJson(cv),
      renderedText,
      atsScore: report.score,
      keywordCoverage: toJson(report.coverage),
      atsIssues: toJson(report.issues),
    },
  });

  if (doc.jobId && parsed.data.gapAdvice.trim()) {
    await prisma.job.update({
      where: { id: doc.jobId },
      data: { riskNotes: parsed.data.gapAdvice.trim() },
    });
  }

  if (doc.jobId) revalidatePath(`/jobs/${doc.jobId}/tailor`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cover letters
// ---------------------------------------------------------------------------

export async function createCoverLetter(jobId: string) {
  const [job, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    getProfile(),
  ]);
  if (!job) return { error: "Job not found." };

  const letter = emptyCoverLetter(profile.fullName);
  letter.organisation = job.companyName;
  letter.subject = `Application: ${job.title}`;

  const existing = await prisma.document.count({ where: { jobId, kind: "COVER_LETTER" } });

  const doc = await prisma.document.create({
    data: {
      kind: "COVER_LETTER",
      label: `Cover letter v${existing + 1}`,
      jobId,
      structure: toJson(letter),
      renderedText: renderCoverLetterText(letter),
      version: existing + 1,
    },
  });

  revalidatePath(`/jobs/${jobId}/tailor`);
  return { ok: true, documentId: doc.id };
}

export async function draftCoverLetterWithAi(jobId: string, documentId: string) {
  const [job, profile, atoms] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { company: true, domains: true } }),
    getProfile(),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { skills: { include: { skill: true } }, domains: true, bullets: true },
    }),
  ]);
  if (!job) return { error: "Job not found." };

  const extracted = parseJson<ExtractedSkill[]>(job.extractedSkills, []);
  const ranked = rankAtomsForJob(
    atoms as unknown as AtomForMatching[],
    extracted,
    job.domains.map((d) => d.slug)
  );

  // Only the strongest evidence goes in — a cover letter that tries to use the
  // whole bank ends up using none of it properly.
  const evidence = ranked.slice(0, 8).map((r) => {
    const atom = atoms.find((a) => a.id === r.atomId)!;
    const bullet = atom.bullets.find((b) => b.register === "CV" && b.isPrimary) ?? atom.bullets[0];
    return `${atom.title}${atom.organisation ? ` (${atom.organisation})` : ""}: ${bullet?.text ?? atom.summary}${
      atom.metric ? ` — ${atom.metric}` : ""
    }`;
  });

  const companyContext = job.company
    ? [job.company.whatTheyDo, job.company.policyPositions, job.company.recentNews]
        .filter(Boolean)
        .join("\n")
    : "";

  const prompt = coverLetterPrompt({
    title: job.title,
    company: job.companyName,
    description: job.rawDescription,
    profileSummary: await buildProfileSummary(),
    voiceNotes: profile.voiceNotes,
    positioningAngle: job.positioningAngle,
    evidence,
    companyContext,
    wordTarget: 350,
  });

  const result = await runAi({
    kind: "COVER_LETTER",
    system: prompt.system,
    user: prompt.user,
    jobId,
    targetType: "document",
    targetId: documentId,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyCoverLetter(documentId, result.text);
  }

  revalidatePath(`/jobs/${jobId}/tailor`);
  return result;
}

export async function applyCoverLetter(documentId: string, responseText: string) {
  const parsed = coverLetterSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the letter JSON from that response." };

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Document not found." };

  const letter = parseJson<CoverLetterStructure>(doc.structure, emptyCoverLetter());
  letter.paragraphs = parsed.data.paragraphs.filter((p) => p.trim());
  if (parsed.data.subject.trim()) letter.subject = parsed.data.subject.trim();
  letter.notes = parsed.data.notes;

  await prisma.document.update({
    where: { id: documentId },
    data: { structure: toJson(letter), renderedText: renderCoverLetterText(letter) },
  });

  if (doc.jobId) revalidatePath(`/jobs/${doc.jobId}/tailor`);
  return { ok: true };
}
