// Deterministic text analysis: tokenising, keyword extraction and a domain
// lexicon tuned for policy / economics / research hiring.
//
// This layer runs with no AI at all. The AI layer enriches what this produces;
// it never replaces it. That matters because match scores must be stable and
// explainable — a score that changes when you re-run it is not a score.

export const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at",
  "be","because","been","before","being","below","between","both","but","by","can","can't","cannot",
  "could","couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few",
  "for","from","further","had","hadn't","has","hasn't","have","haven't","having","he","her","here",
  "hers","herself","him","himself","his","how","i","if","in","into","is","isn't","it","its","itself",
  "let's","me","more","most","must","mustn't","my","myself","no","nor","not","of","off","on","once",
  "only","or","other","ought","our","ours","ourselves","out","over","own","same","shan't","she",
  "should","shouldn't","so","some","such","than","that","the","their","theirs","them","themselves",
  "then","there","these","they","this","those","through","to","too","under","until","up","very","was",
  "wasn't","we","were","weren't","what","when","where","which","while","who","whom","why","will",
  "with","won't","would","wouldn't","you","your","yours","yourself","yourselves",
  // JD boilerplate that is never a real requirement
  "role","job","work","working","team","teams","company","organisation","organization","candidate",
  "candidates","applicant","applicants","position","opportunity","opportunities","experience","skills",
  "ability","able","required","requirements","essential","desirable","responsibilities","duties",
  "including","include","includes","within","across","also","well","strong","good","excellent",
  "please","apply","application","closing","date","salary","full","time","part","new","us","you'll",
  "we'll","our","their","looking","seeking","join","support","supporting","help","helping","ensure",
  "ensuring","provide","providing","deliver","delivering","develop","developing","manage","managing",
  "high","level","key","range","wide","across","etc","may","per","annum","year","years","month",
]);

/** Lowercase word tokens, punctuation stripped, stopwords removed. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Contiguous n-grams from the raw text, for multi-word skills. */
export function ngrams(text: string, n: number): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i <= words.length - n; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

/** Word-frequency map, most frequent first. */
export function termFrequency(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokenise(text)) freq.set(token, (freq.get(token) ?? 0) + 1);
  return new Map([...freq.entries()].sort((a, b) => b[1] - a[1]));
}

// ---------------------------------------------------------------------------
// Skill lexicon
// ---------------------------------------------------------------------------

export interface LexiconEntry {
  name: string;
  kind: "HARD" | "SOFT" | "TOOL" | "LANGUAGE" | "METHOD";
  /** Lowercase surface forms that indicate this skill. */
  aliases: string[];
}

/**
 * Tuned for policy, economics, research and graduate-scheme postings. Broad
 * enough to be useful outside that, but this is where the domain knowledge
 * lives — extend it rather than adding special cases elsewhere.
 */
