"use server";

import { revalidatePath } from "next/cache";
import { prisma, setSetting } from "@/lib/db";
import { toJson } from "@/lib/utils";

export async function saveProfile(formData: FormData) {
  const splitList = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  await prisma.profile.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  await prisma.profile.update({
    where: { id: "singleton" },
    data: {
      fullName: String(formData.get("fullName") ?? "").trim(),
      headline: String(formData.get("headline") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      linkedIn: String(formData.get("linkedIn") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      summary: String(formData.get("summary") ?? "").trim(),
      degree: String(formData.get("degree") ?? "").trim(),
      university: String(formData.get("university") ?? "").trim(),
      graduationYear: String(formData.get("graduationYear") ?? "").trim(),
      classification: String(formData.get("classification") ?? "").trim(),
      targetRoles: toJson(splitList(formData.get("targetRoles"))),
      targetSectors: toJson(formData.getAll("targetSectors").map(String)),
      targetLocations: toJson(splitList(formData.get("targetLocations"))),
      voiceNotes: String(formData.get("voiceNotes") ?? "").trim(),
      weeklyApplicationTarget: Number(formData.get("weeklyApplicationTarget")) || 5,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function updateSetting(key: string, value: string) {
  await setSetting(key, value);
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Wipe user content but keep the reference vocabularies. Used to clear the demo
 * dataset without having to re-seed domains, competencies and the skill lexicon.
 */
export async function clearAllContent() {
  // Order matters only where cascades do not cover the relation.
  await prisma.practiceAnswer.deleteMany();
  await prisma.predictedQuestion.deleteMany();
  await prisma.interviewEvent.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.task.deleteMany();
  await prisma.document.deleteMany();
  await prisma.aiCall.deleteMany();
  await prisma.job.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.atomSkill.deleteMany();
  await prisma.bulletVariant.deleteMany();
  await prisma.experienceAtom.deleteMany();

  // Skills stay, but nothing is claimed any more.
  await prisma.skill.updateMany({ data: { proficiency: 0 } });

  await prisma.profile.update({
    where: { id: "singleton" },
    data: {
      fullName: "", headline: "", email: "", phone: "", location: "",
      linkedIn: "", website: "", summary: "", degree: "", university: "",
      graduationYear: "", classification: "", voiceNotes: "",
      targetRoles: "[]", targetSectors: "[]", targetLocations: "[]",
    },
  });

  revalidatePath("/");
  revalidatePath("/experience");
  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true };
}

/** Full JSON export — this is your data, it should be trivially removable. */
export async function exportEverything() {
  const [profile, atoms, skills, domains, competencies, jobs, companies, contacts, interactions, documents, interviews, questions, answers, tasks] =
    await Promise.all([
      prisma.profile.findUnique({ where: { id: "singleton" } }),
      prisma.experienceAtom.findMany({
        include: { bullets: true, skills: { include: { skill: true } }, domains: true, competencies: true },
      }),
      prisma.skill.findMany(),
      prisma.domain.findMany(),
      prisma.competency.findMany(),
      prisma.job.findMany({ include: { domains: true } }),
      prisma.company.findMany({ include: { domains: true } }),
      prisma.contact.findMany(),
      prisma.interaction.findMany(),
      prisma.document.findMany(),
      prisma.interviewEvent.findMany(),
      prisma.predictedQuestion.findMany(),
      prisma.practiceAnswer.findMany(),
      prisma.task.findMany(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    profile, atoms, skills, domains, competencies, jobs, companies,
    contacts, interactions, documents, interviews, questions, answers, tasks,
  };
}
