import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel, PageHeader, LinkButton, Badge, Tag, EmptyState, StatTile, Dot } from "@/components/ui";
import { IconPlus, IconSparkle, IconLayers, IconAlert } from "@/components/icons";
import { ATOM_CATEGORIES, ATOM_CATEGORY_LABELS, type AtomCategory } from "@/lib/constants";
import { dateRange, truncate } from "@/lib/utils";

export default async function ExperiencePage() {
  const [atoms, skillsClaimed, domainCount] = await Promise.all([
    prisma.experienceAtom.findMany({
      orderBy: [{ isHeadline: "desc" }, { impactScore: "desc" }, { startDate: "desc" }],
      include: {
        bullets: true,
        skills: { include: { skill: true } },
        domains: true,
        competencies: true,
      },
    }),
    prisma.skill.count({ where: { proficiency: { gt: 0 } } }),
    prisma.domain.count(),
  ]);

  const active = atoms.filter((a) => !a.archived);
  const withMetric = active.filter((a) => a.metric.trim());
  const withStar = active.filter((a) => a.starAction.trim() && a.starResult.trim());
  const untagged = active.filter((a) => a.skills.length === 0);

  const byCategory = ATOM_CATEGORIES.map((category) => ({
    category,
    items: active.filter((a) => a.category === category),
  })).filter((g) => g.items.length > 0);

  const archived = atoms.filter((a) => a.archived);

  return (
    <>
      <PageHeader
        title="Experience bank"
        description="The source of truth. Every CV bullet, cover-letter line and interview answer is a projection of what is stored here — write a fact once, reuse it in three registers."
        actions={
          <>
            <LinkButton href="/experience/skills">Skills</LinkButton>
            <LinkButton href="/experience/import">
              <IconSparkle size={14} /> Import from CV
            </LinkButton>
            <LinkButton href="/experience/new" variant="primary">
              <IconPlus size={14} /> Add entry
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Entries" value={active.length} sub={archived.length ? `${archived.length} archived` : "all active"} />
        <StatTile
          label="With a metric"
          value={`${withMetric.length}/${active.length}`}
          sub="numbers are the biggest differentiator"
          tone={active.length && withMetric.length / active.length < 0.5 ? "warning" : undefined}
        />
        <StatTile
          label="STAR-ready"
          value={`${withStar.length}/${active.length}`}
          sub="usable in interviews as-is"
          tone={active.length && withStar.length < 4 ? "warning" : undefined}
        />
        <StatTile label="Skills claimed" value={skillsClaimed} sub={`across ${domainCount} policy domains`} href="/experience/skills" />
      </div>

      {untagged.length > 0 && (
        <Panel className="mb-4 border-[color-mix(in_srgb,var(--warning)_35%,transparent)]">
          <div className="flex items-start gap-3">
            <IconAlert size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div>
              <p className="text-[13px] font-medium">
                {untagged.length} entr{untagged.length === 1 ? "y has" : "ies have"} no skills tagged
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
                Untagged entries are invisible to match scoring and never get selected during tailoring. Tag them and
                they start working:{" "}
                {untagged.slice(0, 3).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <Link href={`/experience/${a.id}`} className="underline hover:text-[var(--ink)]">
                      {truncate(a.title, 40)}
                    </Link>
                  </span>
                ))}
                {untagged.length > 3 && ` and ${untagged.length - 3} more`}.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {active.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconLayers size={28} />}
            title="Nothing in the bank yet"
            detail="Paste an existing CV and it will be broken into taggable entries automatically, or add your first entry by hand."
            action={
              <div className="flex gap-2">
                <LinkButton href="/experience/import" variant="primary">
                  <IconSparkle size={14} /> Import from CV
                </LinkButton>
                <LinkButton href="/experience/new">Add by hand</LinkButton>
              </div>
            }
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {byCategory.map((group) => (
            <Panel
              key={group.category}
              title={ATOM_CATEGORY_LABELS[group.category as AtomCategory]}
              subtitle={`${group.items.length} entr${group.items.length === 1 ? "y" : "ies"}`}
              padded={false}
            >
              <ul className="divide-y divide-[var(--line)]">
                {group.items.map((atom) => {
                  const cvBullets = atom.bullets.filter((b) => b.register === "CV");
                  const registers = new Set(atom.bullets.map((b) => b.register));
                  return (
                    <li key={atom.id} className="hover-row px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {atom.isHeadline && <Badge tone="accent">Headline</Badge>}
                            <Link href={`/experience/${atom.id}`} className="text-[13px] font-medium hover:underline">
                              {atom.title}
                            </Link>
                          </div>

                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {[atom.role, atom.organisation].filter(Boolean).join(" · ")}
                            {atom.startDate && ` · ${dateRange(atom.startDate, atom.endDate, atom.ongoing)}`}
                          </p>

                          {cvBullets[0] && (
                            <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-2)]">
                              {truncate(cvBullets[0].text, 165)}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {atom.metric ? (
                              <Badge tone="good">{truncate(atom.metric, 40)}</Badge>
                            ) : (
                              <Badge tone="warning">No metric</Badge>
                            )}
                            {atom.skills.slice(0, 5).map((s) => (
                              <Tag key={s.skillId}>{s.skill.name}</Tag>
                            ))}
                            {atom.skills.length > 5 && (
                              <span className="text-[11px] text-[var(--muted)]">+{atom.skills.length - 5}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5 text-[11px] text-[var(--muted)]">
                          <span className="flex items-center gap-1" title={`Impact weighting ${atom.impactScore}/5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span
                                key={n}
                                className="block size-1.5 rounded-full"
                                style={{ background: n <= atom.impactScore ? "var(--accent)" : "var(--line)" }}
                              />
                            ))}
                          </span>
                          <span title="Phrasings stored across registers">
                            {atom.bullets.length} phrasing{atom.bullets.length === 1 ? "" : "s"}
                          </span>
                          {registers.has("INTERVIEW") && (
                            <span className="flex items-center gap-1">
                              <Dot tone="good" /> spoken
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}

          {archived.length > 0 && (
            <Panel title="Archived" subtitle="Excluded from tailoring and scoring, kept for reference." padded={false}>
              <ul className="divide-y divide-[var(--line)]">
                {archived.map((atom) => (
                  <li key={atom.id} className="hover-row flex items-center justify-between gap-4 px-4 py-2.5">
                    <Link href={`/experience/${atom.id}`} className="text-[13px] text-[var(--muted)] hover:underline">
                      {atom.title}
                    </Link>
                    <span className="text-[11px] text-[var(--muted)]">{atom.organisation}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
