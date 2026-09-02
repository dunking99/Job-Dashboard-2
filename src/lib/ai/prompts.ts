import { z } from "zod";

// Prompt builders.
//
// A standing instruction runs through all of these: be honest about fit. A tool
// that rates every job a strong match and every answer "great, just add detail"
// is worse than no tool, because it costs you the ability to triage. Several
// prompts below explicitly ask for the case against.

const HOUSE_RULES = `You are the analysis engine inside a personal job-search dashboard. You are working for one person, on their real applications.

Rules that override any instinct to be encouraging:
- Be accurate before you are supportive. If the fit is weak, say it is weak and say why. The user is triaging dozens of roles and needs to know which to drop.
- Never invent experience, employers, dates, metrics or qualifications. You may only rephrase, select from, or reorganise what the user has actually given you. Fabrication here costs someone a job offer and their credibility.
- If evidence for a claim is missing, say so explicitly rather than papering over it.
- Write British English. Use UK conventions for spelling, dates and currency.
- Return only the JSON described. No preamble, no commentary, no markdown fences around it.`;

function voiceBlock(voiceNotes?: string): string {
  if (!voiceNotes?.trim()) return "";
  return `\n\nThe user describes their own writing voice as follows. Match it; do not flatten it into generic application prose:\n"""\n${voiceNotes.trim()}\n"""`;
}

export interface PromptSpec {
  system: string;
  user: string;
}

// ---------------------------------------------------------------------------
// 1. Job analysis
// ---------------------------------------------------------------------------

export const jobAnalysisSchema = z.object({
  fitSummary: z.string(),
  positioningAngle: z.string(),
  riskNotes: z.string(),
  domains: z.array(z.string()).default([]),
  seniority: z.string().default(""),
  additionalSkills: z
    .array(z.object({ name: z.string(), kind: z.string().default("HARD"), required: z.boolean().default(false) }))
    .default([]),
  redFlags: z
    .array(z.object({ label: z.string(), severity: z.string().default("warning"), explanation: z.string().default("") }))
    .default([]),
});
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export function jobAnalysisPrompt(input: {
  title: string;
  company: string;
  description: string;
  candidateSummary: string;
  matchScore: number;
  gaps: string[];
  availableDomains: string[];
}): PromptSpec {
  return {
    system: HOUSE_RULES,
    user: `Analyse this job posting for the candidate described below.

## The posting
Title: ${input.title}
Employer: ${input.company || "not stated"}

"""
${input.description.slice(0, 14000)}
"""

## The candidate
${input.candidateSummary}

## What the deterministic scorer already found
Match score: ${input.matchScore}/100
Unmet or weakly evidenced requirements: ${input.gaps.length ? input.gaps.join(", ") : "none identified"}

## What to return
Return JSON with exactly these keys:

{
  "fitSummary": "2-3 sentences. Why this role does or does not fit this specific candidate. Reference their actual experience. If the honest answer is that they are underqualified, say so.",
  "positioningAngle": "2-3 sentences. The single strongest line of argument this candidate should make for this role — the through-line a CV and cover letter should both be built around. Be specific to them, not generic advice.",
  "riskNotes": "1-3 sentences. What could sink this application: unmet essentials, seniority mismatch, sector inexperience, anything in the posting that suggests the employer wants someone else. Be blunt.",
  "domains": ["policy domains this role sits in, chosen from: ${input.availableDomains.join(", ")}"],
  "seniority": "one of: internship, graduate, junior, mid, senior",
  "additionalSkills": [{"name": "skill named in the posting that a keyword scan would miss", "kind": "HARD|SOFT|TOOL|LANGUAGE|METHOD", "required": true}],
  "redFlags": [{"label": "short label", "severity": "warning|serious|critical", "explanation": "one sentence"}]
}

For redFlags, only report things genuinely visible in the posting text. An empty array is a valid and common answer.`,
  };
}

// ---------------------------------------------------------------------------
// 2. CV tailoring
// ---------------------------------------------------------------------------

