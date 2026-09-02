// CV composition.
//
// A CV here is a *structure* referencing atoms, not a blob of text. That is what
// makes it traceable: every bullet knows which experience it came from and which
// requirement it was chosen to answer, so the tailoring studio can show its
// working instead of handing you an opaque draft.
//
// renderCvText() flattens the structure for ATS scanning, clipboard and export.

export type CvSectionKind =
  | "PROFILE"
  | "EDUCATION"
  | "EXPERIENCE"
  | "LEADERSHIP"
  | "PROJECTS"
  | "SKILLS"
  | "CUSTOM";

export interface CvBullet {
  text: string;
  /** Which experience atom this came from. Empty for free text. */
  atomId?: string;
  /** The JD requirement this was selected to answer. */
  answersRequirement?: string;
  rationale?: string;
}

export interface CvItem {
  id: string;
  headline: string;
  subheadline: string;
  dates: string;
  location?: string;
  bullets: CvBullet[];
  atomId?: string;
}

export interface CvSection {
  id: string;
  kind: CvSectionKind;
  heading: string;
  /** Free prose, used by PROFILE and SKILLS. */
  body?: string;
  items: CvItem[];
}

export interface CvHeader {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  website: string;
}

export interface CvStructure {
  header: CvHeader;
  sections: CvSection[];
}

export const SECTION_HEADINGS: Record<CvSectionKind, string> = {
  PROFILE: "Profile",
  EDUCATION: "Education",
  EXPERIENCE: "Experience",
  LEADERSHIP: "Leadership & Positions of Responsibility",
  PROJECTS: "Projects",
  SKILLS: "Skills",
  CUSTOM: "Additional",
};

/** Which CV section an atom category belongs in by default. */
export function sectionForCategory(category: string): CvSectionKind {
  switch (category) {
    case "ACADEMIC":
      return "EDUCATION";
    case "LEADERSHIP":
    case "VOLUNTEER":
      return "LEADERSHIP";
    case "PROJECT":
      return "PROJECTS";
    case "CERTIFICATION":
      return "CUSTOM";
    default:
      return "EXPERIENCE";
  }
}

export function emptyCv(header: Partial<CvHeader> = {}): CvStructure {
  return {
    header: {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      linkedIn: "",
      website: "",
      ...header,
    },
    sections: [
      { id: "profile", kind: "PROFILE", heading: "Profile", body: "", items: [] },
      { id: "education", kind: "EDUCATION", heading: "Education", items: [] },
      { id: "experience", kind: "EXPERIENCE", heading: "Experience", items: [] },
      { id: "leadership", kind: "LEADERSHIP", heading: SECTION_HEADINGS.LEADERSHIP, items: [] },
      { id: "skills", kind: "SKILLS", heading: "Skills", body: "", items: [] },
    ],
  };
}

/**
 * Flatten to plain text.
 *
 * The output is deliberately ATS-shaped: one column, literal standard headings,
 * hyphen bullets, contact details in the body rather than a header region.
 * This is the text the ATS scanner analyses, so what you score is what you send.
 */
export function renderCvText(cv: CvStructure): string {
  const lines: string[] = [];
  const h = cv.header;

  if (h.fullName) lines.push(h.fullName);
  if (h.headline) lines.push(h.headline);

  const contact = [h.email, h.phone, h.location, h.linkedIn, h.website].filter(Boolean);
  if (contact.length) lines.push(contact.join(" | "));
  lines.push("");

  for (const section of cv.sections) {
    const hasBody = Boolean(section.body?.trim());
    if (!hasBody && section.items.length === 0) continue;

    lines.push(section.heading);
    lines.push("");

    if (hasBody) {
      lines.push(section.body!.trim());
      lines.push("");
    }

    for (const item of section.items) {
      const heading = [item.headline, item.subheadline].filter(Boolean).join(", ");
      const right = [item.location, item.dates].filter(Boolean).join(" | ");
      lines.push(right ? `${heading} — ${right}` : heading);
      for (const bullet of item.bullets) {
        if (bullet.text.trim()) lines.push(`- ${bullet.text.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Markdown export — useful for pasting into portals that accept rich text. */
export function renderCvMarkdown(cv: CvStructure): string {
  const lines: string[] = [];
  const h = cv.header;

  if (h.fullName) lines.push(`# ${h.fullName}`);
  if (h.headline) lines.push(`*${h.headline}*`);
  const contact = [h.email, h.phone, h.location, h.linkedIn, h.website].filter(Boolean);
  if (contact.length) lines.push(contact.join(" · "));
  lines.push("");

  for (const section of cv.sections) {
    const hasBody = Boolean(section.body?.trim());
    if (!hasBody && section.items.length === 0) continue;
    lines.push(`## ${section.heading}`, "");
    if (hasBody) lines.push(section.body!.trim(), "");

    for (const item of section.items) {
      const heading = [item.headline, item.subheadline].filter(Boolean).join(", ");
      const right = [item.location, item.dates].filter(Boolean).join(" | ");
      lines.push(`**${heading}**${right ? ` — ${right}` : ""}`);
      for (const bullet of item.bullets) {
        if (bullet.text.trim()) lines.push(`- ${bullet.text.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function countCvBullets(cv: CvStructure): number {
  return cv.sections.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.bullets.length, 0), 0);
}

// ---------------------------------------------------------------------------
// Cover letters
// ---------------------------------------------------------------------------

export interface CoverLetterStructure {
  recipient: string;
  organisation: string;
  subject: string;
  salutation: string;
  paragraphs: string[];
  signOff: string;
  senderName: string;
  notes?: string;
}

export function emptyCoverLetter(senderName = ""): CoverLetterStructure {
  return {
    recipient: "",
    organisation: "",
    subject: "",
    salutation: "Dear Hiring Manager,",
    paragraphs: [""],
    signOff: "Yours sincerely,",
    senderName,
  };
}

export function renderCoverLetterText(letter: CoverLetterStructure): string {
  const lines: string[] = [];
  if (letter.subject) lines.push(letter.subject, "");
  lines.push(letter.salutation, "");
  for (const p of letter.paragraphs) {
    if (p.trim()) lines.push(p.trim(), "");
  }
  lines.push(letter.signOff);
  if (letter.senderName) lines.push(letter.senderName);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
