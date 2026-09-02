import { prisma, getProfile } from "./db";
import { parseJson, dateRange } from "./utils";

// A single place that turns the profile + experience bank into the prose
// summary every AI prompt needs. Without this the candidate would be described
// slightly differently by each feature, and the outputs would drift apart.

interface AtomLike {
  category: string;
  startDate: Date | null;
  endDate: Date | null;
  ongoing: boolean;
}

/**
 * Rough total years of *professional* experience, used for the seniority
 * component of match scoring.
 *
 * Academic work and society roles are deliberately excluded: a JD asking for
 * "3 years' experience" means employment, and counting a dissertation towards
 * it would inflate scores on exactly the roles that are out of reach. Part-time
 * work alongside study is halved for the same reason.
 */
export function yearsOfExperience(atoms: AtomLike[]): number {
  let months = 0;
  for (const atom of atoms) {
    if (!["WORK", "VOLUNTEER"].includes(atom.category)) continue;
    if (!atom.startDate) continue;
    const end = atom.ongoing ? new Date() : (atom.endDate ?? atom.startDate);
    const span =
      (end.getFullYear() - atom.startDate.getFullYear()) * 12 +
      (end.getMonth() - atom.startDate.getMonth());
    if (span <= 0) continue;
    // Long-running part-time roles overlap study; count them at half weight.
    months += span > 14 ? span * 0.5 : span;
  }
  return Math.round((months / 12) * 10) / 10;
}

/** The candidate description shared by every AI prompt. */
export async function buildCandidateSummary(): Promise<string> {
  const [profile, atoms, skills] = await Promise.all([
    getProfile(),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      orderBy: [{ isHeadline: "desc" }, { impactScore: "desc" }],
      include: { skills: { include: { skill: true } }, domains: true },
    }),
    prisma.skill.findMany({ where: { proficiency: { gt: 0 } }, orderBy: { proficiency: "desc" } }),
  ]);

  const targetRoles = parseJson<string[]>(profile.targetRoles, []);
  const lines: string[] = [];

  lines.push(
    `${profile.fullName || "The candidate"}${profile.headline ? ` — ${profile.headline}` : ""}.`
  );
  if (profile.degree || profile.university) {
    lines.push(
      `Education: ${[profile.degree, profile.university, profile.classification, profile.graduationYear]
        .filter(Boolean)
        .join(", ")}.`
    );
  }
  if (profile.summary) lines.push(`Self-description: ${profile.summary}`);
  if (targetRoles.length) lines.push(`Targeting: ${targetRoles.join(", ")}.`);
  lines.push(`Approximate professional experience: ${yearsOfExperience(atoms)} years.`);

  if (skills.length) {
    lines.push(
      `Claimed skills: ${skills.map((s) => `${s.name} (${s.proficiency}/5)`).join(", ")}.`
    );
  }

  if (atoms.length) {
    lines.push("", "Experience bank:");
    for (const atom of atoms.slice(0, 20)) {
      const where = [atom.role, atom.organisation].filter(Boolean).join(" at ");
      const when = dateRange(atom.startDate, atom.endDate, atom.ongoing);
      lines.push(
        `- ${atom.title}${where ? ` (${where}` : ""}${when ? `${where ? ", " : " ("}${when}` : ""}${where || when ? ")" : ""}` +
          `${atom.metric ? ` — ${atom.metric}` : ""}`
      );
    }
  } else {
    lines.push("", "Experience bank is empty.");
  }

  return lines.join("\n");
}

/** Compact profile line for prompts that do not need the full bank. */
export async function buildProfileSummary(): Promise<string> {
  const profile = await getProfile();
  return [
    profile.fullName,
    profile.headline,
    profile.degree && `${profile.degree}${profile.university ? `, ${profile.university}` : ""}`,
    profile.classification,
    profile.summary,
  ]
    .filter(Boolean)
    .join(" · ");
}
