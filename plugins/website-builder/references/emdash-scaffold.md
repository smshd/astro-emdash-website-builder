# emdash Scaffold Procedure (authoritative)

The per-client website is an emdash project. Never `npm create astro`. Never
deploy to Cloudflare Pages — emdash deploys as a Cloudflare **Worker**.

## 1. Scaffold

Run in the empty per-client project directory's PARENT:

    npx create-emdash <client-dir> --template cloudflare:marketing --pm npm --yes

The `--pm npm --yes` form is mandatory: the bare form prompts interactively
(verified in Plan 1). `<client-dir>` is the slugified business name.

> **Windows / npm 10 note:** The `npm create emdash@latest <dir> -- --template ...`
> form silently strips flags after `--` on npm 10, producing "Unexpected extra argument"
> errors (smoke-tested Plan 3 Task 8). Use `npx create-emdash` directly instead.
> Template key format: `cloudflare:marketing` (combined `<platform>:<key>` form,
> as shown in `npx create-emdash --help` examples).

## 2. Disable plugin sandbox (R1 — free tier)

In `<client-dir>/wrangler.jsonc`, comment out the entire `worker_loaders`
block (the `LOADER` binding). This disables ONLY sandboxed plugins. In-process
trusted plugins under the emdash integration's `plugins:[]` keep working on
the Cloudflare free tier. NEVER use `sandboxed:[]`. The block to comment:

    // "worker_loaders": [
    //   { "binding": "LOADER" },
    // ],

Revisit only if a specific client needs the plugin sandbox (~$5/mo Workers
Paid) — out of scope for v1.

## 3. `.dev.vars` secret-hygiene GATE (mandatory, before first commit)

emdash scaffolding writes a generated `EMDASH_ENCRYPTION_KEY` into
`<client-dir>/.dev.vars`. This file MUST be gitignored BEFORE the first
project commit or the key lands in git history permanently.

GATE ORDER (do not reorder):
1. Scaffold (step 1).
2. Open `<client-dir>/.gitignore`. Confirm it contains a line exactly:

       .dev.vars

   The marketing-cloudflare template ships this line, but a future emdash
   version or a `--template` change may not. If absent, append these lines:

       # Wrangler local secrets
       .dev.vars
       .dev.vars.*

3. Run `git -C <client-dir> status --porcelain` and assert `.dev.vars` is
   NOT listed as tracked/staged. If it appears, STOP and remediate before
   any commit.
4. ONLY THEN: `git -C <client-dir> add ...` and the first commit.

If `.dev.vars` ever appears in `git status` as staged, abort the commit and
remove it from the index (`git rm --cached .dev.vars`) before continuing.

## 4. Config edits

- `astro.config.mjs`: KEEP the `emdash(...)` integration, `output:"server"`,
  `adapter: cloudflare()`, the D1 `DB` + R2 `MEDIA` bindings, and the
  in-project `plugins:[{ id:"marketing-blocks", ... }]` entry. ADD
  `@tailwindcss/vite` to `vite.plugins` (NOT the deprecated
  `@astrojs/tailwind` integration). ADD `@astrojs/sitemap` to `integrations`
  and set `site:` to the client domain (Nico's page-graph sitemap is KEPT
  with-reconciliation per stage0-findings; do NOT add `astro-robots-txt` —
  emdash emits robots natively; the DROP/reconciliation is Plan 4/6).
- `wrangler.jsonc`: only the `worker_loaders` comment-out (step 2). Leave
  `main:"./src/worker.ts"`, `d1_databases`, `r2_buckets` intact.
- `package.json`: keep `"emdash": { "seed": "seed/seed.json" }`. Change the
  `dev` script to `node ../../scripts/emdash-dev.mjs --cwd .` style only when
  building INSIDE the fork for testing; for a real client project the script
  is copied in and `dev` becomes `node scripts/emdash-dev.mjs`.

## 5. Deploy (Plan 6 owns wiring — stated here for correctness only)

`astro build && wrangler deploy` → a Cloudflare Worker. Stop at preview.
Never auto-promote to production. Do NOT assume `wrangler pages deploy`.

## 6. R2 upgrade seam — do-not-edit files

The entire scaffold is user-owned and safe to Claude-code into EXCEPT:

- `src/live.config.ts` — emdash core wiring. DO NOT EDIT.
- `emdash-env.d.ts` — generated. DO NOT EDIT.
- `worker-configuration.d.ts` — generated. DO NOT EDIT.

