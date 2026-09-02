"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function completeTask(taskId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { done: true, doneAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function createTask(input: {
  title: string;
  detail?: string;
  kind?: string;
  dueAt?: string | null;
  jobId?: string | null;
  contactId?: string | null;
}) {
  if (!input.title.trim()) return { error: "A task needs a title." };

  await prisma.task.create({
    data: {
      title: input.title.trim(),
      detail: input.detail ?? "",
      kind: input.kind ?? "GENERAL",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      jobId: input.jobId || null,
      contactId: input.contactId || null,
    },
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/");
  return { ok: true };
}
