# SpecProt — The Finishing Workshop for Product Requirements

SpecProt is the **first gate** of the SpecCore ecosystem: it forges scattered materials (discussions, screenshots, Word/PDF) into frozen, finalized requirement documents, then hands them to SpecCore as a whole-directory mirror for development.

```
SpecProt(finalize) → SpecCore(spec & dev) → SpecTest(verify)
      freeze              unitize                gate
```

The product team does exactly three things: **create an iteration, drop in materials, run the pipeline**. Everything else — extraction, writing, slicing, deepening, diagram assets, risk adjudication — is handled by the pipeline and AI handoff.

> 📖 For product folks: [docs/product-guide.en.md](docs/product-guide.en.md) — the full-journey handbook (install → create → materials → pipeline → check-up → prototype → design system → canon → handoff); every step tells you how, where, and what you get.

## Quick Start (Three Steps)

```bash
# 1. Create an iteration — workshop scaffolded (materials + per-platform skeletons)
specprot iteration create -n iteration-2026-Q3 -p web,backend

# 2. Drop materials into 00-素材/{platform}/ (cross-platform stuff goes to shared/)
#    Supports .md / .docx / .pdf / .xlsx / screenshots / audio

# 3. Run the full pipeline (interactive mode)
specprot run -i iteration-2026-Q3 -m interactive
```

Or just talk to it: `specprot ask "create iteration Q3 for meeting room booking"` — plain language, executed directly.

## The Six-Stage Pipeline

`run` orchestrates six stages; each stage persists its output and gates pause for confirmation:

| # | Stage | Command | Output | Executor |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Convert | `convert` | Materials → md (image index, audio transcription hint) | CLI |
| 2 | Analyze | `analyze` | `{platform}/REQUIREMENT.md` full requirement doc | AI handoff |
| 3 | Slice | `slice` | `{platform}/features/{unit}/` functional units | AI handoff |
| 4 | Deepen | `deepen` | OUTLINE contract + review pack (risk/CLARIFY) | AI handoff |
| 5 | Adopt | `req adopt` | Units promoted to global canonical requirements | CLI |
| 6 | Freeze | `iteration freeze` | `04-交付/` delivery mirror + version evolution | CLI |

**Modes**: `-m auto` runs without waiting between stages (six gates still pause); `-m interactive` pauses at every stage. Interrupted? `--resume` continues; `--from`/`--to` slice the range.

**Six gates** (pause in either mode): scope confirmation, empty materials, empty skeleton, unresolved clarifications, unadjudicated risks, adoption confirmation.

**Reference context** — `analyze` / `slice` automatically inject existing assets while writing requirements (only when present, summaries not full text, same platform first):

| Source | Content |
| :--- | :--- |
| Canonical history | Summaries of same-platform REQs under `.speccore/GLOBAL/{project}/` (max 5; no duplication, no conflicts) |
| Iteration shared contracts | `_shared/GLOSSARY.md` glossary + `RULES.md` cross-unit rules |
| Design system | Iteration-root `DESIGN_SYSTEM.yaml` (falls back to global `.speccore/GLOBAL/DESIGN_SYSTEM.yaml`) |

The AI thus writes with precedent: duplicate or conflicting units get a 「待确认」 note instead of silent merging.

## Command Map

| Command | Role |
| :--- | :--- |
| `ask [words...]` | Natural-language entry — recognizes intent, executes directly (aligned with SpecCore ask) |
| `run` | Pipeline — orchestrates the six stages |
| `convert` | Material conversion — docx/pdf/xlsx → md, image indexing |
| `analyze` | Per-platform analysis — full requirement doc from materials |
| `slice` | Functional slicing — platform doc → functional units |
| `deepen` | Unit deepening — structure contract + review pack (risk adjudication) |
| `assets` | Asset generation — Mermaid diagrams + prototype HTML + registry |
| `schemes` | Scheme branching — multi-option comparison + recommendation |
| `check` | Five-dimension health check — skeleton/quality/diagram/risk/delta |
| `iteration` | Iteration management — create / list / freeze |
| `req` | Requirement management — new / adopt / change / link / status |
| `prototype` | HTML prototype straight from a requirement doc |
| `design` | Extract/configure design system (antd / element / tailwind…) |
| `init` | Initialize project — global layer + Slash Commands |

`ask` is an execution engine, not a tour guide: it understands and acts. When parameters are missing it emits `[SPECPROT_NEEDS_INFO]` naming exactly what is needed.

## Material Strategy — Verbatim Conversion + Refined Drafts

`convert` performs deterministic format conversion only (docx/pdf/xlsx → md, verbatim);
semantic distillation is the AI's job and lands in `00-素材/converted/{platform}/_refined/`
(dry goods), while verbatim output stays as trace-back. `analyze` prioritizes refined drafts,
uses verbatim copies for cross-checking, and records conflicts or doubts in the clarify list.

Audio/video materials follow `.specprot.yml` at the iteration root (optional; delete = defaults):

| Key | Values | Description |
| :--- | :--- | :--- |
| `materials.audio.mode` / `materials.video.mode` | `prompt` (default) / `ai` / `local` / `third-party` | Manual transcription hint / host-AI direct read / local whisper / third-party API. The CLI only generates the handoff list (`converted/_pending-ai.md`); execution follows the host-AI protocol |
| `materials.refine.enabled` | `true` (default) / `false` | Refined-draft mechanism toggle |

