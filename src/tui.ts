const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

const useColor = process.stdout.isTTY ?? false;

function wrap(open: string, close: string): (s: string) => string {
  return (s: string) => (useColor ? `${open}${s}${close}` : s);
}

export const c = {
  reset: wrap(codes.reset, codes.reset),
  bold: wrap(codes.bold, codes.reset),
  dim: wrap(codes.dim, codes.reset),
  red: wrap(codes.red, codes.reset),
  green: wrap(codes.green, codes.reset),
  yellow: wrap(codes.yellow, codes.reset),
  blue: wrap(codes.blue, codes.reset),
  magenta: wrap(codes.magenta, codes.reset),
  cyan: wrap(codes.cyan, codes.reset),
  gray: wrap(codes.gray, codes.reset),
};

export const providerColor = {
  gemini: c.blue,
  grok: c.magenta,
  openai: c.green,
  claude: c.cyan,
} as const;

export function printHeader(title: string): void {
  const line = "─".repeat(Math.max(0, 60 - title.length - 4));
  console.error(`\n${c.bold("═══")} ${c.bold(title)} ${c.dim(line)}\n`);
}

export function printPrompt(prompt: string): void {
  console.error(`${c.dim("┌─ prompt")}`);
  const lines = prompt.split("\n");
  for (const line of lines) {
    console.error(`${c.dim("│")} ${line}`);
  }
  console.error(`${c.dim("└─")}\n`);
}

export function printPanelHeader(label: string, model: string, status: "running" | "done" | "error" | "skipped"): void {
  const statusMark =
    status === "running"
      ? c.yellow("● running")
      : status === "done"
        ? c.green("✓ done")
        : status === "error"
          ? c.red("✗ error")
          : c.gray("○ skipped");
  console.error(`${c.bold(label)} ${c.dim(model)} ${statusMark}`);
  console.error(c.dim("─".repeat(60)));
}

export function printPanelBody(content: string, color: (s: string) => string): void {
  for (const line of content.split("\n")) {
    console.error(color(`│ ${line}`));
  }
  console.error(c.dim("─".repeat(60)));
}

export function printPanelError(error: string): void {
  console.error(c.red(`│ ${error}`));
  console.error(c.dim("─".repeat(60)));
}

export function printSynthesisHeader(model: string): void {
  console.error(`\n${c.bold(c.yellow("═══ SUPERVISOR SYNTHESIS"))} ${c.dim(model)}\n`);
}

export function writeSynthesisChunk(text: string): void {
  process.stdout.write(c.yellow(text));
}

export function endSynthesis(): void {
  console.error("");
}

export function printError(msg: string): void {
  console.error(c.red(`error: ${msg}`));
}

export function printWarning(msg: string): void {
  console.error(c.yellow(`warning: ${msg}`));
}

export function printInfo(msg: string): void {
  console.error(c.dim(msg));
}
