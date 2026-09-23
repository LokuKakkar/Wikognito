# Illustrations / Mascots

This frontend supports **versioned illustration packs** (v1, v2, …) that can be enabled/disabled via a build-time env var, while keeping page code slot-based and stable.

## Enable / disable

Set `NEXT_PUBLIC_ILLUSTRATIONS_PACK`:

- `v1`: enable v1 pack (legacy mascots)
- `none`: disable all illustration slots (default; detective artwork is served from `public/assets/detective/` instead)

The active pack is resolved in [`illustrations/index.ts`](illustrations/index.ts).

## Slots (where art appears)

Pages/components never pick a specific illustration directly. They render a **slot**, and the active pack decides what goes there.

- Slot types live in [`illustrations/types.ts`](illustrations/types.ts) (`IllustrationSlot`)
- v1 placements live in [`illustrations/packs/v1.ts`](illustrations/packs/v1.ts) (`slots`)

Current slots:

- `caseIntroHero`
- `howToHero`
- `resultWonBadge`
- `resultGaveUpBadge`
- `pageHeaderDecoration`
- `errorMascot`

## Assets

v1 is generated from a single sheet:

- Source-of-truth: [`assets/illustrations/v1/sheet.png`](assets/illustrations/v1/sheet.png)
- Served output: `public/illustrations/v1/{mascot,decor}/*.svg`

## Regenerate v1

If you update `sheet.png` (or tweak crops/thresholds), regenerate the output SVGs:

```bash
pnpm -C apps/frontend illustrations:generate:v1
```

This runs [`scripts/illustrations/generate-v1.mjs`](scripts/illustrations/generate-v1.mjs) which:

- Crops each illustration out of the sheet (using hardcoded crop rectangles)
- Removes the checkerboard background to transparency (color-distance threshold)
- Auto-traces to SVG (via `imagetracerjs`)
- Optimizes output (via `svgo`)
- Writes a small manifest: `public/illustrations/v1/manifest.v1.json`

## Add a v2 pack

1. Generate/store new assets under `public/illustrations/v2/...` (however you prefer).
2. Create a new pack file, e.g. `illustrations/packs/v2.ts` that exports `ILLUSTRATIONS_V2`.
3. Update [`illustrations/index.ts`](illustrations/index.ts) to return `v2` when `NEXT_PUBLIC_ILLUSTRATIONS_PACK=v2`.
4. Update/extend slots and placements in `ILLUSTRATIONS_V2.slots`.

Pages should not need edits unless you add brand-new slot names.

