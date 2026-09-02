"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAi, extractJson } from "@/lib/ai/client";
import {
  questionsPrompt, questionsSchema,
  answerFeedbackPrompt, answerFeedbackSchema,
} from "@/lib/ai/prompts";
import { toJson, parseJson, wordCount } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Interview events
// ---------------------------------------------------------------------------

export async function saveInterview(interviewId: string | null, formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  if (!jobId || !scheduledAt) return { error: "Pick a job and a date." };

  const data = {
    jobId,
    kind: String(formData.get("kind") ?? "SCREENING"),
    scheduledAt: new Date(scheduledAt),
    durationMins: Number(formData.get("durationMins")) || 45,
    format: String(formData.get("format") ?? "VIDEO"),
    locationOrLink: String(formData.get("locationOrLink") ?? "").trim(),
    prepStatus: String(formData.get("prepStatus") ?? "NOT_STARTED"),
    prepNotes: String(formData.get("prepNotes") ?? ""),
    debrief: String(formData.get("debrief") ?? ""),
    outcome: String(formData.get("outcome") ?? ""),
  };

  if (interviewId) {
    await prisma.interviewEvent.update({ where: { id: interviewId }, data });
  } else {
    await prisma.interviewEvent.create({ data });
    // Booking an interview is a stage change; move the job unless it is
    // already further along.
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (job && ["SAVED", "TAILORING", "APPLIED", "SCREENING"].includes(job.status)) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "INTERVIEW", stageChangedAt: new Date() },
      });
    }
  }

  revalidatePath("/interview");
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteInterview(interviewId: string) {
  await prisma.interviewEvent.delete({ where: { id: interviewId } });
  revalidatePath("/interview");
  revalidatePath("/");
  return { ok: true };
}

export async function setPrepStatus(interviewId: string, prepStatus: string) {
  await prisma.interviewEvent.update({ where: { id: interviewId }, data: { prepStatus } });
  revalidatePath("/interview");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Predicted questions
// ---------------------------------------------------------------------------

export async function generateQuestions(jobId: string, interviewKind = "SCREENING", count = 10) {
  const [job, atoms, competencies] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.experienceAtom.findMany({
      where: { archived: false },
      include: { competencies: true },
    }),
    prisma.competency.findMany(),
  ]);
  if (!job) return { error: "Job not found." };

  const prompt = questionsPrompt({
    title: job.title,
    company: job.companyName,
    description: job.rawDescription,
    interviewKind,
    atoms: atoms.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      competencies: a.competencies.map((c) => c.name),
    })),
    competencies: competencies.map((c) => c.name),
    count,
  });

  const result = await runAi({
    kind: "QUESTIONS",
    system: prompt.system,
    user: prompt.user,
    jobId,
    maxTokens: 6000,
    targetType: "job",
    targetId: jobId,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyQuestions(jobId, result.text);
  }

  revalidatePath("/interview");
  return result;
}

export async function applyQuestions(jobId: string, responseText: string) {
  const parsed = questionsSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the questions JSON from that response." };

  const [competencies, atoms] = await Promise.all([
    prisma.competency.findMany(),
    prisma.experienceAtom.findMany({ select: { id: true } }),
  ]);
  const validAtomIds = new Set(atoms.map((a) => a.id));

  let created = 0;
  for (const q of parsed.data.questions) {
    if (!q.text?.trim()) continue;
    const competency = competencies.find(
      (c) => c.name.toLowerCase() === q.competency.toLowerCase().trim()
    );

    await prisma.predictedQuestion.create({
      data: {
        jobId,
        text: q.text.trim(),
        kind: ["BEHAVIOURAL", "TECHNICAL", "MOTIVATIONAL", "CASE", "POLICY", "COMPETENCY"].includes(q.kind)
          ? q.kind
          : "BEHAVIOURAL",
        competencyId: competency?.id ?? null,
        // Drop any suggested id that is not a real atom.
        suggestedAtomIds: toJson(q.suggestedAtomIds.filter((id) => validAtomIds.has(id))),
        rationale: q.rationale,
        difficulty: Math.min(5, Math.max(1, Math.round(q.difficulty))),
      },
    });
    created++;
  }

  revalidatePath("/interview");
  return { ok: true, count: created };
}

export async function deleteQuestion(questionId: string) {
  await prisma.predictedQuestion.delete({ where: { id: questionId } });
  revalidatePath("/interview");
  return { ok: true };
}

