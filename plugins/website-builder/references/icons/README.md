# Icon system (spec §3.2)

Inline raw SVG. Source: LobeHub Icons (brand/UI), itshover (motion-accent).
NO icon fonts, NO @iconify runtime, NO astro-iconset (that template default
is rejected — it bundles megabytes and is not the agency standard).

## Storage
- Plugin master copies: `plugins/website-builder/references/icons/*.svg`.
- Per client project: tech-builder copies the needed icons into
  `src/icons/<name>.svg` and inlines them in components via Astro's
  `import icon from "../icons/x.svg?raw"` then `<Fragment set:html={icon} />`,
  OR a thin `Icon.astro` wrapper that reads `src/icons/${name}.svg?raw`.

## Rules
1. Every SVG uses `currentColor` — never hardcode hex. The consuming
   component sets `color:` (brand token) so icons inherit brand palette.
2. No intrinsic `width`/`height` — size via the wrapper (`w-6 h-6` etc).
3. `aria-hidden="true"` on decorative icons; provide an adjacent text label
   or `aria-label` on the interactive parent for meaningful ones.
4. Static by default. A React island (motion-accent itshover icon) is used
   ONLY for a single hero/WhyUs accent where motion measurably lifts the
   section — never for every icon. Wrap islands so they degrade to the
   static SVG with no JS.
5. Map Nico's unspecified slots: WhyUs USP → gradient icon container with
   one of {shield,clock,award,sparkle,wrench}; process steps → numbered +
   {check}; footer/contact → {phone,mail,map-pin}; social row → the four
   social SVGs in circular hover-fill containers; card arrow → arrow-right.
