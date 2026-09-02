import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { AtomForm } from "@/components/AtomForm";
import { saveAtom } from "@/app/actions/experience";

export default async function NewAtomPage() {
  const [skills, domains, competencies] = await Promise.all([
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.domain.findMany({ orderBy: { name: "asc" } }),
    prisma.competency.findMany({ orderBy: [{ framework: "asc" }, { name: "asc" }] }),
  ]);

  async function create(formData: FormData) {
    "use server";
    return saveAtom(null, formData);
  }

  return (
    <>
      <PageHeader
        title="New experience entry"
        description="One coherent piece of experience — a job, a project, a dissertation, a society role. Write the facts once here and every document draws from them."
      />
      <AtomForm atom={null} skills={skills} domains={domains} competencies={competencies} action={create} />
    </>
  );
}
