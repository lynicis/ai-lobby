import "dotenv/config";

export const config = {
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  grokKey: process.env.GROK_API_KEY ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",

  supervisorModel: process.env.SUPERVISOR_MODEL ?? "anthropic:claude-opus-4-5",
  geminiModel: process.env.GEMINI_MODEL ?? "google:gemini-2.5-pro",
  grokModel: process.env.GROK_MODEL ?? "openai-compatible:grok-4-latest",
  openaiModel: process.env.OPENAI_MODEL ?? "openai:gpt-4o",
  claudePanelModel: process.env.CLAUDE_PANEL_MODEL ?? "anthropic:claude-sonnet-4-5",

  defaultTimeoutMs: Number(process.env.DEFAULT_TIMEOUT_MS ?? 60000),
} as const;

export function hasAnyKey(): boolean {
  return Boolean(
    config.geminiKey || config.grokKey || config.openaiKey || config.anthropicKey,
  );
}

export function hasAnthropic(): boolean {
  return Boolean(config.anthropicKey);
}