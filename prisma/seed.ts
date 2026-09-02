import { PrismaClient } from "@prisma/client";
import { SKILL_LEXICON } from "../src/lib/text";

const prisma = new PrismaClient();

// Reference vocabularies are always seeded — they are the tag axes the whole
// app scores against. Demo content is seeded unless SEED_DEMO=0, so a fresh
// install shows a working system rather than eight empty pages; it can be
// cleared in one click from Settings.

const DOMAINS = [
  "Economic Policy",
  "Fiscal & Tax",
  "Foreign Affairs & Defence",
  "Trade",
  "Technology & Digital Regulation",
  "Environment & Climate",
  "Energy",
  "Health & Social Care",
  "Education & Skills",
  "Housing & Planning",
  "Transport",
  "Justice & Home Affairs",
  "Welfare & Labour Market",
  "Local Government & Devolution",
  "Democracy & Constitution",
  "International Development",
];

// Civil Service Success Profiles behaviours, plus the general competencies most
// think tanks and NGOs interview against.
const COMPETENCIES: { name: string; framework: string; description: string }[] = [
  { name: "Seeing the Big Picture", framework: "CIVIL_SERVICE", description: "Understanding how your work fits the wider organisational and political context." },
  { name: "Changing and Improving", framework: "CIVIL_SERVICE", description: "Finding better ways of working and responding to change." },
  { name: "Making Effective Decisions", framework: "CIVIL_SERVICE", description: "Using evidence and judgement to reach sound, defensible decisions." },
  { name: "Communicating and Influencing", framework: "CIVIL_SERVICE", description: "Conveying complex material clearly and persuading others." },
  { name: "Working Together", framework: "CIVIL_SERVICE", description: "Building relationships and collaborating across boundaries." },
  { name: "Developing Self and Others", framework: "CIVIL_SERVICE", description: "Investing in your own and others' capability." },
  { name: "Managing a Quality Service", framework: "CIVIL_SERVICE", description: "Delivering reliably to a defined standard for users." },
  { name: "Delivering at Pace", framework: "CIVIL_SERVICE", description: "Working to deadlines and maintaining momentum under pressure." },
  { name: "Leadership", framework: "CIVIL_SERVICE", description: "Setting direction and taking responsibility for outcomes." },
  { name: "Analytical Rigour", framework: "GENERAL", description: "Handling data and evidence carefully and drawing warranted conclusions." },
  { name: "Written Communication", framework: "GENERAL", description: "Producing clear, concise, accurate written work." },
  { name: "Resilience", framework: "GENERAL", description: "Recovering from setbacks and sustaining performance." },
  { name: "Initiative", framework: "GENERAL", description: "Acting without being told to, and owning the result." },
  { name: "Stakeholder Management", framework: "GENERAL", description: "Managing competing interests and expectations." },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function seedReference() {
  for (const name of DOMAINS) {
    await prisma.domain.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name) },
      update: { name },
    });
  }

  for (const c of COMPETENCIES) {
    await prisma.competency.upsert({
      where: { slug: slugify(c.name) },
      create: { name: c.name, slug: slugify(c.name), framework: c.framework, description: c.description },
      update: { description: c.description, framework: c.framework },
    });
  }

  // The skill lexicon doubles as the starting skill list, so JD parsing and the
  // user's own skill records share one vocabulary from day one.
  for (const entry of SKILL_LEXICON) {
    await prisma.skill.upsert({
      where: { name: entry.name },
      create: {
        name: entry.name,
        kind: entry.kind,
        proficiency: 0, // 0 = "not claimed". The user raises it for skills they have.
        aliases: JSON.stringify(entry.aliases),
      },
      update: { aliases: JSON.stringify(entry.aliases), kind: entry.kind },
    });
  }

  console.log(`  ${DOMAINS.length} domains, ${COMPETENCIES.length} competencies, ${SKILL_LEXICON.length} skills`);
}