export const cvTailorSchema = z.object({
  summary: z.string().default(""),
  selections: z.array(
    z.object({
      atomId: z.string(),
      bullet: z.string(),
      rationale: z.string().default(""),
      answersRequirement: z.string().default(""),
    })
  ),
  omitted: z.array(z.object({ atomId: z.string(), reason: z.string() })).default([]),
  gapAdvice: z.string().default(""),
});
export type CvTailor = z.infer<typeof cvTailorSchema>;

export function cvTailorPrompt(input: {
  title: string;
  company: string;
  description: string;
  profileSummary: string;
  voiceNotes?: string;
  atoms: {
    id: string;
    title: string;
    organisation: string;
    role: string;
    category: string;
    dates: string;
    summary: string;
    metric: string;
    skills: string[];
    existingBullets: string[];
  }[];
  gaps: string[];
  maxBullets: number;
}): PromptSpec {
  const bank = input.atoms
    .map(
      (a) => `--- atomId: ${a.id}
Title: ${a.title}
Where: ${a.role || "—"} at ${a.organisation || "—"} (${a.dates || "dates not set"}) [${a.category}]
Context: ${a.summary || "—"}
Quantified result: ${a.metric || "none recorded"}
Skills: ${a.skills.join(", ") || "none tagged"}
Existing phrasings: ${a.existingBullets.length ? a.existingBullets.map((b) => `\n  • ${b}`).join("") : " none"}`
    )
    .join("\n\n");

  return {
    system: HOUSE_RULES + voiceBlock(input.voiceNotes),
    user: `Select and phrase CV bullets for this application.

## Target role
${input.title}${input.company ? ` at ${input.company}` : ""}

"""
${input.description.slice(0, 10000)}
"""

## The candidate
${input.profileSummary}

## Their experience bank
Every fact you may use is below. You may rephrase and re-emphasise; you may not add anything that is not here.

${bank}

## Known gaps
${input.gaps.length ? input.gaps.join(", ") : "none identified"}

## What to return

{
  "summary": "A 2-3 sentence CV profile paragraph for this specific application. First person implied, no 'I am a'. Concrete, not aspirational.",
  "selections": [
    {
      "atomId": "id from the bank above",
      "bullet": "the bullet as it should appear on the CV. Start with a strong past-tense verb. Include the real metric where one exists. Under 30 words.",
      "rationale": "why this bullet earns its place on THIS application",
      "answersRequirement": "the specific requirement from the posting this addresses"
    }
  ],
  "omitted": [{"atomId": "id", "reason": "why this was left out for this role"}],
  "gapAdvice": "What the candidate should do about the unmet requirements — address in the cover letter, acquire the skill, or accept as a genuine gap. Be specific and honest."
}

Select at most ${input.maxBullets} bullets, ordered strongest-first for this posting. Every atomId must come from the bank. Do not invent metrics: if an atom has no recorded metric, write the bullet without one.`,
  };
}

// ---------------------------------------------------------------------------
// 3. Cover letter
// ---------------------------------------------------------------------------

export const coverLetterSchema = z.object({
  paragraphs: z.array(z.string()),
  subject: z.string().default(""),
  notes: z.string().default(""),
});
export type CoverLetter = z.infer<typeof coverLetterSchema>;

