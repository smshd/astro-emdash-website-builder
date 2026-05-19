---
name: build-website
description: Runs an onboarding questionnaire and builds a complete SEO-optimized Astro website for a service-based business, deploying to Cloudflare.
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion", "Task", "Skill"]
---

# Website Builder Orchestrator

You are the lead architect of a professional web agency team. You run onboarding, coordinate specialist agents, and deliver a fully built, SEO-optimised **emdash** (Astro 6 / Cloudflare Worker / D1+R2) website for a service business. Every site looks like an award-winning studio built it, not a template. Australian English throughout.

Work through the steps in order. Do NOT skip steps. The numbered `STEP` headings map to the design-spec stages as follows (this map is authoritative; do not renumber the STEP headings):

| Spec Stage (design §5) | Command STEP | What runs |
|---|---|---|
| Stage 0 — Scaffold + smoke test | **STEP 0** | emdash scaffold, `.dev.vars` gate, per-client repo |
| Stage 1 — Onboarding | **STEP 1** | Nico's 10 onboarding questions |
| Stage 2 — SEO research & architecture | **STEP 1.5** | seo-researcher + John approval gate |
| (palette helper) | **STEP 2** | Claude-vision palette extraction |
| Stage 3 — Content | **STEP 3 + STEP 4 (seo-writer)** | seo-writer against approved briefs → mandatory AU rewrite pass → emdash seed.json |
| Stage 4 — Build | **STEP 4 (tech-builder) + STEP 5** | tech-builder ports Nico's design into emdash; integrate content |
| Stage 5 — Imagery | **STEP 7** | gpt-image (gpt-image-2, webp); replace $media placeholders |
| Stage 6 — Audit | **STEP 5.5 + STEP 6** | design self-review, then seo-auditor (Sections 1–12), loop to PASS |
| Stage 7 — Deploy | **STEP 8 + STEP 9** | `astro build && wrangler deploy` → STOP at preview, never auto-promote |

---

## STEP 0: Scaffold the emdash Project + Secret-Hygiene Gate (Spec Stage 0)

Do this FIRST, in the empty per-client folder where `/build-website` was invoked. Follow `plugins/website-builder/references/emdash-scaffold.md` exactly (authored by the tech-builder/scaffold plan — do not redefine the commands here; that reference is the single source of truth). In summary it:

1. Scaffolds via the exact command in `references/emdash-scaffold.md` §1 (`npx create-emdash <client-dir> --template cloudflare:marketing --pm npm --yes` — do not restate or vary it here; the `npm create emdash@latest` form silently strips flags on npm 10 and FAILS, per the Plan 3 smoke test).
2. Comments out the `worker_loaders` block in `wrangler.jsonc` (R1 — sandboxed plugins off, free tier).
3. **`.dev.vars` secret-hygiene GATE (mandatory, BEFORE the first commit):** ensure `.gitignore` contains `.dev.vars` and `.dev.vars.*` and assert `git status --porcelain` does NOT show `.dev.vars` staged. If `.dev.vars` is staged, abort and `git rm --cached .dev.vars` before proceeding. The scaffold MUST NOT be committed until this passes.
4. Creates the per-client `smshd` private repo and makes the first commit only after the gate passes.
5. Records the Windows-safe dev/seed workflow (`scripts/emdash-dev.mjs` from the fork) for later stages — emdash's `npx emdash dev` dies with `spawn npx ENOENT` on Windows and the template's `npm run dev` never seeds.

Do not proceed to STEP 1 until the scaffold exists, `worker_loaders` is commented out, the `.dev.vars` gate has passed, and the first commit is made.

---

## STEP 1: Onboarding Questionnaire

Ask the following questions using `AskUserQuestion`. Ask them one at a time and wait for each answer before continuing.

**Q1 -- Business basics:**
"What is your business name, tagline, phone number, email address, and physical address (or service area if you don't have a storefront)?"

**Q2 -- Services:**
"List every service you offer. For each one, give me: the service name, a 1-2 sentence description, and what makes you better at it than competitors (differentiator)."

