import { panel } from "./registry.ts";
import type { ModelResponse, PanelEntry } from "./types.ts";
import { disposePool, getPool } from "./pool.ts";
import { extractStructured } from "./panel-shared.ts";
import {
  c,
  printPanelBody,
  printPanelError,
  printPanelHeader,
  providerColor,
} from "./tui.ts";

export async function runPanel(prompt: string, timeoutMs: number): Promise<ModelResponse[]> {
  const pool = getPool();

  const liveEntries = panel.filter((e): e is PanelEntry => e.hasKey);
  const tasks = liveEntries.map((entry) => ({
    modelId: entry.modelId,
    prompt,
    timeoutMs,
    label: entry.label,
  }));

  const settled = await Promise.allSettled(tasks.map((t) => pool.run(t)));

  const liveResults: ModelResponse[] = settled.map((res, i) => {
    const entry = liveEntries[i]!;
    const r = res.status === "fulfilled"
      ? res.value
      : {
        content: "",
        durationMs: 0,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      };

    const full: ModelResponse = {
      provider: entry.provider,
      model: entry.modelId,
      content: r.content,
      durationMs: r.durationMs,
      structured: r.content ? extractStructured(r.content) : undefined,
      error: r.error,
    };

    printPanelHeader(entry.label, full.model, full.error ? "error" : "done");
    if (full.error) {
      printPanelError(c.red(full.error));
    } else if (full.content) {
      printPanelBody(full.content, providerColor[entry.provider]);
    }
    console.error(c.dim(`(${full.durationMs}ms)\n`));
    return full;
  });

  let liveIdx = 0;
  const merged: ModelResponse[] = panel.map((entry) => {
    if (!entry.hasKey) {
      const skipped: ModelResponse = {
        provider: entry.provider,
        model: entry.modelId,
        content: "",
        durationMs: 0,
        error: `skipped: ${entry.keyEnvName} not set`,
      };
      printPanelHeader(entry.label, skipped.model, "skipped");
      printPanelError(c.gray(skipped.error!));
      console.error(c.dim(`(${skipped.durationMs}ms)\n`));
      return skipped;
    }
    return liveResults[liveIdx++]!;
  });

  await disposePool();
  return merged;
}