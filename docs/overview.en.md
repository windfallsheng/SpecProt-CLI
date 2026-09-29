# SpecProt Overview

SpecProt is the **first gate** of the SpecCore ecosystem — product requirements are finalized here, then handed to SpecCore as a whole-directory mirror for spec development.

```
SpecProt(finalize) → SpecCore(spec & dev) → SpecTest(verify)
      freeze              unitize                gate
```

## The Problem It Solves

Raw product requirements are scattered: discussion notes, meeting screenshots, Word/PDF documents, a sentence scribbled on the fly. Their problem is not "no information" but **no shape** — the dev side cannot consume them directly.

SpecProt forges scattered materials into shaped outputs:

| Materials (input) | Forged output |
| :--- | :--- |
| Notes / screenshots / documents | `{platform}/REQUIREMENT.md` — a full seven-section requirement doc |
| Platform requirement doc | `features/{unit}/` — independently deliverable functional units |
| Functional unit | OUTLINE structure contract + review pack with risk adjudication |
| Requirement content | Mermaid diagram sources + prototype HTML + asset registry |
| Frozen iteration | `04-交付/` mirror → copied wholesale into SpecCore |

## Design Philosophy — Three-Way Division of Labor

| Role | Owns | How |
| :--- | :--- | :--- |
| **CLI** | Determinism | Scaffolding, structure validation, gate decisions, version evolution |
| **AI** | Semantics | Writing, slicing, deepening, diagram assets (via `[SPECPROT_PROMPT]` handoff) |
| **Human** | Gates | Scope confirmation, clarification adjudication, risk adjudication, adoption confirmation |

The CLI never guesses semantics, the AI never touches determinism, and humans hold exactly six gates. Each stays in its lane — that is how the pipeline stays both fast and reliable.

## Capability Panorama

1. **Six-stage pipeline** — convert → analyze → slice → deepen → adopt → freeze; two modes (auto / interactive) + resume from breakpoint
2. **Natural-language entry** — the `ask` execution engine: talk to it, it acts; missing parameters get named and asked for
3. **Five-dimension health check** — `check` anytime: skeleton / quality / diagram suggestions / risk screening / delta check, five entry points
4. **Template first** — per-platform templates from the product; your template when provided, system fallback otherwise
5. **Scheme branching** — `schemes` compares options; the recommended one enters the snapshot body at freeze, the rest go to an appendix
6. **Risk lenses** — seven industry-standard lenses (funds, financial compliance, privacy, accessibility, content, concurrency, state machines)
7. **Delivery mirror** — `04-交付/` is isomorphic to SpecCore's `010-requirements/`; copying is the handoff

## Documentation Navigation

| Doc | Content |
| :--- | :--- |
| [quick-start.en.md](quick-start.en.md) | Install and your first iteration, end to end |
| [command-reference.en.md](command-reference.en.md) | Complete reference for all 22 commands |
| [scenarios.en.md](scenarios.en.md) | Typical usage scenarios |
| [architecture.md](architecture.md) | Architecture and data flow |
| [quick-reference.en.md](quick-reference.en.md) | Quick reference card |
