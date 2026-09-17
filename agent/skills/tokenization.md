---
description: Use when tokenizing a brand's foundations or configuring a framework's parameters — naming convention and category guide for every token family (color, typography, spacing, product/media, container, CTA safe zone, pattern, radius).
---

# Tokenization — Category Guide

Tokenizing means translating every brand decision into a **named value**, so a framework
consumes it by reference ("use the `primary` color") and never by a loose value ("use
`#E4002B`"). This is what makes it possible to switch variant, photo, or framework without
touching the structure.

This guide has two parts, because not everything gets tokenized at the same moment:

- **Part A — Foundations.** Resolved ONCE, before touching any framework. It's what is truly
  shared.
- **Part B — Framework parameters.** NOT filled in here. These are the categories resolved one
  at a time, inside the configuration of each framework — see the `framework-construction`
  skill. They are listed here only as a reference of what exists.

If a category doesn't apply to the current brand, it's declared explicitly as "not applicable" —
never silently omitted.

## Naming convention (applies in `foundations/` and in each framework's `.md`)

Every token is named under one of these families. The family is what repeats identically across
any brand; the full name changes depending on what the brand actually has. This is the
vocabulary the written specification uses — and the one any future implementation built from it
should use too (see the `engine-principles` skill).

| Family | What it's for | Level |
|---|---|---|
| `color.palette.*` | The raw hex, by name (A1) — never referenced directly from a framework | Foundations |
| `color.role.*` | The semantic layer a framework does reference (B1) — points to a `color.palette.*`, never to a hex | Framework |
| `font.family.*` / `font.weight.*` / `font.size.*` / `font.tracking.*` / `font.leading.*` | Typography: inventory (A2) and per-element assignment/scaling (B5) | Foundations + Framework |
| `spacing.safe.*` | Safe margins (e.g. `spacing.safe.top`) | Framework |
| `product.*` / `media.*` | Assets for "product" mode or "photo" mode (B2, B8) | Framework |
| `container.*` / `content.*` | Layout geometry — position, size, anchor (B6) | Framework, per size |
| `cta.safezone.*` | The zone a platform (Meta, etc.) reserves for its own button — the system never draws anything there | Framework |
| `pattern.*` | If the brand has its own decorative motif (e.g. a recurring background icon or texture) | Framework |
| `radius.*` | Reusable corner radii (e.g. `radius.pill`, `radius.card`) | Foundations or Framework, depending on whether it's brand-wide or piece-specific |

If something doesn't fit any family, add a new row to this table — the list isn't closed. But a
new family follows the same grammar as the others: `family.subfamily.detail`, in English, in
lowercase, from most general to most specific (e.g. `color.role.background.primary`, not
`colorRoleBgPrimary` or "background primary color role").

If the brand expert or the designer proposes a name that doesn't respect this grammar, or
something that doesn't fit any existing family well, it isn't accepted as-is just because that's
what was asked: it gets flagged, and the aligned name or family is suggested instead. The same
applies to any other rule in this method that's clearly improvable in the moment — propose the
improvement, don't apply it silently and don't ignore it.

---

## Part A — Foundations (once, shared by every framework)

### A1. Base brand palette (`color.palette.*`)

The brand's complete official color set, named — not yet assigned to a framework role (that's
B1). These names are never referenced directly from a framework: a framework always goes through
a role (B1).

| Name | Hex | Notes |
|---|---|---|
| | | |

### A2. Base typography

The complete inventory of families/weights the brand has available — could be 2, could be 7,
whatever the brand uses:

| Family/weight | Notes |
|---|---|

Only the inventory goes here. Which family a given element (headline, sub, CTA) uses INSIDE a
specific framework — same as its sizes and scaling rules — does NOT go here: that's B5, because
that assignment changes framework to framework.

### A3. Logo

- Logo file(s) (light and dark version).
- Minimum clear-space around the logo (this is a brand rule, not a framework one — it always
  applies, even though its exact position and measurement is defined per framework in B6).

### A4. Copy tone and legal boundaries

- Brand tone in 2-3 adjectives + one "do" example line and one "don't" example line.
- Explicit list of prohibited claims (health, legal, competitor comparisons, etc.) and why they're
  prohibited.

---

## Part B — Framework parameters (one at a time, see the `framework-construction` skill)

These categories exist inside the configuration of EACH framework, because their value differs
depending on what that framework solves. They are not filled in ahead of time. They all end up
living in one place: that framework's `frameworks/<name>.md` document — there is no code, the
document IS the complete specification.

### B0. Intent, objective, and channels

Resolved first, before any other category — without this there's no way to later validate
whether the framework delivers what was expected of it:

| Field | Question |
|---|---|
| Intent | Why does this framework exist in the communication strategy? What role does it play? |
| Objective | What must a piece from this framework concretely achieve? |
| Channels | Which channels does it run on? (this determines which B7 buckets apply) |

