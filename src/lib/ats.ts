// ATS analysis: does this CV actually contain what the JD asks for, and is it
// machine-parseable?
//
// Two separate questions that get conflated by most "ATS score" tools:
//   1. Keyword coverage — a content problem, fixed by choosing better bullets.
//   2. Formatting/parseability — a structure problem, fixed by the template.
// They are reported separately because the fixes are different.

import { extractSkills, tokenise, type ExtractedSkill } from "./text";
import { wordCount } from "./utils";

export interface AtsIssue {
  label: string;
  severity: "warning" | "serious" | "critical";
  hint: string;
}

export interface KeywordCoverage {
  matched: string[];
  missing: string[];
  missingRequired: string[];
  /** 0–100. */
  percentage: number;
}

export interface AtsReport {
  score: number;
  coverage: KeywordCoverage;
  issues: AtsIssue[];
  stats: {
    words: number;
    bullets: number;
    longestBulletWords: number;
    quantifiedBullets: number;
  };
}

const STANDARD_HEADINGS = [
  "education",
  "experience",
  "work experience",
  "employment",
  "skills",
  "projects",
  "leadership",
  "volunteering",
  "certifications",
  "profile",
  "summary",
];

// Verbs that describe activity rather than achievement. Not wrong, just weak
// openers when every bullet starts with one.
const WEAK_OPENERS = [
  "responsible for",
  "helped",
  "assisted",
  "worked on",
  "involved in",
  "participated in",
  "tasked with",
  "duties included",
];

export function analyseAts(cvText: string, jobDescription: string): AtsReport {
  const jdSkills = extractSkills(jobDescription);
  const coverage = computeCoverage(cvText, jdSkills);

  const lines = cvText.split("\n").map((l) => l.trim());
  const bulletLines = lines.filter((l) => /^[-•*·]/.test(l) || (l.length > 40 && !isHeading(l)));
  const words = wordCount(cvText);

  const bulletWordCounts = bulletLines.map(wordCount);
  const longestBulletWords = bulletWordCounts.length ? Math.max(...bulletWordCounts) : 0;
  const quantifiedBullets = bulletLines.filter((l) =>
    /\d|£|%|\bper cent\b|\bhundred\b|\bthousand\b/i.test(l)
  ).length;

  const issues: AtsIssue[] = [];

  // --- Content ------------------------------------------------------------
  if (coverage.missingRequired.length > 0) {
    issues.push({
      label: `${coverage.missingRequired.length} essential requirement${
        coverage.missingRequired.length > 1 ? "s" : ""
      } not mentioned`,
      severity: "critical",
      hint: `Missing: ${coverage.missingRequired.slice(0, 5).join(", ")}. If you have the experience, say so explicitly using the JD's own wording.`,
    });
  }
  if (coverage.percentage < 45 && jdSkills.length > 0) {
    issues.push({
      label: "Low keyword coverage",
      severity: "serious",
      hint: "Under half the skills named in the posting appear in this CV. Swap in bullets that evidence them, or address the gap in the cover letter.",
    });
  }

  // --- Length -------------------------------------------------------------
  if (words > 850) {
    issues.push({
      label: `Long for a graduate CV (${words} words)`,
      severity: "warning",
      hint: "Aim for one page, roughly 450–650 words. Cut the weakest bullets rather than shrinking the font.",
    });
  }
  if (words < 220 && words > 0) {
    issues.push({
      label: `Very short (${words} words)`,
      severity: "warning",
      hint: "There is room to evidence more. Add bullets from your bank that match the posting.",
    });
  }
  if (longestBulletWords > 40) {
    issues.push({
      label: "Overlong bullet points",
      severity: "warning",
      hint: `Longest bullet is ${longestBulletWords} words. Bullets over ~30 words stop being scannable — split or trim.`,
    });
  }

  // --- Evidence quality ---------------------------------------------------
  if (bulletLines.length > 0) {
    const quantRatio = quantifiedBullets / bulletLines.length;
    if (quantRatio < 0.3) {
      issues.push({
        label: "Few quantified results",
        severity: "serious",
        hint: `Only ${quantifiedBullets} of ${bulletLines.length} bullets contain a number. Numbers are the single biggest differentiator on a graduate CV.`,
      });
    }
  }

  const weakFound = WEAK_OPENERS.filter((w) => cvText.toLowerCase().includes(w));
  if (weakFound.length >= 2) {
    issues.push({
      label: "Passive bullet openers",
      severity: "warning",
      hint: `Found "${weakFound.slice(0, 3).join('", "')}". Lead with what you did and what changed, not what you were assigned.`,
    });
  }

  // --- Parseability -------------------------------------------------------
  const lower = cvText.toLowerCase();
  const headingsFound = STANDARD_HEADINGS.filter((h) =>
    lines.some((l) => l.toLowerCase().replace(/[^a-z ]/g, "").trim() === h)
  );
  if (headingsFound.length < 2) {
    issues.push({
      label: "Non-standard section headings",
      severity: "serious",
      hint: "Parsers look for literal headings like Education, Experience and Skills. Creative headings get dropped.",
    });
  }
  if (!/@/.test(cvText)) {
    issues.push({
      label: "No email address found",
      severity: "critical",
      hint: "Contact details must be in the document body, never in a header/footer — many parsers ignore those regions.",
    });
  }
  if (/\t{2,}/.test(cvText) || /\|.*\|.*\|/.test(cvText)) {
    issues.push({
      label: "Possible table or column layout",
      severity: "serious",
      hint: "Multi-column and table layouts are the most common cause of scrambled ATS parsing. Use a single column.",
    });
  }

  // --- Score --------------------------------------------------------------
  // Coverage is 60% of the score; structure penalties take the rest.
  const penalty = issues.reduce((sum, i) => {
    if (i.severity === "critical") return sum + 14;
    if (i.severity === "serious") return sum + 8;
    return sum + 4;
  }, 0);
  const score = Math.max(0, Math.min(100, Math.round(coverage.percentage * 0.6 + 40 - penalty)));

  return {
    score,
    coverage,
    issues,
    stats: {
      words,
      bullets: bulletLines.length,
      longestBulletWords,
      quantifiedBullets,
    },
  };
}

function isHeading(line: string): boolean {
  const clean = line.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return STANDARD_HEADINGS.includes(clean);
}

export function computeCoverage(cvText: string, jdSkills: ExtractedSkill[]): KeywordCoverage {
  const cvLower = cvText.toLowerCase();
  const cvTokens = new Set(tokenise(cvText));

  const matched: string[] = [];
  const missing: string[] = [];
  const missingRequired: string[] = [];

  for (const skill of jdSkills) {
    // Match on the skill name or the surface form the JD actually used.
    const present =
      cvLower.includes(skill.name.toLowerCase()) ||
      cvLower.includes(skill.matchedAs) ||
      cvTokens.has(skill.name.toLowerCase());

    if (present) {
      matched.push(skill.name);
    } else {
      missing.push(skill.name);
      if (skill.required) missingRequired.push(skill.name);
    }
  }

  const total = jdSkills.length;
  return {
    matched,
    missing,
    missingRequired,
    percentage: total ? Math.round((matched.length / total) * 100) : 0,
  };
}
