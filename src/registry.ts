import { createProviderRegistry, type LanguageModel } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google, createGoogle } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { config } from "./config.ts";
import type { PanelEntry } from "./types.ts";

const XAI_BASE_URL = "https://api.x.ai/v1";

// Each @ai-sdk/* provider returns a slightly different shape (some expose
// imageModel, some don't), so we use a permissive shape here.
type AnyProvider = Parameters<typeof createProviderRegistry>[0] extends Record<string, infer P> ? P : never;
const providers: Record<string, AnyProvider> = {};

if (config.anthropicKey) {
  providers.anthropic = (config.anthropicBaseURL
    ? createAnthropic({ baseURL: config.anthropicBaseURL })
    : anthropic) as unknown as AnyProvider;
}
if (config.geminiKey) {
  providers.google = (config.googleBaseURL
    ? createGoogle({ baseURL: config.googleBaseURL })
    : google) as unknown as AnyProvider;
}
if (config.openaiKey) {
  providers.openai = (config.openaiBaseURL
    ? createOpenAI({ baseURL: config.openaiBaseURL })
    : openai) as unknown as AnyProvider;
}
if (config.grokKey) {
  providers["openai-compatible"] = createOpenAICompatible({
    name: "xai",
    apiKey: config.grokKey,
    baseURL: config.xaiBaseURL || XAI_BASE_URL,
  }) as unknown as AnyProvider;
}
if (config.gatewayKey && config.gatewayBaseURL) {
  providers.gateway = createOpenAICompatible({
    name: "gateway",
    baseURL: config.gatewayBaseURL,
    apiKey: config.gatewayKey,
    headers: {
      ...(config.gatewayAppUrl ? { "HTTP-Referer": config.gatewayAppUrl } : {}),
      ...(config.gatewayAppTitle ? { "X-Title": config.gatewayAppTitle } : {}),
    },
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
  { provider: "gateway", label: "Gateway", modelId: config.gatewayModel, hasKey: Boolean(config.gatewayKey && config.gatewayBaseURL), keyEnvName: "GATEWAY_API_KEY" },
];
