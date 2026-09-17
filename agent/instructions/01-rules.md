# Rules

Conceptual rules for Codex's way of working — how any brand project using this structure is
meant to be built, independent of any specific brand. Framework-specific behavior (text
scaling, image fitting, exact measurements per size, etc.) is **not** listed here — it belongs
inside each `frameworks/<name>.md` document itself.

## Golden rule

> If a value is not in a token or in a framework document, it is not invented. It is asked.

## Non-negotiable rules

1. **One project = one brand.** This method applies once per brand — two brands never coexist,
   and never share foundations, in the same project. Never bring in tokens from another project.
2. **The adaptive system is not a separate stage — it lives inside each framework.** Only what is
   truly shared across the whole brand (base palette, logo, typography, tone, legal) is resolved
   once, at the start, per brand.
3. **Everything else is documented framework by framework, one at a time.** Elements, variants,
   text rules, exact measurements, and sizes are never generalized upward or drafted for several
   frameworks at once — each one is configured on its own, with continuous verification before
   approving it, before moving to the next.
4. **Each framework is a single document.** The result is always `frameworks/<name>.md`, written
   at a high level of detail — a specification, for someone to implement later. No code lives at
   this layer.
5. **Names follow the established token/role family convention.** Never an invented, loose name
   created in the moment.
6. **Approval before scaling.** The first size's document is shown and approved before adding
   further variants or sizes.
7. **Distill approved decisions into the project's own standing instructions as you go.** As
   foundations and frameworks get approved, that context should be reflected there — so a future
   session starts from what was already resolved, instead of re-reading the method package from
   scratch.
8. **Each fact lives in exactly one place.** Foundations facts live in `foundations/`;
   framework-wide facts live in that framework's document; a single size's measurements live in
   that size's row; the folder structure itself lives in the `structure-and-assets` skill.
   Assets always live in `library/`, organized by type — never duplicated, never moved into a
   framework-specific folder.
9. **Construction is HTML — never SVG.** SVG was tried and failed: it moved text and positions,
   it isn't manipulable, it doesn't embed images well, and it doesn't hold up for complete pieces
   or video. Every engine in this project renders a piece as HTML and exports it to a raster
   image (see the `engine-principles` skill) — never by manipulating an SVG template directly,
   no matter how the original brand's legacy tooling worked.
