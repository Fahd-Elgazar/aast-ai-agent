import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), "aast-frontend-correctness-"));
const viteEntry = join(frontendRoot, "node_modules", "vite", "bin", "vite.js");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  return result.status === 0;
}

function findTestBundle(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findTestBundle(path);
      if (nested) return nested;
    } else if (/^frontendCorrectness\.test\.[cm]?js$/.test(entry.name)) {
      return path;
    }
  }
  return null;
}

try {
  const compiled = run(process.execPath, [
    viteEntry,
    "build",
    "--ssr",
    "testing/frontendCorrectness.test.ts",
    "--outDir",
    outputDirectory,
    "--emptyOutDir",
  ]);

  if (compiled) {
    const bundle = findTestBundle(outputDirectory);
    if (!bundle) throw new Error("Vite did not produce the frontend correctness test bundle.");
    run(process.execPath, ["--test", bundle]);
  }
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
