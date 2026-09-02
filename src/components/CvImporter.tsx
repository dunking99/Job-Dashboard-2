"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Badge, Labelled } from "./ui";
import { BridgeDialog, type AiActionResult } from "./AiAction";
import { IconSparkle, IconAlert, IconCheck } from "./icons";
import { wordCount } from "@/lib/utils";

export function CvImporter({
  action,
  mode,
}: {
  action: (formData: FormData) => Promise<AiActionResult & { applied?: { ok?: boolean; error?: string; created?: number; missingMetrics?: string[] } }>;
  mode: "API" | "BRIDGE";
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [bridge, setBridge] = useState<{ callId: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; missingMetrics: string[] } | null>(null);

  function submit() {
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.set("pastedText", text);

    start(async () => {
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.mode === "BRIDGE" && res.bridgePrompt && res.callId) {
        setBridge({ callId: res.callId, prompt: res.bridgePrompt });
        return;
      }
      if (res?.applied?.error) {
        setError(res.applied.error);
        return;
      }
      setResult({
        created: res?.applied?.created ?? 0,
        missingMetrics: res?.applied?.missingMetrics ?? [],
      });
      router.refresh();
    });
  }

  return (
    <>
      <Panel
        title="Paste your career history"
        subtitle={
          mode === "API"
            ? "Runs in one click."
            : "No API key set — this will produce a prompt to paste into Claude, then you paste the reply back."
        }
      >
        <Labelled label="Source text" hint="A CV, a LinkedIn export, or an unstructured brain-dump. Longer is better.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            placeholder={`Paste anything, in any format. For example:

EDUCATION
BSc Politics with Economics, University of Bath, 2026 (predicted 2:1)
Dissertation on regional inflation and voting behaviour — 74

EXPERIENCE
Research & Casework Intern, Office of an MP, Jun–Aug 2025
- Handled constituency casework
- Wrote briefings ahead of debates
...`}
            className="field font-mono text-[11.5px] leading-relaxed"
          />
        </Labelled>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--muted)]">
            {wordCount(text)} words
            {wordCount(text) > 0 && wordCount(text) < 60 && " — quite short, add more for better results"}
          </span>
          <Button variant="primary" onClick={submit} disabled={pending || !text.trim()}>
            <IconSparkle size={14} className={pending ? "pulse-soft" : undefined} />
            {pending ? "Extracting…" : "Extract entries"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px]" style={{ color: "var(--critical)" }}>
            <IconAlert size={13} className="mt-px shrink-0" /> {error}
          </p>
        )}

        {result && (
          <div className="rise-in mt-4 rounded-md border border-[color-mix(in_srgb,var(--good)_40%,transparent)] bg-[color-mix(in_srgb,var(--good)_8%,transparent)] p-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium">
              <IconCheck size={14} style={{ color: "var(--good)" }} />
              {result.created} entr{result.created === 1 ? "y" : "ies"} added to the bank
            </p>

            {result.missingMetrics.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[12px] text-[var(--ink-2)]">
                  These need a number that your source text did not contain. Adding one to each is the single
                  highest-value edit you can make:
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {result.missingMetrics.map((m) => (
                    <li key={m}>
                      <Badge tone="warning">{m}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => router.push("/experience")}>
                Review the bank
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setResult(null);
                  setText("");
                }}
              >
                Import more
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {bridge && (
        <BridgeDialog
          callId={bridge.callId}
          prompt={bridge.prompt}
          title="Extract experience entries"
          onClose={() => setBridge(null)}
          onApplied={() => {
            setBridge(null);
            setText("");
            router.refresh();
            router.push("/experience");
          }}
        />
      )}
    </>
  );
}
