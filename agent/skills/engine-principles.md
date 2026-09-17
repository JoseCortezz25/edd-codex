---
description: Use when implementing or reviewing the rendering engine that turns a framework document into rendered pieces — brand-agnostic, stack-agnostic engineering principles.
---

# Engine Principles (reference)

The `methodology` skill leaves the rendering engine outside the core method — it's technical
infrastructure built AFTERWARDS, from the framework documents, not a brand or framework decision
itself. This document is the one exception: four engineering principles that are agnostic to
brand and to stack, worth writing down because they prevent costly mistakes if whoever builds
the engine doesn't already know them. They aren't blocking for configuring foundations or
frameworks — they apply once someone builds that implementation, reading each
`frameworks/<name>.md` as the specification.

## Everything is regenerable

No final asset is hand-edited. If something looks wrong, the fix goes into the token or into the
corresponding section of `frameworks/<name>.md` — never into the already-exported image file.
Re-producing a piece from the specification must reproduce the expected result, every time.

## Measure with a real browser, never estimate

The width and height of a text block are measured by rendering in a real browser (headless or
not) and reading the result — never by estimating with in-code font metrics. Estimating produces
silent overflow that only shows up in production.

## Text-fit loop

Render at base size → measure real dimensions/line count → if it doesn't fit, adjust → repeat →
final render. By default, when copy is longer than expected, wrapping to more lines is
prioritized over shrinking the text until it becomes illegible — unless the framework's
typography and scaling section (B5 of the `tokenization` skill) explicitly defines otherwise.

## One browser per batch, not one per piece

The browser is opened once per run; one page per size; every screenshot in that batch comes from
that same instance. Opening a new browser for every single piece is the difference between
seconds and minutes per piece.
