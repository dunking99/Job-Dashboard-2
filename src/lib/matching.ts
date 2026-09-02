// Match scoring.
//
// The score is deliberately deterministic and decomposed. A single opaque
// number ("78% match") is useless — you cannot act on it. Every component is
// reported with the evidence behind it, so the score doubles as a to-do list:
// low evidence depth means write more bullets; a seniority penalty means the
// role is genuinely a stretch and you should decide that consciously.

import { extractSkills, extractYearsRequired, type ExtractedSkill } from "./text";
import { clamp } from "./utils";

export interface MatchComponent {
  key: string;
  label: string;
  /** Points awarded. */
  score: number;
  /** Points available. */
  max: number;
  detail: string;
}

export interface MatchGap {
  skill: string;
  kind: string;
  required: boolean;
  /** Why it's a gap: no skill record, or a skill with no evidencing atom. */
  reason: "NO_SKILL" | "NO_EVIDENCE" | "WEAK_EVIDENCE";
}

export interface MatchResult {
  score: number;
  components: MatchComponent[];
  gaps: MatchGap[];
  matchedSkills: string[];
  extracted: ExtractedSkill[];
  yearsRequired: number | null;
}

export interface AtomForMatching {
  id: string;
  impactScore: number;
  metric: string;
  category: string;
  skills: { skill: { name: string }; weight: number }[];
  domains: { slug: string }[];
}

export interface ProfileForMatching {
  targetRoles: string[];
  targetSectors: string[];
  /** Rough total years of professional experience; grads are ~0–1. */
  yearsExperience: number;
}

export interface JobForMatching {
  title: string;
  rawDescription: string;
  domainSlugs: string[];
  sector?: string;
}

const WEIGHTS = {
  skillCoverage: 35,
  evidenceDepth: 25,
  domainAlignment: 15,
  seniorityFit: 15,
  targetAlignment: 10,
};

export function computeMatch(
  job: JobForMatching,
  atoms: AtomForMatching[],
  userSkillNames: string[],
  profile: ProfileForMatching
): MatchResult {
  const text = `${job.title}\n${job.rawDescription}`;
  const extracted = extractSkills(text);
  const yearsRequired = extractYearsRequired(text);

  const userSkills = new Set(userSkillNames.map((s) => s.toLowerCase()));

  // Skills that actually appear in at least one atom, with the strongest weight
  // seen for each. This is the difference between "I listed R on my CV" and
  // "I have a bullet that demonstrates R".
  const evidence = new Map<string, number>();
  for (const atom of atoms) {
    for (const link of atom.skills) {
      const key = link.skill.name.toLowerCase();
      const strength = link.weight * (atom.metric ? 1.25 : 1) * (atom.impactScore / 3);
      evidence.set(key, Math.max(evidence.get(key) ?? 0, strength));
    }
  }

  // --- 1. Skill coverage --------------------------------------------------
  // Required skills count double: missing an essential is worse than missing a
  // nice-to-have.
  const required = extracted.filter((s) => s.required);
  const optional = extracted.filter((s) => !s.required);

  let coverageEarned = 0;
  let coveragePossible = 0;
  const matchedSkills: string[] = [];
  const gaps: MatchGap[] = [];

  for (const skill of extracted) {
    const weight = skill.required ? 2 : 1;
    coveragePossible += weight;
    const key = skill.name.toLowerCase();
    if (userSkills.has(key)) {
      coverageEarned += weight;
      matchedSkills.push(skill.name);
      if (!evidence.has(key)) {
        gaps.push({ skill: skill.name, kind: skill.kind, required: skill.required, reason: "NO_EVIDENCE" });
      } else if ((evidence.get(key) ?? 0) < 1.5) {
        gaps.push({ skill: skill.name, kind: skill.kind, required: skill.required, reason: "WEAK_EVIDENCE" });
      }
    } else {
      gaps.push({ skill: skill.name, kind: skill.kind, required: skill.required, reason: "NO_SKILL" });
    }
  }

  const coverageRatio = coveragePossible ? coverageEarned / coveragePossible : 0;
  const skillCoverage: MatchComponent = {
    key: "skillCoverage",
    label: "Skill coverage",
    score: Math.round(coverageRatio * WEIGHTS.skillCoverage),
    max: WEIGHTS.skillCoverage,
    detail: coveragePossible
      ? `${matchedSkills.length} of ${extracted.length} named skills present (${required.length} marked essential)`
      : "No recognised skills found in the description",
  };

  // --- 2. Evidence depth --------------------------------------------------
  // Of the skills this job asks for, how many are backed by a real bullet?
  const askedFor = extracted.slice(0, 12);
  let evidenced = 0;
  let evidenceStrength = 0;
  for (const skill of askedFor) {
    const strength = evidence.get(skill.name.toLowerCase()) ?? 0;
    if (strength > 0) {
      evidenced++;
      evidenceStrength += Math.min(strength, 3);
    }
  }
  const depthRatio = askedFor.length ? evidenceStrength / (askedFor.length * 2.2) : 0;
  const evidenceDepth: MatchComponent = {
    key: "evidenceDepth",
    label: "Evidence depth",
    score: Math.round(clamp(depthRatio, 0, 1) * WEIGHTS.evidenceDepth),
    max: WEIGHTS.evidenceDepth,
        detail: askedFor.length
      ? `${evidenced} of the top ${askedFor.length} requirements are backed by a bullet in your bank`
      : "Nothing to evidence",
  };

  // --- 3. Domain alignment ------------------------------------------------
  const jobDomains = new Set(job.domainSlugs);
  const atomDomains = new Set(atoms.flatMap((a) => a.domains.map((d) => d.slug)));
  const overlap = [...jobDomains].filter((d) => atomDomains.has(d));
  const domainRatio = jobDomains.size ? overlap.length / jobDomains.size : 0.5;
  const domainAlignment: MatchComponent = {
    key: "domainAlignment",
    label: "Domain alignment",
    score: Math.round(domainRatio * WEIGHTS.domainAlignment),
    max: WEIGHTS.domainAlignment,
    detail: jobDomains.size
      ? `${overlap.length} of ${jobDomains.size} policy domains overlap with your experience`
      : "No domains tagged on this job yet",
  };

  // --- 4. Seniority fit ---------------------------------------------------
  // A grad applying to a role demanding 5 years is a real mismatch and the
  // score should say so plainly rather than quietly averaging it away.
  let seniorityScore = WEIGHTS.seniorityFit;
  let seniorityDetail = "No explicit experience requirement";
  if (yearsRequired !== null) {
    const excess = yearsRequired - profile.yearsExperience;
    if (excess <= 0) {
      seniorityDetail = `Asks for ${yearsRequired}y, you have ~${profile.yearsExperience}y — met`;
    } else if (excess <= 1) {
      seniorityScore = Math.round(WEIGHTS.seniorityFit * 0.8);
      seniorityDetail = `Asks for ${yearsRequired}y, you have ~${profile.yearsExperience}y — a slight stretch`;
    } else if (excess <= 3) {
      seniorityScore = Math.round(WEIGHTS.seniorityFit * 0.4);
      seniorityDetail = `Asks for ${yearsRequired}y, you have ~${profile.yearsExperience}y — a real stretch`;
    } else {
      seniorityScore = 0;
      seniorityDetail = `Asks for ${yearsRequired}y, you have ~${profile.yearsExperience}y — likely out of range`;
    }
  }
  const seniorityFit: MatchComponent = {
    key: "seniorityFit",
    label: "Seniority fit",
    score: seniorityScore,
    max: WEIGHTS.seniorityFit,
    detail: seniorityDetail,
  };

  // --- 5. Target alignment ------------------------------------------------
  const titleLower = job.title.toLowerCase();
  const roleHit = profile.targetRoles.some((r) => r && titleLower.includes(r.toLowerCase().split(" ")[0]));
  const sectorHit = job.sector
    ? profile.targetSectors.some((s) => s && s.toLowerCase() === job.sector!.toLowerCase())
    : false;
  const targetScore =
    (roleHit ? WEIGHTS.targetAlignment * 0.6 : 0) + (sectorHit ? WEIGHTS.targetAlignment * 0.4 : 0);
  const targetAlignment: MatchComponent = {
    key: "targetAlignment",
    label: "Target alignment",
    score: Math.round(targetScore),
    max: WEIGHTS.targetAlignment,
    detail: [
      roleHit ? "title matches a target role" : "title outside your stated targets",
      sectorHit ? "sector matches" : null,
    ]
      .filter(Boolean)
      .join(", "),
  };

  const components = [skillCoverage, evidenceDepth, domainAlignment, seniorityFit, targetAlignment];
  const score = clamp(
    components.reduce((sum, c) => sum + c.score, 0),
    0,
    100
  );

  // Report essential gaps first, then by kind.
  gaps.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    const order = { NO_SKILL: 0, NO_EVIDENCE: 1, WEAK_EVIDENCE: 2 };
    return order[a.reason] - order[b.reason];
  });

  return {
    score,
    components,
    gaps: gaps.slice(0, 14),
    matchedSkills,
    extracted,
    yearsRequired,
  };
}

