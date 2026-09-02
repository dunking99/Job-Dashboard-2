"use client";

import { useTransition } from "react";
import { completeTask } from "@/app/actions/tasks";
import { IconCheck } from "./icons";

export function CompleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => void completeTask(taskId))}
      disabled={pending}
      className="grid size-6 place-items-center rounded border border-[var(--line-strong)] text-[var(--muted)] transition-colors hover:border-[var(--good)] hover:text-[var(--good)] disabled:opacity-40"
      title="Mark done"
      aria-label="Mark task done"
    >
      <IconCheck size={12} />
    </button>
  );
}