**Q3 -- Locations:**
"What is your primary city/location? List any additional cities or service areas you want separate pages for."

**Q4 -- Value propositions:**
"What are your top 3-5 unique selling points? Why should someone choose you over every other option?"

**Q5 -- Tone:**
"What tone best describes your brand? Choose from: professional, friendly, authoritative, or local community-focused. You can combine two."

**Q6 -- Color palette:**
"Do you have brand colors? If yes, provide hex codes or color names. If you have an existing website or brand asset, you can provide a screenshot path and I'll extract the palette from it. If you have no preference, just say 'choose for me'."

**Q6b -- Design personality:**
"What design personality fits your brand? Choose one:
(a) Bold and modern: dramatic contrasts, sharp angles, strong typography
(b) Warm and approachable: soft curves, rounded shapes, inviting colors
(c) Sleek and minimal: refined whitespace, understated elegance, subtle motion
(d) Energetic and dynamic: vibrant gradients, playful motion, geometric shapes

Or say 'choose for me' and I'll pick the best fit based on your industry and tone."

**Q7 -- Social media:**
"Provide your social media handles for any platforms you use: Facebook, Instagram, LinkedIn, Google Business Profile, TikTok, YouTube."

**Q8 -- Testimonials:**
"Share any existing customer reviews or testimonials you want featured. Include the customer name (or first name + last initial), their quote, and optionally their location or service received."

**Q9 -- Business hours:**
"What are your hours of operation? Include any notes like 'emergency service available 24/7' or 'by appointment only'."

---

Once all 10 questions are answered (Q1 through Q9, including Q6b), confirm the collected information back to the user in a structured summary and ask: "Does this look correct? Type YES to continue or tell me what to change."

Do not proceed until the user confirms.

---

## STEP 1.5: SEO Research & Architecture (Stage 2 — DataForSEO)

This runs AFTER onboarding is confirmed and BEFORE any palette extraction, scaffolding, or specialist-agent work. No website content is written until John approves the data-backed sitemap and per-page keyword targets.

### Spawn the seo-researcher agent

Using the Task tool, spawn the **seo-researcher** agent. Pass it:
- Business name and primary service (Q1, Q2)
- The full services list with descriptions and differentiators (Q2)
- The primary city and all additional cities/service areas (Q3) — these are the AU locations all DataForSEO calls must be scoped to
- The client's own website domain if known (from Q1 or onboarding)
- The tone preference (Q5)

Instruct it to run the full 7-step methodology in its agent specification and write the four output artifacts plus `research-summary.md` into a `research/` folder in the current project working directory. It returns the absolute path to `research/research-summary.md`.

Wait for the seo-researcher agent to complete before proceeding.

### MANDATORY GATE: John approves the data-backed sitemap + per-page keyword targets

Read `research/research-summary.md` and present its contents to the user. Then ask, using `AskUserQuestion`:

"Here is the data-backed sitemap and the per-page keyword targets from the SEO research (DataForSEO, location-scoped to your cities). This determines exactly which pages get built and what each one targets — nothing is written until you approve it.

- Proposed pages: [list path · page type · primary keyword · volume · difficulty · funnel]
- TOFU/blog backlog: [count + top topics]
- Internal-link plan: [counts by relation]
- Any long-tail substitutions and why: [list]
- DataForSEO calls used this run: [tally]

Do you approve this sitemap and these keyword targets? Type YES to proceed to the build, or tell me what to change (add/remove a page, retarget a keyword, change a location). I will re-run or adjust the research and ask again."

Do not proceed past this gate until the user explicitly approves. If the user requests changes, re-spawn or adjust the seo-researcher run, regenerate the artifacts, and re-present this gate. The four artifacts in `research/` are the locked input for the seo-writer and seo-auditor — they must be approved before STEP 2.

---

## STEP 2: Colour Palette Extraction (Conditional — Claude vision, no image model)

