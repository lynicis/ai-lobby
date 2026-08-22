import { generateText } from "ai";
import { registry } from "./registry.ts";
import { getSystemPrompt } from "./panel-shared.ts";

export interface PanelTask {
  modelId: string;
  prompt: string;
  timeoutMs: number;
  label: string;
  historyBlock: string;
  roundIndex: number;
  totalRounds: number;
}

export interface PanelResult {
  content: string;
  durationMs: number;
  error?: string;
}

export default async function runPanelTask(task: PanelTask): Promise<PanelResult> {
  const start = Date.now();
  try {
    const model = registry.languageModel(task.modelId as `${string}:${string}`);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), task.timeoutMs);
    try {
      const userText = task.historyBlock
        ? `${task.historyBlock}\n\n${task.prompt}`
        : task.prompt;
      const { text } = await generateText({
        model,
        system: getSystemPrompt(task.roundIndex, task.totalRounds),
        prompt: userText,
        abortSignal: ac.signal,
      });
      return { content: text, durationMs: Date.now() - start };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      content: "",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}