Videos always split two ways: audio track through the transcription chain + keyframes into
`{platform}/frames/` (auto-collected by the image index).

## check — The Health Checker, Anytime

Five-dimension assessment over five entry points:

| Usage | Target |
| :--- | :--- |
| `check -s "a snippet"` | A freshly written fragment |
| `check -f REQUIREMENT.md` | Any complete document |
| `check -i iter -p web -u booking` | A functional unit document |
| `check -i iter -p web` | The whole platform-level document |
| `check -i iter` | The whole iteration (all platforms + units, summary table) |

Dimensions: ① skeleton completeness ② quality (vague wording, missing AC/rules/fields/boundaries) ③ diagram suggestions ④ risk-lens screening (seven industry lenses: funds, compliance, privacy, accessibility, content, concurrency, state machines) ⑤ delta check against global requirements and sibling units.

## Product Templates — Template First, System Fallback

Per-platform requirement templates: use the product's template when provided, fall back to system defaults otherwise:

```
{iteration}/00-素材/_templates/
├── web/REQUIREMENT.md          ← web-only (platform-specific)
├── web/UNIT_REQUIREMENT.md     ← web unit template
├── web/CLARIFY.md              ← web clarification template
└── REQUIREMENT.md              ← shared by all platforms (root fallback)
```

Priority: **platform-specific > root shared > system default**. A template only needs section headings plus one-line hints; AI fills the content. System-enforced structures (OUTLINE contract, RISK adjudication) are not open to override.

## Iteration Directory Structure

```
iteration-XXX/
├── 00-素材/{platform}/        ← material drop zone (discussions, screenshots, reference docs)
│   ├── converted/{platform}/  ← [auto] docx/pdf conversion output
│   └── _templates/            ← [optional] product-defined templates
├── {platform}/
│   ├── REQUIREMENT.md         ← platform requirement doc (written by analyze)
│   └── features/{unit}/       ← functional units (sliced by slice)
│       ├── REQUIREMENT.md
│       └── assets/            ← diagram sources .mmd + prototype HTML + ASSETS.yaml
├── _shared/                   ← cross-platform shared contracts
│   └── PLATFORM_MAP.yaml     ← [optional] platform name → SpecCore project id
└── 04-交付/                   ← frozen output (copy the whole directory to hand off)
```

**Platform naming** — names are product-owned, English preferred (e.g. `web` / `admin-web` / `booking-service` — may match SpecCore project ids or not); attach Chinese labels with `=`:

```bash
specprot iteration create -n iteration-2026-Q4 -p "web=网页端,h5-mobile=移动端,booking-service" \
  -m "web=admin-web,booking-service=booking-service"
```

`-m` builds the bridge; freeze ships `PLATFORM_MAP.yaml` inside the delivery mirror — SpecCore always receives project ids.

## Delivery & Handoff — Freeze Is the Mirror

At `freeze`, the pipeline finishes three things automatically:

1. **Change reflow** — canonical versions of changed requirements evolve vX.Y → vX.(Y+1), status locked 🔒
2. **Delivery mirror** — `04-交付/` takes shape, isomorphic to SpecCore's `010-requirements/`:
   - `sources/` → requirement snapshots (input for SpecCore unitize)
   - `converted/` → converted materials (doc2spec can skip)
   - `assets/{prototypes,designs,screenshots}/` → prototype HTML, diagram sources, screenshots
3. **Handoff** — copy `04-交付/` wholesale into SpecCore's `010-requirements/`; links survive, the product side is done

The full three-gate chain:

```
SpecProt  freeze ──► SpecCore  unitize ──► SpecTest  gate
Finalize requirements ─► generate specs ─► verify
```

## AI Handoff Protocol

CLI owns determinism (skeleton scaffolding, structure validation, gate decisions); AI owns semantics (writing, slicing, deepening). Key markers:

| Marker | Meaning |
| :--- | :--- |
| `[SPECPROT_PROMPT]` | AI handoff block — the host AI writes per its guidance |
| `[SPECPROT_STEP_DONE]` | Current step complete, continue in a new session |
| `[SPECPROT_NEXT_STEP]` | Next-step instruction and resume command |
| `[SPECPROT_NEEDS_INFO]` | Parameters missing — names what is needed with examples |

## Installation

```bash
npm install          # install dependencies
npm run build        # compile to dist/
node dist/cli.js --help   # list commands
```

## Documentation Navigation

| Doc | Content |
| :--- | :--- |
| [docs/product-guide.en.md](docs/product-guide.en.md) | **Product folks start here** — full-journey handbook (install / create / materials / pipeline / check-up / prototype / design system / canon / handoff) |
| [docs/quick-start.en.md](docs/quick-start.en.md) | Install and your first iteration, end to end |
| [docs/command-reference.en.md](docs/command-reference.en.md) | Complete reference for all 22 commands |
| [docs/scenarios.en.md](docs/scenarios.en.md) | Typical usage scenarios |
| [docs/architecture.md](docs/architecture.md) | Architecture and data flow |
| [docs/quick-reference.en.md](docs/quick-reference.en.md) | Quick reference card |

## Contribution

1. Fork the repository
2. Create a Feat_xxx branch
3. Commit your code
4. Create a Pull Request
