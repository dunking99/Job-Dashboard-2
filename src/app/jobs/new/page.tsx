import { PageHeader, Panel, Labelled, Button } from "@/components/ui";
import { ingestJob } from "@/app/actions/jobs";

export default function NewJobPage() {
  return (
    <>
      <PageHeader
        title="Capture a job"
        description="Paste the full description. Title, employer, salary, work mode and closing date are pulled out automatically where they are stated — correct anything it gets wrong below."
      />

      <form action={ingestJob}>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Job description">
            <Labelled
              label="Paste the full posting"
              hint="Include the person specification — that is where essential requirements live, and the match score depends on reading them."
            >
              <textarea
                name="rawDescription"
                required
                rows={24}
                className="field font-mono text-[11.5px] leading-relaxed"
                placeholder="Paste the whole advert here, including the person specification, salary and closing date…"
              />
            </Labelled>
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title="Details" subtitle="Leave blank to use what is detected in the text.">
              <div className="flex flex-col gap-3">
                <Labelled label="Job title">
                  <input name="title" className="field" placeholder="detected from the text" />
                </Labelled>
                <Labelled label="Employer">
                  <input name="companyName" className="field" placeholder="detected from the text" />
                </Labelled>
                <Labelled label="Location">
                  <input name="location" className="field" placeholder="London (hybrid)" />
                </Labelled>
                <Labelled label="Contract">
                  <input name="contract" className="field" placeholder="Permanent / FTC / Grad scheme" />
                </Labelled>
                <Labelled label="Link to the posting">
                  <input name="url" type="url" className="field" placeholder="https://…" />
                </Labelled>
                <Labelled label="Source" hint="Tracked so you can see which boards actually produce interviews.">
                  <input
                    name="source"
                    className="field"
                    list="sources"
                    placeholder="Civil Service Jobs"
                  />
                  <datalist id="sources">
                    <option value="Civil Service Jobs" />
                    <option value="LinkedIn" />
                    <option value="Indeed" />
                    <option value="W4MP" />
                    <option value="Guardian Jobs" />
                    <option value="Charity Job" />
                    <option value="Direct" />
                    <option value="Referral" />
                  </datalist>
                </Labelled>
                <Labelled label="Closing date" hint="Only needed if it is not stated in the text.">
                  <input name="deadline" type="date" className="field" />
                </Labelled>
              </div>
            </Panel>

            <Panel title="What happens next">
              <ul className="flex flex-col gap-2 text-[12px] text-[var(--ink-2)]">
                <li>Requirements are extracted and marked essential or desirable.</li>
                <li>The posting is scored against your bank across five components.</li>
                <li>Gaps are listed — skills asked for that nothing evidences.</li>
                <li>Red flags and positive signals are detected from the wording.</li>
              </ul>
              <p className="mt-3 text-[11px] text-[var(--muted)]">
                All of that is deterministic and runs immediately. AI enrichment is a separate, optional step on
                the job page.
              </p>
            </Panel>

            <Button type="submit" variant="primary" className="w-full justify-center py-2">
              Capture and analyse
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
