# SpecProt — Command Reference

All 22 SpecProt commands on this page. Convention: `-i` is the iteration name, which is the directory name itself (whatever you passed when creating the iteration is what you use afterwards).

## 1. Smart Entry

### ask

Natural-language execution engine — recognizes intent and executes directly, aligned with SpecCore ask.

```bash
specprot ask [words...]
```

Behavior tiers: confidence ≥ 70 executes directly; 45~69 lists candidates and names what is missing; lower gives the closest command. Missing parameters emit `[SPECPROT_NEEDS_INFO]`.

```bash
specprot ask "create iteration Q3"
specprot ask "new requirement meeting room booking"
specprot ask "mark REQ-001 as review passed"
```

## 2. Pipeline

### run (alias r)

The six-stage pipeline orchestrator. Full parameters:

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-i, --iteration` | Iteration name (required) | — |
| `-p, --platforms` | Platform list, comma-separated; empty = platforms configured for the iteration | — |
| `--from` | Start stage: convert/analyze/slice/deepen/adopt/freeze | convert |
| `--to` | End stage (same enum) | freeze |
| `-m, --mode` | auto (no wait between stages, gates still pause) / interactive (pause at every stage) | interactive |
| `-y, --yes` | Pass through in one keypress under interactive mode | false |
| `--resume` | Resume from breakpoint | false |

```bash
specprot run -i iteration-2026-Q3 -m auto
specprot run -i iteration-2026-Q3 --resume
specprot run -i iteration-2026-Q3 --from analyze --to slice
```

## 3. The Six Pipeline Stages

### convert (alias cv)

Material conversion: docx/pdf/xlsx → md (verbatim), image indexing; audio/video handled per `.specprot.yml` strategy.

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Convert only this platform; empty = all platforms + shared |

**Material strategy** (`.specprot.yml` at iteration root, optional; delete = defaults):

| Key | Values | Description |
| :--- | :--- | :--- |
| `materials.audio.mode` | `prompt` (default) / `ai` / `local` / `third-party` | Audio transcription mode: manual hint / host-AI direct read / local whisper / third-party API |
| `materials.video.mode` | same as above | Video mode (audio-track transcription + keyframes into image index) |
| `materials.refine.enabled` | `true` (default) / `false` | Refined-draft mechanism toggle |

**Refined-draft mechanism**: the host AI distills noisy materials into refined drafts at `00-素材/converted/{platform}/_refined/` (denoise → segment → conclusion-first → traceability). `analyze` prioritizes refined drafts; verbatim conversions remain as trace-back sources. With `ai` mode, `convert` generates `converted/_pending-ai.md` handoff list; delete it after transcription + refinement.

### analyze (alias az)

Per-platform analysis: distills a full seven-section requirement doc from platform materials (AI handoff). Output: `{platform}/REQUIREMENT.md`.

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Target platform (names are product-owned, English preferred; `web=网页端` may carry a Chinese label) (required) |

### slice (alias sl)

In-platform functional slicing: platform doc → independently deliverable functional units (AI handoff + material tracing). Output: `{platform}/features/{unit}/`.

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Target platform (required) |

### deepen

Unit deepening: OUTLINE structure contract → review pack (RISK adjudication / CLARIFY / REBOUND reflow).

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-i, --iteration` | Iteration name (required) | — |
| `-p, --platform` | Platform name (required) | — |
| `-f, --feature` | Functional unit name; empty = all units of the platform | — |
| `--phase` | outline / review / all | all |

### assets

Asset generation: Mermaid diagrams + prototype HTML + ASSETS.yaml registry.

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-i, --iteration` | Iteration name (required) | — |
| `-p, --platform` | Platform name (required) | — |
| `-f, --feature` | Functional unit name (required) | — |
| `-k, --kind` | diagrams / prototype / all | all |

### schemes

Scheme branching: multi-option comparison + recommendation; at freeze the recommended one enters the snapshot body, the rest go to an appendix.

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Platform name (required) |
| `-f, --feature` | Functional unit name (required) |

## 4. Iteration Management (iteration / iter)

### iteration create (alias cr)

Creating an iteration = building the workshop (material zones + per-platform requirement skeletons + unit directories + template area + delivery area).

**Platform naming**: names are product-owned, English preferred (e.g. `web` / `admin-web` / `booking-service` — may match SpecCore project ids or not); attach Chinese labels with `=` (`web=网页端`). When names differ from SpecCore project ids, build the bridge with `-m`; freeze ships `PLATFORM_MAP.yaml` inside the delivery mirror.

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-n, --name` | Iteration name, e.g. `iteration-2026-Q3` (required) | — |
| `-p, --platforms` | Platforms involved, comma-separated (names product-owned; `web=网页端` may carry a Chinese label) | web |
| `-m, --platform-map` | Platform name → SpecCore project id mapping (`web=admin-web,booking-service=booking-service`), shipped with the delivery mirror on freeze | — |
| `-g, --goal` | Goal of this iteration | — |
| `-f, --from` | Start date | — |
| `-t, --to` | End date | — |

### iteration list (alias ls)

Lists all iterations and their linked requirements.

### iteration freeze (alias fz)

Freezes the iteration, forbidding requirement changes. Blocks when risks are unadjudicated or clarifications unresolved. Generates the `04-交付/` handoff snapshot; with `-p`, freezes only the given platforms (snapshots / assets / lookup table filtered accordingly). With `-p`, the change reflow is filtered per platform as well — unselected platforms keep their "变更中" status untouched.

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-n, --name` | Iteration name (required) | — |
| `-p, --platforms` | Freeze only these platforms (comma-separated), empty = all | — |
| `--force` | Skip the freeze gates | false |

## 5. Requirement Management (req)

The global requirement layer = the single source of truth for all requirements. Each requirement has a REQ-NNN id, a version vX.Y, and a status.

### req new (alias add)

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-n, --name` | Requirement name (required) | — |
| `-d, --desc` | Requirement description | — |
| `-p, --project` | Owning project | default |
| `-i, --iteration` | Linked iteration | — |
| `--platform` | Owning platform (product-defined, e.g. web; used for per-platform export/convert grouping) | — |

