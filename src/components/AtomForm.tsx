"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Labelled, Button, Tag, Badge } from "./ui";
import { IconTrash, IconAlert } from "./icons";
import { ATOM_CATEGORIES, ATOM_CATEGORY_LABELS, type AtomCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface AtomFormData {
  id: string;
  title: string;
  category: string;
  organisation: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  ongoing: boolean;
  summary: string;
  metric: string;
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  impactScore: number;
  isHeadline: boolean;
  skillIds: { id: string; weight: number }[];
  domainIds: string[];
  competencyIds: string[];
}

export function AtomForm({
  atom,
  skills,
  domains,
  competencies,
  action,
  onDelete,
}: {
  atom: AtomFormData | null;
  skills: { id: string; name: string; kind: string }[];
  domains: { id: string; name: string }[];
  competencies: { id: string; name: string; framework: string }[];
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  onDelete?: () => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedSkills, setSelectedSkills] = useState<Map<string, number>>(
    new Map(atom?.skillIds.map((s) => [s.id, s.weight]) ?? [])
  );
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set(atom?.domainIds ?? []));
  const [selectedComps, setSelectedComps] = useState<Set<string>>(new Set(atom?.competencyIds ?? []));
  const [skillQuery, setSkillQuery] = useState("");
  const [ongoing, setOngoing] = useState(atom?.ongoing ?? false);

  const filteredSkills = skills.filter(
    (s) => !selectedSkills.has(s.id) && s.name.toLowerCase().includes(skillQuery.toLowerCase())
  );

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    for (const [id, weight] of selectedSkills) {
      formData.append("skillIds", id);
      formData.set(`weight_${id}`, String(weight));
    }
    for (const id of selectedDomains) formData.append("domainIds", id);
    for (const id of selectedComps) formData.append("competencyIds", id);

    const result = await action(formData);
    setSaving(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title="What this is">
            <div className="flex flex-col gap-3">
              <Labelled label="Title" hint="A short internal label — not CV prose.">
                <input
                  name="title"
                  defaultValue={atom?.title}
                  required
                  className="field"
                  placeholder="Dissertation — regional inflation and voting"
                />
              </Labelled>

              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Category">
                  <select name="category" defaultValue={atom?.category ?? "WORK"} className="field">
                    {ATOM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {ATOM_CATEGORY_LABELS[c as AtomCategory]}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label="Your role">
                  <input name="role" defaultValue={atom?.role} className="field" placeholder="Research Intern" />
                </Labelled>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Organisation">
                  <input name="organisation" defaultValue={atom?.organisation} className="field" />
                </Labelled>
                <Labelled label="Location">
                  <input name="location" defaultValue={atom?.location} className="field" placeholder="London" />
                </Labelled>
              </div>

              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Labelled label="Start">
                  <input type="month" name="startDate" defaultValue={atom?.startDate} className="field" />
                </Labelled>
                <Labelled label="End">
                  <input
                    type="month"
                    name="endDate"
                    defaultValue={atom?.endDate}
                    disabled={ongoing}
                    className={cn("field", ongoing && "opacity-40")}
                  />
                </Labelled>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-[12px]">
                  <input
                    type="checkbox"
                    name="ongoing"
                    defaultChecked={atom?.ongoing}
                    onChange={(e) => setOngoing(e.target.checked)}
                    className="size-3.5 accent-[var(--accent)]"
                  />
                  Ongoing
                </label>
              </div>

              <Labelled
                label="Context"
                hint="What actually happened, in plain prose. Raw material for later phrasing — not a finished bullet."
              >
                <textarea name="summary" defaultValue={atom?.summary} rows={4} className="field" />
              </Labelled>

                            <Labelled
                label="Quantified result"
                hint="The number behind it. Leave empty rather than inventing one — an empty metric is honest, a fabricated one is a liability."
              >
                <input
                  name="metric"
                  defaultValue={atom?.metric}
                  className="field"
                  placeholder="Cleared 120+ cases in 10 weeks"
                />
              </Labelled>
            </div>
          </Panel>

          <Panel
            title="STAR expansion"
            subtitle="Fill this in and the entry becomes usable in interviews as-is, with no separate story bank to maintain."
          >
            <div className="flex flex-col gap-3">
              <Labelled label="Situation">
                <textarea name="starSituation" defaultValue={atom?.starSituation} rows={2} className="field" />
              </Labelled>
              <Labelled label="Task">
                <textarea name="starTask" defaultValue={atom?.starTask} rows={2} className="field" />
              </Labelled>
              <Labelled label="Action">
                <textarea name="starAction" defaultValue={atom?.starAction} rows={3} className="field" />
              </Labelled>
              <Labelled label="Result">
                <textarea name="starResult" defaultValue={atom?.starResult} rows={2} className="field" />
              </Labelled>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Weighting">
            <div className="flex flex-col gap-3">
              <Labelled label="Impact" hint="Your own view of how strong this evidence is. Drives ranking during tailoring.">
                <input
                  type="range"
                  name="impactScore"
                  min={1}
                  max={5}
                  defaultValue={atom?.impactScore ?? 3}
                  className="w-full accent-[var(--accent)]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
                  <span>filler</span>
                  <span>flagship</span>
                </div>
              </Labelled>

              <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                <input
                  type="checkbox"
                  name="isHeadline"
                  defaultChecked={atom?.isHeadline}
                  className="mt-0.5 size-3.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-medium">Headline story</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                    One of the two or three you would tell in any interview.
                  </span>
                </span>
              </label>
            </div>
          </Panel>

          <Panel
            title="Skills evidenced"
            subtitle="Only tagged skills count towards match scores. An untagged entry is invisible to the engine."
          >
            {selectedSkills.size > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {[...selectedSkills.entries()].map(([id, weight]) => {
                  const skill = skills.find((s) => s.id === id);
                  if (!skill) return null;
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px]">{skill.name}</span>
                      <select
                        value={weight}
                        onChange={(e) => {
                          const next = new Map(selectedSkills);
                          next.set(id, Number(e.target.value));
                          setSelectedSkills(next);
                        }}
                        className="field w-[104px] py-0.5 text-[11px]"
                      >
                        <option value={1}>mentioned</option>
                        <option value={2}>used</option>
                        <option value={3}>central</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Map(selectedSkills);
                          next.delete(id);
                          setSelectedSkills(next);
                        }}
                        className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                        aria-label={`Remove ${skill.name}`}
                      >
                        <IconTrash size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <input
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder="Search skills to add…"
              className="field"
            />
            {skillQuery && (
              <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-[var(--line)]">
                {filteredSkills.slice(0, 30).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Map(selectedSkills);
                        next.set(s.id, 2);
                        setSelectedSkills(next);
                        setSkillQuery("");
                      }}
                      className="hover-row flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px]"
                    >
                      {s.name}
                      <span className="text-[10px] text-[var(--muted)]">{s.kind.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
                {filteredSkills.length === 0 && (
                  <li className="px-2.5 py-2 text-[11px] text-[var(--muted)]">
                    No match. Add it on the Skills page first.
                  </li>
                )}
              </ul>
            )}
          </Panel>

          <Panel title="Policy domains">
            <div className="flex flex-wrap gap-1.5">
              {domains.map((d) => {
                const on = selectedDomains.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedDomains);
                      on ? next.delete(d.id) : next.add(d.id);
                      setSelectedDomains(next);
                    }}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"
                    )}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Competencies" subtitle="Used to map this story to likely interview questions.">
            <div className="flex flex-wrap gap-1.5">
              {competencies.map((c) => {
                const on = selectedComps.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedComps);
                      on ? next.delete(c.id) : next.add(c.id);
                      setSelectedComps(next);
                    }}
                    title={c.framework === "CIVIL_SERVICE" ? "Civil Service Success Profiles" : "General"}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--line-strong)]"
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--critical)" }}>
          <IconAlert size={13} /> {error}
        </p>
      )}

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface)] py-3">
        <div className="flex items-center gap-2">
          {selectedSkills.size === 0 && (
            <Badge tone="warning">No skills tagged — this entry will not be scored</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button
              variant="danger"
              type="button"
              onClick={async () => {
                if (window.confirm("Delete this entry permanently? Archiving keeps it out of tailoring without losing it.")) {
                  await onDelete();
                }
              }}
            >
              <IconTrash size={13} /> Delete
            </Button>
          )}
          <Button type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : atom ? "Save changes" : "Create entry"}
          </Button>
        </div>
      </div>
    </form>
  );
}
