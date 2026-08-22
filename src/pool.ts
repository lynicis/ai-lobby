import { Piscina } from "piscina";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

const SIZE = Math.min(8, Math.max(1, availableParallelism()));

let _pool: Piscina | undefined;

export function getPool(): Piscina {
  if (_pool) return _pool;
  _pool = new Piscina({
    filename: fileURLToPath(new URL("./panel-worker.ts", import.meta.url)),
    minThreads: SIZE,
    maxThreads: SIZE,
    idleTimeout: 30_000,
  });
  return _pool;
}

export async function disposePool(): Promise<void> {
  if (_pool) {
    await _pool.destroy();
    _pool = undefined;
  }
}