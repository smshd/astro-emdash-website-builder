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
3. Start Astro directly with the same env var emdash's CLI would have set.
   The backslash form `EMDASH_DATABASE_URL="file:C:\Coding\_study\emdash-spike\data.db" npx astro dev --port 4321`
   is exactly what was run in this spike and it **did work empirically** (server
   served HTTP 200 with the seed applied). However, backslashes in a SQLite
   `file:` URI are not portable and can fail silently with other drivers or
   shells, so later plans should prefer the safe portable form with a `file:///`
   absolute prefix and forward slashes (recommended):
   `EMDASH_DATABASE_URL="file:///C:/Coding/_study/emdash-spike/data.db" npx astro dev --port 4321`
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
| `WebSiteSchema` | Partial (`WebSite` name+url, homepage-wide via every page) | **KEEP Nico's** — emdash's is minimal and emitted site-wide (identical block on `/`, `/pricing`, `/contact`), whereas Nico's audit hard-requires it homepage-only (`seo-auditor.md` §3.1: "`WebSiteSchema` present on homepage ONLY"). Different scope, so not the identical job. Low-priority dedup candidate only if emdash's `WebSite` is later scoped to homepage and enriched. |

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

## Open Item B — sitemap/robots

Empirical spike: determine exactly what emdash emits natively for sitemap and
robots, then a keep-or-drop decision per emitter against Nico's stack
(`@astrojs/sitemap` + `astro-robots-txt`). Same throwaway spike, same
local-dev/seed procedure as Open Item A (server served HTTP 200 with the
"Acme" seed applied; DB `./data.db` migrated; started with
`EMDASH_DATABASE_URL="file:///C:/Coding/_study/emdash-spike/data.db" npx astro dev --port 4321`).

### HTTP results (verified against the running seeded server)

Fetched with `curl -s -D <hdr> -o <body> -w "%{http_code}"`. All four paths
hit emdash's own injected routes (not Astro's static 404) — confirmed by the
emdash-specific `Cache-Control` headers from the route source.

| Path | HTTP | Content-Type | Cache-Control | Body (verbatim) |
|---|---|---|---|---|
| `/sitemap.xml` | **200** | `application/xml; charset=utf-8` | `public, max-age=3600` | valid but **empty** sitemap index (see below) |
| `/sitemap-index.xml` | **404** | `application/xml` | (none) | `<!-- Collection not found or empty -->` |
| `/sitemap-0.xml` | **500** | `application/xml` | (none) | `<!-- EmDash not configured -->` |
| `/robots.txt` | **200** | `text/plain; charset=utf-8` | `public, max-age=86400` | emdash default robots (see below) |

`/sitemap.xml` body (verbatim, 121 bytes):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</sitemapindex>
```

`/robots.txt` body (verbatim, 120 bytes):

```
User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /_emdash/

Sitemap: http://localhost:4321/sitemap.xml
```

`/sitemap-index.xml` and `/sitemap-0.xml` are NOT emdash sitemap outputs: they
match emdash's `/sitemap-[collection].xml` route with `collection="index"` /
`collection="0"` respectively, so they 404 ("Collection not found or empty")
and 500 ("EmDash not configured") — they are *misses against the per-collection
route*, not the `@astrojs/sitemap` index/child files (those paths exist only
because `@astrojs/sitemap` uses them; emdash does not).

### What emdash emits natively (sitemap and robots — separately)

**Robots — emdash emits a complete, usable robots.txt natively.** Source:
`C:\Coding\_study\emdash\packages\core\src\astro\routes\robots.txt.ts` (route
injected at `/robots.txt` by `integration/routes.ts` ll. 706–709). Behaviour:
serves a custom robots.txt from SEO settings if configured, else a generated
default that allows all crawlers, disallows `/_emdash/`, and appends an
absolute `Sitemap:` directive. The spike (fresh seed, no custom robots set)
returned the generated default with `Sitemap: http://localhost:4321/sitemap.xml`
— a real, well-formed robots.txt with a working sitemap pointer. Absolute URL
derived from SEO-settings `url` or request origin.

