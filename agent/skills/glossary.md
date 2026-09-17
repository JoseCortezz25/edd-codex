---
description: Use when the user needs a definition of a core Codex concept (framework, variant, element, delivery bucket, foundations, slot, atom/molecule, adaptive design) or a quick reference to the project's folder structure.
---

# Glossary

## Core concepts

| Concept | What it is | Generic example |
|---|---|---|
| **Framework** | A reusable visual structure, documented in its own `frameworks/<name>.md` with its complete adaptive system | "Product framework": centered object + logo + text below, "product" image mode, its own text limits |
| **Variant** | A variation of components over the SAME composition — never a different layout | "Offer" variant (with price) vs. "Invitation" variant (message only), on the same structure; or "berry" vs. "mango" variant (same layout, different color/product) |
| **Element** | Each piece that makes up a framework — text, image, shape, or empty space — whether dynamic or fixed | Headline (dynamic), logo (fixed), platform CTA zone (fixed, empty) |
| **Delivery bucket** | A group of sizes requested together because they go to the same channel | "Social" (9:16, 1:1) vs. "Display" (banners of several sizes) |
| **Foundations** | The only thing truly shared across all of this brand's frameworks | base palette, logo, base typography, tone, legal |
| **Slot** | The position inside a framework where an atom or molecule goes | the headline slot, the logo slot |
| **Atom / molecule / component** | Atom is the smallest unit; a molecule can contain several atoms and/or molecules | a color swatch (atom), a price tag combining a number + a label (molecule) |
| **Adaptive design** | The same framework (piece) reflowed into different formats (1:1, 9:16, 16:9, etc.) and channels, without changing its identity — only its slots' sizes, positions, and text scaling adapt per format | one framework rendered at 1:1 and at 9:16 |
| **Digital Twin** | Future concept: a 3D-recontextualized product image (not blocking today) | — |

## Folder structure

Quick reference — see the agent's instructions for the full description of each folder.

| Folder | Primitive | Meaning |
|---|---|---|
| `foundations/` | Foundations | Shared brand layer, tokenized once per brand: palette, typography, logo, tone, legal. |
| `frameworks/` | Frameworks | One document per framework (`frameworks/<name>.md`): slots, intent, variants, measurements. |
| `library/` | Insumos (asset library) | Raw brand assets: logos, images, videos, icons, sounds, fonts. |
| `content/` | Content generation | Generated output — copy, video, photo, Digital Twins — produced by running a framework through the engine. |
| `knowledge/` | Knowledge | Brand-specific knowledge and learnings (not an asset library). |
| `engine/` | Rendering engine | Scripts that read the framework docs and produce the pieces that land in `content/`. |

Note: this skill is harness-level knowledge about how Codex itself works, available to any
agent operating this project. The top-level `knowledge/` folder above is a different thing: it's
the Knowledge **primitive**, reserved for brand-specific facts about the one brand this project
is for.
