// Status vocabularies. SQLite has no enums, so these are the single source of
// truth for what the String columns are allowed to contain.

export const ATOM_CATEGORIES = [
  "ACADEMIC",
  "WORK",
  "LEADERSHIP",
  "PROJECT",
  "CERTIFICATION",
  "VOLUNTEER",
] as const;
export type AtomCategory = (typeof ATOM_CATEGORIES)[number];

export const ATOM_CATEGORY_LABELS: Record<AtomCategory, string> = {
  ACADEMIC: "Academic & research",
  WORK: "Work experience",
  LEADERSHIP: "Leadership & politics",
  PROJECT: "Projects",
  CERTIFICATION: "Certifications",
  VOLUNTEER: "Volunteering",
};

export const BULLET_REGISTERS = [
  "CV",
  "CV_SHORT",
  "COVER_LETTER",
  "INTERVIEW",
] as const;
export type BulletRegister = (typeof BULLET_REGISTERS)[number];

export const BULLET_REGISTER_LABELS: Record<BulletRegister, string> = {
  CV: "CV bullet",
  CV_SHORT: "CV bullet (short)",
  COVER_LETTER: "Cover letter line",
  INTERVIEW: "Spoken / interview",
};

export const SKILL_KINDS = ["HARD", "SOFT", "TOOL", "LANGUAGE", "METHOD"] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

export const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  HARD: "Hard skill",
  SOFT: "Soft skill",
  TOOL: "Tool / software",
  LANGUAGE: "Language",
  METHOD: "Method / framework",
};

// --- Pipeline ---------------------------------------------------------------
// Order matters: this array defines both the kanban column order and the
// funnel. `terminal` stages sit outside the forward funnel.

export const JOB_STATUSES = [
  "SAVED",
  "TAILORING",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: "Saved",
  TAILORING: "Tailoring",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL: "Final stage",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

/** Stages that form the forward funnel, in order. */
export const FUNNEL_STAGES: JobStatus[] = [
  "SAVED",
  "TAILORING",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

/** Stages shown as kanban columns. */
export const BOARD_STAGES: JobStatus[] = [
  "SAVED",
  "TAILORING",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

export const CLOSED_STATUSES: JobStatus[] = ["REJECTED", "WITHDRAWN", "ARCHIVED"];

/** A job is "live" if it is still capable of turning into an offer. */
export const ACTIVE_STATUSES: JobStatus[] = [
  "SAVED",
  "TAILORING",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL",
  "OFFER",
];

/** Statuses where the ball is with the employer — i.e. staleness is meaningful. */
export const AWAITING_STATUSES: JobStatus[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "FINAL",
];

export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const COMPANY_SECTORS = [
  "GOVERNMENT",
  "THINK_TANK",
  "NGO",
  "CONSULTANCY",
  "PRIVATE",
  "ACADEMIC",
  "POLITICAL",
  "REGULATOR",
  "OTHER",
] as const;
export type CompanySector = (typeof COMPANY_SECTORS)[number];

export const COMPANY_SECTOR_LABELS: Record<CompanySector, string> = {
  GOVERNMENT: "Government / Civil Service",
  THINK_TANK: "Think tank",
  NGO: "NGO / charity",
  CONSULTANCY: "Consultancy",
  PRIVATE: "Private sector",
  ACADEMIC: "Academic",
  POLITICAL: "Political office / party",
  REGULATOR: "Regulator",
  OTHER: "Other",
};

export const RELATIONSHIPS = [
  "COLD",
  "OUTREACH_SENT",
  "WARM",
  "MET",
  "REFERRER",
  "RECRUITER",
  "INTERVIEWER",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  COLD: "Cold",
  OUTREACH_SENT: "Outreach sent",
  WARM: "Warm",
  MET: "Met",
  REFERRER: "Referrer",
  RECRUITER: "Recruiter",
  INTERVIEWER: "Interviewer",
};

export const INTERACTION_KINDS = [
  "EMAIL",
  "CALL",
  "LINKEDIN",
  "MEETING",
  "APPLICATION",
  "INTERVIEW",
  "NOTE",
] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERVIEW_KINDS = [
  "SCREENING",
  "TECHNICAL",
  "PANEL",
  "FINAL",
  "INFORMAL",
  "ASSESSMENT_CENTRE",
] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  SCREENING: "Screening call",
  TECHNICAL: "Technical / written",
  PANEL: "Panel",
  FINAL: "Final round",
  INFORMAL: "Informal chat",
  ASSESSMENT_CENTRE: "Assessment centre",
};

export const QUESTION_KINDS = [
  "BEHAVIOURAL",
  "TECHNICAL",
  "MOTIVATIONAL",
  "CASE",
  "POLICY",
  "COMPETENCY",
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  BEHAVIOURAL: "Behavioural",
  TECHNICAL: "Technical",
  MOTIVATIONAL: "Motivational",
  CASE: "Case / exercise",
  POLICY: "Policy knowledge",
  COMPETENCY: "Competency",
};

export const DOCUMENT_KINDS = ["CV", "COVER_LETTER"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const AI_KINDS = [
  "JOB_ANALYSIS",
  "CV_TAILOR",
  "COVER_LETTER",
  "COMPANY_DOSSIER",
  "QUESTIONS",
  "ANSWER_FEEDBACK",
  "ATOM_EXTRACT",
  "BULLET_REWRITE",
] as const;
export type AiKind = (typeof AI_KINDS)[number];

export const AI_KIND_LABELS: Record<AiKind, string> = {
  JOB_ANALYSIS: "Job analysis",
  CV_TAILOR: "CV tailoring",
  COVER_LETTER: "Cover letter",
  COMPANY_DOSSIER: "Company dossier",
  QUESTIONS: "Predicted questions",
  ANSWER_FEEDBACK: "Answer feedback",
  ATOM_EXTRACT: "Experience extraction",
  BULLET_REWRITE: "Bullet rewrite",
};

export const TASK_KINDS = ["GENERAL", "FOLLOW_UP", "PREP", "ADMIN", "RESEARCH"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Days without movement before an awaiting application is flagged. */
export const STALE_DAYS = 10;
export const VERY_STALE_DAYS = 21;