async function seedDemo() {
  const existingAtoms = await prisma.experienceAtom.count();
  if (existingAtoms > 0) {
    console.log("  demo data skipped — experience bank already has entries");
    return;
  }

  await prisma.profile.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      fullName: "Your Name",
      headline: "Politics & Economics graduate — policy analysis and quantitative research",
            email: "you@example.com",
      phone: "",
      location: "London, UK",
      linkedIn: "",
      summary:
        "Politics with Economics graduate with applied quantitative research experience and a track record of turning evidence into written recommendations for non-specialist audiences.",
      degree: "BSc Politics with Economics",
      university: "University of Bath",
      graduationYear: "2026",
      classification: "2:1 (predicted)",
      targetRoles: JSON.stringify(["Policy Advisor", "Research Assistant", "Policy Analyst", "Economist", "Public Affairs Executive"]),
      targetSectors: JSON.stringify(["GOVERNMENT", "THINK_TANK", "NGO", "REGULATOR"]),
      targetLocations: JSON.stringify(["London", "Bristol", "Remote"]),
      voiceNotes:
        "Direct and analytical. Prefers concrete claims over abstraction, leads with the argument rather than building up to it, and avoids inflated adjectives. Comfortable with qualification where the evidence is genuinely mixed.",
      weeklyApplicationTarget: 5,
    },
    update: {},
  });

  const domains = await prisma.domain.findMany();
  const competencies = await prisma.competency.findMany();
  const skills = await prisma.skill.findMany();

  const domainBy = (name: string) => domains.find((d) => d.name === name)!;
  const compBy = (name: string) => competencies.find((c) => c.name === name)!;
  const skillBy = (name: string) => skills.find((s) => s.name === name)!;

  // Mark the skills the demo persona actually claims.
  const claimed: [string, number][] = [
    ["Stata", 4], ["R", 3], ["Excel", 4], ["Econometrics", 4], ["Quantitative research", 4],
    ["Statistical analysis", 4], ["Policy analysis", 3], ["Report writing", 4], ["Literature review", 4],
    ["Survey design", 3], ["Policy briefing", 3], ["Campaigning", 3], ["Stakeholder engagement", 3],
    ["Communication", 4], ["Attention to detail", 4], ["Time management", 4], ["Teamwork", 4],
    ["Problem solving", 4], ["Presentation", 3], ["Economic analysis", 4], ["Data visualisation", 3],
    ["French", 2], ["Research design", 3], ["Public consultation", 2],
  ];
  for (const [name, proficiency] of claimed) {
    const skill = skills.find((s) => s.name === name);
    if (skill) await prisma.skill.update({ where: { id: skill.id }, data: { proficiency } });
  }

  interface DemoAtom {
    title: string;
    category: string;
    organisation: string;
    role: string;
    location: string;
    start: string;
    end?: string;
    ongoing?: boolean;
    summary: string;
    metric: string;
    impactScore: number;
    isHeadline?: boolean;
    star: [string, string, string, string];
    bullets: { text: string; register: string; isPrimary?: boolean }[];
    skills: [string, number][];
    domains: string[];
    competencies: string[];
  }

  const demoAtoms: DemoAtom[] = [
    {
      title: "Dissertation — regional inflation exposure and voting behaviour",
      category: "ACADEMIC",
      organisation: "University of Bath",
      role: "Undergraduate researcher",
      location: "Bath",
      start: "2025-09",
      end: "2026-04",
      summary:
        "Final-year dissertation testing whether local inflation exposure predicted shifts in party support across UK constituencies between 2021 and 2024, combining ONS regional price data with British Election Study panel responses.",
      metric: "Panel of 2,300 respondents across 41 constituencies; awarded 74",
      impactScore: 5,
      isHeadline: true,
      star: [
        "Existing work on economic voting relied on national inflation figures, which mask large regional variation in what households actually pay.",
        "I needed to build a constituency-level exposure measure and test it against panel voting data without the sample sizes collapsing.",
        "I constructed a weighted regional price index from ONS series, matched it to BES panel waves, and ran fixed-effects models in Stata with robustness checks on alternative weighting schemes.",
        "The exposure measure predicted support shifts where national inflation did not; the dissertation was awarded 74 and the supervisor asked to use the method in a subsequent module.",
      ],
      bullets: [
        { text: "Built a constituency-level inflation exposure index from ONS regional price series and matched it to 2,300 British Election Study panel responses across 41 constituencies", register: "CV", isPrimary: true },
        { text: "Constructed a regional inflation index and tested it against 2,300 panel responses (awarded 74)", register: "CV_SHORT" },
        { text: "My dissertation tested whether regional inflation exposure predicted voting shifts that national figures missed — it did, and the method was picked up by my supervisor for later teaching.", register: "COVER_LETTER" },
        { text: "So the puzzle was that everyone was using national inflation figures, but what people actually pay varies a lot by region. I built my own index from ONS data, matched it to the election study panel, and ran fixed-effects models in Stata. The regional measure predicted vote shifts where the national one didn't.", register: "INTERVIEW" },
      ],
      skills: [["Stata", 3], ["Econometrics", 3], ["Quantitative research", 3], ["Statistical analysis", 3], ["Research design", 3], ["Economic analysis", 3], ["Literature review", 2]],
      domains: ["Economic Policy", "Democracy & Constitution"],
      competencies: ["Analytical Rigour", "Making Effective Decisions", "Written Communication"],
    },
    {
      title: "Constituency casework and research support",
      category: "WORK",
      organisation: "Office of a Member of Parliament",
      role: "Research & Casework Intern",
      location: "London",
      start: "2025-06",
      end: "2025-08",
            summary:
        "Summer internship in a constituency office handling casework triage and producing briefing material for the MP ahead of debates and select committee sessions.",
      metric: "Handled 120+ cases; produced 14 briefings",
      impactScore: 5,
      isHeadline: true,
      star: [
        "The office had a casework backlog of several hundred items and no consistent way of identifying which issues were recurring.",
        "I was asked to clear the backlog while also producing briefing material, with no additional staff time available.",
        "I categorised incoming casework into a simple tagged spreadsheet, which let me batch similar cases and identify the three issues driving most of the volume, then wrote briefings on those themes.",
        "Cleared 120+ cases over ten weeks, and the tagging showed that housing disrepair alone accounted for roughly a third — which the MP raised directly with the local authority.",
      ],
      bullets: [
        { text: "Cleared a backlog of 120+ constituency cases in ten weeks and introduced a tagging system that identified housing disrepair as a third of all casework volume", register: "CV", isPrimary: true },
        { text: "Cleared 120+ constituency cases and identified the issue driving a third of volume", register: "CV_SHORT" },
        { text: "Drafted 14 briefings for an MP ahead of debates and select committee sessions, condensing technical material into two pages for a non-specialist reader", register: "CV" },
        { text: "Working in a constituency office taught me that the volume itself carries information — tagging the casework showed housing disrepair was driving a third of it, which changed what the MP raised locally.", register: "COVER_LETTER" },
      ],
      skills: [["Policy briefing", 3], ["Report writing", 3], ["Legislative process", 2], ["Case work", 3], ["Stakeholder engagement", 2], ["Time management", 3], ["Attention to detail", 3], ["Excel", 2]],
      domains: ["Housing & Planning", "Local Government & Devolution", "Democracy & Constitution"],
      competencies: ["Managing a Quality Service", "Delivering at Pace", "Communicating and Influencing", "Initiative"],
    },
    {
      title: "Survey analysis for a local transport consultation",
      category: "PROJECT",
      organisation: "Bath & North East Somerset Council",
      role: "Student analyst (module placement)",
      location: "Bath",
      start: "2025-01",
      end: "2025-04",
      summary:
        "Analysed responses to a public consultation on bus network changes as part of an applied research module, producing a written report for council officers.",
      metric: "Analysed 1,400 consultation responses",
      impactScore: 4,
      star: [
        "The council had 1,400 free-text consultation responses and no capacity to analyse them systematically before a decision deadline.",
        "I was asked to produce a structured summary of what respondents actually said, distinguishing volume from intensity.",
        "I coded the free-text responses into themes in NVivo, cross-tabulated by respondent postcode, and wrote a 12-page report separating majority views from concentrated local objections.",
        "The report was used in the officer recommendation; two route changes were revised in response to the concentrated objections it identified.",
      ],
      bullets: [
        { text: "Coded and analysed 1,400 free-text consultation responses, cross-tabulating by area to separate broad support from concentrated local objection", register: "CV", isPrimary: true },
        { text: "Analysed 1,400 consultation responses; findings fed into two revised route decisions", register: "CV_SHORT" },
        { text: "Wrote a 12-page report for council officers that fed directly into the published recommendation", register: "CV" },
      ],
      skills: [["Qualitative research", 3], ["Public consultation", 3], ["Report writing", 3], ["NVivo", 2], ["Data visualisation", 2], ["Policy analysis", 2]],
      domains: ["Transport", "Local Government & Devolution"],
      competencies: ["Analytical Rigour", "Working Together", "Written Communication"],
    },
    {
      title: "Treasurer, University Economics Society",
      category: "LEADERSHIP",
      organisation: "University of Bath Students' Union",
      role: "Treasurer",
      location: "Bath",
      start: "2024-09",
      end: "2025-06",
      summary:
        "Elected treasurer of a 300-member society, responsible for the budget, sponsorship and event finances across an academic year.",
      metric: "£8,400 budget; grew sponsorship 45%",
      impactScore: 4,
      star: [
        "The society had run a deficit the previous year and had a single sponsor whose renewal was uncertain.",
        "As treasurer I was responsible for closing the gap without cutting the events programme.",
        "I rebuilt the budget on a per-event basis to show which events actually lost money, and approached four new sponsors with attendance data rather than a generic pitch.",
        "Sponsorship income rose 45% to £8,400 and the society finished the year in surplus for the first time in three years.",
      ],
      bullets: [
        { text: "Rebuilt a £8,400 society budget on a per-event basis and grew sponsorship income 45% by pitching sponsors with attendance data, returning the society to surplus", register: "CV", isPrimary: true },
        { text: "Grew society sponsorship 45% to £8,400 and returned it to surplus", register: "CV_SHORT" },
      ],
      skills: [["Excel", 3], ["Financial analysis", 3], ["Stakeholder engagement", 3], ["Leadership", 3], ["Networking", 2], ["Presentation", 2]],
      domains: ["Economic Policy"],
      competencies: ["Leadership", "Changing and Improving", "Stakeholder Management", "Initiative"],
    },
    {
      title: "Local election campaign volunteering",
      category: "VOLUNTEER",
      organisation: "Local constituency campaign",
      role: "Volunteer coordinator",
      location: "Bath",
      start: "2024-03",
      end: "2024-05",
      summary:
        "Coordinated canvassing rotas and door-to-door voter contact during a local election campaign.",
      metric: "Coordinated 30 volunteers; 4,000+ doors",
      impactScore: 3,
      star: [
        "The campaign had volunteers turning up inconsistently and no reliable record of which streets had been covered.",
        "I took on coordinating the rota and the canvassing record.",
        "I set up a shared tracker of covered streets and moved rota confirmations to a group message the night before, which cut no-shows sharply.",
        "Roughly 30 volunteers contacted over 4,000 households across eight weeks with no duplicated streets.",
      ],
      bullets: [
        { text: "Coordinated 30 volunteers across an eight-week local election campaign, contacting 4,000+ households and eliminating duplicated canvassing through a shared coverage tracker", register: "CV", isPrimary: true },
        { text: "Coordinated 30 campaign volunteers contacting 4,000+ households", register: "CV_SHORT" },
      ],
      skills: [["Campaigning", 3], ["Leadership", 2], ["Teamwork", 3], ["Time management", 2], ["Communication", 3]],
      domains: ["Democracy & Constitution", "Local Government & Devolution"],
      competencies: ["Working Together", "Delivering at Pace", "Leadership"],
    },
        {
      title: "Econometrics module — panel data methods",
      category: "ACADEMIC",
      organisation: "University of Bath",
      role: "Student",
      location: "Bath",
      start: "2024-09",
      end: "2025-01",
      summary:
        "Advanced quantitative module covering panel data, instrumental variables and causal inference, assessed by applied empirical projects in Stata.",
      metric: "Awarded 78",
      impactScore: 3,
      star: ["", "", "", ""],
      bullets: [
        { text: "Completed advanced econometrics (78) covering panel data, instrumental variables and causal inference, assessed through applied Stata projects", register: "CV", isPrimary: true },
      ],
      skills: [["Econometrics", 3], ["Stata", 3], ["Statistical analysis", 3], ["Quantitative research", 2]],
      domains: ["Economic Policy"],
      competencies: ["Analytical Rigour"],
    },
    {
      title: "Retail supervisor — weekend and vacation work",
      category: "WORK",
      organisation: "High street retailer",
      role: "Shift supervisor",
      location: "Bath",
      start: "2023-06",
      end: "2025-06",
      summary:
        "Part-time work throughout university, progressing to shift supervisor with responsibility for opening, closing and a small team during peak trading.",
      metric: "Supervised teams of up to 8",
      impactScore: 2,
      star: [
        "Weekend shifts regularly ran short-staffed during peak trading periods.",
        "As supervisor I was responsible for keeping the floor covered and the queue moving.",
        "I reorganised break scheduling around the observed footfall peaks rather than fixed times.",
        "Queue complaints during Saturday peaks dropped noticeably and the approach was adopted on other shifts.",
      ],
      bullets: [
        { text: "Supervised teams of up to 8 during peak trading while studying full-time, reorganising break scheduling around footfall data to reduce queue times", register: "CV", isPrimary: true },
        { text: "Supervised retail teams of up to 8 alongside full-time study", register: "CV_SHORT" },
      ],
      skills: [["Leadership", 2], ["Teamwork", 2], ["Time management", 3], ["Communication", 2], ["Problem solving", 2]],
      domains: [],
      competencies: ["Working Together", "Delivering at Pace", "Resilience"],
    },
  ];

  for (const demo of demoAtoms) {
    await prisma.experienceAtom.create({
      data: {
        title: demo.title,
        category: demo.category,
        organisation: demo.organisation,
        role: demo.role,
        location: demo.location,
        startDate: new Date(`${demo.start}-01`),
        endDate: demo.end ? new Date(`${demo.end}-01`) : null,
        ongoing: demo.ongoing ?? false,
        summary: demo.summary,
        metric: demo.metric,
        impactScore: demo.impactScore,
        isHeadline: demo.isHeadline ?? false,
        starSituation: demo.star[0],
        starTask: demo.star[1],
        starAction: demo.star[2],
        starResult: demo.star[3],
        bullets: {
          create: demo.bullets.map((b) => ({
            text: b.text,
            register: b.register,
            isPrimary: b.isPrimary ?? false,
          })),
        },
        skills: {
          create: demo.skills
            .filter(([name]) => skills.some((s) => s.name === name))
            .map(([name, weight]) => ({ skillId: skillBy(name).id, weight })),
        },
        domains: { connect: demo.domains.map((d) => ({ id: domainBy(d).id })) },
        competencies: { connect: demo.competencies.map((c) => ({ id: compBy(c).id })) },
      },
    });
  }

  // --- Companies & jobs ----------------------------------------------------
  const ifs = await prisma.company.create({
    data: {
      name: "Institute for Fiscal Studies",
      sector: "THINK_TANK",
      website: "https://ifs.org.uk",
      hq: "London",
      whatTheyDo:
        "Independent microeconomic research institute focused on UK fiscal policy, taxation, public spending and inequality. Funded by ESRC core grants, foundations and commissioned research.",
      policyPositions:
        "Non-partisan by constitution. Best known for costings and distributional analysis of Budget measures.",
      whyThisOrg: "",
      domains: { connect: [{ id: domainBy("Economic Policy").id }, { id: domainBy("Fiscal & Tax").id }] },
    },
  });
  
  const dept = await prisma.company.create({
    data: {
      name: "Department for Transport",
      sector: "GOVERNMENT",
      website: "https://www.gov.uk/dft",
      hq: "London",
      whatTheyDo: "UK government department responsible for the transport network, including rail, roads, aviation and local transport funding.",
      domains: { connect: [{ id: domainBy("Transport").id }] },
    },
  });

  const resolution = await prisma.company.create({
    data: {
      name: "Resolution Foundation",
      sector: "THINK_TANK",
      website: "https://www.resolutionfoundation.org",
      hq: "London",
      whatTheyDo: "Think tank focused on living standards for low-to-middle income households, with a strong quantitative output on pay, employment and household income.",
      domains: { connect: [{ id: domainBy("Welfare & Labour Market").id }, { id: domainBy("Economic Policy").id }] },
    },
  });

  const now = new Date();
  const day = 86_400_000;

  await prisma.job.create({
    data: {
      title: "Research Assistant — Tax and Benefits",
      companyId: ifs.id,
      companyName: ifs.name,
      location: "London (hybrid)",
      workMode: "HYBRID",
      contract: "Permanent",
      salaryText: "£32,000 – £35,000",
      salaryMin: 32000,
      salaryMax: 35000,
      source: "Direct",
      url: "https://ifs.org.uk/jobs",
      status: "TAILORING",
      stageChangedAt: new Date(now.getTime() - 3 * day),
      deadline: new Date(now.getTime() + 9 * day),
      priority: 5,
      rawDescription: `Research Assistant — Tax and Benefits

The Institute for Fiscal Studies is recruiting a Research Assistant to join our tax and benefits team.

About the role
You will support senior researchers in producing quantitative analysis of the UK tax and benefit system, including distributional analysis of policy reforms and contributions to our Budget response.

Responsibilities
- Conduct quantitative analysis of household survey data using Stata
- Produce charts, tables and written summaries for publications and briefings
- Support the maintenance of our microsimulation model
- Contribute to briefings for journalists, civil servants and parliamentarians
- Assist with literature reviews and evidence synthesis

Person specification
Essential:
- A strong undergraduate degree in economics or a closely related quantitative discipline
- Demonstrable experience of statistical analysis, ideally in Stata or R
- Excellent written communication, with the ability to explain technical findings to a non-specialist audience
- Strong attention to detail and the ability to work accurately with large datasets
- Ability to manage competing priorities and work to deadlines

Desirable:
- Familiarity with UK household survey data (FRS, LCFS, Understanding Society)
- Experience of econometrics or microsimulation
- Knowledge of the UK tax and benefit system

Salary £32,000 – £35,000 depending on experience. 25 days annual leave plus bank holidays, generous pension contribution of 10%. Hybrid working with 2 days a week in our central London office.

Closing date: applications close at 23:59.`,
    },
  });

  await prisma.job.create({
    data: {
      title: "Policy Advisor — Local Transport Funding",
      companyId: dept.id,
      companyName: dept.name,
      location: "London / Birmingham",
      workMode: "HYBRID",
      contract: "Permanent",
      salaryText: "£35,400 – £39,100",
      salaryMin: 35400,
      salaryMax: 39100,
      source: "Civil Service Jobs",
      status: "APPLIED",
      appliedAt: new Date(now.getTime() - 14 * day),
      stageChangedAt: new Date(now.getTime() - 14 * day),
      priority: 4,
      rawDescription: `Policy Advisor — Local Transport Funding

Department for Transport | HEO

We are looking for a Policy Advisor to join the Local Transport Funding team.

Job description
The team is responsible for the design and delivery of funding settlements to local transport authorities. You will contribute to policy development, produce advice for ministers, and work closely with analysts and local authority stakeholders.

Key responsibilities
- Draft submissions and briefings for senior officials and ministers
- Analyse funding allocations and their distributional effects across regions
- Engage with local authority stakeholders and represent the department in working groups
- Support the appraisal of funding bids against departmental criteria

Person specification
We are looking for candidates who can demonstrate:
- Strong written communication, particularly the ability to draft clear and concise advice
- Analytical skills and comfort working with quantitative evidence
- Ability to build relationships with a range of stakeholders
- Ability to work at pace and manage competing priorities

Success Profiles behaviours assessed at interview: Seeing the Big Picture, Communicating and Influencing, Delivering at Pace, Working Together.

Benefits include Civil Service pension with an employer contribution of 28.97%, 25 days annual leave rising to 30, and flexible working.

We are a Disability Confident employer and operate a guaranteed interview scheme.`,
    },
  });

  await prisma.job.create({
    data: {
      title: "Economist — Labour Market",
      companyId: resolution.id,
      companyName: resolution.name,
      location: "London",
      workMode: "HYBRID",
      contract: "Permanent",
      salaryText: "Competitive salary",
      source: "LinkedIn",
      status: "SAVED",
      stageChangedAt: new Date(now.getTime() - 2 * day),
      priority: 3,
      rawDescription: `Economist — Labour Market

Resolution Foundation is seeking an Economist to join our labour market team.

You will produce original quantitative research on pay, employment and job quality, publish briefing notes and reports, and represent the Foundation's research in the media and to policymakers.

Requirements
- Postgraduate degree in economics or equivalent experience
- 3+ years experience of applied quantitative research
- Advanced Stata or R
- Track record of published written output
- Excellent communication skills — this is a fast-paced environment and you will need to thrive under pressure

We offer a competitive salary and the chance to shape the national debate. We're a small, close-knit team — we're like a family here, and we're looking for someone who will go the extra mile.

We reserve the right to close this vacancy early if we receive sufficient applications.`,
    },
  });

  await prisma.contact.create({
    data: {
      name: "Example Contact",
      role: "Senior Research Economist",
      companyId: ifs.id,
      companyName: ifs.name,
      relationship: "OUTREACH_SENT",
      notes: "Bath alum. Messaged on LinkedIn about the RA role; mentioned the dissertation method.",
      lastContactedAt: new Date(now.getTime() - 6 * day),
      nextActionAt: new Date(now.getTime() + 1 * day),
      nextActionNote: "Follow up if no reply after a week.",
    },
  });

  console.log(`  ${demoAtoms.length} experience atoms, 3 companies, 3 jobs, 1 contact`);
}

async function main() {
  console.log("Seeding reference data…");
  await seedReference();

  if (process.env.SEED_DEMO !== "0") {
    console.log("Seeding demo content (set SEED_DEMO=0 to skip)…");
    await seedDemo();
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
