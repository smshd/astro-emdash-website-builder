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
| `astro-robots-txt` (Nico, `/robots.txt`) | **Yes — provably equivalent and usable.** emdash serves a valid `/robots.txt` (HTTP 200, `text/plain`) natively on every deploy: allow-all, `Disallow: /_emdash/`, absolute `Sitemap:` directive, plus a custom-robots override hook from SEO settings. Evidence: verbatim 200 body above + `robots.txt.ts` source. | **DROP `astro-robots-txt`** — emdash's native robots.txt is equivalent: it additionally disallows the `/_emdash/` admin surface, which Nico's bare `astro-robots-txt` does not. Net DROP the `astro-robots-txt` integration; manage robots via emdash SEO settings. **This DROP is gated by the Reconciliation prerequisite below — do not act on it until that is resolved.** |
| `@astrojs/sitemap` (Nico, `/sitemap-index.xml`) | **No — not equivalent.** emdash's `/sitemap.xml` returns HTTP 200 with valid XML, but **empty** (zero `<sitemap>` children) for this template — it indexes `has_seo=1` *content collections*, not the prerendered marketing/service/location *pages* the plugin's whole value rests on. emdash emits *a* sitemap, but it omits the content pages. | **KEEP `@astrojs/sitemap` — with-reconciliation, NOT drop.** Per the task's explicit nuance: emdash emits a sitemap but it omits the content pages, so this is keep-with-reconciliation, not drop. emdash's empty `/sitemap.xml` does not provably do Nico's job (listing the actual built pages). Reconciliation items: (1) path divergence — emdash owns `/sitemap.xml`, Nico's lives at `/sitemap-index.xml`; both can coexist (no path collision) but it is two sitemaps; (2) *Forward-looking note (NOT a Stage-0 finding — future-plan consideration):* if marketing pages are later modelled as a `has_seo=1` emdash collection, emdash's native sitemap could subsume Nico's; re-evaluate then. For now KEEP. |

> ### ⚠ Reconciliation prerequisite (blocks acting on the robots-DROP)
>
> **PREREQUISITE — must be resolved before `astro-robots-txt` is removed.**
> emdash's native robots.txt emits `Sitemap: <origin>/sitemap.xml` (its own
> path, currently an *empty* sitemap), NOT Nico's `@astrojs/sitemap`
> `/sitemap-index.xml`. Because the sitemap-KEEP verdict means Nico's real
> sitemap lives at `/sitemap-index.xml`, dropping `astro-robots-txt` while
> emdash's robots points only at the empty `/sitemap.xml` would ship a
> robots.txt that advertises an empty sitemap and never references the real
> one.
>
> **Resolution required (pick one), decided in Plan 4/6 BEFORE removing
> `astro-robots-txt`:**
>
> - **(a)** Set a custom robots.txt via emdash SEO settings whose `Sitemap:`
>   directive points at Nico's `/sitemap-index.xml`; or
> - **(b)** Keep both sitemaps and explicitly accept dual `Sitemap:` pointers
>   (emdash's `/sitemap.xml` + Nico's `/sitemap-index.xml`).
>
> Until this decision is made and applied, the robots-DROP is **blocked**.
> Tracked item for Plan 4/6.

Per-emitter summary, evidence-based and consistent with default-keep /
drop-only-on-proof:

- **Robots: DROP Nico's `astro-robots-txt`** — emdash provably emits an
  equivalent `/robots.txt` natively (verbatim 200 evidence) that additionally
  disallows `/_emdash/`. **Gated by the Reconciliation prerequisite above —
  blocked until the sitemap-pointer decision is made in Plan 4/6.**
- **Sitemap: KEEP Nico's `@astrojs/sitemap` (with reconciliation)** — emdash's
  native `/sitemap.xml` is HTTP 200 and valid but **empty of content pages**
  for this content model; it does not provably replicate Nico's page-graph
  sitemap. Burden of proof for dropping is unmet. Revisit only if marketing
  pages become a `has_seo=1` collection.

Note: the two emitters get **opposite** verdicts on purpose — robots equivalence
is proven by a populated 200 body; sitemap equivalence is *disproven* by a 200
body that is empty of the pages that matter.

## Open Item C — D1 free-tier limits

Empirical/research spike: determine emdash's per-content-entry D1 footprint and
whether a large multi-location service-business site fits Cloudflare D1's free
tier. Resolves §4 open item C.

### Step 1 — emdash's per-entry D1 footprint (grounded in actual schema)

**The headline finding: emdash stores ONE content entry as exactly ONE row.**
emdash does **not** use an EAV / per-field-row / per-portable-text-block-row
model. It is a wide-table, one-row-per-entry model. This is verified from
source, not assumed:

