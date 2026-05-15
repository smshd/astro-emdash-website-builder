# Stage 0 Findings (Plan 1)

De-risking the retarget of the website-builder plugin onto emdash. Empirical findings
recorded by inspecting actual rendered output from a throwaway emdash spike
(`C:\Coding\_study\emdash-spike`, emdash `0.12.0`, marketing-cloudflare template).

## Open Item A — emdash native SEO/schema

### Local-dev / seed procedure (record for later plans)

This is itself a load-bearing finding. emdash's seed/migration runtime does **not**
run under a bare `astro dev` — the marketing-cloudflare template's
`package.json` `dev` script is `astro dev`, which boots the worker but never
initialises the database, so the first request 500s ("D1 binding has no local
data" / Miniflare fetch failed). The authoritative command per `AGENTS.md` and
the bundled `emdash-cli` skill is `npx emdash dev`, which (1) creates/migrates
the database and (2) applies the bundled seed on first request when the DB is
empty, then (3) spawns Astro.

On Windows, `npx emdash dev` partially fails: it correctly creates the DB and
applies 36 migrations to a local SQLite file (`./data.db`, via
`EMDASH_DATABASE_URL=file:<dbPath>`), but then dies with
`Failed to start dev server: spawn npx ENOENT` — the emdash CLI spawns a bare
`npx`/`pnpm`/`yarn` (no `.cmd` suffix), which does not resolve on Windows
(`node_modules/emdash/dist/cli/index.mjs` ~line 945–963). This is an emdash CLI
Windows bug, not a spike misconfiguration.

**Working procedure used (Windows):**

1. `cd C:\Coding\_study\emdash-spike`
2. `npx emdash dev` — let it create `./data.db`, apply 36 migrations, then fail
   on `spawn npx ENOENT` (expected on Windows; the DB is now migrated).
3. Start Astro directly with the same env var emdash's CLI would have set:
   `EMDASH_DATABASE_URL="file:C:\Coding\_study\emdash-spike\data.db" npx astro dev --port 4321`
4. `curl http://localhost:4321/` — first request applies the seed
   (`seed/seed.json`, the "Acme" demo). Re-fetch → HTTP 200, full markup.

Verified: `/` 200 (52 KB), `/pricing` 200, `/contact` 200 — all real rendered
pages, not error pages. `npx astro build` also completes (server output;
content is rendered per-request against the DB, so static head inspection
requires the running dev server, as the task anticipated).

> **Action for later plans:** the fork's own template/scaffold must not rely on
> `npx emdash dev` spawning Astro on Windows. Either (a) patch the dev script to
> `emdash dev` with a Windows-safe spawn / a `predev` migrate step + plain
> `astro dev` carrying `EMDASH_DATABASE_URL`, or (b) document this two-step
> manual procedure. File this against Plan 1/2 scaffold hardening.

### Native SEO tags emdash emits (verified, literal)

emdash emits a consistent, minimal SEO head on every page (homepage / pricing /
contact all identical in structure, values driven by per-page title +
description from the CMS):

```html
<title>Acme</title>
<meta name="description" content="Build products people actually want. The all-in-one platform for modern teams.">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Acme">
<meta name="twitter:description" content="Build products people actually want. The all-in-one platform for modern teams.">
<meta property="og:type" content="website">
<meta property="og:title" content="Acme">
<meta property="og:description" content="Build products people actually want. The all-in-one platform for modern teams.">
<meta property="og:url" content="http://localhost:4321/">
<meta property="og:site_name" content="Acme">
<link rel="canonical" href="http://localhost:4321/">
```

Present natively:

- `<title>` — per-page
- `<meta name="description">` — per-page
- `<link rel="canonical">` — per-page, absolute URL
- `og:type`, `og:title`, `og:description`, `og:url`, `og:site_name`
- `twitter:card` (= `summary`), `twitter:title`, `twitter:description`

**Absent natively** (checked across all three pages):

- `og:image` — **not emitted** (no `og:image`/`og:image:*` on any page)
- `twitter:image`, `twitter:site`, `twitter:creator` — not emitted
- `twitter:card` is hardcoded `summary` (not `summary_large_image`)
- No `meta name="robots"`, no `meta name="author"`, no `hreflang`, no
  `<link rel="alternate">`

### Native JSON-LD schema emdash emits (verified)

Exactly one JSON-LD block, identical on every page (homepage, pricing,
contact):

```html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Acme","url":"http://localhost:4321"}</script>
```

@types emitted natively: **`WebSite` only.**

Explicitly checked and **NOT** emitted by emdash, even where the rendered page
has the corresponding content visible in the body:

- `LocalBusiness` — none
- `Organization` — none
- `Service` — none
- `BreadcrumbList` — none
- `FAQPage` — **none, despite the homepage and contact page rendering a visible
  FAQ section** (the marketing template has an FAQ accordion; emdash emits no
  FAQ schema for it)

The `WebSite` schema is also minimal (`name` + `url` only — no
`potentialAction`/SearchAction, no `publisher`).

### Nico's schema components (the fork's, for the keep/drop comparison)

The fork ships SEO/schema as plugin methodology (agent specs), not Astro
components in this repo, but it specifies discrete schema emitters and audits
them as hard requirements (`plugins/website-builder/agents/seo-auditor.md`
§3.1–3.3):

- `WebSiteSchema` — homepage only
- `LocalBusinessSchema` — homepage + every location page; requires `@type`,
  `name`, `url`, `telephone`, `email`, `address` (`PostalAddress`),
  `openingHoursSpecification`
- `ServiceSchema` — every service page; requires `name`, `description`,
  `provider`, `areaServed`
- `BreadcrumbSchema` — every non-home page; requires `position` integers + abs URLs
- `FAQSchema` — every page with an FAQ section; ≥2 Q/A pairs
- All emitted XSS-safe via `set:html={JSON.stringify(schema)}`

### Decision (per spec §2 — default keep Nico's; burden of proof is on dropping)

Rule: drop a commodity emitter only if emdash **provably** already does the
identical job. For schema the bar is: emdash natively emits **LocalBusiness AND
Service AND FAQPage AND BreadcrumbList to a usable standard.**

Evidence: emdash emits **`WebSite` only**. It emits **none** of LocalBusiness,
Service, FAQPage, or BreadcrumbList — confirmed against fully rendered output,
including a page that visibly has FAQ content but produces no FAQPage schema.

**Recommendation: KEEP Nico's schema components.** Specifically, emdash lacks
and Nico must continue to supply:

| Nico component | emdash native? | Verdict |
|---|---|---|
| `LocalBusinessSchema` | No | **KEEP** — emdash emits nothing |
| `ServiceSchema` | No | **KEEP** — emdash emits nothing |
| `FAQSchema` (FAQPage) | No | **KEEP** — emdash emits nothing even with visible FAQ |
| `BreadcrumbSchema` (BreadcrumbList) | No | **KEEP** — emdash emits nothing |
| `WebSiteSchema` | Partial (`WebSite` name+url, homepage-wide via every page) | **KEEP Nico's** — emdash's is minimal and emitted site-wide, not homepage-only as Nico's audit requires; not the identical job. Low-priority dedup candidate only if emdash's `WebSite` is later scoped to homepage and enriched. |

Net: no schema emitter can be dropped on the strength of emdash's native
output. The local-business schema suite (LocalBusiness / Service / FAQ /
Breadcrumb) is the core SEO value of Nico's plugin and emdash does not replicate
any of it.

**Related (Open Item A, SEO-head side — for the SEO-head keep/drop task):**
emdash's native head covers title/description/canonical/OG/Twitter basics, but
omits `og:image` and `twitter:image` entirely and hardcodes `twitter:card` to
`summary`. Any decision to drop Nico's SEO head must account for the missing
social image tags. (Flagged here as evidence; the head keep/drop decision is a
separate task.)