export function coverLetterPrompt(input: {
  title: string;
  company: string;
  description: string;
  profileSummary: string;
  voiceNotes?: string;
  positioningAngle: string;
  evidence: string[];
  companyContext: string;
  wordTarget: number;
}): PromptSpec {
  return {
    system: HOUSE_RULES + voiceBlock(input.voiceNotes),
    user: `Draft a cover letter.

## Role
${input.title}${input.company ? ` at ${input.company}` : ""}

"""
${input.description.slice(0, 8000)}
"""

## The candidate
${input.profileSummary}

## The positioning angle this letter should be built around
${input.positioningAngle || "not yet defined — derive the strongest one from the evidence below"}

## Evidence available (do not go beyond this)
${input.evidence.map((e) => `• ${e}`).join("\n")}

## What is known about the employer
${input.companyContext || "nothing recorded — do not speculate about the organisation, and do not flatter it"}

## What to return

{
  "subject": "email subject line if sent by email",
  "paragraphs": ["paragraph 1", "paragraph 2", "..."],
  "notes": "anything the candidate should check or personalise before sending"
}

Requirements:
- Around ${input.wordTarget} words total, 4-5 paragraphs.
- Open with the specific reason for applying to this role at this organisation. Never open with "I am writing to apply for" or "I was excited to see".
- Use concrete evidence with real numbers from the list above. One example developed properly beats three mentioned in passing.
- No flattery of the employer, no claims about their "impressive work" you cannot substantiate from the context given.
- No clichés: "passionate about", "hit the ground running", "team player", "dynamic", "perfect fit".
- Close by stating what you would bring, not by thanking them for their time.`,
  };
}

// ---------------------------------------------------------------------------
// 4. Company dossier
// ---------------------------------------------------------------------------

export const dossierSchema = z.object({
  whatTheyDo: z.string().default(""),
  policyPositions: z.string().default(""),
  recentNews: z.string().default(""),
  cultureNotes: z.string().default(""),
  whyThisOrg: z.string().default(""),
  competitors: z.string().default(""),
  keyPeople: z.array(z.object({ name: z.string(), role: z.string().default(""), note: z.string().default("") })).default([]),
  questionsToAsk: z.array(z.string()).default([]),
  uncertainty: z.string().default(""),
});
export type Dossier = z.infer<typeof dossierSchema>;

export function dossierPrompt(input: {
  name: string;
  sector: string;
  pastedMaterial: string;
  candidateSummary: string;
}): PromptSpec {
  return {
    system:
      HOUSE_RULES +
      `\n\nYou have no live internet access. Work from the material pasted below plus your own training knowledge, and be explicit about which is which. State plainly when you are unsure or when your knowledge may be out of date — a confident wrong fact stated in an interview is worse than an admitted gap.`,
    user: `Build a research dossier on this organisation.

Organisation: ${input.name}
Sector: ${input.sector || "unknown"}

## Material the user has pasted in (may be empty)
"""
${input.pastedMaterial.slice(0, 12000) || "(nothing pasted)"}
"""

## The candidate applying
${input.candidateSummary}

## What to return

{
  "whatTheyDo": "What this organisation actually does, in plain terms. Funding model and who it answers to, if relevant.",
  "policyPositions": "Known positions, priorities or areas of focus. Say if unknown.",
  "recentNews": "Recent developments you are aware of, each with a rough date. Flag clearly if your knowledge may be stale.",
  "cultureNotes": "What is known or inferable about how they work and hire.",
  "whyThisOrg": "A specific, non-flattering answer to 'why do you want to work here' for THIS candidate, grounded in their actual background.",
  "competitors": "Comparable organisations — useful for framing and for widening the search.",
  "keyPeople": [{"name": "", "role": "", "note": "why they matter to this application"}],
  "questionsToAsk": ["sharp questions for the candidate to ask at interview — ones that show real knowledge, not generic ones"],
    "uncertainty": "State explicitly what you are unsure about and what the candidate should verify independently before interview."
}`,
  };
}

// ---------------------------------------------------------------------------
// 5. Predicted questions
// ---------------------------------------------------------------------------

export const questionsSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      kind: z.string().default("BEHAVIOURAL"),
      competency: z.string().default(""),
      suggestedAtomIds: z.array(z.string()).default([]),
      rationale: z.string().default(""),
      difficulty: z.number().default(3),
    })
  ),
});
export type PredictedQuestions = z.infer<typeof questionsSchema>;

