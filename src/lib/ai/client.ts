import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import type { AiKind } from "../constants";

// The AI adapter.
//
// Two modes, one code path:
//
//   API mode    — ANTHROPIC_API_KEY is set. Actions run in one click.
//   BRIDGE mode — no key. The same prompt is stored and shown for you to paste
//                 into Claude; you paste the reply back and it lands in exactly
//                 the same place the API response would have.
//
// Bridge mode is not a degraded fallback bolted on afterwards — it is why every
// AI result is persisted as an AiCall row with a target, rather than being
// streamed straight into a component. Both modes write back identically.

export type AiMode = "API" | "BRIDGE";

export function aiMode(): AiMode {
  return process.env.ANTHROPIC_API_KEY ? "API" : "BRIDGE";
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

export interface AiRequest {
  kind: AiKind;
  system: string;
  user: string;
  jobId?: string | null;
  targetType?: string;
  targetId?: string;
  maxTokens?: number;
}

export interface AiResult {
  callId: string;
  mode: AiMode;
  status: "COMPLETE" | "PENDING" | "FAILED";
  /** Present when status is COMPLETE. */
  text?: string;
  /** Present in bridge mode — the prompt to paste into Claude. */
  bridgePrompt?: string;
  error?: string;
}

export async function runAi(req: AiRequest): Promise<AiResult> {
  const mode = aiMode();

  const call = await prisma.aiCall.create({
    data: {
      kind: req.kind,
      mode,
      status: "PENDING",
      model: mode === "API" ? aiModel() : "",
      systemPrompt: req.system,
      userPrompt: req.user,
      jobId: req.jobId ?? null,
      targetType: req.targetType ?? "",
      targetId: req.targetId ?? "",
    },
  });

  if (mode === "BRIDGE") {
    return {
      callId: call.id,
      mode,
      status: "PENDING",
      bridgePrompt: buildBridgePrompt(req.system, req.user),
    };
  }

  const started = Date.now();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await client.messages.create({
      model: aiModel(),
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    await prisma.aiCall.update({
      where: { id: call.id },
      data: {
        status: "COMPLETE",
        responseText: text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      },
    });

    return { callId: call.id, mode, status: "COMPLETE", text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiCall.update({
      where: { id: call.id },
      data: { status: "FAILED", errorText: message, durationMs: Date.now() - started },
    });
    return { callId: call.id, mode, status: "FAILED", error: message };
  }
}

/** Bridge mode: a single self-contained block to paste into a Claude chat. */
export function buildBridgePrompt(system: string, user: string): string {
  return `${system}\n\n---\n\n${user}\n\n---\nReply with the requested JSON only. No preamble, no explanation, no code fence commentary.`;
}

/** Write a pasted bridge response back into its AiCall row. */
export async function completeBridgeCall(callId: string, responseText: string) {
  return prisma.aiCall.update({
    where: { id: callId },
    data: {
      status: "COMPLETE",
      responseText,
      completedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

/**
 * Pull a JSON object or array out of a model response.
 *
 * Handles the three things that actually happen in practice: a bare JSON body,
 * a fenced ```json block, and JSON preceded by a sentence of preamble. Falls
 * back to brace matching so a trailing "Hope this helps!" doesn't break it.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw?.trim()) return null;

  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  candidates.push(raw);

  for (const candidate of candidates) {
    const direct = tryParse<T>(candidate.trim());
    if (direct !== null) return direct;

    const sliced = sliceBalanced(candidate);
    if (sliced) {
      const parsed = tryParse<T>(sliced);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Find the first balanced {...} or [...] region, ignoring braces in strings. */
function sliceBalanced(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
