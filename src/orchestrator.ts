import { panel } from "./registry.ts";
import type { DebateRound, ModelResponse, PanelEntry } from "./types.ts";
import { disposePool, getPool } from "./pool.ts";
import { buildDebatePrompt, extractStructured } from "./panel-shared.ts";
import {
  c,
  printPanelBody,
  printPanelError,
  printPanelHeader,
  printRoundHeader,
  providerColor,
} from "./tui.ts";

async function runOneRound(
  prompt: string,
  timeoutMs: number,
  historyBlock: string,
  roundIndex: number,
  totalRounds: number,
): Promise<ModelResponse[]> {
  const pool = getPool();

  const liveEntries = panel.filter((e): e is PanelEntry => e.hasKey);
  const tasks = liveEntries.map((entry) => ({
    modelId: entry.modelId,
    prompt,
    timeoutMs,
    label: entry.label,
    historyBlock,
    roundIndex,
    totalRounds,
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

  return merged;
}

export async function runDebate(
  prompt: string,
  timeoutMs: number,
  historyBlock: string,
  rounds: number,
): Promise<DebateRound[]> {
  const debateRounds: DebateRound[] = [];
  try {
    for (let i = 1; i <= rounds; i++) {
      if (rounds > 1) {
        printRoundHeader(i, rounds);
      }
      const roundPrompt = i === 1 ? prompt : buildDebatePrompt(prompt, debateRounds, i, rounds);
      const answers = await runOneRound(roundPrompt, timeoutMs, historyBlock, i, rounds);
      debateRounds.push({ index: i, prompt: roundPrompt, answers });
    }
  } finally {
    await disposePool();
  }
  return debateRounds;
}

export async function runPanel(prompt: string, timeoutMs: number, historyBlock: string): Promise<ModelResponse[]> {
  const [round] = await runDebate(prompt, timeoutMs, historyBlock, 1);
  return round!.answers;
}