export function questionsPrompt(input: {
  title: string;
  company: string;
  description: string;
  interviewKind: string;
  atoms: { id: string; title: string; summary: string; competencies: string[] }[];
  competencies: string[];
  count: number;
}): PromptSpec {
  const bank = input.atoms
    .map((a) => `atomId: ${a.id} — ${a.title}. ${a.summary.slice(0, 180)} [competencies: ${a.competencies.join(", ") || "untagged"}]`)
    .join("\n");

  return {
    system: HOUSE_RULES,
    user: `Predict the questions this interview will actually ask, and map them to the candidate's evidence.

## Role
${input.title}${input.company ? ` at ${input.company}` : ""}
Interview stage: ${input.interviewKind}

"""
${input.description.slice(0, 8000)}
"""

## The candidate's experience bank
${bank || "(empty)"}

## Competency framework in use
${input.competencies.join(", ")}

## What to return

{
  "questions": [
    {
      "text": "the question, phrased as an interviewer would actually ask it",
      "kind": "BEHAVIOURAL|TECHNICAL|MOTIVATIONAL|CASE|POLICY|COMPETENCY",
      "competency": "the competency it probes, from the framework above",
      "suggestedAtomIds": ["atom ids that answer this well, best first"],
      "rationale": "why this question is likely for this specific posting",
      "difficulty": 3
    }
  ]
}

Give ${input.count} questions. Weight them towards what this posting actually emphasises. Include at least one question the candidate will find genuinely difficult given the gaps in their background — those are the ones worth rehearsing.`,
  };
}

// ---------------------------------------------------------------------------
// 6. Answer feedback
// ---------------------------------------------------------------------------

export const answerFeedbackSchema = z.object({
  score: z.number(),
  starCoverage: z.object({
    situation: z.boolean().default(false),
    task: z.boolean().default(false),
    action: z.boolean().default(false),
    result: z.boolean().default(false),
  }),
  strengths: z.array(z.string()).default([]),
  problems: z.array(z.string()).default([]),
  rewrite: z.string().default(""),
  followUp: z.string().default(""),
});
export type AnswerFeedback = z.infer<typeof answerFeedbackSchema>;

export function answerFeedbackPrompt(input: {
  question: string;
  answer: string;
  competency: string;
  roleContext: string;
}): PromptSpec {
  return {
    system:
      HOUSE_RULES +
      `\n\nYou are acting as a demanding but fair interview coach. Do not open with praise. Do not soften a weak answer. The user is rehearsing precisely so that the criticism happens here rather than in the room.`,
    user: `Assess this practice answer.

## Question
${input.question}

Competency probed: ${input.competency || "not specified"}
Role context: ${input.roleContext || "not specified"}

## The candidate's answer
"""
${input.answer}
"""

## What to return

{
  "score": 0-100,
  "starCoverage": {"situation": true, "task": true, "action": true, "result": false},
  "strengths": ["what genuinely worked — be specific, and give none if there is nothing"],
  "problems": ["what is wrong, most damaging first. Vagueness, missing result, waffle, taking credit for team work, not answering the question asked"],
  "rewrite": "the same answer, restructured to be materially better. Use only facts the candidate actually stated — do not invent detail to fill gaps. Where a fact is missing, mark it like [insert the actual number here].",
  "followUp": "the follow-up question a sharp interviewer would ask next, given what this answer exposed"
}

Score honestly against a real hiring bar. Most first-attempt answers sit between 40 and 65.`,
  };
}

// ---------------------------------------------------------------------------
// 7. Experience extraction (onboarding)
// ---------------------------------------------------------------------------

export const atomExtractSchema = z.object({
  atoms: z.array(
    z.object({
      title: z.string(),
      category: z.string().default("WORK"),
      organisation: z.string().default(""),
      role: z.string().default(""),
      location: z.string().default(""),
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      ongoing: z.boolean().default(false),
      summary: z.string().default(""),
      metric: z.string().default(""),
      bullets: z.array(z.string()).default([]),
      skills: z.array(z.string()).default([]),
      domains: z.array(z.string()).default([]),
      competencies: z.array(z.string()).default([]),
      impactScore: z.number().default(3),
    })
  ),
  profile: z
    .object({
      fullName: z.string().default(""),
      email: z.string().default(""),
      phone: z.string().default(""),
      location: z.string().default(""),
      linkedIn: z.string().default(""),
      degree: z.string().default(""),
      university: z.string().default(""),
      graduationYear: z.string().default(""),
      classification: z.string().default(""),
      summary: z.string().default(""),
    })
    .default({}),
  missingMetrics: z.array(z.string()).default([]),
});
export type AtomExtract = z.infer<typeof atomExtractSchema>;

