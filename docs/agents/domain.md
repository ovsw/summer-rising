# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** for architectural decisions that touch the area being changed.

If these files don't exist yet, proceed silently. Do not block work on their absence.

## File structure

This repo uses a single-context layout:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept in issues, refactor proposals, hypotheses, or tests, use the term defined in `CONTEXT.md`. Avoid drifting to synonyms if the glossary establishes a preferred term.

If a needed concept is missing from `CONTEXT.md`, note the gap rather than inventing vocabulary.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface that conflict explicitly instead of silently overriding the prior decision.