Custom block types go ONLY in the in-project trusted plugin at
`src/plugins/marketing-blocks/index.ts`. **This file is SCAFFOLDED by emdash
— do NOT recreate or overwrite it.** It exports `createPlugin()` (default
export) and pre-registers five `marketing.*` block types. Add new
`portableTextBlocks` entries to the existing definition for client-specific
block types. There is no upgrade-in-place; upgrades come via
`package.json` emdash version bumps. Pin the emdash version per client.

## 7. Collision rules (resolved — apply, do not re-litigate)

- `output:'hybrid'` removed in Astro 6 → emdash uses `output:'server'`. Keep.
- Nico's `content.config.ts` + per-`.md` collections + `getStaticPaths` →
  DISCARDED. Content is D1 + `seed/seed.json` Portable Text emdash
  collections, queried at request time.
  - **Applies to EVERY content page, not just the blog.** The CCC test
    (2026-05-18/19) found home, services, why-us, experience,
    capability-statement, and contact built as hardcoded `.astro` markup
    while only blog `posts` queried emdash. That is WRONG. Every page that
    renders client copy — the homepage, every service/location page, about,
    contact, capability-statement, why-us, experience, and every blog post —
    MUST read its visible content from emdash collections via
    `getEmDashEntry`/`getEmDashCollection` at request time, mirroring the
    working blog `[slug].astro` pattern. Hardcoding page copy into `.astro`
    files (the original Nico-static pattern) is a HARD red flag: it bypasses
    D1, makes the content un-editable in the CMS, and (per Defect 3) puts
    em-dash/AU-guide violations into served HTML that seed-only audits miss.
- `@astrojs/tailwind` deprecated → `@tailwindcss/vite`.
- Cloudflare image service vs emdash R2 media → use emdash R2 media; do not
  set Nico's `image.service` Cloudflare entrypoint.
- Resend `/api/contact` route vs emdash template's POST-to-same-page contact
  handling → use emdash's contact pattern (POST handled in the page; see
  the template's `src/pages/contact.astro`). Do not add Nico's
  `src/pages/api/contact.ts` / Resend dependency.
- Double SEO-head / sitemap: KEEP all Nico schema components and SEO-head
  enrichment (emdash emits only minimal `WebSite` JSON-LD + basic head, no
  `og:image`); KEEP `@astrojs/sitemap`; do NOT add `astro-robots-txt`.
  Homepage `WebSiteSchema` double-emission with emdash's site-wide `WebSite`
  is a Plan 4/6 reconciliation item — flag, do not fix here.

## 8. Media assets — generated webp → http-seed → D1/R2 (Plan 5↔3 contract)

