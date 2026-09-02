"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { completeBridgeCall, buildBridgePrompt, aiMode } from "@/lib/ai/client";
import { applyJobAnalysis } from "./jobs";
import { applyCvImport, applyBulletVariants } from "./experience";
import { applyTailoring, applyCoverLetter } from "./documents";
import { applyDossier } from "./crm";
import { applyQuestions, applyAnswerFeedback } from "./interview";

// The paste-back router.
//
// In bridge mode an AI action stores its prompt and returns a call id. When the
// user pastes Claude's reply back, it lands here and is dispatched to exactly
// the same apply* function the API-mode response would have hit. That symmetry
// is the whole point: there is no second, weaker code path for people without
// an API key.

export async function submitBridgeResponse(callId: string, responseText: string) {
  const text = responseText.trim();
  if (!text) return { error: "Paste the response first." };

  const call = await prisma.aiCall.findUnique({ where: { id: callId } });
  if (!call) return { error: "That request is no longer available." };

  await completeBridgeCall(callId, text);

  let outcome: { ok?: boolean; error?: string; created?: number; count?: number } = { ok: true };

  switch (call.kind) {
    case "JOB_ANALYSIS":
      outcome = await applyJobAnalysis(call.targetId, text);
      break;
    case "ATOM_EXTRACT":
      outcome = await applyCvImport(text);
      break;
    case "BULLET_REWRITE":
      outcome = await applyBulletVariants(call.targetId, text);
      break;
    case "CV_TAILOR":
      outcome = await applyTailoring(call.targetId, text);
      break;
    case "COVER_LETTER":
      outcome = await applyCoverLetter(call.targetId, text);
      break;
    case "COMPANY_DOSSIER":
      outcome = await applyDossier(call.targetId, text);
      break;
    case "QUESTIONS":
      outcome = await applyQuestions(call.targetId, text);
      break;
    case "ANSWER_FEEDBACK":
      outcome = await applyAnswerFeedback(call.targetId, text);
      break;
    default:
      outcome = { error: `Nothing knows how to apply a ${call.kind} response.` };
  }

  // A response that could not be applied is a failure, not a success — mark it
  // so the pending badge does not clear on a broken paste.
  if (outcome.error) {
    await prisma.aiCall.update({
      where: { id: callId },
      data: { status: "FAILED", errorText: outcome.error },
    });
  }

  revalidatePath("/settings");
  return outcome;
}

/** Re-read a stored prompt, for the "copy again" case. */
export async function getBridgePrompt(callId: string) {
  const call = await prisma.aiCall.findUnique({ where: { id: callId } });
  if (!call) return { error: "Not found." };
  return { ok: true, prompt: buildBridgePrompt(call.systemPrompt, call.userPrompt), kind: call.kind };
}

export async function dismissAiCall(callId: string) {
  await prisma.aiCall.update({
    where: { id: callId },
    data: { status: "FAILED", errorText: "Dismissed by user" },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function getAiMode() {
  return aiMode();
}

export async function clearAiHistory() {
  await prisma.aiCall.deleteMany({ where: { status: { in: ["COMPLETE", "FAILED"] } } });
  revalidatePath("/settings");
  return { ok: true };
}