### req adopt

Adopts a functional unit into the canon (iteration layer → global layer, lineage established).

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Platform where the unit lives (required) |
| `-f, --feature` | Functional unit directory name (required) |
| `-pj, --project` | Owning project, default `default` |

### req change

Marks a canonical requirement as changed; at freeze the version evolves automatically vX.Y → vX.(Y+1).

| Param | Meaning |
| :--- | :--- |
| `-r, --req` | Requirement id, e.g. REQ-001 (required) |
| `-i, --iteration` | Iteration implementing the change (required) |
| `-d, --desc` | Change description |

### req list (alias ls)

Lists requirements; `-i` filters by iteration.

### req show

Shows requirement details. `-r, --req` id (required); `-p, --project` owning project (default `default`).

### req link

Links a requirement to an iteration. `-r, --req` (required) + `-i, --iteration` (required).

### req status

Updates requirement status. `-r, --req` (required) + `-s, --status` (required).

Status enum: draft / in review / approved / frozen / in development / delivered / deprecated / on hold.

## 6. Product Aids

### check (alias ck)

Five-dimension requirement health check (skeleton / quality / diagram suggestions / risk screening / delta check), five entry points:

| Param | Meaning |
| :--- | :--- |
| `-s, --snippet` | Paste a requirement fragment directly |
| `-f, --file` | Read a requirement file |
| `-i, --iteration` | Iteration name |
| `-p, --platform` | Platform name (with -i; with -u it locates the unit, without -u it is the whole platform doc) |
| `-u, --unit` | Functional unit directory name (with -i -p) |

```bash
specprot check -s "user pays the order, amount deducted from balance"
specprot check -i iteration-2026-Q3 -p web -u booking
specprot check -i iteration-2026-Q3          # whole-iteration summary
```

### prototype (alias pt)

Produces an HTML prototype straight from a requirement doc. Two entry points: **within an iteration** use `-i <iteration> -p <platform>` (reads the platform-level REQUIREMENT.md; output goes to `{platform}/assets/prototypes/` and ships with the freeze delivery); **ad-hoc single doc** use `-f <path>` (output goes to the default `prototypes/`). Split of work with `design`: this command builds pages, `design` curates style (prototypes auto-apply DESIGN_SYSTEM.yaml).

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name; empty = global layer |
| `-f, --file` | Requirement doc path (overrides default) |
| `-o, --output` | Output directory (overrides default) |

### design (alias ds)

Extracts/configures a design system, producing DESIGN_SYSTEM.yaml. Split of work with `prototype`: this command curates **style** (colors/fonts/components), `prototype` builds **pages** (auto-applying this command's output).

| Param | Meaning |
| :--- | :--- |
| `-s, --scan` | Scan a local code project |
| `-u, --url` | A live page URL |
| `-c, --cookie` | Browser cookie |
| `-H, --header` | Extra request headers |
| `-f, --file` | Local HTML/CSS files |
| `-p, --preset` | antd / element / tailwind / material / minimal |
| `--update [file]` | Regenerate the style guide from DESIGN_SYSTEM.yaml |
| `-o, --output` | Output file (default DESIGN_SYSTEM.yaml) |

### export (alias exp)

Converts the exported requirement docs to Word / HTML / PDF. Sources: the `04-交付/sources/` delivery snapshots (export first via `iteration freeze`, then convert — two separate steps); `-p` converts only the given platforms (platform ownership comes first from "来源功能单元", then from the "所属端" line). Engine: pandoc; PDF additionally needs LibreOffice.

| Param | Meaning | Default |
| :--- | :--- | :--- |
| `-i, --iteration` | Iteration name (required) | — |
| `-p, --platforms` | Convert only these platforms (comma-separated), empty = all exported | — |
| `-f, --format` | Target formats, comma-separated: docx / html / pdf | docx |
| `-o, --output` | Output dir | `{iteration}/exports/` |

Output layout: `exports/{format}/{platform}/{requirement}.{ext}`; requirements without a platform go to `未归属端/`.

### resolve

Adjudicates a unit's RISK.md "待裁决" and CLARIFY.md "未决" items, clearing the freeze gate. Without `--item` it only lists; after each adjudication the numbering is re-sorted and re-printed, so keep adjudicating by the fresh numbers.

| Param | Meaning |
| :--- | :--- |
| `-i, --iteration` | Iteration name (required) |
| `-p, --platform` | Platform name (required) |
| `-f, --feature` | Feature unit name (required) |
| `--item <n>` | Item number (default: list only) |
| `--decision <d>` | accept / reject |
| `--note <text>` | Adjudication reason (written into the verdict column) |

### init

Initializes the project: global requirement layer + Slash Commands injection.

## Parameter Semantics Quick Reference (same flag, different meaning per command)

| Flag | Meaning by command |
| :--- | :--- |
| `-p` | `req new` = owning project; `convert / analyze / slice / deepen / assets / schemes / check / prototype` = a single platform name; `run / freeze / export / iteration create` = platform list; `design` = preset style |
| `-f` | `deepen / assets / schemes` = feature unit; `prototype / check / design` = file path; `iteration create` = start date; `export` = target format |

> Memory hook: **-p usually means "platform"** (req new's project and design's preset are historical exceptions); **-f is the unit name in unit-centric commands** — read the prompt otherwise.
