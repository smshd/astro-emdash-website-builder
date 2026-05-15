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

## STEP 2: Color Palette Extraction (Conditional)

If the user provided a screenshot path in Q6, **read the screenshot directly with the Read tool** (you are multimodal — no image model is used for analysis; gpt-image-2 is generation-only). Inspect the image and extract the 5 dominant brand colours as hex codes, labelled: `primary`, `secondary`, `accent`, `neutral-light`, `neutral-dark`. Prefer colours that pass WCAG AA for body text/background pairings; if the screenshot's palette is too low-contrast, note it and adjust the neutral pair.

Store the extracted hex values. These feed the emdash design tokens / Tailwind config (per the tech-builder agent — `tailwind.css`/`theme.css`, not the discarded Astro `tailwind.config.mjs`).

If the user said "choose for me", select a professional palette appropriate to their industry based on their services and tone preference.

---

## STEP 3: Scaffold the Astro Project

Run the following commands in sequence using the Bash tool. Run them from the current working directory (the project folder where `/build-website` was invoked).

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-install --git false
```

Then:
```bash
npm install
```

Then:
```bash
npx astro add tailwind cloudflare sitemap --yes
```

Then:
```bash
npm install gsap @astrojs/image resend
npm install -D astro-robots-txt
```

After each command, check for errors before proceeding. If a command fails, diagnose and fix the issue before continuing.

---

## STEP 4: Spawn Specialist Agents in Parallel

In a single message, spawn both agents simultaneously using the Task tool.

**IMPORTANT:** Both agents must produce output that meets award-winning design studio quality. The sites we build are not templates. They have visual depth, distinctive motion, and premium polish.

### tech-builder agent

Provide the full business data collected in Step 1, the color palette from Step 2, and the list of all services and locations. Instruct it to build the entire Astro project file structure as defined in the tech-builder agent specification.

Pass this context:
- Business name, tagline, contact info, address/service area
- All services (names, descriptions, differentiators, slugs)
- All locations (names, slugs, whether primary or secondary)
- Color palette (hex codes for primary, secondary, accent, neutral)
- Social media handles
- Business hours
- Any testimonials
- Tone preference
- **Design personality preference from Q6b** (bold/warm/sleek/energetic). This informs layout choices, animation intensity, shape language, and color treatment. Specifically:
  - **Bold and modern:** sharp clip-paths, high-contrast gradients, strong diagonal section dividers, heavier shadows, aggressive hover states
  - **Warm and approachable:** wave/curve section dividers, softer rounded corners (rounded-3xl to rounded-4xl), gentler animations (longer durations, softer easing), warm-toned gradient meshes
  - **Sleek and minimal:** more whitespace (py-32+), fewer gradient meshes, subtle animations (shorter distances, quicker durations), thin accent lines instead of bold bars
  - **Energetic and dynamic:** zigzag dividers, playful rotation animations, vibrant gradient meshes, bento grid with varied card sizes, bouncy easing (back.out)

### seo-writer agent

Provide the same full business data. Instruct it to write all page content: titles, meta descriptions, H1s, body copy, FAQs, CTAs, stat items, and breadcrumb labels for every page (homepage, about, contact, services index, each service page, locations index, each location page).

Pass the same context as tech-builder, plus the design personality preference so the writer knows to keep hero H1s short (4-8 words) for large-scale display and to structure stats as number + label pairs.

Wait for both agents to complete before proceeding to Step 5.

---

## STEP 5: Integrate Content into Files

After both agents return their outputs, use the tech-builder agent again (or directly via Write/Edit tools) to merge the seo-writer's content into the files the tech-builder created. Specifically:

- Insert all meta titles and descriptions into frontmatter of content collection .md files
- Insert all H1s and body copy into the correct .astro page components
- Insert all FAQs into the FAQ component data
- Insert testimonials into the Testimonials component data
- Insert stat items (number + label pairs) into the stats bar
- Insert CTA content for each placement (above-fold, mid-page, bottom) with proper heading/subtext/button structure
- Verify all breadcrumb labels are set

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
- Instructions to read every relevant file and run the full audit checklist (including the new Section 8: Design Quality checks)

The auditor will return a structured report (PASS/FAIL per check with file:line references).

If there are FAILs, address each one:
- Content failures: fix via seo-writer or directly
- Technical failures: fix via tech-builder or directly
- Design quality failures: fix via tech-builder or directly

Re-run the auditor until all checks PASS.

---

## STEP 7: Image Generation (Stage 5)

After the auditor gives a full PASS, generate all required imagery with the
**`gpt-image`** skill (engine: `gpt-image-2`, snapshot `gpt-image-2-2026-04-21`,
`--format webp`). `nano-banana-pro` is the **documented fallback engine** —
only use it (same prompts) if `gpt-image` fails to produce an asset after a
retry; note any fallback in the handoff report.

**Contract with Stage 3 (seo-writer / Plan 4).** `seed/seed.json` already
contains every page/collection entry. Each image field is an emdash `$media`
object written by seo-writer in this exact shape:

```json
"hero_image":     { "$media": { "url": "PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5", "alt": "<descriptive alt>", "filename": "<slug>-hero.webp" } }
"featured_image": { "$media": { "url": "PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5", "alt": "<descriptive alt>", "filename": "<slug>-featured.webp" } }
```

The token lives under `hero_image` for services/locations/pages and under
`featured_image` for blog `posts` entries — scan and replace BOTH.

Your job for every such object is to: generate the image, save it into the
per-client emdash asset directory `seed/assets/` (the tech-builder /
emdash media convention from Plan 3 — do not invent a different location),
then **replace ONLY the literal string `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5`
in that object's `url` with the saved asset's path** (`seed/assets/<filename>`,
forward slashes). **Preserve `alt` and `filename` byte-for-byte — do not
rewrite them.** Do not change image fields whose `url` is not the placeholder
token. emdash ingests the local-path `$media` into the R2 `MEDIA` binding at
seed-apply time (emdash media handling is owned by emdash/Plan 3 — do not add
raw-URL image fields; emdash rejects them).

### Procedure

1. **Locate every placeholder.** Read `seed/seed.json`. Find all `$media`
   objects with `url == "PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5"`. Build a
   work list of `{ json-path, alt, filename }`. Group by image purpose using
   the entry's collection + slug:
   - homepage entry `hero_image` → homepage hero
   - `content.services[*].hero_image` → per-service hero
   - `content.locations[*].hero_image` → per-location hero
   - blog `posts[*].featured_image` → per-post featured image (blog
     `posts` entries carry the token under `featured_image`, NOT
     `hero_image` — you MUST scan and replace it there too, or Plan 3's
     pre-build gate hard-fails every blog post with an image)
   - the OG/share image field → OG image
   - the about/team image field → team image
2. **Generate each image** with the Skill tool, `--output` set to the absolute
   path `<project>/seed/assets/<filename>` (the `gpt-image` skill writes an
   absolute `--output` exactly as given). Use the entry's `alt` text to inform
   a strong prompt. Suggested prompts (substitute business/service/location/
   colour from Step 1 + the Step 2 palette):
   - **Homepage hero** — `--aspect 16:9`: `"Professional [industry] service hero image, modern and clean, photorealistic, [primaryColor] tones, no text overlays, wide cinematic lighting"`
   - **Service hero** (one per service) — `--aspect 16:9`: `"Professional photo of [service name] work being performed, clean modern setting, photorealistic, no text"`
   - **Location hero** (one per location) — `--aspect 16:9`: `"Street-level view of [city], [state], clean bright daylight, professional photography, no text"`
   - **Blog post featured** (one per `posts` entry) — `--aspect 16:9`: `"Editorial photo illustrating [post topic], clean modern setting, photorealistic, no text"`
   - **OG/share image** — `--aspect 1:1`: `"[Business name] — [primary service] in [primary city], clean brand image, no text"`
   - **Team image** — `--aspect 16:9`: `"Friendly professional team of [industry] workers, modern setting, approachable, photorealistic, no text"`
   All calls use `--format webp`. Example:
   ```
   Skill: gpt-image
   Command: python scripts/run.py generate.py --prompt "Professional plumbing service hero, modern and clean, photorealistic, teal tones, no text, cinematic lighting" --aspect 16:9 --format webp --output "<project>/seed/assets/home-hero.webp"
   ```
3. **Replace the token.** For each generated asset, edit `seed/seed.json`:
   set that `$media` object's `url` to `"seed/assets/<filename>"`. Change
   nothing else in the object. This applies to the token under BOTH
   `hero_image` (services/locations/pages) and `featured_image` (blog
   `posts`). After all replacements, `Grep`
   `PLACEHOLDER_REPLACED_BY_GPT_IMAGE_STAGE5` in `seed/seed.json` → **0
   matches** (hard gate; if any remain, an image was missed — generate it;
   a surviving `featured_image` token hard-fails Plan 3's pre-build gate).
4. **Validate JSON.** `python -c "import json;json.load(open('seed/seed.json'))"`
   must succeed (emdash rejects malformed seed and raw-URL image fields).
5. **Asset directory note.** If `seed/assets/` does not exist, create it.
   The exact directory is Plan 3's emdash-media convention; if Plan 3's
   tech-builder placed assets elsewhere, follow that and use the matching
   relative path in the `url` — the contract is "local path emdash can
   ingest", not a hardcoded folder.

The `alt` text already lives in each `$media` object (written by seo-writer
per the AU writing standard) — it is preserved automatically because you only
ever overwrite `url`.

---

## STEP 8: Final Build Validation

Run the production build:
```bash
npm run build
```

If it fails, diagnose the errors and fix them. Re-run until the build succeeds with zero errors.

Then report to the user:
- Build status: SUCCESS
- All pages generated (list them)
- All images generated (list them)
- Next steps: set up Cloudflare Pages, configure environment variables (Resend API key), submit sitemap to Google Search Console

---

## STEP 9: Handoff Report

Present a clean summary to the user:

```
## Your Website is Ready

### Pages Built
- Homepage
- About
- Contact
- Services: [list]
- Locations: [list]

### Design Quality
- Design personality: [selected personality]
- Visual features: gradient text, split-word animations, bento grids, glass-morphism, section dividers, colored shadows, grain overlay, page transitions
- Motion: GSAP scroll-triggered reveals, parallax, count-up stats, micro-interactions
- All animations respect prefers-reduced-motion

### SEO Setup
- All title tags: 50-60 chars
- All meta descriptions: 140-160 chars
- Schema markup: LocalBusiness, Service, FAQ, BreadcrumbList, WebSite
- Sitemap: /sitemap-index.xml
- Robots.txt: /robots.txt

### Next Steps
1. Deploy: `npx wrangler pages deploy ./dist`
2. Set env var in Cloudflare: RESEND_API_KEY=your_key
3. Point your domain in Cloudflare Dashboard
4. Submit sitemap in Google Search Console
5. Add your Google Business Profile link

### Verify Your Site
- Lighthouse: target Performance >90, SEO 100, Accessibility >90
- Schema: Google Rich Results Test
- Contact form: test end-to-end submission
```
