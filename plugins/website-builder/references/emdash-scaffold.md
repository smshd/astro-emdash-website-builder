# emdash Scaffold Procedure (authoritative)

The per-client website is an emdash project. Never `npm create astro`. Never
deploy to Cloudflare Pages — emdash deploys as a Cloudflare **Worker**.

## 1. Scaffold

Run in the empty per-client project directory's PARENT:

    npm create emdash@latest <client-dir> -- --template marketing --platform cloudflare --pm npm --yes

The `--pm npm --yes` form is mandatory: the bare form prompts interactively
(verified in Plan 1). `<client-dir>` is the slugified business name.

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
`src/plugins/marketing-blocks/index.ts` (modelled on the template's
existing one). There is no upgrade-in-place; upgrades come via
`package.json` emdash version bumps. Pin the emdash version per client.

## 7. Collision rules (resolved — apply, do not re-litigate)

- `output:'hybrid'` removed in Astro 6 → emdash uses `output:'server'`. Keep.
- Nico's `content.config.ts` + per-`.md` collections + `getStaticPaths` →
  DISCARDED. Content is D1 + `seed/seed.json` Portable Text emdash
  collections, queried at request time.
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
