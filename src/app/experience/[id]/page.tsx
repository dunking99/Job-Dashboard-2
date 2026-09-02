import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, Badge } from "@/components/ui";
import { AtomForm, type AtomFormData } from "@/components/AtomForm";
import { BulletEditor } from "@/components/BulletEditor";
import { AiAction } from "@/components/AiAction";
import { saveAtom, deleteAtom, toggleAtomArchived, generateBulletVariants } from "@/app/actions/experience";

function toMonthInput(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [atom, skills, domains, competencies] = await Promise.all([
    prisma.experienceAtom.findUnique({
      where: { id },
      include: {
        bullets: { orderBy: [{ register: "asc" }, { createdAt: "asc" }] },
        skills: true,
        domains: true,
        competencies: true,
      },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.domain.findMany({ orderBy: { name: "asc" } }),
    prisma.competency.findMany({ orderBy: [{ framework: "asc" }, { name: "asc" }] }),
  ]);

  if (!atom) notFound();

  const formData: AtomFormData = {
    id: atom.id,
    title: atom.title,
    category: atom.category,
    organisation: atom.organisation,
    role: atom.role,
    location: atom.location,
    startDate: toMonthInput(atom.startDate),
    endDate: toMonthInput(atom.endDate),
    ongoing: atom.ongoing,
    summary: atom.summary,
    metric: atom.metric,
    starSituation: atom.starSituation,
    starTask: atom.starTask,
    starAction: atom.starAction,
    starResult: atom.starResult,
    impactScore: atom.impactScore,
    isHeadline: atom.isHeadline,
    skillIds: atom.skills.map((s) => ({ id: s.skillId, weight: s.weight })),
    domainIds: atom.domains.map((d) => d.id),
    competencyIds: atom.competencies.map((c) => c.id),
  };

  async function save(fd: FormData) {
    "use server";
    return saveAtom(id, fd);
  }
  async function remove() {
    "use server";
    await deleteAtom(id);
  }
  async function archive() {
    "use server";
    await toggleAtomArchived(id);
  }
  async function generate() {
    "use server";
    return generateBulletVariants(id);
  }

  return (
    <>
      <PageHeader
        title={atom.title}
        description={[atom.role, atom.organisation].filter(Boolean).join(" · ") || undefined}
        actions={
          <form action={archive}>
            <button
              type="submit"
              className="rounded-md border border-[var(--line-strong)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--raised)]"
            >
              {atom.archived ? "Restore to bank" : "Archive"}
            </button>
          </form>
        }
      >
        {atom.archived && (
          <div className="mt-2">
            <Badge tone="warning">Archived — excluded from tailoring and match scoring</Badge>
          </div>
        )}
      </PageHeader>

      <Panel
        className="mb-4"
        title="Phrasings"
        subtitle="The same fact in different registers. Tailoring picks the CV variant; interview prep picks the spoken one."
        action={
          <AiAction
            action={generate}
            label="Generate variants"
            size="sm"
            bridgeTitle="Generate phrasing variants"
          />
        }
        padded={false}
      >
        <BulletEditor atomId={atom.id} bullets={atom.bullets.map((b) => ({
          id: b.id,
          text: b.text,
          register: b.register,
          isPrimary: b.isPrimary,
          aiGenerated: b.aiGenerated,
        }))} />
      </Panel>

      <AtomForm
        atom={formData}
        skills={skills}
        domains={domains}
        competencies={competencies}
        action={save}
        onDelete={remove}
      />
    </>
  );
}
