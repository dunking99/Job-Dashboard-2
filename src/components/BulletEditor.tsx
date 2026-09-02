"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Tag } from "./ui";
import { IconTrash, IconPlus, IconCheck, IconEdit, IconCopy } from "./icons";
import { saveBullet, deleteBullet } from "@/app/actions/experience";
import { BULLET_REGISTERS, BULLET_REGISTER_LABELS, type BulletRegister } from "@/lib/constants";
import { wordCount, cn } from "@/lib/utils";

interface Bullet {
  id: string;
  text: string;
  register: string;
  isPrimary: boolean;
  aiGenerated: boolean;
}

export function BulletEditor({ atomId, bullets }: { atomId: string; bullets: Bullet[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<BulletRegister | null>(null);

  function persist(input: Parameters<typeof saveBullet>[0]) {
    start(async () => {
      await saveBullet(input);
      setEditing(null);
      setAdding(null);
      setDraft("");
      router.refresh();
    });
  }

  return (
    <div className="divide-y divide-[var(--line)]">
      {BULLET_REGISTERS.map((register) => {
        const group = bullets.filter((b) => b.register === register);
        return (
          <div key={register} className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {BULLET_REGISTER_LABELS[register]}
              </span>
              <button
                onClick={() => {
                  setAdding(register);
                  setDraft("");
                  setEditing(null);
                }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
              >
                <IconPlus size={11} /> Add
              </button>
            </div>

            {group.length === 0 && adding !== register && (
              <p className="text-[11px] text-[var(--muted)]">
                {register === "CV"
                  ? "No CV bullet yet — tailoring falls back to the raw context, which reads poorly."
                  : "Nothing stored for this register."}
              </p>
            )}

            <ul className="flex flex-col gap-1.5">
              {group.map((bullet) => (
                <li key={bullet.id}>
                  {editing === bullet.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        className="field text-[12px]"
                        autoFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--muted)]">{wordCount(draft)} words</span>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              persist({
                                bulletId: bullet.id,
                                atomId,
                                text: draft,
                                register,
                                isPrimary: bullet.isPrimary,
                              })
                            }
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "group flex items-start gap-2 rounded-md border px-2.5 py-2 transition-colors",
                        bullet.isPrimary
                          ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)] hover:border-[var(--line-strong)]"
                      )}
                    >
                      <button
                        onClick={() =>
                          persist({
                            bulletId: bullet.id,
                            atomId,
                            text: bullet.text,
                            register,
                            isPrimary: !bullet.isPrimary,
                          })
                        }
                        title={bullet.isPrimary ? "Primary for this register" : "Make primary"}
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                          bullet.isPrimary
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--line-strong)] text-transparent hover:border-[var(--accent)]"
                        )}
                      >
                        <IconCheck size={9} />
                      </button>

                      <p className="min-w-0 flex-1 text-[12px] leading-snug">{bullet.text}</p>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="mr-1 text-[10px] text-[var(--muted)]">{wordCount(bullet.text)}w</span>
                        {bullet.aiGenerated && <Tag>ai</Tag>}
                        <button
                          onClick={() => navigator.clipboard?.writeText(bullet.text)}
                          className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                          title="Copy"
                        >
                          <IconCopy size={11} />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(bullet.id);
                            setDraft(bullet.text);
                            setAdding(null);
                          }}
                          className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--ink)]"
                          title="Edit"
                        >
                          <IconEdit size={11} />
                        </button>
                        <button
                          onClick={() =>
                            start(async () => {
                              await deleteBullet(bullet.id, atomId);
                              router.refresh();
                            })
                          }
                          className="grid size-5 place-items-center rounded text-[var(--muted)] hover:text-[var(--critical)]"
                          title="Delete"
                        >
                          <IconTrash size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {adding === register && (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={
                    register === "INTERVIEW"
                      ? "How you would actually say this out loud…"
                      : register === "COVER_LETTER"
                        ? "A flowing sentence for prose…"
                        : "Past-tense verb first, include the number…"
                  }
                  className="field text-[12px]"
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--muted)]">{wordCount(draft)} words</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => setAdding(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!draft.trim()}
                      onClick={() =>
                        persist({ atomId, text: draft, register, isPrimary: group.length === 0 })
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