export async function addQuestion(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Question text required." };

  await prisma.predictedQuestion.create({
    data: {
      text,
      kind: String(formData.get("kind") ?? "BEHAVIOURAL"),
      jobId: String(formData.get("jobId") ?? "").trim() || null,
      competencyId: String(formData.get("competencyId") ?? "").trim() || null,
      isCore: formData.get("isCore") === "on",
    },
  });

  revalidatePath("/interview");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

/**
 * Structural analysis that needs no AI: does the answer have the STAR parts,
 * a number, and a sane length? This runs first so practice is useful offline
 * and so the AI is not asked to count words.
 */
export function analyseAnswerStructure(answer: string) {
  const lower = answer.toLowerCase();
  const words = wordCount(answer);

  const hasResult = /\b(result|outcome|led to|meant that|as a result|which (?:cut|reduced|increased|raised|saved)|ended up)\b/.test(lower);
  const hasAction = /\b(i |we )(?:built|ran|wrote|set up|organised|analysed|designed|led|coded|created|introduced|rebuilt|coordinated)/.test(lower);
  const hasSituation = /\b(the (?:problem|issue|situation|challenge|backlog|team|office)|at the time|when i|during my)\b/.test(lower);
  const hasTask = /\b(i was (?:asked|responsible|tasked)|my (?:job|role|responsibility)|needed to|had to)\b/.test(lower);
  const hasNumber = /\d|£|%/.test(answer);
  const fillers = (lower.match(/\b(basically|obviously|kind of|sort of|you know|like,|literally|just)\b/g) ?? []).length;

  return {
    words,
    hasSituation, hasTask, hasAction, hasResult, hasNumber,
    fillers,
    lengthVerdict:
      words < 90 ? "short" : words > 380 ? "long" : "about right",
  };
}

export async function savePracticeAnswer(questionId: string, answerText: string, withAi: boolean) {
  const text = answerText.trim();
  if (!text) return { error: "Write an answer first." };

  const structure = analyseAnswerStructure(text);

  const answer = await prisma.practiceAnswer.create({
    data: { questionId, answerText: text, analysis: toJson(structure) },
  });

  if (!withAi) {
    revalidatePath("/interview");
    return { ok: true, answerId: answer.id, structure };
  }

  const question = await prisma.predictedQuestion.findUnique({
    where: { id: questionId },
    include: { competency: true, job: { select: { title: true, companyName: true } } },
  });

  const prompt = answerFeedbackPrompt({
    question: question?.text ?? "",
    answer: text,
    competency: question?.competency?.name ?? "",
    roleContext: question?.job ? `${question.job.title} at ${question.job.companyName}` : "",
  });

  const result = await runAi({
    kind: "ANSWER_FEEDBACK",
    system: prompt.system,
    user: prompt.user,
    targetType: "answer",
    targetId: answer.id,
  });

  if (result.status === "COMPLETE" && result.text) {
    await applyAnswerFeedback(answer.id, result.text);
  }

  revalidatePath("/interview");
  return { ...result, answerId: answer.id, structure };
}

export async function applyAnswerFeedback(answerId: string, responseText: string) {
  const parsed = answerFeedbackSchema.safeParse(extractJson(responseText));
  if (!parsed.success) return { error: "Could not read the feedback JSON from that response." };

  const answer = await prisma.practiceAnswer.findUnique({ where: { id: answerId } });
  if (!answer) return { error: "Answer not found." };

  const existing = parseJson<Record<string, unknown>>(answer.analysis, {});

  await prisma.practiceAnswer.update({
    where: { id: answerId },
    data: {
      score: Math.min(100, Math.max(0, Math.round(parsed.data.score))),
      feedback: toJson({
        strengths: parsed.data.strengths,
        problems: parsed.data.problems,
        rewrite: parsed.data.rewrite,
        followUp: parsed.data.followUp,
        starCoverage: parsed.data.starCoverage,
      }),
      analysis: toJson({ ...existing, aiStar: parsed.data.starCoverage }),
    },
  });

  revalidatePath("/interview");
  return { ok: true };
}

export async function deletePracticeAnswer(answerId: string) {
  await prisma.practiceAnswer.delete({ where: { id: answerId } });
  revalidatePath("/interview");
  return { ok: true };
}
