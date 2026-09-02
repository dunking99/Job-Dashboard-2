import { PageHeader, Panel } from "@/components/ui";
import { CvImporter } from "@/components/CvImporter";
import { importFromCv } from "@/app/actions/experience";
import { aiMode } from "@/lib/ai/client";

export default async function ImportPage() {
  async function run(formData: FormData) {
    "use server";
    return importFromCv(formData);
  }

  return (
    <>
      <PageHeader
        title="Import from a CV"
        description="Paste an existing CV, a LinkedIn profile, or just a rough list of everything you have done. It gets split into separate entries, tagged against skills, domains and competencies, and dropped into the bank."
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <CvImporter action={run} mode={aiMode()} />

        <div className="flex flex-col gap-4">
          <Panel title="What this does">
            <ol className="flex flex-col gap-2.5 text-[12px] text-[var(--ink-2)]">
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--accent)]">1</span>
                Splits the text into discrete entries — one per job, project, module or society role.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--accent)]">2</span>
                Pulls out any quantified results already present, and lists the entries that need a number you
                have not supplied.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--accent)]">3</span>
                Tags each entry against the skill, domain and competency vocabularies so match scoring works
                immediately.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[var(--accent)]">4</span>
                Fills in blank profile fields — name, contact details, degree. Anything you have already written
                is left alone.
              </li>
            </ol>
          </Panel>

          <Panel title="It will not invent anything">
            <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
              Metrics, dates and employers are only ever transcribed, never generated. If your CV says
              &ldquo;helped with research&rdquo;, the entry keeps that vagueness and gets flagged as needing a
              number — rather than being quietly upgraded into a claim you would have to defend in an interview.
            </p>
          </Panel>

          <Panel title="Getting the most out of it">
            <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
              Paste more than your CV. Modules, half-finished projects, things you dropped, part-time work you
              left off for space — the bank is not a document, so there is no length limit and nothing here is
              shown to an employer. The more raw material it holds, the better tailoring gets, because there is
              more to select from.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