export const SKILL_LEXICON: LexiconEntry[] = [
  // Quantitative & analytical tooling
  { name: "Stata", kind: "TOOL", aliases: ["stata"] },
  { name: "R", kind: "TOOL", aliases: ["rstudio", "r programming", "r statistical"] },
  { name: "Python", kind: "TOOL", aliases: ["python", "pandas", "numpy"] },
  { name: "SQL", kind: "TOOL", aliases: ["sql", "postgres", "mysql", "bigquery"] },
  { name: "SPSS", kind: "TOOL", aliases: ["spss"] },
  { name: "Excel", kind: "TOOL", aliases: ["excel", "ms excel", "microsoft excel", "spreadsheets", "pivot tables", "vlookup"] },
  { name: "Power BI", kind: "TOOL", aliases: ["power bi", "powerbi"] },
  { name: "Tableau", kind: "TOOL", aliases: ["tableau"] },
  { name: "NVivo", kind: "TOOL", aliases: ["nvivo"] },
  { name: "GIS", kind: "TOOL", aliases: ["gis", "arcgis", "qgis", "geospatial"] },

  // Methods
  { name: "Econometrics", kind: "METHOD", aliases: ["econometrics", "econometric", "regression analysis", "regression"] },
  { name: "Statistical analysis", kind: "METHOD", aliases: ["statistical analysis", "statistics", "statistical modelling", "statistical modeling"] },
  { name: "Quantitative research", kind: "METHOD", aliases: ["quantitative research", "quantitative analysis", "quantitative methods", "quant"] },
  { name: "Qualitative research", kind: "METHOD", aliases: ["qualitative research", "qualitative analysis", "qualitative methods", "interviews", "focus groups"] },
  { name: "Cost-benefit analysis", kind: "METHOD", aliases: ["cost benefit analysis", "cost-benefit", "cba", "appraisal", "green book"] },
  { name: "Impact evaluation", kind: "METHOD", aliases: ["impact evaluation", "programme evaluation", "program evaluation", "monitoring and evaluation", "m&e"] },
  { name: "Policy analysis", kind: "METHOD", aliases: ["policy analysis", "policy appraisal", "policy development", "policy design"] },
  { name: "Literature review", kind: "METHOD", aliases: ["literature review", "evidence review", "systematic review", "rapid evidence"] },
  { name: "Survey design", kind: "METHOD", aliases: ["survey design", "questionnaire", "survey methodology"] },
  { name: "Data visualisation", kind: "METHOD", aliases: ["data visualisation", "data visualization", "dashboards", "charts"] },

  // Policy & public affairs craft
    { name: "Policy briefing", kind: "HARD", aliases: ["briefing", "briefings", "policy brief", "submissions", "ministerial", "brief writing"] },
  { name: "Report writing", kind: "HARD", aliases: ["report writing", "drafting", "written communication", "reports", "writing skills"] },
  { name: "Legislative process", kind: "HARD", aliases: ["legislation", "legislative", "parliamentary", "parliament", "bill", "statutory"] },
  { name: "Public consultation", kind: "HARD", aliases: ["consultation", "consultations", "public engagement", "engagement"] },
  { name: "Stakeholder engagement", kind: "HARD", aliases: ["stakeholder", "stakeholders", "stakeholder management", "partnership working"] },
  { name: "Public affairs", kind: "HARD", aliases: ["public affairs", "government relations", "lobbying", "advocacy"] },
  { name: "Campaigning", kind: "HARD", aliases: ["campaign", "campaigns", "campaigning", "grassroots"] },
  { name: "Media relations", kind: "HARD", aliases: ["media relations", "press", "communications", "comms", "press office"] },
  { name: "Economic analysis", kind: "HARD", aliases: ["economic analysis", "economics", "macroeconomics", "microeconomics", "economic policy"] },
  { name: "Financial analysis", kind: "HARD", aliases: ["financial analysis", "financial modelling", "financial modeling", "budgeting", "forecasting"] },
  { name: "Research design", kind: "HARD", aliases: ["research design", "research methods", "methodology"] },
  { name: "Project management", kind: "HARD", aliases: ["project management", "project delivery", "programme management", "prince2", "agile"] },
  { name: "Grant writing", kind: "HARD", aliases: ["grant writing", "bid writing", "funding applications", "fundraising"] },
  { name: "Case work", kind: "HARD", aliases: ["casework", "case work", "constituency"] },

  // Soft
  { name: "Communication", kind: "SOFT", aliases: ["communication skills", "verbal communication", "interpersonal", "articulate"] },
  { name: "Attention to detail", kind: "SOFT", aliases: ["attention to detail", "accuracy", "meticulous", "detail-oriented"] },
  { name: "Time management", kind: "SOFT", aliases: ["time management", "prioritise", "prioritize", "deadlines", "competing priorities", "workload"] },
  { name: "Teamwork", kind: "SOFT", aliases: ["teamwork", "collaborative", "collaboration", "team player"] },
  { name: "Leadership", kind: "SOFT", aliases: ["leadership", "leading", "line management", "mentoring", "supervising"] },
  { name: "Problem solving", kind: "SOFT", aliases: ["problem solving", "problem-solving", "analytical thinking", "critical thinking"] },
  { name: "Adaptability", kind: "SOFT", aliases: ["adaptability", "flexible", "flexibility", "ambiguity", "resilience"] },
  { name: "Presentation", kind: "SOFT", aliases: ["presentation", "presenting", "public speaking", "briefing senior"] },
  { name: "Networking", kind: "SOFT", aliases: ["networking", "relationship building", "influencing"] },

  // Languages
  { name: "French", kind: "LANGUAGE", aliases: ["french"] },
  { name: "Spanish", kind: "LANGUAGE", aliases: ["spanish"] },
  { name: "German", kind: "LANGUAGE", aliases: ["german"] },
  { name: "Mandarin", kind: "LANGUAGE", aliases: ["mandarin", "chinese"] },
  { name: "Arabic", kind: "LANGUAGE", aliases: ["arabic"] },
];

