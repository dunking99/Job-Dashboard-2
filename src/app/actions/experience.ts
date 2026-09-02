"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { runAi, extractJson } from "@/lib/ai/client";
import { atomExtractPrompt, atomExtractSchema, bulletRewritePrompt, bulletRewriteSchema } from "@/lib/ai/prompts";
import { getProfile } from "@/lib/db";
import { slugify } from "@/lib/utils";

function parseMonth(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  // <input type="month"> gives YYYY-MM.
  const d = new Date(/^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export async function saveAtom(atomId: string | null, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give this entry a title." };

  const skillIds = formData.getAll("skillIds").map(String).filter(Boolean);
  const domainIds = formData.getAll("domainIds").map(String).filter(Boolean);
  const competencyIds = formData.getAll("competencyIds").map(String).filter(Boolean);

  const data = {
    title,
    category: String(formData.get("category") ?? "WORK"),
    organisation: String(formData.get("organisation") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    startDate: parseMonth(String(formData.get("startDate") ?? "")),
    endDate: parseMonth(String(formData.get("endDate") ?? "")),
    ongoing: formData.get("ongoing") === "on",
    summary: String(formData.get("summary") ?? "").trim(),
    metric: String(formData.get("metric") ?? "").trim(),
    starSituation: String(formData.get("starSituation") ?? "").trim(),
    starTask: String(formData.get("starTask") ?? "").trim(),
    starAction: String(formData.get("starAction") ?? "").trim(),
    starResult: String(formData.get("starResult") ?? "").trim(),
    impactScore: Number(formData.get("impactScore")) || 3,
    isHeadline: formData.get("isHeadline") === "on",
  };

  let id = atomId;

  if (atomId) {
    await prisma.experienceAtom.update({
      where: { id: atomId },
      data: {
        ...data,
        skills: { deleteMany: {} },
        domains: { set: domainIds.map((d) => ({ id: d })) },
        competencies: { set: competencyIds.map((c) => ({ id: c })) },
      },
    });
    if (skillIds.length) {
      await prisma.atomSkill.createMany({
        data: skillIds.map((skillId) => ({
          atomId,
          skillId,
          weight: Number(formData.get(`weight_${skillId}`)) || 2,
        })),
      });
    }
  } else {
    const created = await prisma.experienceAtom.create({
      data: {
        ...data,
        domains: { connect: domainIds.map((d) => ({ id: d })) },
        competencies: { connect: competencyIds.map((c) => ({ id: c })) },
        skills: {
          create: skillIds.map((skillId) => ({
            skillId,
            weight: Number(formData.get(`weight_${skillId}`)) || 2,
          })),
        },
      },
    });
    id = created.id;
  }

  // Any skill attached to an atom is, by definition, one the user has — raise
  // it off zero so it counts in match scoring.
  if (skillIds.length) {
    await prisma.skill.updateMany({
      where: { id: { in: skillIds }, proficiency: 0 },
      data: { proficiency: 3 },
    });
  }

  revalidatePath("/experience");
  revalidatePath("/");
  redirect(`/experience/${id}`);
}

export async function deleteAtom(atomId: string) {
  await prisma.experienceAtom.delete({ where: { id: atomId } });
  revalidatePath("/experience");
  redirect("/experience");
}

export async function toggleAtomArchived(atomId: string) {
  const atom = await prisma.experienceAtom.findUnique({ where: { id: atomId } });
  if (!atom) return { error: "Not found." };
  await prisma.experienceAtom.update({
    where: { id: atomId },
    data: { archived: !atom.archived },
  });
  revalidatePath("/experience");
  revalidatePath(`/experience/${atomId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

export async function saveBullet(input: {
  bulletId?: string;
  atomId: string;
  text: string;
  register: string;
  isPrimary?: boolean;
}) {
  const text = input.text.trim();
  if (!text) return { error: "Bullet text is empty." };

  if (input.isPrimary) {
    await prisma.bulletVariant.updateMany({
      where: { atomId: input.atomId, register: input.register },
      data: { isPrimary: false },
    });
  }

  if (input.bulletId) {
    await prisma.bulletVariant.update({
      where: { id: input.bulletId },
      data: { text, register: input.register, isPrimary: input.isPrimary ?? false },
    });
  } else {
    await prisma.bulletVariant.create({
      data: {
        atomId: input.atomId,
        text,
        register: input.register,
        isPrimary: input.isPrimary ?? false,
      },
    });
  }

  revalidatePath(`/experience/${input.atomId}`);
  return { ok: true };
}

export async function deleteBullet(bulletId: string, atomId: string) {
  await prisma.bulletVariant.delete({ where: { id: bulletId } });
  revalidatePath(`/experience/${atomId}`);
  return { ok: true };
}

/** Generate register variants for an atom. */
export async function generateBulletVariants(atomId: string) {
  const [atom, profile] = await Promise.all([
    prisma.experienceAtom.findUnique({ where: { id: atomId }, include: { bullets: true } }),
    getProfile(),
  ]);
  if (!atom) return { error: "Not found." };

  const prompt = bulletRewritePrompt({
    atomTitle: atom.title,
    context: atom.summary || [atom.role, atom.organisation].filter(Boolean).join(" at "),
    metric: atom.metric,
    existing: atom.bullets.map((b) => b.text),
    voiceNotes: profile.voiceNotes,
    targetRegisters: ["CV", "CV_SHORT", "COVER_LETTER", "INTERVIEW"],
  });

  const result = await runAi({
    kind: "BULLET_REWRITE",
    system: prompt.system,
    user: prompt.user,
    targetType: "atom",
    targetId: atomId,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyBulletVariants(atomId, result.text);
  }

  revalidatePath(`/experience/${atomId}`);
  return result;
}

export async function applyBulletVariants(atomId: string, responseText: string) {
  const parsed = bulletRewriteSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read variants from that response." };

  for (const variant of parsed.data.variants) {
    const register = ["CV", "CV_SHORT", "COVER_LETTER", "INTERVIEW"].includes(variant.register)
      ? variant.register
      : "CV";
    await prisma.bulletVariant.create({
      data: { atomId, text: variant.text.trim(), register, aiGenerated: true },
    });
  }

  revalidatePath(`/experience/${atomId}`);
  return { ok: true, count: parsed.data.variants.length };
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function upsertSkill(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required." };

  await prisma.skill.upsert({
    where: { name },
    create: {
      name,
      kind: String(formData.get("kind") ?? "HARD"),
      proficiency: Number(formData.get("proficiency")) || 3,
      notes: String(formData.get("notes") ?? ""),
    },
    update: {
      kind: String(formData.get("kind") ?? "HARD"),
      proficiency: Number(formData.get("proficiency")) || 3,
      notes: String(formData.get("notes") ?? ""),
    },
  });

  revalidatePath("/experience/skills");
  return { ok: true };
}

export async function setSkillProficiency(skillId: string, proficiency: number) {
  await prisma.skill.update({ where: { id: skillId }, data: { proficiency } });
  revalidatePath("/experience/skills");
  return { ok: true };
}

export async function deleteSkill(skillId: string) {
  await prisma.skill.delete({ where: { id: skillId } });
  revalidatePath("/experience/skills");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CV import
// ---------------------------------------------------------------------------

export async function importFromCv(formData: FormData) {
  const pastedText = String(formData.get("pastedText") ?? "").trim();
  if (!pastedText) return { error: "Paste your CV or career history first." };

  const [domains, competencies] = await Promise.all([
    prisma.domain.findMany(),
    prisma.competency.findMany(),
  ]);

  const prompt = atomExtractPrompt({
    pastedText,
    availableDomains: domains.map((d) => d.name),
    availableCompetencies: competencies.map((c) => c.name),
  });

  const result = await runAi({
    kind: "ATOM_EXTRACT",
    system: prompt.system,
    user: prompt.user,
    maxTokens: 8192,
    targetType: "import",
    targetId: "bank",
  });

  if (result.status === "COMPLETE" && result.text) {
    const applied = await applyCvImport(result.text);
    return { ...result, applied };
  }

  return result;
}

/** Shared by API responses and pasted bridge responses. */
export async function applyCvImport(responseText: string) {
  const parsed = atomExtractSchema.safeParse(extractJson(responseText));
  if (!parsed.success) {
    return { error: "Could not read the extraction JSON from that response." };
  }

  const [domains, competencies, skills] = await Promise.all([
    prisma.domain.findMany(),
    prisma.competency.findMany(),
    prisma.skill.findMany(),
  ]);

  // Only fill profile fields that are currently empty — an import should never
  // overwrite details the user has already curated.
  const profile = await getProfile();
  const p = parsed.data.profile;
  const profileUpdates: Record<string, string> = {};
  for (const key of [
    "fullName", "email", "phone", "location", "linkedIn",
    "degree", "university", "graduationYear", "classification", "summary",
  ] as const) {
    const incoming = (p as Record<string, string>)[key]?.trim();
    const existing = (profile as unknown as Record<string, string>)[key]?.trim();
    if (incoming && (!existing || existing === "Your Name" || existing === "you@example.com")) {
      profileUpdates[key] = incoming;
    }
  }
  if (Object.keys(profileUpdates).length) {
    await prisma.profile.update({ where: { id: "singleton" }, data: profileUpdates });
  }

  let created = 0;
  for (const atom of parsed.data.atoms) {
    if (!atom.title?.trim()) continue;

    // Skills named in the CV that we do not yet know about become real records,
    // so the vocabulary grows with the user rather than being fixed at seed time.
    const skillIds: string[] = [];
    for (const skillName of atom.skills) {
      const clean = skillName.trim();
      if (!clean) continue;
      const existing = skills.find((s) => s.name.toLowerCase() === clean.toLowerCase());
      if (existing) {
        skillIds.push(existing.id);
      } else {
        const made = await prisma.skill.create({
          data: { name: clean, kind: "HARD", proficiency: 3, aliases: JSON.stringify([clean.toLowerCase()]) },
        });
        skills.push(made);
        skillIds.push(made.id);
      }
    }

    const domainIds = atom.domains
      .map((name) => domains.find((d) => d.slug === slugify(name) || d.name.toLowerCase() === name.toLowerCase()))
      .filter(Boolean)
      .map((d) => d!.id);

    const competencyIds = atom.competencies
      .map((name) => competencies.find((c) => c.slug === slugify(name) || c.name.toLowerCase() === name.toLowerCase()))
      .filter(Boolean)
      .map((c) => c!.id);

    await prisma.experienceAtom.create({
      data: {
        title: atom.title.trim(),
        category: ["ACADEMIC", "WORK", "LEADERSHIP", "PROJECT", "CERTIFICATION", "VOLUNTEER"].includes(atom.category)
          ? atom.category
          : "WORK",
        organisation: atom.organisation,
        role: atom.role,
        location: atom.location,
        startDate: parseMonth(atom.startDate),
        endDate: parseMonth(atom.endDate),
        ongoing: atom.ongoing,
        summary: atom.summary,
        metric: atom.metric,
        impactScore: Math.min(5, Math.max(1, Math.round(atom.impactScore))),
        bullets: {
          create: atom.bullets
            .filter((b) => b.trim())
            .map((text, i) => ({ text: text.trim(), register: "CV", isPrimary: i === 0, aiGenerated: true })),
        },
        skills: { create: skillIds.map((skillId) => ({ skillId, weight: 2 })) },
        domains: { connect: domainIds.map((id) => ({ id })) },
        competencies: { connect: competencyIds.map((id) => ({ id })) },
      },
    });
    created++;
  }

  if (skills.length) {
    await prisma.skill.updateMany({
      where: { proficiency: 0, atoms: { some: {} } },
      data: { proficiency: 3 },
    });
  }

  revalidatePath("/experience");
  revalidatePath("/");
  return { ok: true, created, missingMetrics: parsed.data.missingMetrics };
}
