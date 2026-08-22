import { createProviderRegistry, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { config } from "./config.ts";
import type { PanelEntry } from "./types.ts";

const XAI_BASE_URL = "https://api.x.ai/v1";

// Each @ai-sdk/* provider returns a slightly different shape (some expose
// imageModel, some don't), so we use a permissive shape here.
type AnyProvider = Parameters<typeof createProviderRegistry>[0] extends Record<string, infer P> ? P : never;
const providers: Record<string, AnyProvider> = {};

if (config.anthropicKey) providers.anthropic = anthropic as unknown as AnyProvider;
if (config.geminiKey) providers.google = google as unknown as AnyProvider;
if (config.openaiKey) providers.openai = openai as unknown as AnyProvider;
if (config.grokKey) {
  providers["openai-compatible"] = createOpenAICompatible({
    name: "xai",
    apiKey: config.grokKey,
    baseURL: XAI_BASE_URL,
  }) as unknown as AnyProvider;
}

export const registry = createProviderRegistry(providers);

export function getModel(modelId: string): LanguageModel {
  return registry.languageModel(modelId as `${string}:${string}`);
}

export const panel: PanelEntry[] = [
  { provider: "gemini", label: "Gemini", modelId: config.geminiModel, hasKey: Boolean(config.geminiKey), keyEnvName: "GEMINI_API_KEY" },
  { provider: "grok", label: "Grok", modelId: config.grokModel, hasKey: Boolean(config.grokKey), keyEnvName: "GROK_API_KEY" },
  { provider: "openai", label: "ChatGPT", modelId: config.openaiModel, hasKey: Boolean(config.openaiKey), keyEnvName: "OPENAI_API_KEY" },
  { provider: "claude", label: "Claude", modelId: config.claudePanelModel, hasKey: Boolean(config.anthropicKey), keyEnvName: "ANTHROPIC_API_KEY" },
];