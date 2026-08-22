import type { DebateRound, StructuredAnswer } from "./types.ts";

export const PANELIST_SYSTEM_PROMPT = `You are one of several independent AI panelists answering a user's question.
Answer accurately and concisely.

After your answer, append a single fenced JSON block labeled \`lobby-struct\` with
exactly this shape — no commentary before or after it, no extra keys:

\`\`\`lobby-struct
{
  "summary": "<1-3 sentence answer>",
  "key_points": ["<point 1>", "<point 2>", "<point 3>"],
  "confidence": <integer 1-10>,
  "caveats": ["<limitation or uncertainty>"]
}
\`\`\`

Rules for the JSON block:
- summary: direct answer to the question, not a meta-commentary.
- key_points: 3-7 bullets, each a complete clause (not a fragment).
- confidence: how sure you are of the answer on a 1-10 scale.
- caveats: empty array if none. Do not invent facts.
- Output ONLY the JSON block as the final thing in your response. No trailing prose.`;

export const STRUCT_RE = /```lobby-struct\s*\n([\s\S]*?)\n```\s*$/;

export function extractStructured(text: string): StructuredAnswer | undefined {
  const m = text.match(STRUCT_RE);
  if (!m) return undefined;
  try {
    const parsed = JSON.parse(m[1]!);
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.key_points) ||
      !parsed.key_points.every((x: unknown) => typeof x === "string") ||
      typeof parsed.confidence !== "number"
    ) {
      return undefined;
    }
    const caveats = Array.isArray(parsed.caveats)
      ? parsed.caveats.filter((x: unknown) => typeof x === "string")
      : undefined;
    return {
      summary: parsed.summary,
      key_points: parsed.key_points,
      confidence: parsed.confidence,
      caveats,
    };
  } catch {
    return undefined;
  }
}

const DEBATE_CONTENT_CHAR_CAP = 800;

export function formatDebateBlock(rounds: DebateRound[]): string {
  if (rounds.length === 0) return "";
  const sections = rounds.map((round) => {
    const lines: string[] = [];
    lines.push(`Round ${round.index} prompt: ${round.prompt}`);
    for (const answer of round.answers) {
      const label = answer.provider;
      const trimmed = answer.content.length > DEBATE_CONTENT_CHAR_CAP
        ? `${answer.content.slice(0, DEBATE_CONTENT_CHAR_CAP)}…`
        : answer.content;
      const status = answer.error ? `[ERROR] ${answer.error}` : trimmed;
      lines.push(`Round ${round.index} — ${label} (${answer.model}): ${status}`);
    }
    return lines.join("\n");
  });
  return `<DEBATE_HISTORY>\n${sections.join("\n\n")}\n</DEBATE_HISTORY>`;
}

export function buildDebatePrompt(
  originalPrompt: string,
  priorRounds: DebateRound[],
  currentRound: number,
  totalRounds: number,
): string {
  const debateBlock = formatDebateBlock(priorRounds);
  return `${debateBlock}\n\nOriginal question: ${originalPrompt}\n\nThis is round ${currentRound} of ${totalRounds}. React to the prior rounds above: agree, refine, or push back. Stay concise and append your \`lobby-struct\` JSON block as usual.`;
}

export function getSystemPrompt(roundIndex: number, _totalRounds: number): string {
  if (roundIndex <= 1) return PANELIST_SYSTEM_PROMPT;
  return `${PANELIST_SYSTEM_PROMPT}\n\nYou are in a multi-round debate. The prior rounds' answers are prepended to the user message — read them and react (agree, refine, or push back). Keep your answer focused on what changed since the last round.`;
}