/** Band a score for display. Bands, not raw numbers, drive triage decisions. */
export function scoreBand(score: number | null | undefined): {
  label: string;
  tone: "good" | "warning" | "serious" | "critical" | "neutral";
} {
  if (score === null || score === undefined) return { label: "Not analysed", tone: "neutral" };
  if (score >= 75) return { label: "Strong", tone: "good" };
  if (score >= 55) return { label: "Worth it", tone: "warning" };
  if (score >= 35) return { label: "Stretch", tone: "serious" };
  return { label: "Weak", tone: "critical" };
}

/**
 * Rank experience atoms against a job. This is what the tailoring studio uses
 * to decide which bullets to lead with.
 */
export function rankAtomsForJob(
  atoms: AtomForMatching[],
  extracted: ExtractedSkill[],
  jobDomainSlugs: string[]
): { atomId: string; score: number; reasons: string[] }[] {
  const wanted = new Map<string, number>();
  extracted.forEach((s, i) => {
    // Earlier (more required / more frequent) skills are worth more.
    const positional = Math.max(1, 10 - i);
    wanted.set(s.name.toLowerCase(), positional * (s.required ? 2 : 1));
  });
  const jobDomains = new Set(jobDomainSlugs);

  return atoms
    .map((atom) => {
      let score = 0;
      const reasons: string[] = [];

      for (const link of atom.skills) {
        const value = wanted.get(link.skill.name.toLowerCase());
        if (value) {
          score += value * link.weight;
          reasons.push(`evidences ${link.skill.name}`);
        }
      }

      const domainHits = atom.domains.filter((d) => jobDomains.has(d.slug));
      if (domainHits.length) {
        score += domainHits.length * 8;
        reasons.push(`${domainHits.length} domain match${domainHits.length > 1 ? "es" : ""}`);
      }

      if (atom.metric) {
        score += 10;
        reasons.push("has a quantified result");
      }
      score += atom.impactScore * 3;

      return { atomId: atom.id, score: Math.round(score), reasons: reasons.slice(0, 4) };
    })
    .sort((a, b) => b.score - a.score);
}
