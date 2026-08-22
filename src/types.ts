export type ProviderName = "gemini" | "grok" | "openai" | "claude" | "gateway";

export interface StructuredAnswer {
  summary: string;
  key_points: string[];
  confidence: number;
  caveats?: string[];
}

export interface ModelResponse {
  provider: ProviderName;
  model: string;
  content: string;
  durationMs: number;
  error?: string;
  structured?: StructuredAnswer;
}

export interface PanelEntry {
  provider: ProviderName;
  label: string;
  modelId: string;
  hasKey: boolean;
  keyEnvName: string;
}