export interface ExtractedSkill {
  name: string;
  kind: LexiconEntry["kind"];
  /** How many times the JD referenced it. */
  count: number;
  /** True when it appears near "essential", "must have", "required". */
  required: boolean;
  /** The surface form actually found, for highlighting. */
  matchedAs: string;
}

const REQUIRED_CUES = [
  "essential", "must have", "must be able", "required", "requirement", "you will need",
  "you must", "necessary", "mandatory", "minimum", "expected to",
];

// Postings almost always group requirements under a header and then list them
// as bullets, so per-sentence cue matching alone marks nothing as essential.
// Tracking the prevailing section as we walk the lines is what makes
// "Essential:\n - Stata" register correctly.
const ESSENTIAL_HEADER =
  /^\s*[-•*]?\s*(essential|essential (?:skills|criteria|requirements?|experience)|must have|minimum (?:requirements?|criteria)|requirements?|person specification|what (?:we|you)(?:'| a)?re looking for|you will (?:have|need)|about you)\b/i;
const DESIRABLE_HEADER =
  /^\s*[-•*]?\s*(desirable|nice to have|preferred|advantageous|bonus|would be a plus|beneficial)\b/i;

type LineMode = "ESSENTIAL" | "DESIRABLE" | "NONE";

/** Label each line with the requirement section it falls under. */
function classifyLines(text: string): { line: string; mode: LineMode }[] {
  let mode: LineMode = "NONE";
  return text.split("\n").map((raw) => {
    const line = raw.trim();
    if (DESIRABLE_HEADER.test(line)) mode = "DESIRABLE";
    else if (ESSENTIAL_HEADER.test(line)) mode = "ESSENTIAL";
    // A blank line ends a short header block only if the next content restarts
    // a section; leaving mode sticky matches how postings actually read.
    else if (/^#{1,3}\s/.test(line) || /^[A-Z][A-Za-z ]{3,40}$/.test(line)) {
      // A new plain heading that is not a requirement header closes the section.
      if (!ESSENTIAL_HEADER.test(line) && !DESIRABLE_HEADER.test(line) && line.length < 45) {
        mode = "NONE";
      }
    }
    return { line: line.toLowerCase(), mode };
  });
}

/**
 * Find lexicon skills in a job description. `required` is true when the skill
 * appears under an essential/requirements heading, or in a sentence carrying
 * explicit requirement language — which distinguishes "Essential: Stata" from
 * "Stata would be nice".
 */
export function extractSkills(text: string): ExtractedSkill[] {
  const haystack = text.toLowerCase();
  const sentences = text.toLowerCase().split(/[.;\n••]+/);
  const classified = classifyLines(text);
  const found: ExtractedSkill[] = [];

  for (const entry of SKILL_LEXICON) {
    let count = 0;
    let matchedAs = "";
    for (const alias of entry.aliases) {
      // Word-boundary match so "r" doesn't match every word containing r.
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, "g");
      const hits = haystack.match(pattern);
      if (hits) {
        count += hits.length;
        if (!matchedAs) matchedAs = alias;
      }
    }
    // Bare "R" needs stricter handling: only count it in an obvious context.
    if (entry.name === "R" && count === 0) {
      if (/(^|[^a-z])r([^a-z]|$)/.test(haystack) && /(stata|spss|python|statistical|data analysis)/.test(haystack)) {
        count = 1;
        matchedAs = "r";
      }
    }
    if (count === 0) continue;

    const inEssentialSection = classified.some(
      (l) => l.mode === "ESSENTIAL" && entry.aliases.some((a) => l.line.includes(a))
    );
    const inDesirableSection = classified.some(
      (l) => l.mode === "DESIRABLE" && entry.aliases.some((a) => l.line.includes(a))
    );
    const hasInlineCue = sentences.some(
      (s) =>
        entry.aliases.some((a) => s.includes(a)) &&
        REQUIRED_CUES.some((cue) => s.includes(cue))
    );

    // An explicit "desirable" listing wins over a generic inline cue: a skill
    // named only under Desirable is not essential however the sentence reads.
    const required = inEssentialSection || (hasInlineCue && !inDesirableSection);

    found.push({ name: entry.name, kind: entry.kind, count, required, matchedAs });
  }

  return found.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.count - a.count;
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Years of experience demanded, if the JD states a number. */
export function extractYearsRequired(text: string): number | null {
  const patterns = [
    /(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?['’s]*\s+(?:of\s+)?(?:relevant\s+|professional\s+|demonstrable\s+)?experience/i,
    /minimum\s+of\s+(\d+)\s*years?/i,
    /at\s+least\s+(\d+)\s*years?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n <= 30) return n;
    }
  }
  return null;
}

/** Salary figures mentioned in the text, in GBP. */
export function extractSalary(text: string): { min?: number; max?: number; raw: string } {
  // £30,000 - £35,000 / £30k-£35k / £30,000 per annum
  const rangeMatch = text.match(
    /£\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?k)\s*(?:-|–|to)\s*£?\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?k)/i
  );
  if (rangeMatch) {
    return {
      min: parseMoney(rangeMatch[1]),
      max: parseMoney(rangeMatch[2]),
      raw: rangeMatch[0].trim(),
    };
  }
  const single = text.match(/£\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?k)/i);
  if (single) return { min: parseMoney(single[1]), raw: single[0].trim() };
  return { raw: "" };
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, "").toLowerCase();
  if (cleaned.endsWith("k")) {
    const n = parseFloat(cleaned.slice(0, -1));
    return Number.isNaN(n) ? undefined : Math.round(n * 1000);
  }
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Work mode inferred from the posting text. */
export function extractWorkMode(text: string): "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN" {
  const t = text.toLowerCase();
  if (/\bfully remote\b|\b100% remote\b|\bremote[- ]first\b/.test(t)) return "REMOTE";
  if (/\bhybrid\b|\bdays? (?:a|per) week in (?:the )?office\b|\bblended working\b/.test(t)) return "HYBRID";
  if (/\bremote\b/.test(t)) return "REMOTE";
  if (/\bon[- ]?site\b|\bin[- ]person\b|\boffice[- ]based\b/.test(t)) return "ONSITE";
  return "UNKNOWN";
}

/** A deadline date mentioned in the posting, if parseable. */
export function extractDeadline(text: string): Date | null {
  const m = text.match(
    /(?:closing date|deadline|applications? close|apply by)[:\s]*(?:is\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})/i
  );
  if (m) {
    const date = new Date(`${m[1]} ${m[2]} ${m[3]}`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const iso = text.match(/(?:closing date|deadline|applications? close|apply by)[:\s]*(\d{4}-\d{2}-\d{2})/i);
  if (iso) {
    const date = new Date(iso[1]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

/**
 * Guess a job title and employer from pasted text. Rough by design — the user
 * confirms in the ingest form; this just saves typing.
 */
export function guessTitleAndCompany(text: string): { title: string; company: string } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 120);

  const title = lines[0] ?? "";
  let company = "";

  for (const line of lines.slice(0, 12)) {
    const m = line.match(/^(?:at|employer|company|organisation|organization)[:\s]+(.{2,80})$/i);
    if (m) {
      company = m[1].trim();
      break;
    }
  }
  if (!company && lines[1] && lines[1].length < 60) company = lines[1];

  return { title, company };
}
