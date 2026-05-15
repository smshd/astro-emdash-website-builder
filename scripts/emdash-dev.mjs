#!/usr/bin/env node
// emdash-dev.mjs — cross-platform Windows-safe dev/seed runner.
// Codifies docs/stage0-findings.md "Open Item A — Local-dev / seed procedure".
//
// Why this exists: `npx emdash dev` migrates the local D1 SQLite DB then, on
// Windows, dies with `spawn npx ENOENT` (emdash CLI spawns a bare `npx` with
// no `.cmd` suffix). The marketing-cloudflare template's `npm run dev`
// (`astro dev`) never migrates/seeds, so the first request 500s. This script
// performs the verified two-step: migrate via the CLI (tolerate its Windows
// crash), then start Astro directly carrying the portable EMDASH_DATABASE_URL.
//
// Usage: node scripts/emdash-dev.mjs [--port 4321] [--no-open] [--cwd <dir>]
// Run from (or pass --cwd) a scaffolded emdash project root.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { argv, platform, exit } from "node:process";

function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const hasFlag = (name) => argv.includes(name);

const projectDir = resolve(arg("--cwd", process.cwd()));
const port = arg("--port", "4321");
const open = !hasFlag("--no-open");
const isWin = platform === "win32";
const npxCmd = isWin ? "npx.cmd" : "npx";
const dbPath = resolve(projectDir, "data.db");
// Portable file: URI — forward slashes + file:/// absolute prefix.
// Backslash form worked empirically in the spike but is non-portable
// (stage0-findings Open Item A step 3); always emit the safe form.
const dbUrl = `file:///${dbPath.replace(/\\/g, "/")}`;

console.log(`[emdash-dev] project: ${projectDir}`);
console.log(`[emdash-dev] EMDASH_DATABASE_URL=${dbUrl}`);

// Step 1: migrate. `npx emdash dev` creates + migrates the DB. On Windows it
// then crashes (expected); we only need the migration side effect. Give it a
// bounded window, then move on regardless of how it exited.
console.log("[emdash-dev] step 1: migrating database via `npx emdash dev` (its Windows crash is expected)…");
spawnSync(npxCmd, ["emdash", "dev"], {
  cwd: projectDir,
  stdio: "inherit",
  timeout: 90_000,
  shell: false,
});

if (!existsSync(dbPath)) {
  console.error(
    "[emdash-dev] FATAL: data.db was not created. The emdash CLI did not migrate. " +
      "Check `npx emdash dev` output above (not a Windows spawn-ENOENT crash — that is tolerated; " +
      "this means migration itself failed).",
  );
  exit(1);
}
console.log("[emdash-dev] step 1 ok: data.db migrated.");

// Step 2: start Astro directly carrying the env var the emdash CLI would set.
console.log(`[emdash-dev] step 2: starting Astro on :${port} (seed applies on first request)…`);
const astro = spawn(npxCmd, ["astro", "dev", "--port", port], {
  cwd: projectDir,
  stdio: "inherit",
  shell: false,
  env: { ...process.env, EMDASH_DATABASE_URL: dbUrl },
});

// Step 3: warm the first request once so the seed applies without a manual curl.
if (open) {
  const url = `http://localhost:${port}/`;
  const warm = setInterval(async () => {
    try {
      await fetch(url);
      clearInterval(warm);
      console.log(`[emdash-dev] step 3 ok: warmed ${url} (seed applied on first request).`);
    } catch {
      /* server not up yet — retry */
    }
  }, 1500);
  setTimeout(() => clearInterval(warm), 60_000);
}

astro.on("exit", (code) => exit(code ?? 0));
