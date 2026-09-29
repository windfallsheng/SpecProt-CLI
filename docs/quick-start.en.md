# SpecProt — Quick Start

## 1. Install

```bash
npm install       # install dependencies
npm run build     # compile to dist/
node dist/cli.js --help   # confirm it works
```

## 2. Initialize the project (first time only)

```bash
specprot init
```

Initializes two things: the in-project `.speccore/GLOBAL/` global requirement layer (the single source of truth for all requirements), and Slash Commands injection for the host AI.

## 3. Create an iteration

```bash
specprot iteration create -n iteration-2026-Q3 -p web,backend -g "launch meeting room booking"
```

One command builds the **workshop**: material zones (per platform + shared + converted), per-platform requirement skeletons, functional unit directories, the template area, and the delivery area.

## 4. Drop in materials

Throw materials into `iteration-2026-Q3/00-素材/{platform}/`:

- `web/` ← frontend-related notes, screenshots, reference docs
- `backend/` ← backend-related materials
- `shared/` ← cross-platform items (business rules, global fields, data models)

Supports `.md` `.docx` `.pdf` `.xlsx`, screenshots, and audio. The pipeline handles conversion — just drop them in.

## 5. Run the pipeline

```bash
# Interactive mode (recommended for the first run)
specprot run -i iteration-2026-Q3 -m interactive

# Auto mode (key gates still pause)
specprot run -i iteration-2026-Q3 -m auto

# Resume from a breakpoint (after interruption)
specprot run -i iteration-2026-Q3 --resume

# Run only a slice of stages
specprot run -i iteration-2026-Q3 --from analyze --to slice
```

## 6. Health-check anytime

After writing a fragment, a unit, or the whole iteration, press the checker:

```bash
specprot check -s "user pays the order, amount deducted from balance"   # snippet
specprot check -i iteration-2026-Q3 -p web -u booking                   # unit
specprot check -i iteration-2026-Q3 -p web                              # whole platform doc
specprot check -i iteration-2026-Q3                                     # whole iteration
```

## 7. Freeze and hand off

Running all six stages freezes automatically and `04-交付/` takes shape:

```bash
# Or freeze manually (blocks if risks are unadjudicated)
specprot iteration freeze -n iteration-2026-Q3
```

Copy `04-交付/` **as a whole directory** into `010-requirements/` of the SpecCore iteration; the product side is done:

```
04-交付/
├── sources/        → requirement snapshots (input for SpecCore unitize)
├── converted/      → converted materials (doc2spec can skip)
└── assets/         → prototype HTML + diagram sources + screenshots
```

## 8. Natural-language shortcuts

Don't want to memorize commands? Just talk:

```bash
specprot ask "create iteration Q3, goal: launch meeting room booking"
specprot ask "mark REQ-001 as approved"
specprot ask "list all iterations"
```

It acts when it understands; when parameters are missing it names them (`[SPECPROT_NEEDS_INFO]`).

## Next Steps

- Command details → [command-reference.en.md](command-reference.en.md)
- Typical scenarios → [scenarios.en.md](scenarios.en.md)
- Architecture → [architecture.md](architecture.md)