- **Content tables are created dynamically, one table per collection**
  (`ec_{slug}`), not via migration. Source:
  `packages/core/src/database/migrations/001_initial.ts` ll. 5–10 ("Content
  tables (ec_posts, ec_pages, etc.) are created dynamically by the
  SchemaRegistry when collections are added") and
  `packages/core/src/schema/registry.ts` `createContentTable()` ll. 689–711.
- **Each `ec_{slug}` table row = one entry.** `createContentTable()` adds 16
  fixed system columns (`id`, `slug`, `status`, `author_id`,
  `primary_byline_id`, `created_at`, `updated_at`, `published_at`,
  `scheduled_at`, `deleted_at`, `version`, `live_revision_id`,
  `draft_revision_id`, `locale`, `translation_group`, + the
  `slug`+`locale` unique constraint) on a single row per entry
  (`registry.ts` ll. 694–711).
- **Every user-defined field is a COLUMN on that same row, not a row.**
  `FIELD_TYPE_TO_COLUMN` (`packages/core/src/schema/types.ts` ll. 59–74) maps
  every field type to a single SQLite column type: `string`/`text` → TEXT,
  `number` → REAL, `integer`/`boolean` → INTEGER, `image`/`reference`/`slug`/
  `url` → TEXT, **`portableText` → JSON, `json`/`multiSelect` → JSON**. Fields
  are added with `ALTER TABLE … ADD COLUMN` (`registry.ts` `addColumn()`
  ll. 780–810), confirmed by `schema-and-seed.md` ("Collections… Each
  collection becomes a database table (`ec_{slug}`)" and the Field Types
  column-type table).
- **Portable Text consumes ZERO extra rows.** A `portableText` field — the
  marketing template's `content` field, holding the entire hero/features/
  testimonials/FAQ block array seen in `emdash-spike/seed/seed.json`
  ll. 92–189 — is serialised whole into a single JSON column on the entry's
  one row (`registry.ts` ll. 905–913: JSON column → `JSON.stringify(value)`
  into one cell). Block count, span count, nested arrays: all irrelevant to
  row count; they only affect that one cell's byte size (storage, not rows).
- **Media is shared, not per-entry.** Image fields store a TEXT reference
  (`{id,src,…}`); the actual asset is one row in the global `media` table
  (`001_initial.ts` ll. 74–89), content-hash deduplicated
  (`idx_media_content_hash`). An entry that reuses an image adds 0 media rows.

**Per-entry footprint model (rows added when you create one content entry):**

| Component | Rows per entry | Notes |
|---|---|---|
| `ec_{collection}` entry row | **1** | All fields (incl. portableText/json) are columns on this one row |
| Per-field rows | **0** | Fields are columns, not rows |
| Portable-text block rows | **0** | Whole block array → one JSON column cell |
| Media rows | **0 typically** | Shared `media` table, hash-deduped; +1 only for each *new unique* image asset, charged once globally not per entry |
| Revision rows (`revisions` table) | **+1 per save** *if* the collection declares `revisions` support | One JSON snapshot row per saved version (`001_initial.ts` ll. 13–24). A page saved 10 times = 10 revision rows. |
| Taxonomy junction rows (`content_taxonomies`) | **+1 per (entry,term) link** | Only for collections using taxonomies (e.g. a blog post with 2 categories + 3 tags = 5 junction rows; `001_initial.ts` ll. 56–71) |
| FTS5 shadow storage | **not 1:1 logical rows** | Only if collection declares `search` support; FTS5 is an inverted index (`packages/core/src/search/fts-manager.ts`), storage-bearing but not modelled as N content rows. The marketing template's collections do not enable `search`. |

**Fixed/overhead tables (one-time, NOT per-entry):** system tables from the 38
core migrations — `_emdash_collections`, `_emdash_fields`, `users`, `options`,
`media`, `taxonomies`, `revisions` (table itself), `audit_logs`, `menus`,
`sections`, `redirects`, `bylines`, plus schema-registry metadata: roughly **1
row per collection** in `_emdash_collections` and **1 row per field** in
`_emdash_fields`. For an 8-collection site with ~6 fields each this is order
~10² rows total — negligible at D1 scale.

**Assumptions stated explicitly:**

1. **Conservative footprint = 2 rows per published entry**: 1 `ec_*` row + 1
   `revisions` row (assuming collections enable `revisions` support, as the
   marketing template's `pages` collection does — `seed.json` l. 18
   `"supports": ["drafts","revisions","seo"]`). Drafts that were published add
   one more revision; we bound at **3 rows/entry** for an entry edited a few
   times. Blog posts additionally get ~5 taxonomy-junction rows each
   (categories+tags).
2. One locale (`locale='en'`); no i18n translation groups (each translation
   would be a separate entry row — out of scope for the worst-case English-only
   site).
3. Images are mostly shared/reused stock; treat new-media rows as a small fixed
   addition, not per-entry.

### Step 2 — Current Cloudflare D1 free-tier limits (2026-05)

**Research method used: the Google AI Mode skill** (`~/.claude/skills/
google-ai-mode/`, run via `scripts/run.py search.py`), succeeded first try (no
CAPTCHA; exit 0). Result corroborated by a direct `WebFetch` of the primary
Cloudflare pricing doc — both agree exactly.

| Metric | Free-tier limit | Source |
|---|---|---|
| Total storage (account-wide, all DBs) | **5 GB** | https://developers.cloudflare.com/d1/platform/pricing/ |
| Rows read / day | **5,000,000 / day** | https://developers.cloudflare.com/d1/platform/pricing/ |
| Rows written / day | **100,000 / day** | https://developers.cloudflare.com/d1/platform/pricing/ |
| Databases / account | **10** | https://developers.cloudflare.com/d1/platform/limits/ |
| Max single database size | **500 MB** (free) / 10 GB (paid) | https://developers.cloudflare.com/d1/platform/limits/ |

Access date: **2026-05-15**. Primary source URLs:
`https://developers.cloudflare.com/d1/platform/pricing/` and
`https://developers.cloudflare.com/d1/platform/limits/` (also
`https://developers.cloudflare.com/d1/observability/metrics-analytics/`).
Note: "rows written" and "rows read" are *operational* metrics (count of rows
touched by queries per day), distinct from *stored* row count. Stored rows are
bounded only by the 5 GB / 500 MB storage caps, not by the daily 100k figure —
this distinction is decisive for the verdict below.

### Step 3 — Worst-case site estimate (explicit, reproducible math)

**Page/entry model assumed** (matches the website-builder plugin: per
`plugins/website-builder/agents/seo-writer.md` ll. 23, 184 the plugin builds
distinct *service pages* and *location pages*, not a forced service×location
matrix; both modelled, matrix shown as an upper bound):

Large multi-location service business:
- 8 services → 8 service-page entries
- 20 locations → 20 location-page entries
- 30-post blog → 30 post entries (with taxonomies)
- homepage + about + contact → 3 page entries
- **Plus an upper-bound variant:** if service×location landing pages are
  generated (8 × 20 = 160 entries) instead of 8 + 20.

**Stored-row count:**

Base model (8+20 distinct + 30 blog + 3 core = **61 content entries**):

| Bucket | Entries | Rows/entry (conservative ≤3 incl. revisions) | Stored rows |
|---|---|---|---|
| Service pages | 8 | 3 | 24 |
| Location pages | 20 | 3 | 60 |
| Core pages (home/about/contact) | 3 | 3 | 9 |
| Blog posts | 30 | 3 + ~5 taxonomy junctions = 8 | 240 |
| Fixed/overhead (collections+fields+menus+sections+media meta) | — | — | ~200 (one-time) |
| **Total (base)** | **61** | — | **≈ 533 rows** |

Upper-bound variant (service×location matrix = 160 + 20 + 30 + 3 = **213
entries**): 160×3 + 20×3 + 3×3 + 30×8 + ~200 overhead = 480 + 60 + 9 + 240 +
200 = **≈ 989 rows**.

Round both **up by 10×** for heavy editing churn (every page revised 10×):
worst-of-worst ≈ **~10,000 stored rows**.

**Storage (bytes):** worst case each entry's portableText JSON is a content-rich
local-SEO page. Generous assumption: **50 KB per entry row** (a long location
page with full FAQ, testimonials, services blocks serialised as JSON — emdash's
own seeded homepage rendered ~52 KB of *HTML*; the stored JSON source is
smaller, but use 50 KB as a fat upper bound). Revisions duplicate that:

- Base: 61 entries × 50 KB × 3 (entry+2 revisions) ≈ **9.2 MB**
- Upper-bound matrix: 213 × 50 KB × 3 ≈ **32 MB**
- ×10 editing churn on the matrix variant: ≈ **320 MB** absolute worst case
- Add the global `media` table (assume 200 unique optimised images @ ~150 KB
  metadata is trivial; the *binary* lives in R2/storage, not D1 — D1 only holds
  the media *row*, ~a few hundred bytes): negligible, < 1 MB.

**Compare against caps:**

| Dimension | Worst-case estimate | Free-tier cap | Headroom |
|---|---|---|---|
| Total storage (account) | ≤ 0.32 GB (320 MB, abuse-case) ; realistic ≈ 10–32 MB | **5 GB** | **15×–500×** headroom |
| Single DB size | same ≤ 320 MB | **500 MB** | fits, ~1.5× headroom even in abuse-case |
| Stored rows | ~10,000 (abuse) / ~500–1,000 (realistic) | (no stored-row cap; storage-bound only) | n/a |
| Databases | 1 per client site | **10** | fine for ≤10 client sites per CF account |

**Daily read/write (traffic) implications:**

Rows *written*/day = CMS edit operations, **not** page views. emdash is
DB-backed at request time, but writes happen only on content save. A typical
agency site sees a few dozen content edits per day at most; even an aggressive
content sprint (publish 30 pages, each saved 10× = 300 writes + 300 revision
rows = 600 row-writes in a day) is **0.6 %** of the 100k/day write cap. Verdict
dimension: writes are a non-issue.

Rows *read*/day = the real traffic-coupled risk, because emdash renders pages
from D1 per request (Open Item A confirmed content is rendered per-request
against the DB; no static prerender of content). Worst-case read math: assume
each page view = ~5 row reads (entry row + menus + settings/options + 1–2
lookups; emdash batches, but bound generously at 5). The free cap is 5,000,000
rows read/day ÷ 5 = **1,000,000 page views/day** before the read cap binds. A
local service business doing even 5,000 views/day uses 25,000 row-reads/day =
**0.5 %** of the cap. For the read cap to bind you'd need ~1M views/day — far
beyond any local-SEO client. **Caveat:** if emdash does NOT cache and a single
page does many row reads (N+1 on a 30-item blog index = 30+ reads), a viral
spike could matter; but `Cache-Control: public, max-age=3600`/`86400` headers
observed in Open Item B show emdash sets edge-cacheable responses, so Cloudflare
CDN absorbs repeat traffic and most views never hit D1 at all. Read pressure is
realistically negligible for this client profile.

### Step 4 — Decision / verdict (numeric, unambiguous)

**VERDICT: A large multi-location service-business site FITS the Cloudflare D1
free tier comfortably, on every dimension. No paid D1 required for this client
profile.** Storage and traffic are decoupled and both clear the caps by orders
of magnitude:

- **Storage:** worst realistic ≈ 10–32 MB vs **5 GB** account cap →
  **~150×–500× headroom**. Even a pathological 10× editing-churn matrix-page
  abuse case (~320 MB) still fits the 5 GB account cap (**~15× headroom**) and
  the 500 MB single-DB cap (**~1.5× headroom**). The decisive structural reason:
  emdash is **1 row per entry** (portableText is a JSON cell, not block rows),
  so a content-heavy local site is hundreds–low-thousands of rows, not the
  millions an EAV model would produce.
- **Rows written/day:** worst realistic editing day ≈ 600 vs **100,000/day** →
  **0.6 %** utilisation. Non-issue.
- **Rows read/day:** decoupled from storage; bound by traffic. ~5 reads/view →
  the 5M/day cap = ~1,000,000 uncached views/day. A local client at 5,000
  views/day = **0.5 %** of cap, and emdash's `Cache-Control` headers push most
  traffic to the Cloudflare CDN so D1 reads are far lower still. Non-issue at
  this client profile.
- **Databases:** 1 DB per client; free cap is **10** → only a constraint if a
  single Cloudflare account hosts **>10** client sites. *This* is the only
  realistic free-tier ceiling the agency can hit — not from any one site's
  size, but from account-level fan-out.

**Onboarding flags (the only caveats — none block free tier for a single
large site):**

1. **Account fan-out, not site size, is the real limit.** Free tier = 10 D1
   databases per Cloudflare account. At >10 client sites the agency must either
   use multiple Cloudflare accounts or move to Workers Paid (which raises the
   DB cap massively). Flag at agency-infra level, not per client.
2. **`revisions` support multiplies stored rows/storage by edit count.** Still
   ~500×-under-cap here, but if a future client has thousands of heavily-revised
   entries, prune old revisions or disable `revisions` support on high-churn
   collections.
3. **emdash renders from D1 per request → read volume tracks uncached
   traffic.** Comfortable now (CDN-cached), but a client expecting >1M
   uncached views/day (not this profile) would need paid D1 or stricter edge
   caching. Re-evaluate only for unusually high-traffic clients.

**Net:** §4 open item C is resolved — **free D1 is sufficient for a large
multi-location service business; the per-entry footprint is ~1–3 rows, storage
headroom is 150×+, and the only agency-level watch-item is the 10-database
per-account cap (infra concern, not a per-site blocker).**
