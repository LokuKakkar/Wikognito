# Detective artwork

Web-ready artwork for the Phase 9 detective presentation. Everything here is
served from `/assets/detective/...`.

Full-resolution sources live outside the Next app in `wikognito-images/` at
the repo root. Files in this folder are the hand-exported, web-sized
derivatives — export them at the size they are actually displayed and prefer
WebP for opaque artwork, PNG where an alpha channel is needed.

## Layout

| Folder         | Contents                                              | Phase |
| -------------- | ----------------------------------------------------- | ----- |
| `environment/` | Full-bleed backdrops (the desk)                        | 9A    |
| `objects/`     | Pen, stamp, magnifier, hat, folders, paperclips        | 9B–9D |
| `textures/`    | Tiling paper grain and surface noise                   | 9B    |
| `ui/`          | Avatars, folder states, medals, plaques, archive stamp | 9D    |
| `sounds/`      | Reserved for optional short clips (unused; 9C is Web Audio) | 9C |

## Replacing artwork

Filenames are the contract. Drop a replacement in at the same path and nothing
else needs to change:

| Path                            | Used by                         | Notes                                      |
| ------------------------------- | ------------------------------- | ------------------------------------------ |
| `environment/desk.png`          | `.desk-surface`                 | Opaque, `background-size: cover`           |
| `objects/detective-pen.png`     | `Pen`                           | Transparent PNG, decorative                |
| `objects/case-solved-stamp.png` | `CaseStamp`                     | Transparent PNG, multiply blend on paper   |
| `objects/magnifier.png`         | How-to / error                  | Transparent PNG                            |
| `objects/hat.png`               | Profile dossier                 | Transparent PNG                            |
| `objects/folder-stack.png`      | Case intro                      | Transparent PNG                            |
| `objects/paperclips.png`        | Dossier clip                    | Transparent PNG                            |
| `ui/avatar-*.png`               | `DetectiveAvatar`               | Circular portraits, local selection only   |
| `ui/folder-available.png`       | Archive unplayed                | Transparent PNG                            |
| `ui/folder-solved.png`          | Archive completed               | Transparent PNG                            |
| `ui/medal-1.png`–`medal-3.png`  | Leaderboard ranks 1–3           | Transparent PNG                            |
| `ui/plaque-leaderboard.png`     | Leaderboard header              | Transparent PNG                            |
| `ui/stamp-archive.png`          | Archive header                  | Transparent PNG                            |

If a file is missing the app still renders: `.desk-surface` sits on
`--desk-base` and `.desk-vignette` supplies the lighting in CSS, so the desk
reads correctly with or without the raster. Secondary pages fall back to
paper CSS when a decorative PNG 404s.

## Not this folder

- `public/illustrations/v1/` is the legacy mascot pack, gated by
  `NEXT_PUBLIC_ILLUSTRATIONS_PACK`. Detective pages no longer use those slots;
  keep the pack at `none` so the mascots do not reappear.
- `public/icons/` holds cursor artwork.
