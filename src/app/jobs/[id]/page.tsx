import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  PageHeader, Panel, Badge, Tag, ScoreChip, LinkButton, DataList, EmptyState, Dot,
} from "@/components/ui";
import { ScoreBreakdown } from "@/components/charts";
import { AiAction } from "@/components/AiAction";
import { StatusSelect } from "@/components/StatusSelect";
import { JdViewer } from "@/components/JdViewer";
import { DomainPicker } from "@/components/DomainPicker";
import { IconAlert, IconCheck, IconExternal, IconFile, IconRefresh } from "@/components/icons";
import { analyseJob, setJobDomains, deleteJob } from "@/app/actions/jobs";
import { detectGreenFlags, type RedFlag } from "@/lib/redflags";
import { parseJson, formatDate, formatSalary, relativeDays } from "@/lib/utils";
import { scoreBand, type MatchComponent, type MatchGap } from "@/lib/matching";
import type { ExtractedSkill } from "@/lib/text";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [job, allDomains] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: {
        domains: true,
        company: true,
        documents: { orderBy: { createdAt: "desc" } },
        interviews: { orderBy: { scheduledAt: "asc" } },
        interactions: { orderBy: { occurredAt: "desc" }, take: 8 },
      },
    }),
    prisma.domain.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!job) notFound();

  const components = parseJson<MatchComponent[]>(job.matchBreakdown, []);
  const gaps = parseJson<MatchGap[]>(job.gaps, []);
  const redFlags = parseJson<RedFlag[]>(job.redFlags, []);
  const greenFlags = detectGreenFlags(job.rawDescription);
  const extracted = parseJson<ExtractedSkill[]>(job.extractedSkills, []);
  const band = scoreBand(job.matchScore);

  const essentialGaps = gaps.filter((g) => g.required);
  const otherGaps = gaps.filter((g) => !g.required);

  async function runAnalysis() {
    "use server";
    return analyseJob(id, true);
  }
  async function rescore() {
    "use server";
    await analyseJob(id, false);
  }
  async function updateDomains(domainIds: string[]) {
    "use server";
    return setJobDomains(id, domainIds);
  }
  async function remove() {
    "use server";
    await deleteJob(id);
  }

  return (
    <>
      <PageHeader
        title={job.title}
        description={[job.companyName, job.location].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--raised)]"
              >
                <IconExternal size={13} /> Posting
              </a>
            )}
            <StatusSelect jobId={job.id} status={job.status} />
            <LinkButton href={`/jobs/${job.id}/tailor`} variant="primary">
              <IconFile size={14} /> Tailor
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        {/* --- Left: the posting --------------------------------------- */}
        <div className="flex flex-col gap-4">
          {(job.fitSummary || job.positioningAngle || job.riskNotes) && (
            <Panel title="Assessment">
              <div className="flex flex-col gap-3 text-[13px] leading-relaxed">
                {job.fitSummary && (
                  <div>
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Fit
                    </span>
                    <p>{job.fitSummary}</p>
                  </div>
                )}
                {job.positioningAngle && (
                  <div>
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Positioning angle
                    </span>
                    <p>{job.positioningAngle}</p>
                  </div>
                )}
                {job.riskNotes && (
                  <div>
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Risks
                    </span>
                    <p className="text-[var(--ink-2)]">{job.riskNotes}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel
            title="The posting"
            subtitle="Requirements the parser recognised are highlighted. Essential ones are underlined."
            padded={false}
          >
            <JdViewer text={job.rawDescription} skills={extracted} />
          </Panel>

          {(redFlags.length > 0 || greenFlags.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {redFlags.length > 0 && (
                <Panel title="Red flags" subtitle="Each one quotes the wording that triggered it." padded={false}>
                  <ul className="divide-y divide-[var(--line)]">
                    {redFlags.map((flag, i) => (
                      <li key={i} className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <Dot tone={flag.severity} className="mt-1.5" />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium">{flag.label}</p>
                            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-2)]">
                              {flag.explanation}
                            </p>
                            {flag.evidence && (
                              <p className="mt-1 border-l-2 border-[var(--line-strong)] pl-2 text-[11px] italic text-[var(--muted)]">
                                {flag.evidence}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {greenFlags.length > 0 && (
                <Panel title="Positive signals" padded={false}>
                  <ul className="divide-y divide-[var(--line)]">
                    {greenFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 px-4 py-2.5">
                        <IconCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--good)" }} />
                        <div className="min-w-0">
                          <p className="text-[12.5px]">{flag.label}</p>
                          <p className="mt-0.5 text-[11px] italic text-[var(--muted)]">{flag.evidence}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          )}

          {job.documents.length > 0 && (
            <Panel title="Documents" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {job.documents.map((doc) => (
                  <li key={doc.id} className="hover-row flex items-center gap-3 px-4 py-2.5">
                    <IconFile size={14} className="shrink-0 text-[var(--muted)]" />
                    <Link href={`/jobs/${job.id}/tailor`} className="min-w-0 flex-1 truncate text-[13px] hover:underline">
                      {doc.label}
                    </Link>
                    {doc.isFinal && <Badge tone="good">Final</Badge>}
                    {doc.atsScore !== null && <ScoreChip score={doc.atsScore} size="sm" />}
                    <span className="shrink-0 text-[11px] text-[var(--muted)]">{relativeDays(doc.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* --- Right: analysis ------------------------------------------ */}
        <div className="flex flex-col gap-4">
          <Panel
            title="Match score"
            subtitle={job.analysedAt ? `Last scored ${relativeDays(job.analysedAt)}` : "Not yet analysed"}
            action={
              <form action={rescore}>
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                  title="Recompute against the current experience bank"
                >
                  <IconRefresh size={12} /> Rescore
                </button>
              </form>
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <ScoreChip score={job.matchScore} />
              <div>
                <p className="text-[13px] font-medium">{band.label}</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {job.yearsRequired !== null
                    ? `posting asks for ${job.yearsRequired} years`
                    : "no explicit experience requirement"}
                </p>
              </div>
            </div>

            {components.length > 0 ? (
              <ScoreBreakdown components={components} />
            ) : (
              <p className="text-[12px] text-[var(--muted)]">Rescore to generate a breakdown.</p>
            )}

            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <AiAction
                action={runAnalysis}
                label={job.fitSummary ? "Re-run AI assessment" : "Run AI assessment"}
                runningLabel="Assessing…"
                bridgeTitle="Assess this job in Claude"
                variant="default"
                size="sm"
                className="w-full justify-center"
              />
              <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
                Adds a fit judgement, a positioning angle and a risk read on top of the deterministic score.
              </p>
            </div>
          </Panel>

          {gaps.length > 0 && (
            <Panel
              title="Gaps"
              subtitle="Requirements your bank does not currently answer."
              padded={false}
            >
              <ul className="divide-y divide-[var(--line)]">
                {[...essentialGaps, ...otherGaps].map((gap, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12px]">{gap.skill}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {gap.required && <Badge tone="serious">essential</Badge>}
                      <span className="text-[10px] text-[var(--muted)]">
                        {gap.reason === "NO_SKILL"
                          ? "not claimed"
                          : gap.reason === "NO_EVIDENCE"
                            ? "claimed, no bullet"
                            : "weak evidence"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-[var(--line)] px-4 py-2.5 text-[11px] leading-snug text-[var(--muted)]">
                &ldquo;Claimed, no bullet&rdquo; is the easiest to fix — the skill is on your list but nothing in the
                bank demonstrates it. Write one bullet and it stops being a gap.
              </p>
            </Panel>
          )}

          <Panel title="Policy domains" subtitle="Tagging these raises domain alignment in the score.">
            <DomainPicker
              domains={allDomains.map((d) => ({ id: d.id, name: d.name }))}
              selected={job.domains.map((d) => d.id)}
              action={updateDomains}
            />
          </Panel>

          <Panel title="Details">
            <DataList
              rows={[
                { label: "Employer", value: job.company ? <Link href={`/companies/${job.company.id}`} className="hover:underline">{job.companyName}</Link> : job.companyName || "—" },
                { label: "Stage", value: JOB_STATUS_LABELS[job.status as JobStatus] },
                { label: "Salary", value: formatSalary(job.salaryMin, job.salaryMax, job.salaryText) },
                { label: "Work mode", value: job.workMode === "UNKNOWN" ? "Not stated" : job.workMode.toLowerCase() },
                { label: "Contract", value: job.contract || "—" },
                { label: "Closing", value: job.deadline ? `${formatDate(job.deadline)} (${relativeDays(job.deadline)})` : "—" },
                { label: "Source", value: job.source || "—" },
                { label: "Captured", value: formatDate(job.createdAt) },
                { label: "Applied", value: job.appliedAt ? formatDate(job.appliedAt) : "—" },
              ]}
            />
          </Panel>

          {job.interactions.length > 0 && (
            <Panel title="History" padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {job.interactions.map((entry) => (
                  <li key={entry.id} className="px-4 py-2">
                    <p className="text-[12px]">{entry.subject || entry.kind}</p>
                    <p className="text-[11px] text-[var(--muted)]">{formatDate(entry.occurredAt)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <form action={remove}>
            <button
              type="submit"
              className="w-full rounded-md border border-[color-mix(in_srgb,var(--critical)_35%,transparent)] px-3 py-1.5 text-[12px] text-[var(--critical)] transition-colors hover:bg-[color-mix(in_srgb,var(--critical)_10%,transparent)]"
            >
              Delete this job
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
