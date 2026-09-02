// Red-flag detection for job postings.
//
// Every rule carries the evidence that triggered it, because an unexplained
// warning is just noise. Severity maps to the status palette.

export interface RedFlag {
  label: string;
  severity: "warning" | "serious" | "critical";
  explanation: string;
  /** The phrase in the posting that triggered the rule. */
  evidence: string;
}

interface Rule {
  label: string;
  severity: RedFlag["severity"];
  explanation: string;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    label: "Unpaid or expenses-only",
    severity: "critical",
    explanation:
      "Unpaid work is illegal for most UK roles that involve set hours and duties, and it excludes anyone who can't self-fund.",
    patterns: [
      /\bunpaid\b/i,
      /\bexpenses[- ]only\b/i,
      /\bvoluntary (?:position|role)\b(?![^.]*\bcharity\b)/i,
      /\bno salary\b/i,
    ],
  },
  {
    label: "No salary stated",
    severity: "warning",
    explanation:
      "Postings without a figure are correlated with below-market pay and weaker negotiating position. Ask before investing time.",
    patterns: [
      /\bcompetitive salary\b/i,
      /\bsalary (?:is )?(?:negotiable|commensurate|dependent on experience|doe)\b/i,
      /\battractive package\b/i,
    ],
  },
  {
    label: "Unrealistic experience demand",
    severity: "serious",
    explanation:
      "An entry-level title paired with multi-year experience requirements usually means the role is misgraded or the employer expects to underpay for a mid-level hire.",
    patterns: [
      /\b(?:graduate|junior|entry[- ]level|intern|assistant)\b[^.]{0,120}\b(?:[3-9]|1\d)\+?\s*years?\b/i,
      /\b(?:[3-9]|1\d)\+?\s*years?[^.]{0,120}\b(?:graduate|junior|entry[- ]level|intern)\b/i,
    ],
  },
  {
    label: "Always-on expectations",
    severity: "serious",
    explanation:
      "Language framing long or unpredictable hours as a virtue tends to describe understaffing rather than ambition.",
    patterns: [
      /\bwork hard,? play hard\b/i,
      /\bwhatever it takes\b/i,
      /\bgo the extra mile\b/i,
      /\blong hours\b/i,
      /\bevenings and weekends\b/i,
      /\bavailable (?:24\/7|around the clock)\b/i,
      /\bhustle\b/i,
    ],
  },
  {
    label: "Role sprawl",
    severity: "warning",
    explanation:
      "Phrases about covering many functions often mean several jobs bundled into one salary, with unclear success criteria.",
    patterns: [
      /\bwear (?:many|multiple|several) hats\b/i,
      /\bjack of all trades\b/i,
      /\bno two days are the same\b/i,
      /\bother duties as (?:required|assigned)\b/i,
    ],
  },
  {
    label: "Family/culture language",
    severity: "warning",
    explanation:
      "\"We're a family\" framing is associated with blurred boundaries and informal HR practice. Not disqualifying, but ask how leave and escalation actually work.",
    patterns: [/\bwe(?:'| a)re (?:a|like a) family\b/i, /\bfamily[- ]like (?:culture|atmosphere)\b/i],
  },
  {
    label: "High-pressure framing",
    severity: "warning",
    explanation:
      "Heavy emphasis on pressure and pace, without mention of support or resourcing, often signals churn.",
    patterns: [
      /\bthrive under pressure\b/i,
      /\bfast[- ]paced environment\b/i,
      /\bhigh[- ]pressure\b/i,
      /\bmust be able to work under pressure\b/i,
    ],
  },
  {
    label: "Vague deliverables",
    severity: "warning",
    explanation:
      "If the posting never says what you'd actually produce, the role may be undefined — which makes probation and promotion arbitrary.",
    patterns: [/\brockstar\b/i, /\bninja\b/i, /\bguru\b/i, /\bsuperstar\b/i, /\bwizard\b/i],
  },
  {
    label: "Unpaid assessment burden",
    severity: "serious",
    explanation:
      "Extensive unpaid test work beyond a couple of hours transfers real cost onto candidates.",
    patterns: [
      /\b(?:take[- ]home|unpaid)\s+(?:task|test|assignment|exercise|project)\b/i,
      /\b(?:four|five|six|seven|eight|[4-9]|1\d)[- ]stage (?:interview|process)\b/i,
    ],
  },
  {
    label: "Self-funded requirements",
    severity: "serious",
    explanation:
      "Requiring candidates to hold or fund their own clearance, equipment or membership narrows the field on ability to pay.",
    patterns: [
      /\bat your own (?:cost|expense)\b/i,
      /\bmust (?:provide|supply) your own (?:laptop|equipment|vehicle)\b/i,
      /\byou will need to fund\b/i,
    ],
  },
  {
    label: "Rolling deadline pressure",
    severity: "warning",
    explanation:
      "Rolling or early-close deadlines mean applying late materially lowers your odds — treat this as time-critical.",
    patterns: [
      /\bwe reserve the right to close (?:this|the) (?:vacancy|advert|role) early\b/i,
      /\brolling basis\b/i,
      /\bmay close (?:early|before)\b/i,
    ],
  },
];

export function detectRedFlags(text: string): RedFlag[] {
  if (!text.trim()) return [];
  const flags: RedFlag[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        flags.push({
          label: rule.label,
          severity: rule.severity,
          explanation: rule.explanation,
          evidence: contextAround(text, match.index ?? 0, match[0].length),
        });
        break; // One hit per rule is enough.
      }
    }
  }

  // "No salary stated" is only meaningful if there genuinely is no figure.
  const hasFigure = /£\s?\d/.test(text);
  return flags.filter((f) => !(f.label === "No salary stated" && hasFigure));
}

/** Pull a readable snippet around a match so the warning is checkable. */
function contextAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 45);
  const end = Math.min(text.length, index + length + 45);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}

/** Positive signals — worth surfacing so the panel isn't purely negative. */
export interface GreenFlag {
  label: string;
  evidence: string;
}

const GREEN_RULES: { label: string; patterns: RegExp[] }[] = [
  { label: "Salary published", patterns: [/£\s?\d{2},?\d{3}/] },
  { label: "Flexible working offered", patterns: [/\bflexible working\b/i, /\bcompressed hours\b/i, /\bjob share\b/i] },
  { label: "Structured development", patterns: [/\btraining (?:programme|program)\b/i, /\bmentoring\b/i, /\bprofessional development\b/i, /\bcpd\b/i] },
  { label: "Guaranteed interview scheme", patterns: [/\bguaranteed interview\b/i, /\bdisability confident\b/i] },
  { label: "Transparent process", patterns: [/\binterview (?:process|stages) (?:will|are|consists)\b/i, /\bwhat to expect\b/i] },
  { label: "Generous leave", patterns: [/\b(?:2[5-9]|3\d)\s*days?(?:'|’)?\s*(?:annual )?leave\b/i] },
  { label: "Pension contribution stated", patterns: [/\bpension\b[^.]{0,40}\b\d{1,2}(?:\.\d)?%/i, /\bcivil service pension\b/i] },
];

export function detectGreenFlags(text: string): GreenFlag[] {
  const out: GreenFlag[] = [];
  for (const rule of GREEN_RULES) {
    for (const pattern of rule.patterns) {
      const m = text.match(pattern);
      if (m) {
        out.push({ label: rule.label, evidence: contextAround(text, m.index ?? 0, m[0].length) });
        break;
      }
    }
  }
  return out;
}
