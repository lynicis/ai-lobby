import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { HISTORY_TURN_CAP } from "./types.ts";
import type { HistoryFile, HistoryTurn } from "./types.ts";

function emptyHistory(): HistoryFile {
  return { version: 1, turns: [] };
}

export async function loadHistory(filePath: string): Promise<HistoryFile> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyHistory();
    process.stderr.write(
      `warning: could not read history file ${filePath}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return emptyHistory();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { turns?: unknown }).turns)
    ) {
      process.stderr.write(`warning: history file ${filePath} has unexpected shape; ignoring\n`);
      return emptyHistory();
    }
    return parsed as HistoryFile;
  } catch (err) {
    process.stderr.write(
      `warning: history file ${filePath} could not be parsed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return emptyHistory();
  }
}

export async function appendTurn(
  filePath: string,
  turn: HistoryTurn,
  cap: number = HISTORY_TURN_CAP,
): Promise<void> {
  const existing = await loadHistory(filePath);
  const merged = [...existing.turns, turn];
  const trimmed = merged.length > cap ? merged.slice(merged.length - cap) : merged;
  const next: HistoryFile = { version: 1, turns: trimmed };

  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
  await rename(tmp, filePath);
}

const SYNTHESIS_CHAR_CAP = 600;

function truncate(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}... [truncated]`;
}

export function formatHistoryBlock(file: HistoryFile): string {
  if (file.turns.length === 0) return "";
  const lines: string[] = ["<CONVERSATION_HISTORY>"];
  file.turns.forEach((turn, i) => {
    const n = i + 1;
    lines.push(`Turn ${n} (user): ${turn.prompt}`);
    const synth = turn.synthesis === null ? "[no synthesis — --no-supervisor or supervisor failed]" : truncate(turn.synthesis, SYNTHESIS_CHAR_CAP);
    lines.push(`Turn ${n} (assistant): ${synth}`);
  });
  lines.push("</CONVERSATION_HISTORY>");
  return lines.join("\n");
}
