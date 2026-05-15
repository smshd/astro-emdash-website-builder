# Robots / Sitemap Reconciliation Decision (Plan 4 — owner)

## Status

RESOLVED. Decision: Option (a). This file is the HARD GATE for Plan 6's astro-robots-txt removal. Plan 6 MUST NOT remove astro-robots-txt unless this file exists and Status is RESOLVED.

## Context

- **Open Item B — "⚠ Reconciliation prerequisite"** (`docs/stage0-findings.md:260-280`): emdash's native `/robots.txt` route emits `Sitemap: <origin>/sitemap.xml` by default — emdash's own sitemap path, which is an empty collection sitemap for this content model (indexes only `has_seo=1` collections; the built marketing/service/location pages are not such a collection).
- **Locked Decisions — "BLOCKER on the robots-DROP"** (`docs/stage0-findings.md:574-582`): removal of `astro-robots-txt` is blocked until the sitemap pointer is reconciled. Nico's `@astrojs/sitemap` at `/sitemap-index.xml` is the real page-graph sitemap and is KEPT (locked verdict).
- **Spec §4 resolved-B** (`plugins/website-builder/references/emdash-scaffold.md` spec §4-B): confirms the reconciliation approach and gates Plan 6 on this decision artifact.
- **Source**: emdash's `/robots.txt` route serves a custom robots.txt from SEO settings if configured, else the generated default (`C:\Coding\_study\emdash\packages\core\src\astro\routes\robots.txt.ts`).

## Decision

Option (a): set a custom robots.txt via emdash SEO settings whose single `Sitemap:` directive is the absolute URL of Nico's `@astrojs/sitemap` index (`https://<production-domain>/sitemap-index.xml`). Do NOT advertise emdash's `/sitemap.xml`.

## Rationale

- emdash's native `/sitemap.xml` is empty of content pages for this content model (stage0-findings Open Item B: indexes only `has_seo=1` collections; the built marketing/service/location pages are not such a collection). Advertising an empty sitemap to crawlers is actively worse than advertising the populated one.
- Nico's `@astrojs/sitemap` `/sitemap-index.xml` is the real page-graph sitemap and is KEPT (locked verdict). Crawlers should be pointed at exactly one authoritative sitemap, and it must be the populated one.
- Option (b) (dual `Sitemap:` pointers) ships a robots.txt that still advertises the empty `/sitemap.xml` alongside the real one. There is no concrete benefit to advertising an empty sitemap, and it risks crawlers wasting budget / treating the empty index as authoritative. No concrete reason for (b) was found, so (a) is chosen.

## Implementation (exact emdash change required)

emdash's `/robots.txt` route serves a custom robots.txt when one is configured in SEO settings (else the generated default). The reconciliation is applied by configuring emdash's SEO settings custom-robots value. The exact custom robots.txt body to set:

```
User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /_emdash/

Sitemap: https://<PRODUCTION_DOMAIN>/sitemap-index.xml
```

This preserves emdash's own `Disallow: /_emdash/` — do not lose it; that is the reason emdash's robots is considered superior to bare `astro-robots-txt`.

`<PRODUCTION_DOMAIN>` is substituted at build/deploy from the client's confirmed production domain (the same value Nico's `@astrojs/sitemap` needs as `site:` in `astro.config.mjs`).

WHERE this is set: via emdash SEO settings (the custom-robots field consumed by `packages/core/src/astro/routes/robots.txt.ts`), seeded through `seed/seed.json` `settings`/SEO config or set in the emdash admin SEO settings during the build pipeline — Plan 6 owns wiring the exact mechanism into `/build-website`; this doc fixes WHAT the value must be.

## Gate contract for Plan 6

Plan 6 reads this file. Precondition to remove `astro-robots-txt`: this file exists AND `## Status` = RESOLVED AND the custom robots.txt body above is applied via emdash SEO settings in the build pipeline AND it has been verified that `/robots.txt` on a built/preview deploy emits the `Sitemap: .../sitemap-index.xml` line and NOT `Sitemap: .../sitemap.xml`. If any precondition fails, `astro-robots-txt` stays.

## What was explicitly rejected

**Option (b)** (dual `Sitemap:` pointers — both `/sitemap.xml` and `/sitemap-index.xml`): rejected because it advertises an empty sitemap alongside the real one. There is no concrete benefit to pointing crawlers at an empty sitemap, and it risks crawlers wasting crawl budget or treating the empty index as authoritative. No concrete reason for (b) was found during Plan 4 analysis.