**Sitemap — emdash emits a structurally valid sitemap natively, but it lists
ZERO content pages for this template's content model.** Source:
`sitemap.xml.ts` (sitemap *index*) + `sitemap-[collection].xml.ts` (per-collection
child) + `api/handlers/seo.ts::handleSitemapData`. The index enumerates only
collections where `_emdash_collections.has_seo = 1`, each producing a child
`/sitemap-{collection}.xml` of published, non-noindex entries with absolute
`<loc>` URLs (built from the collection's `url_pattern`). Empirically the index
came back **well-formed but empty** — `<sitemapindex>` with no `<sitemap>`
children — because the seeded marketing template's pages (`/`, `/pricing`,
`/contact`, verified rendering 200 in Open Item A) are not members of a
`has_seo=1` content collection, so `handleSitemapData` enumerates nothing. So:
emdash's sitemap is correct in *form* (valid XML, absolute URLs when populated,
dynamic, DB-driven) but does **not** cover the static marketing content pages
this plugin builds. It is a collection sitemap, not a page sitemap.

Contrast with Nico's stack (`tech-builder.md` ll. 297–311, `seo-auditor.md`
§ ll. 32–40, `build-website.md` ll. 94–100): `@astrojs/sitemap` builds
`/sitemap-index.xml` + `/sitemap-0.xml` at build time over Astro's prerendered
page graph (every static marketing/service/location page), requiring `site:` in
`astro.config.mjs`; `astro-robots-txt` emits `/robots.txt` at build referencing
that sitemap. Different mechanism (build-time over the page graph) and different
coverage (the actual content pages) from emdash's runtime collection sitemap.

### Decision (per spec §2 — default keep Nico's; drop only on proof of equivalence)

Rule: drop a commodity emitter only if emdash **provably** already produces an
equivalent, usable output. Sitemap and robots decided independently.

| Emitter | emdash native equivalent? | Verdict |
|---|---|---|
| `astro-robots-txt` (Nico, `/robots.txt`) | **Yes — provably equivalent and usable.** emdash serves a valid `/robots.txt` (HTTP 200, `text/plain`) natively on every deploy: allow-all, `Disallow: /_emdash/`, absolute `Sitemap:` directive, plus a custom-robots override hook from SEO settings. Evidence: verbatim 200 body above + `robots.txt.ts` source. | **DROP `astro-robots-txt`** — emdash's native robots.txt is equivalent and arguably better (it also hides the `/_emdash/` admin surface, which Nico's bare `robotsTxt()` does not). **Reconciliation required:** emdash's robots points at `/sitemap.xml` (its own path), not Nico's `/sitemap-index.xml`. If Nico's sitemap is kept (below), either (a) set emdash SEO-settings `robotsTxt` to a custom value referencing `/sitemap-index.xml`, or (b) accept two sitemap pointers. Net still DROP the `astro-robots-txt` integration; manage robots via emdash SEO settings. |
| `@astrojs/sitemap` (Nico, `/sitemap-index.xml`) | **No — not equivalent.** emdash's `/sitemap.xml` returns HTTP 200 with valid XML, but **empty** (zero `<sitemap>` children) for this template — it indexes `has_seo=1` *content collections*, not the prerendered marketing/service/location *pages* the plugin's whole value rests on. emdash emits *a* sitemap, but it omits the content pages. | **KEEP `@astrojs/sitemap` — with-reconciliation, NOT drop.** Per the task's explicit nuance: emdash emits a sitemap but it omits the content pages, so this is keep-with-reconciliation, not drop. emdash's empty `/sitemap.xml` does not provably do Nico's job (listing the actual built pages). Reconciliation items: (1) path divergence — emdash owns `/sitemap.xml`, Nico's lives at `/sitemap-index.xml`; both can coexist (no path collision) but it is two sitemaps; (2) longer-term, if marketing pages are modelled as a `has_seo=1` emdash collection, emdash's native sitemap could subsume Nico's — re-evaluate then. For now KEEP. |

Per-emitter summary, evidence-based and consistent with default-keep /
drop-only-on-proof:

- **Robots: DROP Nico's `astro-robots-txt`** — emdash provably emits an
  equivalent, usable, arguably-superior `/robots.txt` natively (verbatim 200
  evidence). Reconcile the sitemap pointer via emdash SEO settings.
- **Sitemap: KEEP Nico's `@astrojs/sitemap` (with reconciliation)** — emdash's
  native `/sitemap.xml` is HTTP 200 and valid but **empty of content pages**
  for this content model; it does not provably replicate Nico's page-graph
  sitemap. Burden of proof for dropping is unmet. Revisit only if marketing
  pages become a `has_seo=1` collection.

Note: the two emitters get **opposite** verdicts on purpose — robots equivalence
is proven by a populated 200 body; sitemap equivalence is *disproven* by a 200
body that is empty of the pages that matter.
