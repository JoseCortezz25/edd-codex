---
description: Use when building or configuring a frameworks/<name>.md document — the loop across frameworks and the section-by-section protocol for configuring a single one.
---

# Framework Construction

This covers two levels in one place: **the loop across frameworks** (the order they get built,
one after another) and **the protocol for configuring a single one** (the detail of step 2 of
the loop). There isn't a separate skill for each level.

Precondition: foundations resolved (see the `tokenization` skill — Part A, with no gaps). If
anything is missing there, no framework is started.

## The loop, framework by framework

One at a time. Never in parallel, never in batch — each framework is closed (approved) before
opening the next.

1. **Choose which framework to build first.** The one with the highest piece volume, or the
   structurally simplest one — what gets learned (text-scaling curves, image behavior) carries
   over to the next ones.
2. **Configure this framework.** See the detailed protocol below.
3. **Explicit approval of the base document** (`frameworks/<name>.md`, with its first size
   resolved). Nothing moves forward without this.
4. **Add variants**: fill in the B4 tables (content variants and product/color variants) inside
   the same document — nothing new is created, what was already anticipated gets filled in.
5. **Add sizes/buckets**: for each new B7 size, add its row to the B6 tables (exact measurements)
   inside the same document — the color roles, image mode, or text rules are never redeclared
   there; those are resolved once, in B1/B2/B5.
6. **Review edge cases**: longer-than-expected copy, a low-contrast variant, the bucket's
   narrowest size.
7. **Go back to step 1 for the next framework**, carrying what was learned as a starting point —
   not as a reset to zero.

## Configuration protocol for a single framework (detail of step 2)

Each framework is a mini-project: it has its own intent, objective, channels, and rules. The
result is **a single document**: `frameworks/<name>.md`.

**No code is built at this layer.** The document, while it's being drafted together with the
brand expert, IS the complete specification. If something isn't in the document, it isn't
defined.

The names the document uses (roles, elements, tokens) always come from the naming convention in
the `tokenization` skill — a loose name outside those families is never invented.

### 0. Entry point — is there a Figma file or not?

Two possible paths for the first size. Which one applies is asked explicitly — never assumed.

- **Path A — there is structure in Figma.** Geometry is extracted directly from the file. Even
  so, what each layer is gets confirmed with the brand expert before documenting it — Figma gives
  position, not always intent.
- **Path B — no Figma, only a reference image + description.** First, figure out what kind of
  reference it is: a finished example piece (already shows the full layout), or a loose asset
  (e.g. a cut-out product, with nothing composed around it)? If it's a loose asset, the full
  composition is NOT in the image — it gets confirmed with the brand expert separately, element
  by element, for whatever still needs to be composed, not just the asset itself. In both cases:
  before documenting, do exhaustive work, element by element — list every visual element, confirm
  with the brand expert what it is, its approximate position, and its behavior. Don't move
  forward until every element is confirmed — an image can be misread, and that error propagates
  into everything documented on top of it.

### 1. Intent, objective, and channels (B0)

Defined before touching structure or rules, one at a time, in the document's first section
(these apply to the whole framework, not just the first size):

- **Intent** — why does this framework exist in the communication strategy?
- **Objective** — what must a piece from this framework concretely achieve?
- **Channels** — which channels does it run on? This determines which sizes (B7) need to be
  documented — listed in step 2.7 and filled in one at a time in step 5 of the macro loop.

### 2. Draft `frameworks/<name>.md`, section by section

In this order, one part at a time. Don't move to the next without closing the previous one. Each
answer is written directly into the document as it comes — answers aren't stockpiled to
transcribe everything at the end:

1. **Color roles** (B1 of the `tokenization` skill).
2. **Image mode** (B2) and its cropping/framing rules.
3. **Complete element list** (B3) — EVERYTHING that makes up the framework, dynamic or fixed,
   drawn from path A or B of step 0. This is resolved before variants, because variants are
   described in terms of which elements change. This list is also the contract for any
   bulk-copy brief (spreadsheet, feed, etc.) — see the note at the end of B3 in the
   `tokenization` skill.
4. **Variants** (B4) — content and/or product/color, always as a variation of components over
   the same composition.
5. **Typography and text-scaling rules** (B5), with character caps as explicit values.
6. **Exact measurements of the first size** (B6) — position, distance, margins, radii,
   elevation/shadow, and stroke for EVERY B3 element. Nothing eyeballed.
7. **Sizes/buckets covered** (B7) — list which other sizes the framework will need (added one at
   a time later, in step 5 of the macro loop).
8. **Assets** (B8).
9. **Special behaviors** → if it applies to every size, it goes next to the corresponding general
   rule; if it's specific to one size, it goes in that size's row in B6. Never a hidden special
   case left unexplained.

### 3. Request assets

Once the configuration makes clear what's needed, it's requested explicitly. Assets are shared
across ALL sizes of this framework — they aren't requested again per size. The document
references them by file name, never duplicates them.

### 4. Continuous verification

Each section, as it's drafted, is reviewed with the brand expert against the reference (Figma or
image) — the first review doesn't wait for the whole document to be ready. If something had to
be assumed because it wasn't confirmed, that gets flagged explicitly to the brand expert — never
silently, and documentation never continues on top of an unconfirmed assumption. As an
additional sanity check: B6 measurements must be internally consistent and consistent against
the canvas size (do the widths and positions fit inside the canvas? does the margin leave room
for the longest copy allowed in B5?).

### 5. Polish with the brand expert

The brand expert corrects based on what they see in the document. If the correction is to
something shared across all sizes (B1, B2, B3, B4, B5), it's corrected in that section; if it's a
size-specific measurement (B6), it's corrected in that size's row. Telling these apart on every
correction is what prevents the same rule from ending up written differently in two places of
the same document.

### 6. Approval

Before approving, confirm the document meets the objective declared in step 1 (B0) — a tidy
specification that doesn't meet what B0 asked for isn't approved. Explicit approval over the
complete document for the first size → back to step 3 of the macro loop.

## Keeping the framework document in sync with the engine

Once `engine/` implements this framework (see the `engine-principles` skill), the build may need
to diverge from what this document currently says — a value that looked right on paper doesn't
render well, or a rule needs correcting once real content is tested against it. That is allowed.
What is not allowed is the divergence living only inside the engine:

- The reason for the change is documented as a comment at the point in the engine code where the
  deviation happens — that part doesn't move.
- The corresponding field in `frameworks/<name>.md` is updated to the new, true value or rule, in
  the same pass. The document is the specification; if the engine and the document disagree, the
  document has silently stopped being true.

`frameworks/<name>.md` is not only written before the engine exists — it keeps getting corrected
after, every time reality reveals it was wrong.

## Signs something is being invented (stop if one appears)

The method's general anti-hallucination rules always apply here too. Two signals specific to
this loop:

- Copy is being drafted while the brand's tone/legal foundations aren't resolved yet.
- A new size (B6) is being added and it's used as an opportunity to redefine a color role, the
  image mode, or a text rule "just for this size" — those rules belong to the whole framework
  (B1, B2, B5), not to one size; if they truly change per size, that's a special behavior and
  gets documented as one, not silently.
