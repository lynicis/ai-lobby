#!/usr/bin/env bun
import { Command, Option } from "commander";
import { config, hasAnyKey, hasAnthropic } from "./config.ts";
import { runPanel } from "./orchestrator.ts";
import { runSupervisor } from "./supervisor.ts";
import {
  c,
  printError,
  printHeader,
  printInfo,
  printPrompt,
  printWarning,
} from "./tui.ts";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
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
  .version("0.2.0")
  .action(async (promptParts: string[], opts: {
    supervisor: boolean;
    raw: boolean;
    timeout: string;
    supervisorModel: string;
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

    if (!opts.raw) {
      printHeader("AI LOBBY");
      printPrompt(prompt);
    } else {
      process.stderr.write(c.dim("running panel...\n"));
    }

    const answers = await runPanel(prompt, timeoutMs);

    if (opts.raw) {
      if (!opts.supervisor || !hasAnthropic()) {
        process.stdout.write(JSON.stringify({ prompt, answers, supervisor: null }, null, 2) + "\n");
        return;
      }
      const synthText = await runSupervisor(prompt, answers, {
        modelId: opts.supervisorModel,
        silent: true,
      });
      process.stdout.write(JSON.stringify({
        prompt,
        answers,
        supervisor: { model: opts.supervisorModel, content: synthText },
      }, null, 2) + "\n");
      return;
    }

    if (!opts.supervisor) {
      printInfo("(supervisor skipped)");
      return;
    }

    if (!hasAnthropic()) {
      printWarning("ANTHROPIC_API_KEY missing — skipping supervisor. Use --no-supervisor to silence this.");
      return;
    }

    await runSupervisor(prompt, answers, { modelId: opts.supervisorModel });
  });

program.parseAsync(process.argv).catch((err) => {
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});