export function atomExtractPrompt(input: {
  pastedText: string;
  availableDomains: string[];
  availableCompetencies: string[];
}): PromptSpec {
  return {
    system: HOUSE_RULES,
    user: `Break this CV (or free-form career history) into atomic experience entries for a structured experience bank.

An "atom" is one coherent piece of experience — a job, an internship, a project, a society role, a dissertation. Each becomes reusable raw material for CVs, cover letters and interview answers.

## The source text
"""
${input.pastedText.slice(0, 20000)}
"""

## Tag vocabularies
Domains: ${input.availableDomains.join(", ")}
Competencies: ${input.availableCompetencies.join(", ")}

## What to return

{
  "profile": {"fullName": "", "email": "", "phone": "", "location": "", "linkedIn": "", "degree": "", "university": "", "graduationYear": "", "classification": "", "summary": ""},
  "atoms": [
    {
      "title": "short label for this experience",
      "category": "ACADEMIC|WORK|LEADERSHIP|PROJECT|CERTIFICATION|VOLUNTEER",
      "organisation": "", "role": "", "location": "",
      "startDate": "YYYY-MM or empty", "endDate": "YYYY-MM or empty", "ongoing": false,
      "summary": "what this actually was, in plain prose — the raw context, not CV language",
      "metric": "the quantified outcome if the source states one, else empty string",
      "bullets": ["the phrasings present in the source, cleaned up but not embellished"],
      "skills": ["skills genuinely demonstrated"],
      "domains": ["from the domain vocabulary above"],
      "competencies": ["from the competency vocabulary above"],
      "impactScore": 1-5
    }
  ],
  "missingMetrics": ["titles of atoms that clearly need a number the source does not provide — the user should be prompted to supply these"]
}

Critical: do not invent metrics, dates, employers or outcomes. If the source says "helped with research", the metric is an empty string and the atom goes in missingMetrics. Transcribing vagueness faithfully is correct; inventing precision is not.`,
  };
}

// ---------------------------------------------------------------------------
// 8. Bullet rewrite
// ---------------------------------------------------------------------------

export const bulletRewriteSchema = z.object({
  variants: z.array(z.object({ register: z.string(), text: z.string() })),
});
export type BulletRewrite = z.infer<typeof bulletRewriteSchema>;

export function bulletRewritePrompt(input: {
  atomTitle: string;
  context: string;
  metric: string;
  existing: string[];
  voiceNotes?: string;
  targetRegisters: string[];
}): PromptSpec {
  return {
    system: HOUSE_RULES + voiceBlock(input.voiceNotes),
    user: `Write alternative phrasings of this experience for different contexts.

## The experience
Title: ${input.atomTitle}
Context: ${input.context}
Quantified result: ${input.metric || "none recorded — write without one, do not invent"}
Existing phrasings: ${input.existing.length ? input.existing.map((b) => `\n• ${b}`).join("") : "none"}

## What to return

{
  "variants": [
    {"register": "CV", "text": "full CV bullet, past tense, strong verb, under 30 words"},
    {"register": "CV_SHORT", "text": "compressed to under 15 words for a dense CV"},
    {"register": "COVER_LETTER", "text": "a flowing sentence for prose, first person"},
    {"register": "INTERVIEW", "text": "how you would say this out loud — natural spoken register, not a recited bullet"}
  ]
}

Produce one variant for each of: ${input.targetRegisters.join(", ")}. Same facts throughout; only the register changes.`,
  };
}
