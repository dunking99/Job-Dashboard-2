"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./Modal";
import { Button, buttonClass } from "./ui";
import { IconSparkle, IconCopy, IconCheck, IconAlert } from "./icons";
import { submitBridgeResponse } from "@/app/actions/ai";
import { cn } from "@/lib/utils";

// One button, two modes.
//
// With an API key the click just runs the action. Without one, the same click
// returns a prepared prompt and this opens the bridge dialog: copy out, paste
// back. The caller does not branch on mode — it passes a server action and this
// handles whichever shape comes back.

export interface AiActionResult {
  callId?: string;
  mode?: "API" | "BRIDGE";
  status?: "COMPLETE" | "PENDING" | "FAILED";
  bridgePrompt?: string;
  error?: string;
  applied?: { ok?: boolean; error?: string; created?: number };
}

export function AiAction({
  action,
  label,
  runningLabel = "Working…",
  bridgeTitle = "Run this in Claude",
  bridgeHint,
  variant = "default",
  size = "md",
  icon = true,
  className,
  disabled,
  confirm,
}: {
  action: () => Promise<AiActionResult | { error: string } | { ok: boolean } | void>;
  label: string;
  runningLabel?: string;
  bridgeTitle?: string;
  bridgeHint?: string;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: boolean;
  className?: string;
  disabled?: boolean;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [bridge, setBridge] = useState<{ callId: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    setDone(false);

    start(async () => {
      const result = (await action()) as AiActionResult | undefined;

      if (!result) {
        router.refresh();
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status === "FAILED") {
        setError(result.error ?? "The AI request failed.");
        return;
      }
      if (result.mode === "BRIDGE" && result.bridgePrompt && result.callId) {
        setBridge({ callId: result.callId, prompt: result.bridgePrompt });
        return;
      }
      setDone(true);
      router.refresh();
      window.setTimeout(() => setDone(false), 2200);
    });
  }

  return (
    <>
      <button
        onClick={run}
        disabled={pending || disabled}
        className={cn(buttonClass(variant, size), className)}
        title={bridgeHint}
      >
        {icon &&
          (done ? (
            <IconCheck size={size === "sm" ? 12 : 14} style={{ color: "var(--good)" }} />
          ) : (
            <IconSparkle size={size === "sm" ? 12 : 14} className={pending ? "pulse-soft" : undefined} />
          ))}
        {pending ? runningLabel : done ? "Done" : label}
      </button>

      {error && (
        <span className="ml-2 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--critical)" }}>
          <IconAlert size={12} /> {error}
        </span>
      )}

      {bridge && (
        <BridgeDialog
          callId={bridge.callId}
          prompt={bridge.prompt}
          title={bridgeTitle}
          onClose={() => setBridge(null)}
          onApplied={() => {
            setBridge(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

export function BridgeDialog({
  callId,
  prompt,
  title,
  onClose,
  onApplied,
}: {
  callId: string;
  prompt: string;
  title: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [response, setResponse] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard blocked — select the prompt text and copy manually.");
    }
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await submitBridgeResponse(callId, response);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onApplied();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle="No API key is set, so this runs through your Claude subscription instead. Copy the prompt, paste Claude's reply back below."
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={pending || !response.trim()}>
            {pending ? "Applying…" : "Apply response"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              1 · Copy this into Claude
            </span>
            <button onClick={copy} className={buttonClass("default", "sm")}>
              {copied ? <IconCheck size={12} style={{ color: "var(--good)" }} /> : <IconCopy size={12} />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <pre className="max-h-52 overflow-auto rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
            {prompt}
          </pre>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            2 · Paste Claude&rsquo;s reply here
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={9}
            placeholder="Paste the whole reply — surrounding prose and code fences are handled."
            className="field font-mono text-[11px] leading-relaxed"
            autoFocus
          />
          {error && (
            <p className="mt-1.5 flex items-start gap-1 text-[11px]" style={{ color: "var(--critical)" }}>
              <IconAlert size={12} className="mt-px shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
