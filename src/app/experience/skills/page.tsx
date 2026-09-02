import { prisma } from "@/lib/db";
import { PageHeader, Panel, LinkButton } from "@/components/ui";
import { SkillManager } from "@/components/SkillManager";
import { getMarketGaps } from "@/lib/analytics";
import { SKILL_KINDS, SKILL_KIND_LABELS, type SkillKind } from "@/lib/constants";

export default async function SkillsPage() {
  const [skills, gaps] = await Promise.all([
    prisma.skill.findMany({
      orderBy: [{ proficiency: "desc" }, { name: "asc" }],
      include: { _count: { select: { atoms: true } } },
    }),
    getMarketGaps(),
  ]);

  const claimed = skills.filter((s) => s.proficiency > 0);
  const unclaimed = skills.filter((s) => s.proficiency === 0);

  return (
    <>
      <PageHeader
        title="Skills"
        description="The shared vocabulary between your experience and job descriptions. A skill only counts towards a match score once it is both claimed here and evidenced by at least one entry."
        actions={<LinkButton href="/experience">Back to bank</LinkButton>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SkillManager
          claimed={claimed.map((s) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            proficiency: s.proficiency,
            atomCount: s._count.atoms,
          }))}
          unclaimed={unclaimed.map((s) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            proficiency: s.proficiency,
            atomCount: s._count.atoms,
          }))}
        />

        <div className="flex flex-col gap-4">
          <Panel
            title="What the market is asking for"
            subtitle="Skills named across the jobs you have captured that nothing in your bank evidences, ranked by how often they are marked essential."
            padded={false}
          >
            {gaps.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                No unmet demand yet — capture a few jobs and this fills in.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {gaps.slice(0, 14).map((gap) => (
                  <li key={gap.name} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12px]">{gap.name}</span>
                    <span className="tnum shrink-0 text-[11px] text-[var(--muted)]">
                      {gap.jobs} job{gap.jobs === 1 ? "" : "s"}
                      {gap.required > 0 && (
                        <span style={{ color: "var(--serious)" }}> · {gap.required} essential</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="How proficiency is used">
            <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
              Proficiency is your own honest self-rating; it feeds the candidate description given to the AI and
              orders the skills line on a generated CV. It is deliberately separate from{" "}
              <em>evidence</em>: claiming Stata at 5/5 with no entry demonstrating it will still show up as a gap,
              because a hiring manager reads bullets, not a skills list.
            </p>
          </Panel>

          <Panel title="Kinds">
            <ul className="flex flex-col gap-1.5 text-[12px] text-[var(--ink-2)]">
              {SKILL_KINDS.map((k) => (
                <li key={k} className="flex justify-between gap-3">
                  <span>{SKILL_KIND_LABELS[k as SkillKind]}</span>
                  <span className="tnum text-[var(--muted)]">
                    {skills.filter((s) => s.kind === k && s.proficiency > 0).length}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
