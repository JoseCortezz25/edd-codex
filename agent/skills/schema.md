---
description: Use when naming a new token in foundations or a framework document — the frozen family/grammar contract any token name must follow.
---

# Naming Schema

This is the contract of token **names** — never values — that any `foundations/` file or
`frameworks/<name>.md` in this project must use. It is brand-agnostic and framework-agnostic: any
brand or framework added to this structure follows the same families. See the `tokenization`
skill for what each category means and how to fill it in; this document is the frozen list an
engine or a linter can check a token name against.

## Naming grammar

`family.subfamily.detail` — lowercase, in English, from most general to most specific (e.g.
`color.role.background.primary`, never `colorRoleBgPrimary` or a name described in prose). If
something doesn't fit any family below, that's a decision to make explicitly — see the
`tokenization` skill — never a loose name invented in the moment.

## Families

| Family | What it's for |
|---|---|
| `color.palette.*` | Raw hex values, named — never referenced directly from a framework |
| `color.role.*` | The semantic layer a framework references — always resolves to a `color.palette.*`, never to a hex |
| `font.family.*` / `font.weight.*` / `font.size.*` / `font.tracking.*` / `font.leading.*` / `font.transform.*` | Typography: the base inventory and its per-element assignment |
| `spacing.safe.*` | Safe margins — e.g. a platform-reserved zone |
| `spacing.container.gap.*` / `spacing.content.gap.*` | Layout gaps |
| `product.*` / `media.*` | Assets for "product" mode or "photo" mode |
| `container.*` / `content.*` | Layout geometry — position, size, anchor, alignment |
| `cta.safezone.*` | The zone a platform reserves for its own button — never rendered by the system |
| `pattern.*` | A brand's own recurring decorative motif, if it has one — asset, size, rotation, offset, pivot |
| `radius.*` | Reusable corner radii |

If a brand has a recurring decorative asset with its own internal color/opacity slots (an icon
system, a pattern), its slot names are enumerated once, under `pattern.*` or a family named after
that asset, inside `foundations/` — see the `tokenization` skill.

## What this contract does NOT do

It never assigns values — a hex, a px, a font file. Those live in `foundations/` (brand-wide) or
in the matching `frameworks/<name>.md` section (framework-specific), per the non-redundancy rule
in the `structure-and-assets` skill. This document only says which family names are valid, so a
typo or an invented name outside these families can be caught before it reaches a framework
document or the engine.
