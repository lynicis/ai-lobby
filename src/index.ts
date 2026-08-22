#!/usr/bin/env bun
import { resolve } from "node:path";
import { Command, Option } from "commander";
import { config, hasAnyKey, hasAnthropic } from "./config.ts";
import { runDebate } from "./orchestrator.ts";
import { runSupervisor } from "./supervisor.ts";
import {
  c,
  printError,
  printHeader,
  printInfo,
  printPrompt,
  printWarning,
} from "./tui.ts";
import { appendTurn, formatHistoryBlock, loadHistory } from "./history.ts";
import { HISTORY_FILE_DEFAULT } from "./types.ts";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function safeAppendTurn(
  historyPath: string,
  turn: { timestamp: string; prompt: string; synthesis: string | null },
): Promise<void> {
  try {
    await appendTurn(historyPath, turn);
  } catch (err) {
    printWarning(
      `could not persist history to ${historyPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const program = new Command();
program
  .name("ai-lobby")
  .description("Fan out a prompt to multiple LLMs and synthesize the answers with a supervisor model.")
  .argument("[prompt...]", "prompt to send to all models (or pipe via stdin)")
  .option("--no-supervisor", "skip the supervisor synthesis")
  .option("--raw", "emit a single JSON object to stdout")
  .addOption(new Option("--timeout <ms>", "per-provider timeout in ms").default(config.defaultTimeoutMs))
  .option("--supervisor-model <id>", "supervisor model id", config.supervisorModel)
  .option("--history-file <path>", "history file path", HISTORY_FILE_DEFAULT)
  .option("--rounds <n>", "number of debate rounds (default 1)", (v) => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error("--rounds must be a positive integer");
    }
    return n;
  }, 1)
  .version("0.2.0")
  .action(async (promptParts: string[], opts: {
    supervisor: boolean;
    raw: boolean;
    timeout: string;
    supervisorModel: string;
    historyFile: string;
    rounds: number;
  }) => {
    let prompt = promptParts.join(" ").trim();
    if (!prompt) prompt = await readStdin();

    if (!prompt) {
      printError("no prompt provided (pass as argument or via stdin)");
      process.exit(2);
    }
    if (!hasAnyKey()) {
      printError("no API keys found. copy .env.example to .env and fill in at least one key.");
      process.exit(2);
    }

    const timeoutMs = Number(opts.timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      printError(`--timeout requires a positive number, got: ${opts.timeout}`);
      process.exit(2);
    }

    const historyPath = resolve(process.cwd(), opts.historyFile);
    const history = await loadHistory(historyPath);
    const historyBlock = formatHistoryBlock(history);

    if (!opts.raw) {
      printHeader("AI LOBBY");
      if (history.turns.length > 0) {
        printInfo(`${c.dim("history:")} ${history.turns.length} turns`);
      }
      if (opts.rounds > 1) {
        printInfo(`${c.dim("debate rounds:")} ${opts.rounds}`);
      }
      printPrompt(prompt);
    } else {
      process.stderr.write(c.dim(`running panel (${opts.rounds} round${opts.rounds === 1 ? "" : "s"})...\n`));
    }

    const debateRounds = await runDebate(prompt, timeoutMs, historyBlock, opts.rounds);
    const finalAnswers = debateRounds.at(-1)!.answers;

    if (opts.raw) {
      let synthText: string | null = null;
      let supervisorModel: string | null = null;
      if (opts.supervisor && hasAnthropic()) {
        try {
          synthText = await runSupervisor(prompt, finalAnswers, {
            modelId: opts.supervisorModel,
            silent: true,
            historyBlock,
            rounds: opts.rounds > 1 ? debateRounds : undefined,
          });
          supervisorModel = opts.supervisorModel;
        } catch (err) {
          printWarning(
            `supervisor failed (${err instanceof Error ? err.message : String(err)}); emitting panel-only JSON`,
          );
        }
      }
      const payload: Record<string, unknown> = {
        prompt,
        answers: finalAnswers,
      };
      if (opts.rounds > 1) {
        payload.rounds = debateRounds;
      }
      payload.supervisor = synthText && supervisorModel
        ? { model: supervisorModel, content: synthText }
        : null;
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
      await safeAppendTurn(historyPath, {
        timestamp: new Date().toISOString(),
        prompt,
        synthesis: synthText,
      });
      return;
    }

    if (!opts.supervisor) {
      printInfo("(supervisor skipped)");
      await safeAppendTurn(historyPath, {
        timestamp: new Date().toISOString(),
        prompt,
        synthesis: null,
      });
      return;
    }

    if (!hasAnthropic()) {
      printWarning("ANTHROPIC_API_KEY missing — skipping supervisor. Use --no-supervisor to silence this.");
      await safeAppendTurn(historyPath, {
        timestamp: new Date().toISOString(),
        prompt,
        synthesis: null,
      });
      return;
    }

    let synthText: string | null = null;
    try {
      synthText = await runSupervisor(prompt, finalAnswers, {
        modelId: opts.supervisorModel,
        historyBlock,
        rounds: opts.rounds > 1 ? debateRounds : undefined,
      });
    } catch (err) {
      printWarning(
        `supervisor failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await safeAppendTurn(historyPath, {
      timestamp: new Date().toISOString(),
      prompt,
      synthesis: synthText,
    });
  });

program.parseAsync(process.argv).catch((err) => {
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});