If the user provided a screenshot path in Q6, **you (the orchestrator, multimodal) read the screenshot directly** with the Read tool and extract the 5-colour brand palette as hex: primary, secondary, accent, neutral-light, neutral-dark. Do NOT call an image model for analysis — gpt-image-2 is generation-only and nano-banana-pro is no longer the analysis path. Store the hex values for the tech-builder (Tailwind tokens via `@tailwindcss/vite`). If the user said "choose for me", select an industry/tone-appropriate professional palette.

---

## STEP 3: (Scaffold moved to STEP 0)

The project is already scaffolded as an emdash project in STEP 0 — there is NO `npm create astro` / Cloudflare Pages step. emdash's infra (`output:'server'`, `@astrojs/cloudflare`, D1 `DB` + R2 `MEDIA`, `main:"./src/worker.ts"`) replaces Nico's discarded `output:'hybrid'`/Pages config. The design system (Tailwind via `@tailwindcss/vite`, GSAP, Nico's components) and the KEPT `@astrojs/sitemap` are added by the tech-builder agent into the emdash scaffold in STEP 4. `astro-robots-txt` is NOT installed here — its keep/drop is decided by STEP 6.5 (gated on `references/robots-sitemap-decision.md`).

---

## STEP 4: Spawn Specialist Agents (Stage 3 content + Stage 4 build)

STEP 1.5's research artifacts in `research/` are APPROVED (the gate passed) before this step runs. Spawn both agents with the Task tool.

### tech-builder agent (Stage 4 — build into the emdash scaffold)
Pass: full onboarding data, the Step 2 palette, all services/locations, social, hours, testimonials, tone, design personality (Q6b), AND `research/sitemap.json` + `research/internal-link-map.json` (the data-derived page set and link topology — build exactly these pages, not "one page per onboarding service"). Instruct it to port Nico's design system into the **emdash scaffold** (server-rendered pages via `getEmDashCollection`/`getEmDashEntry`, Tailwind via `@tailwindcss/vite`, GSAP, the inline-SVG icon system from `references/icons/`), keep ALL Nico schema components + SEO head enrichment, keep `@astrojs/sitemap`, and obey R2 (never edit `src/live.config.ts` / generated `*-env.d.ts`). No `getStaticPaths`, no `content.config.ts`.

> **EVERY content page is emdash-driven (Defect 1 — CCC test 2026-05-18/19).** Explicitly instruct tech-builder that the visible copy of EVERY page — homepage, about, contact, every service/location page, every blog post, AND every client-specific sitemap page (why-us, experience, capability-statement, etc.) — MUST be fetched from an emdash collection at request time via `getEmDashEntry`/`getEmDashCollection`, mirroring the blog `posts/[slug].astro` pattern. Building the main pages as hardcoded `.astro` content while only the blog queries emdash is the exact failure the test caught — call it out as a HARD red flag. Require the tech-builder self-check #14 grep (every `src/pages/*.astro` route calls `getEmDashEntry`/`getEmDashCollection`) to pass before it reports done.

### seo-writer agent (Stage 3 — content against approved briefs, then mandatory AU pass)
Pass the same onboarding data PLUS `research/keyword-briefs.json` (the per-page primary keyword, secondary cluster, intent, SERP features, H1/title angle, top-3 competitor notes — this is the writer's input, not the raw onboarding service list) and `research/tofu-backlog.json` (blog/guide backlog). The writer applies Nico's rules against the briefs, then **a mandatory deterministic `rewrite` pass applies `references/au-writing-style-guide.md` + the `avo-writing-voice` skill** (precedence: AU guide > avo-writing-voice > Nico's en-US voice rules). Output is emdash collection entries (Portable Text) destined for `seed.json`; image fields use the `$media` form with `url` literal `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` (Stage 5 fills it).

Wait for BOTH agents before STEP 5.

---

## STEP 5: Integrate Content into the emdash seed (Stage 4)

Merge the seo-writer's AU-passed Portable Text content into the emdash `seed/seed.json` collection entries the tech-builder created: services, locations, pages (including every client-specific page — why-us, experience, capability-statement — as a `pages` collection entry, since per Defect 1 those pages render from emdash too), plus the blog/guide collection for the TOFU backlog. Set every page's meta title, meta description, H1, body, FAQs, CTAs, stats, breadcrumb labels, and internal links (per `research/internal-link-map.json`). Leave every image field's `$media.url` as the literal `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` token (Stage 5 replaces it with an http URL).

**Seeding is an EXPLICIT step, not "applies on first request" (Defect 2 — CCC test).** emdash's first-request auto-seed creates the collection SCHEMA ONLY (`includeContent` defaults false, no storage adapter — verified against emdash core `emdash-runtime.ts` / `seed/apply.ts`). Content entries AND `$media` are applied only by the explicit `npx emdash seed` CLI (`includeContent:true` + `LocalStorage`), which `scripts/emdash-dev.mjs` now runs as a required step. Verify locally with `node scripts/emdash-dev.mjs --cwd <client>` (it migrates, serves `seed/assets/` over loopback http, runs `npx emdash seed`, then starts Astro). Do NOT rely on `npx emdash dev`/auto-seed to apply content — it never does. See `references/emdash-scaffold.md` §8/§8a.

---

## STEP 5.5: Design Quality Review

Before handing off to the SEO auditor, run a design quality check against the generated code. Go through each category below and verify the implementation directly by reading the relevant files.

### Layout checks
- [ ] Homepage hero uses asymmetric split layout (NOT centered text over image)
- [ ] Service/location cards use bento grid layout with a featured first card
- [ ] Section transitions exist between differently-backgrounded sections (SectionDivider, clip-path, or gradient fade)
- [ ] Sections alternate between at least 2 background colors for visual rhythm
- [ ] Footer has 4-column layout with social icons, brand decoration, and back-to-top button

### Visual depth checks
- [ ] All box-shadows use brand-colored shadows (no default gray shadows)
- [ ] GradientMesh component exists and is used behind hero, testimonials, and CTA sections
- [ ] Glass-morphism cards include backdrop-blur-xl, border-white/20, and inset shadow highlight
- [ ] GrainOverlay component exists and is included in BaseLayout
- [ ] Noise/grain texture appears at 3-5% opacity

### Animation checks
- [ ] Hero heading uses split-word text reveal (each word clips up from hidden overflow)
- [ ] All section H2 headings have the `section-heading` class for scroll-triggered word reveal
- [ ] Primary buttons have shine sweep pseudo-element on hover
- [ ] Secondary buttons have border-fill animation on hover
- [ ] PageTransition component exists and is included in BaseLayout
- [ ] Header has scroll progress indicator bar (gradient, width tied to scroll %)
- [ ] FAQ accordion uses GSAP height animation with delayed text fade-in
- [ ] WhyUs icons animate with rotation on scroll enter
- [ ] All animations check for prefers-reduced-motion

### Typography checks
- [ ] Hero heading is text-5xl (mobile) to text-7xl (desktop)
- [ ] At least one heading per page uses gradient text (bg-clip-text text-transparent)
- [ ] Stats section numbers use text-8xl or larger
- [ ] Section padding is py-24 to py-32 (never less than py-16)

### Component polish checks
- [ ] FAQ has animated plus-to-minus icon (two crossing spans, not a static symbol)
- [ ] ContactForm uses floating labels (translate up on focus/filled)
- [ ] ContactForm has animated success checkmark (SVG stroke-dashoffset)
- [ ] Footer is fully designed (4-col, social icons in circles, gradient mesh or brand pattern)
- [ ] Testimonials use either ticker marquee or large featured quote (not a basic card grid)
- [ ] CTA sections have decorative rotating circle outlines

If any check fails, fix it directly before proceeding. Do not hand off to the auditor with known design quality issues.

---

## STEP 6: SEO Audit

Spawn the **seo-auditor agent** using the Task tool. Pass it:
- The full list of generated files
- The business data summary
- The per-client project path so it can start the dev/preview server
- Instructions to run its Step A FIRST (start `node scripts/emdash-dev.mjs --cwd <client>`, fetch every route, audit the SERVED HTML — not seed.json or source — for content/dash/AU/keyword checks per Defect 3), then run the full checklist (including Section 8: Design Quality)

The auditor will return a structured report (PASS/FAIL per check, with the route URL + offending rendered text for served-HTML checks and file:line for structural checks). A report that did not start the server and audit served HTML is invalid — it must be re-run, not accepted (this is the exact false-PASS the CCC test caught: em-dashes reported 0 from a seed-only scan while the rendered pages had 119).

If there are FAILs, address each one:
- Content failures: fix via seo-writer or directly
- Technical failures: fix via tech-builder or directly
- Design quality failures: fix via tech-builder or directly

Re-run the auditor until all checks PASS.

---

## STEP 6.5: Robots/Sitemap Decision — Gated astro-robots-txt Removal (Spec §4-B / stage0 blocker)

This is the ONLY commodity SEO drop and it is HARD-GATED on Plan 4's decision artifact. Do exactly this:

1. Read `plugins/website-builder/references/robots-sitemap-decision.md`.
2. **GATE:** if that file does NOT exist, OR its `## Status` is not `RESOLVED`:
   - **HARD-FAIL LOUD.** Print: "ROBOTS-DROP BLOCKED: plugins/website-builder/references/robots-sitemap-decision.md is missing or not RESOLVED (Plan 4 has not resolved the sitemap-pointer choice). Leaving `astro-robots-txt` IN PLACE. emdash's native robots.txt advertises an empty /sitemap.xml; removing astro-robots-txt now would ship a robots.txt that never references Nico's real /sitemap-index.xml."
   - Do NOT remove or disable `astro-robots-txt`. Do NOT modify emdash SEO settings. Proceed to STEP 7 with `astro-robots-txt` intact (the auditor Section 12.4 will record the gate as not-yet-resolved; this is expected and correct, not an audit failure of THIS step).
3. **If `## Status` is `RESOLVED`** with Option (a) (custom emdash SEO-settings robots.txt → Nico's `/sitemap-index.xml`):
   - Remove the `astro-robots-txt` integration from the relevant emdash/Astro config (it is NOT in `package.json` per STEP 3 — confirm it is also absent from any integrations array; if a prior step added it, remove it there).
   - Apply the decided custom robots.txt body from the decision file via emdash SEO settings so the served `/robots.txt` emits `Sitemap: <origin>/sitemap-index.xml` (Nico's real page-graph sitemap), NOT emdash's empty `/sitemap.xml`.
   - Verify on the built/preview deploy that `GET /robots.txt` contains exactly the `Sitemap: .../sitemap-index.xml` line and does not advertise `/sitemap.xml`.
4. **If `## Status` is `RESOLVED`** with Option (b) (dual pointers explicitly accepted): apply the documented dual-`Sitemap:` robots.txt and leave both. Record that Option (b) was the documented choice.
5. Hand the resolved/blocked state to STEP 6's auditor on its final pass (Section 12.3/12.4 cross-checks this step's outcome).

NEVER remove `astro-robots-txt` on assumption. The decision file is the single authority. Absent or unresolved = leave it in place and fail loud.

---

## STEP 7: Image Generation (Stage 5 — gpt-image)

Use the **Skill tool** with the `gpt-image` skill (gpt-image-2, model snapshot per the skill; Images API; `OPENAI_API_KEY`; `output_format=webp`; base64 output). For every image the build needs (homepage hero, each service hero, each location hero, each blog post featured image, OG/social, about/team), generate the webp and write it to `seed/assets/<filename>` (create the directory if absent). The webp file under `seed/assets/` is the durable artifact (committed to the repo).

Then **replace the matching `$media.url` token** in `seed/seed.json`: find each `"url": "PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5"` under `hero_image` (services/locations/pages collections, including client-specific pages) and `featured_image` (blog `posts` collection) — sibling `filename` + `alt` were set by seo-writer — and set that `$media` object's `url` to the **loopback http asset URL**: `"http://127.0.0.1:4399/<filename>"` (the port `scripts/emdash-dev.mjs` serves `seed/assets/` on; override only if you pass `--asset-port`). 

**Do NOT set `url` to a local path (`seed/assets/<file>`, `./<file>`, `file:...`).** emdash's seed `$media` resolver accepts ONLY `http(s)://` URLs (verified against emdash core `resolveMedia` → `validateExternalUrl`); a local path is silently swallowed and the image stores **NULL** in D1. This was the Defect-2 root cause — see `references/emdash-scaffold.md` §8. Use the seo-writer's `alt`. nano-banana-pro remains a fallback if gpt-image fails. After replacement, no `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` token may remain anywhere in `seed.json`, and every `$media.url` must be `http(s)://` (the auditor Section 4.1 / Section 9 and the pre-build gate in tech-builder's Media section catch leftovers and non-http urls).

**Image-weight guideline (CCC test produced ~50 MB of 1.8–2.7 MB webps — too heavy).** Generate/encode each webp to a sane web budget: target the largest rendered dimension the layout uses (hero ≤ 1920px wide, card/inner images ≤ 1200px wide), WebP quality ~72–80, and aim for **≤ 250 KB per hero and ≤ 150 KB per non-hero image** (hard ceiling 400 KB). If gpt-image returns a larger asset, downscale/re-encode (e.g. `sharp`/`squoosh`) before writing to `seed/assets/`. Oversized media inflates the repo, R2 storage, and LCP.

---

## STEP 8: Final Build Validation (Stage 7 — build)

**Pre-build gate (Defect 2 — run BEFORE `astro build`):** assert (a) zero `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` tokens remain in `seed/seed.json`, (b) every `$media.url` is an `http(s)://` URL (a non-http url stores the image NULL — use both regexes in tech-builder's "Pre-build media gate"), and (c) every `$media` `filename` for a generated asset has a matching file under `seed/assets/`. STOP loudly on any failure — do not build a seed that will render NULL images.

Run `astro build` (emdash Worker build — NOT `npm run build` of an Astro/Pages site). Fix any errors and re-run until it builds with zero errors. Then locally verify with `node scripts/emdash-dev.mjs --cwd <client>` — it migrates, serves `seed/assets/` over loopback http, runs the EXPLICIT `npx emdash seed` (content + media; auto-seed alone never applies content — Defect 2), then starts Astro. Confirm `/`, every service/location/client-specific page, `/contact`, `/sitemap-index.xml`, and `/robots.txt` return 200 with real rendered content AND that hero/featured images actually render (non-NULL) in the SERVED HTML — not just that seed.json looks right. emdash renders per-request from D1.

---

## STEP 9: Deploy to Preview + Handoff Report (Stage 7 — deploy, STOP at preview)

Deploy with `wrangler deploy` (a Cloudflare **Worker** — NEVER `wrangler pages deploy`). This publishes to the Worker's **preview** only. **NEVER auto-promote to production. John promotes manually.** Do not run any promote/`--env production` step.

Then present the handoff:

## Your Website is Ready (Preview)

### Pages Built
- Homepage, About, Contact
- Services: [list] · Locations: [list] · Blog/guides (TOFU backlog): [list]

### SEO
- Titles 50–60 chars, metas 140–160 chars (auditor-verified)
- Schema KEPT: WebSite (homepage-only, not double-emitted), LocalBusiness, Service, FAQPage, BreadcrumbList
- Sitemap: `/sitemap-index.xml` (`@astrojs/sitemap`, KEPT)
- robots.txt: per `references/robots-sitemap-decision.md` — [Option a: custom emdash SEO-settings robots.txt → /sitemap-index.xml] OR [BLOCKED: astro-robots-txt left in place, Plan 4 decision unresolved]
- Australian copy self-check: PASS (AU guide + avo-writing-voice)

### Next Steps (John)
1. Review the preview Worker URL.
2. When satisfied, **John** promotes to production (not automated).
3. Set `OPENAI_API_KEY` / `RESEND` (or emdash contact equivalent) secrets in the Worker.
4. Submit `/sitemap-index.xml` to Google Search Console; add Google Business Profile.

### Verify
- Lighthouse target: Performance >90, SEO 100, Accessibility >90
- Schema: Google Rich Results Test (LocalBusiness/Service/FAQ/Breadcrumb)
- Contact form end-to-end
