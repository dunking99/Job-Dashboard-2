"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Tag, Badge } from "./ui";
import { IconPlus, IconTrash } from "./icons";
import { setSkillProficiency, upsertSkill, deleteSkill } from "@/app/actions/experience";
import { SKILL_KINDS, SKILL_KIND_LABELS, type SkillKind } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SkillRow {
  id: string;
  name: string;
  kind: string;
  proficiency: number;
  atomCount: number;
}

export function SkillManager({ claimed, unclaimed }: { claimed: SkillRow[]; unclaimed: SkillRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<SkillKind>("HARD");

  function setLevel(id: string, level: number) {
    start(async () => {
      await setSkillProficiency(id, level);
      router.refresh();
    });
  }

  const filteredUnclaimed = unclaimed.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={`Claimed skills (${claimed.length})`}
        subtitle="Rate honestly — this feeds every AI prompt describing you."
        padded={false}
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          >
            <IconPlus size={12} /> New skill
          </button>
        }
      >
        {adding && (
          <div className="flex items-end gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <label className="flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="field"
                placeholder="Microsimulation modelling"
                autoFocus
              />
            </label>
            <label className="w-40">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Kind</span>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as SkillKind)} className="field">
                {SKILL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SKILL_KIND_LABELS[k as SkillKind]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              disabled={!newName.trim()}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set("name", newName.trim());
                  fd.set("kind", newKind);
                  fd.set("proficiency", "3");
                  await upsertSkill(fd);
                  setNewName("");
                  setAdding(false);
                  router.refresh();
                })
              }
            >
              Add
            </Button>
          </div>
        )}

        {claimed.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">
            Nothing claimed yet. Tag skills on an experience entry and they appear here automatically.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {claimed.map((skill) => (
              <li key={skill.id} className="hover-row flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[12.5px]">{skill.name}</span>
                  <span className="ml-2 text-[10px] text-[var(--muted)]">{skill.kind.toLowerCase()}</span>
                </div>

                {skill.atomCount === 0 ? (
                  <Badge tone="warning">no evidence</Badge>
                ) : (
                  <Tag>
                    {skill.atomCount} entr{skill.atomCount === 1 ? "y" : "ies"}
                  </Tag>
                )}

                <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Proficiency for ${skill.name}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLevel(skill.id, n)}
                      title={`${n}/5`}
                      className={cn(
                        "size-3.5 rounded-full border transition-colors",
                        n <= skill.proficiency
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                      )}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setLevel(skill.id, 0)}
                  title="Unclaim this skill"
                  className="grid size-6 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                >
                  <IconTrash size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Available but not claimed"
        subtitle="Recognised by the job-description parser. Claim one to have it count towards match scores."
        padded={false}
      >
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="field"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 p-4">
          {filteredUnclaimed.slice(0, 80).map((skill) => (
            <button
              key={skill.id}
              onClick={() => setLevel(skill.id, 3)}
              className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
              title="Claim this skill"
            >
              + {skill.name}
            </button>
          ))}
          {filteredUnclaimed.length === 0 && (
            <p className="text-[12px] text-[var(--muted)]">Everything matching is already claimed.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
