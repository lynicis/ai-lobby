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

export interface HistoryTurn {
  timestamp: string;
  prompt: string;
  synthesis: string | null;
}

export interface DebateRound {
  index: number;
  prompt: string;
  answers: ModelResponse[];
}

export interface HistoryFile {
  version: 1;
  turns: HistoryTurn[];
}

export const HISTORY_FILE_DEFAULT = ".ai-lobby-history.json";
export const HISTORY_TURN_CAP = 50;