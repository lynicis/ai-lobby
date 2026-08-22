import { streamText } from "ai";
import { getModel } from "./registry.ts";
import { config } from "./config.ts";
import { endSynthesis, printSynthesisHeader, writeSynthesisChunk } from "./tui.ts";
import type { ModelResponse } from "./types.ts";

const SUPERVISOR_SYSTEM_PROMPT = `You are a neutral moderator. You receive one user question and N
independent panel answers. Each panelist (Gemini, Grok, ChatGPT, Claude) was
asked to append a structured JSON block to their answer.

Your job is to surface the collective signal, NOT to assert your own view —
including your own panel if you are also a panelist. Do not favor any model.

Produce the output using exactly these four markdown sections, in order:

## Consensus
- Points where >=half of panelists agree. Cite which panelists hold each
  point by name. If all agree, say "All N panelists agree".

## Disagreements
A markdown table with columns: Claim | Panelists holding it | Counter-claim |
Panelists holding it.
- List every factual contradiction. Ignore stylistic differences.
- Present the evidence each side cited (verbatim if short).
- Do NOT pick a winner. Do NOT say "the more credible side is...".

## Gaps
- Aspects of the question that no panelist addressed.
- Panels that errored or were skipped (mention by name).
- Areas where every panelist's confidence was low.

## Synthesis
- The most defensible answer given the panel. Frame it as "majority view
  supported by X, Y" — never as your personal opinion.
- If a minority view has strong evidence, surface it as a caveat.
- If the panel split evenly with no evidence on either side, say so
  explicitly rather than picking.

Rules:
- Never use first-person: no "I think", "I would say", "in my view".
  Always attribute ("3 of 4 agree...", "Claude and Gemini argue...").
- Be concise; bullets over prose.
- Do not mention the synthesis process unless asked.
`;

function buildUserMessage(userPrompt: string, answers: ModelResponse[]): string {
  const structuredSection = JSON.stringify(
    answers.map((a) => ({
      provider: a.provider,
      model: a.model,
      status: a.error ? "error" : a.structured ? "ok" : "no_struct",
      error: a.error ?? null,
      structured: a.structured ?? null,
    })),
    null,
    2,
  );

  const rawSection = answers
    .map((a) => {
      if (a.error) return `### ${a.provider} (${a.model}) — ERROR\n${a.error}`;
      return `### ${a.provider} (${a.model})\n${a.content}`;
    })
    .join("\n\n");

  return `<USER_PROMPT>
${userPrompt}
</USER_PROMPT>

<PANEL_STRUCTURED>
${structuredSection}
</PANEL_STRUCTURED>

<PANEL_RAW>
${rawSection}
</PANEL_RAW>

Use the structured section as the primary signal. Refer to PANEL_RAW only
when you need verbatim quotes to characterize a disagreement.

Produce the synthesis now.`;
}

export interface SupervisorOptions {
  modelId?: string;
  silent?: boolean;
}

export async function runSupervisor(
  userPrompt: string,
  answers: ModelResponse[],
  options: SupervisorOptions = {},
): Promise<string> {
  if (!config.anthropicKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for the supervisor. Use --no-supervisor to skip.",
    );
  }

  const modelId = options.modelId ?? config.supervisorModel;
  const model = getModel(modelId);

  if (!options.silent) {
    printSynthesisHeader(modelId);
  }

  const result = streamText({
    model,
    system: SUPERVISOR_SYSTEM_PROMPT,
    prompt: buildUserMessage(userPrompt, answers),
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    if (!options.silent) {
      writeSynthesisChunk(chunk);
    }
  }

  if (!options.silent) {
    endSynthesis();
  }
  return fullText;
}