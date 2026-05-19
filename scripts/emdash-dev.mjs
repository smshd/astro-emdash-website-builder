#!/usr/bin/env node
// emdash-dev.mjs — cross-platform Windows-safe dev/seed runner.
// Codifies docs/stage0-findings.md "Open Item A — Local-dev / seed procedure".
//
// Why this exists: `npx emdash dev` migrates the local D1 SQLite DB then, on
// Windows, dies with `spawn npx ENOENT` (emdash CLI spawns a bare `npx` with
// no `.cmd` suffix). The marketing-cloudflare template's `npm run dev`
// (`astro dev`) never migrates/seeds, so the first request 500s. Additionally,
// spawning `npx.cmd` with shell:false on Windows throws EINVAL — the Astro dev
// step requires shell:true on Windows (smoke-tested Plan 3 Task 8). This script
// performs the verified sequence: migrate, then EXPLICITLY seed content+media
// via the `npx emdash seed` CLI, then start Astro directly carrying the
// portable EMDASH_DATABASE_URL.
//
// Why an EXPLICIT seed step (not "seed applies on first request"):
//   emdash's auto-seed (emdash-runtime.ts, "Auto-seeded default collections")
//   calls `applySeed(db, seed, { onConflict: "skip" })` with NO `includeContent`
//   and NO `storage`. `applySeed` defaults `includeContent = false`, so
//   auto-seed creates the COLLECTION SCHEMA ONLY — zero content entries, zero
//   media. The ONLY core paths that seed content + media with storage are the
//   `npx emdash seed` CLI (includeContent:true + LocalStorage) and the setup
//   wizard. This script uses the CLI path. (Evidence: emdash core
//   packages/core/src/seed/apply.ts:75, cli/commands/seed.ts:205-223,
//   emdash-runtime.ts:1071-1082.)
//
// Why a local HTTP asset server:
//   emdash seed `$media` resolution (apply.ts resolveMedia → ssrf.ts
//   validateExternalUrl) accepts ONLY http:/https: URLs. A local filesystem
//   path (e.g. seed/assets/foo.webp) throws SsrfError, is swallowed, and the
//   image field is stored NULL. So generated webps in seed/assets/ must be
//   served over http during the seed step and referenced by an http URL. This
//   script serves seed/assets/ on a loopback port and the Stage-5 image step
//   writes `$media.url` as `http://127.0.0.1:<asset-port>/<filename>`.
//
// Usage: node scripts/emdash-dev.mjs [--port 4321] [--asset-port 4399]
//                                    [--no-open] [--cwd <dir>] [--no-seed]
// Run from (or pass --cwd) a scaffolded emdash project root.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, join, normalize, sep } from "node:path";
import { argv, platform, exit } from "node:process";

function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const hasFlag = (name) => argv.includes(name);

const projectDir = resolve(arg("--cwd", process.cwd()));
const port = arg("--port", "4321");
const assetPort = arg("--asset-port", "4399");
const open = !hasFlag("--no-open");
const doSeed = !hasFlag("--no-seed");
const isWin = platform === "win32";
const npxCmd = isWin ? "npx.cmd" : "npx";
const dbPath = resolve(projectDir, "data.db");
const seedPath = resolve(projectDir, "seed", "seed.json");
const assetsDir = resolve(projectDir, "seed", "assets");
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
// On Windows, .cmd launchers require shell:true (spawn EINVAL / early-exit otherwise).
spawnSync(npxCmd, ["emdash", "dev"], {
  cwd: projectDir,
  stdio: "inherit",
  timeout: 90_000,
  shell: isWin,
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

// Step 1.5: serve seed/assets/ over loopback http so `npx emdash seed` can
// resolve local-path $media (emdash seed only accepts http(s) URLs — see header).
const MIME = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};
let assetServer;
if (doSeed && existsSync(assetsDir)) {
  assetServer = createServer((req, res) => {
    try {
      const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
      // Contain to assetsDir (no path traversal).
      const target = normalize(join(assetsDir, reqPath));
      if (!target.startsWith(assetsDir + sep) && target !== assetsDir) {
        res.writeHead(403).end();
        return;
      }
      if (!existsSync(target) || !statSync(target).isFile()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": MIME[extname(target).toLowerCase()] || "application/octet-stream" });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(500).end();
    }
  });
  assetServer.listen(Number(assetPort), "127.0.0.1");
  console.log(`[emdash-dev] step 1.5: serving seed/assets/ at http://127.0.0.1:${assetPort}/ for the seed step.`);
}

// Step 2: EXPLICITLY apply content + media via the emdash seed CLI.
// `npx emdash dev` / auto-seed do NOT seed content (includeContent defaults
// false; no storage). The CLI sets includeContent:true and a LocalStorage
// adapter, so content entries AND $media are ingested. Required, not optional.
if (doSeed) {
  if (!existsSync(seedPath)) {
    console.error(`[emdash-dev] FATAL: ${seedPath} not found. Cannot seed content.`);
    exit(1);
  }
  console.log("[emdash-dev] step 2: applying content + media via `npx emdash seed` (includeContent:true)…");
  const seedRun = spawnSync(
    npxCmd,
    [
      "emdash",
      "seed",
      "seed/seed.json",
      "--database",
      "./data.db",
      "--on-conflict",
      "skip",
    ],
    { cwd: projectDir, stdio: "inherit", timeout: 180_000, shell: isWin },
  );
  if (seedRun.status !== 0) {
    console.error(
      "[emdash-dev] FATAL: `npx emdash seed` failed. Content/media not applied. " +
        "Check the seed output above. Common cause: a $media.url that is a local " +
        "filesystem path (emdash seed only resolves http(s) — the Stage-5 image " +
        `step must write http://127.0.0.1:${assetPort}/<filename> while this script runs).`,
    );
    if (assetServer) assetServer.close();
    exit(1);
  }
  console.log("[emdash-dev] step 2 ok: content + media seeded.");
}
if (assetServer) {
  assetServer.close();
  console.log("[emdash-dev] step 2.5: asset server stopped (seed complete; media now in D1/R2-local).");
}

// Step 3: start Astro directly carrying the env var the emdash CLI would set.
// On Windows, .cmd launchers require shell:true (spawn EINVAL otherwise).
console.log(`[emdash-dev] step 3: starting Astro on :${port} (DB already migrated + seeded)…`);
const astro = spawn(npxCmd, ["astro", "dev", "--port", port], {
  cwd: projectDir,
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, EMDASH_DATABASE_URL: dbUrl },
});

// Step 4: warm the first request once so the server is confirmed up.
if (open) {
  const url = `http://localhost:${port}/`;
  const warm = setInterval(async () => {
    try {
      await fetch(url);
      clearInterval(warm);
      console.log(`[emdash-dev] step 4 ok: warmed ${url} (server up; content already seeded in step 2).`);
    } catch {
      /* server not up yet — retry */
    }
  }, 1500);
  setTimeout(() => clearInterval(warm), 60_000);
}

astro.on("exit", (code) => exit(code ?? 0));
