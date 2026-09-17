---
description: Use when deciding where a file, document, or asset belongs in the project, or when starting a new brand project and checking its folder structure and startup checklist.
---

# Structure and Assets

This is the only place that defines the folder structure. No other skill repeats it — they only
reference it. See the non-redundancy rule below.

## What exists in a project

```
project/
├── foundations/                  # Foundations primitive — tokenized once, shared by every framework
├── frameworks/
│   └── <name>.md                 # one document per framework — full spec: B0-B8, every size it covers
├── library/                      # Insumos primitive — every raw brand asset, organized by type
│   ├── logos/
│   ├── images/
│   ├── videos/
│   ├── icons/
│   ├── sounds/
│   └── fonts/
├── content/                      # Content generation primitive — execution output
│   ├── <N>-<project-name>/
│   │   └── <size>/               # final pieces of that delivery, by size
│   └── <N+1>-<project-name>/
├── references/                   # approved-output index — thumbnails/montages for quick lookup
│   └── <framework>/               # one or more reference images per framework — one per size
│       └── <size>[-<variant>].jpg  # and/or content type is common, not a single combined file
├── knowledge/                    # Knowledge primitive — brand-specific facts, not an asset library
└── engine/                       # rendering engine — scripts that build the pieces
```

Everything here belongs to ONE brand. A project never contains `foundations/` for two different
brands — if a new brand shows up, it's a new project, with this same tree, empty.

**`content/<N>-<project-name>/` is sequential and never reused.** A new project or campaign
always gets the next number — past deliveries are never overwritten or renumbered.

## Where each asset goes

- **Every raw brand asset lives in `library/`, organized by type — with no exception.** A logo
  used everywhere and a photo used by only one framework both live here.
- **A framework-specific asset is not moved into `frameworks/`.** It stays in `library/`, under
  its type folder; a subfolder per framework is only created if the number of files actually
  justifies it — the same criterion used for variants (see the `framework-construction` skill):
  don't split until the volume asks for it.
- **A file is never duplicated across folders.** If two frameworks need the same asset, it lives
  once in `library/`, and each `frameworks/<name>.md` references it by name.

## Non-redundancy rule between documents

Each fact lives in exactly one place. Everything else references it, never copies it.

| Fact | Lives in | How it's referenced |
|---|---|---|
| Base palette, base typography, logo, tone, legal (brand-wide) | `foundations/` | "see foundations" — a hex or a tone rule is never repeated inside a `frameworks/<name>.md` |
| Intent, objective, channels, color roles, image mode, elements, variants, text scaling (shared by every size of ONE framework) | The matching section of that `frameworks/<name>.md` | Every size row references them by name — never redeclared or repeated |
| Exact measurements of ONE specific size | That size's row, inside the same `frameworks/<name>.md` | Another size never copies these values — if it shares a ratio with another, that's noted and referenced, not repeated |
| This folder structure | This skill (`structure-and-assets`) | The `methodology` skill only mentions it and points here |

Before creating a new document or file to note a clarification or adjustment, the required
question is: **does this already have a place to live?** Almost always the answer is yes — either
it's a correction to `foundations/`, or an adjustment to a section of `frameworks/<name>.md` (a
general rule if it affects every size, or that size's row if it's just its measurement). The
change stays inside the existing document, not in a separate file. A new standalone document is
the exception, not the norm.

## New-project startup checklist

- [ ] `foundations/` exists and has no gaps (see Part A of the `tokenization` skill)
- [ ] `library/` has the logo in every version needed
- [ ] For every approved framework: `frameworks/<name>.md` exists, with every category resolved
      and no gaps for at least its first size
- [ ] `content/` has a numbered folder for this project/campaign — never a reused one
- [ ] `references/<framework>/` has at least one reference image per approved framework — a
      single combined montage is not required, one image per size/variant is the common case