### B1. Color roles for this framework (`color.role.*`)

Which base-palette (A1) color plays each role in this specific framework. The "token name" column
is what the rest of the document uses to refer to this role — the raw hex is never written again
once it's defined here:

| Role | Token name | Color (from A1) |
|---|---|---|
| Primary background | `color.role.background.primary` | |
| Secondary background / accent | `color.role.background.secondary` | |
| Text on light background | `color.role.text.onLight` | |
| Text on dark background | `color.role.text.onDark` | |

### B2. Image mode

- **Product mode**: automatic cutout + contain (never deformed) + no added shadow.
- **Photo mode**: cover + per-piece framing + respects the logo's exclusion zone.

Each framework declares ONE of the two modes. Before using any asset, confirm the file is
actually clean (no baked-in shadow or background from whoever delivered it) and that its colors
read well against EVERY background color it will be used with — if not, a new cutout is
requested.

### B3. Framework elements

The complete list of EVERYTHING that makes up the framework — not just text. For each element:
whether it's dynamic (changes by copy, variant, or size) or fixed (always the same), and its
type:

| Element | Type (text / image / shape / empty space) | Dynamic or fixed? | Depends on |
|---|---|---|---|
| Headline | text | Dynamic | copy |
| Logo | image | Fixed | — |
| Product/photo | image | Dynamic | variant (B4) |
| Background strip | shape | Fixed | — |
| Platform CTA zone | empty space | Fixed | — |
| Price / discount | text | Dynamic | content variant (B4), offer-type only |

No element of the framework is left off this list — if something appears in the reference
(Figma or image) and isn't here, it isn't defined yet. This is resolved BEFORE B4 (variants),
because variants are described in terms of which elements from this list change.

**This list is also the contract for any bulk copy-delivery mechanism** — spreadsheet, feed, CSV,
or whatever the team uses to produce many pieces at once. Its columns/fields map 1:1 to the
dynamic elements listed here — a loose field that isn't on this list is never invented. If the
framework has content variants (B4), add a column indicating which variant applies to each row —
the rest of the columns don't change between variants, because the composition is the same.

### B4. Variants

A variant is a **variation of components over the SAME composition** — what's shown, what it
says, or which color/product it uses. It's never a different layout of elements: if something
needs a different composition, that's a new framework, not a variant of this one.

There are two types, and a framework can have one, the other, or both at once:

**Content variants** — which B3 elements appear and what they say, over the same structure:

| Variant | Shows (from B3) that others don't | Hides |
|---|---|---|
| e.g. "Offer" | price, discount, legal disclaimer | — |
| e.g. "Invitation" | invitation message/CTA | price, discount |

**Product/color variants** — which role (from B1) or which asset (from B8) each one uses:

| Variant | Roles that change (from B1) | Asset (product/photo, from B8) |
|---|---|---|
| Variant A | | |
| Variant B | | |

A product/color variant can be locked to a single set, or have a bounded set of allowed options
(e.g. "product X can go with set A or set B, depending on the piece") — in that case the
left-hand column lists the full set; which one applies to a specific piece is decided when that
piece is produced.

### B5. Typography and text-scaling rules

Only for the text elements identified in B3, by content variant if applicable:

| Element | Family (from A2) | Min–max size | Scaling rule | Character cap (narrowest size) |
|---|---|---|---|---|
| Headline | | | | |
| Sub | | | | |
| CTA | | | | |
| Price | | | | |

Practical rule: it's better to shorten the copy than to rely on auto-scaling to save an
oversized line — the cap should be conservative, not the theoretical maximum.

**Sizes in this table are expressed as a proportion of the canvas (%), never in absolute
pixels** — a framework covers several sizes (B7), and a pixel value here would be fictional
outside one specific size. The conversion to exact pixels per size goes in B6.

### B6. Exact measurements

For each B3 element, and for each B7 size if the value differs between sizes: position, distance
to neighboring elements, margins, corner radii, elevation/shadow, and stroke width and color.
None of this is left "eyeballed" — if a value isn't defined yet, it's asked before assuming it.

| Element | Size (from B7) | Position / distance | Margin | Radius (`radius.*`) | Elevation / shadow | Stroke |
|---|---|---|---|---|---|---|
| | | | | | | |

Expected level of detail example: "Logo: horizontally centered, `spacing.safe.top` = 6% of
canvas height; no shadow; no stroke." — not "the logo goes up top, roughly centered."

### B7. Sizes and buckets this framework covers

| Bucket | Sizes it includes | Reuses pieces from another bucket? |
|---|---|---|

### B8. Assets specific to this framework

Photos, product cutouts — shared across all sizes of this framework, but not necessarily with
other frameworks.