> **This section was corrected after the CCC end-to-end test (2026-05-18/19).**
> The previous contract ("emdash seed-apply ingests a local
> `seed/assets/<file>` path on first request") is FALSE and was the root
> cause of NULL `hero_image`/`featured_image` in D1. The mechanism below is
> the only emdash-supported path; it is verified against emdash core source.

emdash content image fields use the `$media` form:

    "hero_image": { "$media": { "url": "<http-or-https-url>", "alt": "...", "filename": "name.webp" } }

### Two hard constraints emdash core imposes (do not design around these)

1. **`$media.url` MUST be `http:` or `https:`.** Seed `$media` resolution
   (`resolveMedia` in emdash core `packages/core/src/seed/apply.ts`) calls
   `validateExternalUrl(url)` (`packages/core/src/security/ssrf.ts`,
   `ALLOWED_SCHEMES = {"http:","https:"}`) and then `ssrfSafeFetch(url)`. A
   local filesystem path (`seed/assets/foo.webp`, `./foo.webp`, `file:...`)
   throws `SsrfError`, the error is swallowed (`result.media.skipped++`),
   `resolveMedia` returns `null`, and the image field is stored **NULL**.
   There is NO filesystem-path branch in `resolveMedia` — local paths are
   not "resolvable from the project root at seed time". That earlier claim
   was wrong.

2. **Auto-seed does NOT seed content or media.** emdash's first-request
   auto-seed (`emdash-runtime.ts`, "Auto-seeded default collections") calls
   `applySeed(db, seed, { onConflict: "skip" })` with **no `includeContent`
   and no `storage`**. `applySeed` defaults `includeContent = false`
   (`apply.ts`), so auto-seed creates the **collection schema only** — zero
   content entries, zero media. The ONLY core paths that apply content +
   `$media` with a storage adapter are the **`npx emdash seed` CLI**
   (`cli/commands/seed.ts`: `includeContent: !--no-content` + a
   `LocalStorage` adapter) and the setup wizard / dev-bypass route. "Seed
   applies on first request" is therefore NOT sufficient for a content site.

### The supported mechanism (verified against emdash core)

Generated webps are written to `seed/assets/<filename>`, served over a
loopback HTTP endpoint during the seed step, referenced by that http URL in
`$media.url`, and ingested by the explicit **`npx emdash seed`** CLI (which
provides `includeContent:true` + a storage adapter). Once ingested, emdash
stores the media as `provider:"local"` with a `storageKey` and serves it at
runtime via its own media route / R2 binding — the original http seed URL is
used only for the one-time download and is never referenced again.

**Canonical asset directory (LOCKED): `seed/assets/`.** All generated images
live at `seed/assets/<filename>`. The `filename` field of `$media` is the
bare `<filename>` (no directory). `seed/assets/` is part of the deliverable
repo (NOT gitignored) — the webps ship with the project so a fresh clone can
re-seed.

**Plan 4 → Plan 5 → seed flow (do not deviate):**
1. Plan 4 (seo-writer) writes entries with
   `"$media": { "url": "PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5",
   "alt": "<keyword-rich alt>", "filename": "<slug>-hero.webp" }`.
2. Plan 5 (gpt-image) writes the WebP to `seed/assets/<slug>-hero.webp`
   and replaces the token so `url` becomes
   `http://127.0.0.1:4399/<slug>-hero.webp` (the loopback asset endpoint
   `scripts/emdash-dev.mjs` serves `seed/assets/` on — default `--asset-port
   4399`). `filename` stays the bare `<slug>-hero.webp`. The webp file on
   disk under `seed/assets/` is the durable artifact committed to the repo;
   the http URL is the seed-time ingestion handle only.
3. `scripts/emdash-dev.mjs` (or the documented preview procedure §8a) starts
   the loopback asset server, runs `npx emdash seed seed/seed.json
   --on-conflict skip` (which sets `includeContent:true` + `LocalStorage`),
   then stops the asset server. emdash downloads each webp over http, ingests
   it into the media table + storage (R2 binding on Cloudflare), and the
   entry renders via `emdash/ui` `<Image image={entry.data.hero_image} />`.

### §8a. Dev / preview seeding procedure (replaces the test's out-of-band workaround)

The CCC test needed an ad-hoc `seed-miniflare.py` because the old
`emdash-dev.mjs` only warmed a request and relied on (broken-for-content)
auto-seed. That workaround is folded in properly:

- **Local dev / verification:** `node scripts/emdash-dev.mjs --cwd <client>`.
  It now: (1) migrates via `npx emdash dev`, (2) serves `seed/assets/` on
  `127.0.0.1:<asset-port>`, (3) runs `npx emdash seed` with content+media,
  (4) stops the asset server, (5) starts `astro dev`. No manual curl, no
  external script. Use `--no-seed` only to re-start against an
  already-seeded `data.db`.
- **Preview (`wrangler dev` / deployed Worker):** the same `npx emdash seed`
  CLI is the seeding step; point `--database` / storage at the wrangler
  local D1/R2 (`.wrangler/state`) or run the seed against the deployed
  Worker's setup route. The asset server must be reachable from wherever the
  seed runs (loopback is fine for `wrangler dev`; for a remote Worker seed,
  the assets must be served from a host the Worker can reach).
- Any seed-reading helper script MUST open `seed/seed.json` BOM-tolerantly
  (`encoding="utf-8-sig"` in Python, or strip a leading U+FEFF in Node) —
  emdash/Windows toolchains can emit a BOM and a strict `utf-8` read throws.

**Gating rule (build must not ship the token, and media must not be NULL):**
before `astro build` / `wrangler deploy`, assert:
1. No `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` remains in `seed/seed.json`.
2. Every `$media.url` is an `http://`/`https://` URL (NOT a bare path,
   `./...`, or `file:`). A non-http `$media.url` will silently store NULL.
3. For every `$media` whose `filename` is a generated asset, the file
   exists under `seed/assets/<filename>` (it is what the loopback server
   serves and what ships in the repo).
4. After the seed step, the seeded D1 has a non-NULL media reference for
   every content entry that declares a `$media` field (verify via the
   served HTML in the audit — Plan 6 / seo-auditor — not by re-reading
   seed.json).

A residual token, a non-http `$media.url`, or a missing
`seed/assets/<filename>` means Stage 5 / the seed step did not complete —
STOP, do not deploy with a broken seed.

`seed/assets/` is NOT gitignored — generated client imagery is part of the
deliverable repo. (`.dev.vars`/`data.db`/`dist/` remain gitignored per §3.)
