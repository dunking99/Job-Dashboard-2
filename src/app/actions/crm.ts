"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { runAi, extractJson } from "@/lib/ai/client";
import { dossierPrompt, dossierSchema } from "@/lib/ai/prompts";
import { buildCandidateSummary } from "@/lib/candidate";
import { toJson } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function saveCompany(companyId: string | null, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required." };

  const domainIds = formData.getAll("domainIds").map(String).filter(Boolean);

  const data = {
    name,
    website: String(formData.get("website") ?? "").trim(),
    sector: String(formData.get("sector") ?? "OTHER"),
    size: String(formData.get("size") ?? "").trim(),
    hq: String(formData.get("hq") ?? "").trim(),
    whatTheyDo: String(formData.get("whatTheyDo") ?? ""),
    recentNews: String(formData.get("recentNews") ?? ""),
    policyPositions: String(formData.get("policyPositions") ?? ""),
    cultureNotes: String(formData.get("cultureNotes") ?? ""),
    whyThisOrg: String(formData.get("whyThisOrg") ?? ""),
    competitors: String(formData.get("competitors") ?? ""),
  };

  let id = companyId;
  if (companyId) {
    await prisma.company.update({
      where: { id: companyId },
      data: { ...data, domains: { set: domainIds.map((d) => ({ id: d })) } },
    });
  } else {
    const created = await prisma.company.create({
      data: { ...data, domains: { connect: domainIds.map((d) => ({ id: d })) } },
    });
    id = created.id;
  }

  revalidatePath("/companies");
  redirect(`/companies/${id}`);
}

export async function deleteCompany(companyId: string) {
  await prisma.company.delete({ where: { id: companyId } });
  revalidatePath("/companies");
  redirect("/companies");
}

export async function researchCompany(companyId: string, pastedMaterial: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found." };

  const prompt = dossierPrompt({
    name: company.name,
    sector: company.sector,
    pastedMaterial,
    candidateSummary: await buildCandidateSummary(),
  });

  const result = await runAi({
    kind: "COMPANY_DOSSIER",
    system: prompt.system,
    user: prompt.user,
    targetType: "company",
    targetId: companyId,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyDossier(companyId, result.text);
  }

  revalidatePath(`/companies/${companyId}`);
  return result;
}

export async function applyDossier(companyId: string, responseText: string) {
  const parsed = dossierSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the dossier JSON from that response." };

  const d = parsed.data;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      whatTheyDo: d.whatTheyDo,
      policyPositions: d.policyPositions,
      recentNews: d.recentNews,
      cultureNotes: d.cultureNotes,
      whyThisOrg: d.whyThisOrg,
      competitors: d.competitors,
      keyPeople: toJson(d.keyPeople),
      // The model's own stated uncertainty is kept verbatim and shown in the
      // UI — it is the difference between a dossier and a liability.
      sources: toJson(
        d.uncertainty ? [{ label: "Model uncertainty", url: "", note: d.uncertainty }] : []
      ),
      researchedAt: new Date(),
    },
  });

  // Interview questions worth asking are stored against the org, not a job, so
  // they survive across multiple applications to the same employer.
  if (d.questionsToAsk.length) {
    const jobs = await prisma.job.findMany({ where: { companyId }, select: { id: true } });
    for (const q of d.questionsToAsk.slice(0, 6)) {
      await prisma.predictedQuestion.create({
        data: {
          jobId: jobs[0]?.id ?? null,
          text: q,
          kind: "MOTIVATIONAL",
          rationale: `Question to ask ${(await prisma.company.findUnique({ where: { id: companyId } }))?.name ?? "them"}`,
          isCore: false,
        },
      });
    }
  }

  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function saveContact(contactId: string | null, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required." };

  const companyId = String(formData.get("companyId") ?? "").trim() || null;
  const company = companyId ? await prisma.company.findUnique({ where: { id: companyId } }) : null;

  const nextActionAtRaw = String(formData.get("nextActionAt") ?? "").trim();

  const data = {
    name,
    role: String(formData.get("role") ?? "").trim(),
    companyId,
    companyName: company?.name ?? String(formData.get("companyName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    linkedIn: String(formData.get("linkedIn") ?? "").trim(),
    relationship: String(formData.get("relationship") ?? "COLD"),
    notes: String(formData.get("notes") ?? ""),
    nextActionAt: nextActionAtRaw ? new Date(nextActionAtRaw) : null,
    nextActionNote: String(formData.get("nextActionNote") ?? "").trim(),
  };

  if (contactId) {
    await prisma.contact.update({ where: { id: contactId }, data });
  } else {
    await prisma.contact.create({ data });
  }

  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteContact(contactId: string) {
  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function logInteraction(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "").trim() || null;
  const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();

  await prisma.interaction.create({
    data: {
      contactId,
      jobId: String(formData.get("jobId") ?? "").trim() || null,
      kind: String(formData.get("kind") ?? "NOTE"),
      direction: String(formData.get("direction") ?? "OUT"),
      subject: String(formData.get("subject") ?? "").trim(),
      body: String(formData.get("body") ?? ""),
      occurredAt: occurredAtRaw ? new Date(occurredAtRaw) : new Date(),
    },
  });

  // Logging contact is what "last contacted" means — deriving it here keeps the
  // contact record honest without the user maintaining a second field.
  if (contactId) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: occurredAtRaw ? new Date(occurredAtRaw) : new Date() },
    });
  }

  revalidatePath("/contacts");
  if (formData.get("jobId")) revalidatePath(`/jobs/${formData.get("jobId")}`);
  return { ok: true };
}

export async function deleteInteraction(interactionId: string) {
  await prisma.interaction.delete({ where: { id: interactionId } });
  revalidatePath("/contacts");
  return { ok: true };
}
