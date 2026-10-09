# Product Guide (Full Journey) · SpecProt — Requirement Finalization Workshop

> A complete handbook for product people. No code required. Every step answers three questions: **what to do, where to do it, what you get**.
> Steps 0–3 are all you need for the whole pipeline; steps 4–7 are optional weapons that make requirements sturdier.

## The Full Journey Map

```
Step 0  Install & init (once) ──► then for every requirement:
Step 1  Create iteration ──► Step 2  Drop materials ──► Step 3  Run pipeline ──► Step 8  Hand off to dev
                                      ▲                        ▲
                                      │  Step 4  Check-up      │
                                      │  Step 5  Prototype     │── optional, anytime
                                      │  Step 6  Design system │
                                      │  Step 7  Canon library │
```

## Step 0: Install & Initialize (once)

**What to do**: install the tool and initialize, one line each:

```bash
npm install -g spec-prot   # install
specprot init              # initialize inside the project
```

(Or just tell your AI assistant: "install spec-prot and initialize this project".)

**Where**: the terminal, or your AI coding assistant's chat.

**What you get**:
- A `.speccore/GLOBAL/` global requirement layer appears in the project — the permanent home of all requirements, glossaries and design systems, shared across iterations;
- Your AI assistant gains a batch of slash commands (`/iteration-create`, `/run`, `/check`…): type a slash and it knows what to do.

**In one line**: initialize once, and the assistant speaks your language from then on.

## Step 1: Create an Iteration

**What to do**: tell your AI assistant:

> "Create iteration Q3, goal: launch meeting room booking"

(Or type: `specprot iteration create -n iteration-Q3 -p "web=网页端,backend=后端服务"`)

**Platform naming tip**: you name the platform folders yourself —
- English preferred (`web` / `admin-web` / `booking-service`), with a Chinese note after `=` so anyone can tell at a glance;
- Mismatch with the dev side (SpecCore)? No problem: add `-m "web=admin-web"` when creating the iteration to build a lookup table, shipped automatically on freeze — devs always receive their own names.

**Where**: your AI assistant's chat, or the terminal.

**What you get**: a folder named `iteration-Q3`, with everything prepared:

```
iteration-Q3/
├── 00-素材/          ← where you drop materials (the important one!)
│   ├── web/          ← web-side materials
│   ├── backend/      ← backend materials
│   ├── shared/       ← relevant to both
│   └── _templates/   ← custom templates (optional)
├── web/              ← home of the web requirement doc
├── backend/          ← home of the backend requirement doc
├── _shared/          ← cross-platform glossary & rules
└── 04-交付/          ← what gets delivered at the end (ignore for now)
```

## Step 2: Drop in Materials

**What to do**: **drag materials into the folder** — discussion notes, meeting screenshots, Word/PDF/Excel, audio recordings: all welcome.

```
iteration-Q3/00-素材/
├── web/      ← front-end related stuff goes here
├── backend/  ← backend related stuff goes here
└── shared/   ← relevant to both (business rules, field definitions)
```

**Where**: your file manager (Finder / Explorer).

**What you get**: nothing to manage — the pipeline auto-converts them to text (`00-素材/converted/`), indexes images, and adds transcription hints for audio.

**Pro tip**: want your own document structure? Put template files (section titles + one-line descriptions) into `00-素材/_templates/` — your template wins, otherwise the system default applies.

## Step 3: Run the Pipeline

**What to do**: tell your AI assistant:

> "Run the pipeline, interactive mode"

(Or type: `specprot run -i iteration-Q3 -m interactive`. For hands-free, say "auto mode" — no pauses between stages, but the six gates still guard you.)

**Where**: your AI assistant's chat.

**What you get**: six stages relay automatically, each with visible output:

| # | Stage | What happens | Output |
| :--- | :--- | :--- | :--- |
| 1 | Convert | Materials become text, images indexed | `00-素材/converted/` |
| 2 | Analyze | A **complete requirement doc** is written (7 sections: background/scenarios/features/pages&APIs/fields/rules/acceptance) | `{platform}/REQUIREMENT.md` |
| 3 | Slice | Split into functional units (booking, payment…) | `{platform}/features/{unit}/` |
| 4 | Deepen | Risk list + clarification list | RISK.md, CLARIFY.md in each unit |
| 5 | Adopt | Requirements promoted into the canon library | `.speccore/GLOBAL/` |
| 6 | Freeze | Delivery package takes shape | `04-交付/` |

**The pipeline pauses to ask you six things** (by design — it guards quality for you):

1. Is the scope right?
2. Are the materials empty?
3. Is the requirement skeleton filled?
4. Are clarifications resolved?
5. Are risks adjudicated?
6. Confirm adopting these requirements?

Answer and it continues; if you can't answer, the requirement isn't thought through yet — a good moment to think it through.

**Interrupted mid-run**: say "continue" (`--resume`), it resumes from where it stopped.

## Step 4: Check-ups Anytime (optional but recommended)

**What to do**: after writing a chunk of requirements, anytime say:

> "Check this: users pay orders, the amount is deducted from balance"

**Where**: your AI assistant's chat. Five entry points, pick by what you have at hand:

| Entry | Command | When |
| :--- | :--- | :--- |
| A snippet | `specprot check -s "…"` | The requirement is still in your head |
| A file | `specprot check -f req.md` | A document needs a check-up |
| Whole iteration | `specprot check -i iteration-Q3` | Full inspection with a summary table |
| One platform | `specprot check -i iteration-Q3 -p web` | Only the web side |
| One unit | `specprot check -i iteration-Q3 -p web -u booking` | Only one feature |

**What you get**: a check-up report telling you exactly what's missing:

```
🩺 Requirement Check-up Report
① Skeleton       ⚠️ missing: pages/APIs, business rules, acceptance criteria
② Quality (6-D)  ⚠️ colloquial "probably" / no acceptance criteria
③ Diagram advice 💡 suggest adding: business flowchart, page wireframe
④ Risk screening ⚠️ hit the "funds business lens": payment, amount
⑤ Delta vs canon ✅ no duplication with history
```

Patch it up and re-check until you see "🎉 Pass".

## Step 5: Prototypes & Diagrams (optional — make requirements visible)

**What to do**:
- Want a **clickable HTML prototype**? Say "generate a prototype for web" (`specprot prototype -i iteration-Q3 -p web`);
- Want **flowcharts / wireframes**? Say "draw diagrams for the booking unit" (`specprot assets -i iteration-Q3 -p web -f booking`).

**Where**: your AI assistant's chat.

**What you get**:
- Prototype: a clickable HTML under `{platform}/assets/prototypes/`, generated from the requirement doc;
- Diagrams: flowcharts, state diagrams, wireframes per unit, plus an index page to view them all.

**Who sees it**: project the prototype at review meetings — ten times more intuitive than reading documents aloud.

## Step 6: Design System (optional — distill the style once)

**What to do**: to keep prototypes consistent across iterations, say:

> "Extract the design system from the xxx design / live page"

(`specprot design -s code-dir` or `-u pageURL`; antd / element / tailwind etc. supported.)

**Where**: your AI assistant's chat, or the terminal.

**What you get**: the design system lands in the global layer `.speccore/GLOBAL/DESIGN_SYSTEM.yaml` plus a style-guide HTML — **shared across iterations**: every future prototype inherits the same colors, fonts and components, so your product line never loses its look.

## Step 7: The Canon Library (advanced — changes, versions, history)

**What it is**: `.speccore/GLOBAL/` is the **single source of truth** for requirements — every unit adopted in an iteration is promoted to a canon entry (REQ-001, REQ-002…, versioned v1.0), never lost.

**Daily operations** (all expressible in plain language):

| Want to | Say | Command |
| :--- | :--- | :--- |
| Create globally | "New requirement: membership system" | `specprot req new -n membership -d …` |
| Inspect | "What is REQ-001" | `specprot req show REQ-001` |
| Link to iteration | "Link REQ-001 to Q3" | `specprot req link --req REQ-001 -i iteration-Q3` |
| Update status | "Mark REQ-001 as review passed" | `specprot req status …` |
| Declare a change | "REQ-001 changed: booking now supports rescheduling" | `specprot req change REQ-001 -d …` |
| Adopt a unit | Pipeline stage 5 does it automatically | `specprot req adopt` |

**How changes flow**: once declared, freeze auto-evolves the version (v1.0 → v1.1); old versions are kept, so who changed what is always traceable.

**Does the AI consult history?** Yes. When analyzing / slicing, the tool automatically feeds the AI **same-platform history summaries** (max 5), the iteration's shared glossary and rules, and the design system — when a new requirement duplicates or conflicts with history, the AI marks 「待确认」 instead of silently merging. The more you accumulate, the more the AI writes like your team.

## Step 8: Hand Off to Dev

**What to do**: when the pipeline finishes, **copy the whole `04-交付/` folder** to the dev team.

**Where**: your file manager (Finder / Explorer).

**What you get**: devs drop it into their `010-requirements/` and start immediately; the `PLATFORM_MAP.yaml` lookup table keeps both sides' names perfectly aligned. Your part on the product side is done.

```
What's inside 04-交付/?
├── sources/          ← finalized requirement snapshots (dev input)
├── converted/        ← converted material text
├── assets/           ← prototypes, flowcharts, reference screenshots (links survive)
└── PLATFORM_MAP.yaml ← name lookup (your names → dev names)
```

### Ship part of the platforms, or export Word/PDF

- **Freeze only some platforms**: `specprot iteration freeze -n name -p web,booking-service` — snapshots, assets and the lookup table keep only these platforms.
- **Export as Word / HTML / PDF** (for business review, archiving, sealing):

  ```bash
  specprot export -i name -f docx,html    # all platforms, Word + HTML
  specprot export -i name -p web -f pdf   # only the web platform, as PDF
  ```

  Output lands in `04-交付/exports/{format}/{platform}/`; works even before freeze (pulls from the canon). PDF needs LibreOffice (`brew install --cask libreoffice`); if missing, it skips with a hint.```

## Command Cheat Sheet

| Action | Command |
| :--- | :--- |
| Initialize | `specprot init` |
| Create iteration | `specprot iteration create -n name -p "web=网页端"` |
| Run pipeline | `specprot run -i name -m interactive` |
| Check-up | `specprot check -s "a snippet"` |
| Prototype | `specprot prototype -i name -p platform` |
| Diagrams | `specprot assets -i name -p platform -f unit` |
| Compare options | `specprot schemes -i name -p platform -f unit` |
| Design system | `specprot design -u pageURL` |
| Requirement mgmt | `specprot req new / change / link / status …` |
| Freeze & deliver | `specprot iteration freeze -n name` (`-p p1,p2` = selected platforms only) |
| Export docs | `specprot export -i name -f docx,html` (`-p` by platform) |

## FAQ

**Q: I don't want to remember any command — is that OK?**
Yes. Talk to your AI assistant the whole way:

> "Create iteration Q4" → "Run the pipeline" → "Mark REQ-001 as review passed" → "Freeze iteration Q4"

**Q: What if the run breaks halfway?**
Say "continue" (`--resume`); it resumes from where it stopped — no restart.

**Q: What if a requirement changes midway?**
Say "REQ-001 changed: booking now supports rescheduling". Freeze auto-records version evolution (v1.0 → v1.1); old versions are kept.

**Q: Can I define my own document format per platform?**
Yes. Put template files (section titles + one-line descriptions) into `00-素材/_templates/` — your template wins, otherwise the system default applies.

**Q: Torn between options and want a comparison?**
Say "make two options for the booking feature". You get a multi-option comparison; on freeze the recommended one enters the main text, the rest stay as a backup appendix.

**Q: How do I name platform folders? Must they match the dev side?**
English preferred, with a Chinese label after `=`; no need to match — build the lookup with `-m` at iteration creation, and freeze ships it automatically.

**Q: Does the AI consult historical requirements when writing?**
Yes. Analyze/slice auto-inject same-platform history summaries + glossary + rules + design system; duplicates and conflicts get a 「待确认」 note.

**Q: Where does the design system live? Do I redo it per iteration?**
In the global layer `.speccore/GLOBAL/DESIGN_SYSTEM.yaml` — shared across iterations; do it once, the whole line benefits.

**Q: I initialized before — must I redo it for a new project?**
Yes. `specprot init` is per project; run it once in each new project.

## In One Line

Install once, initialize once; then every iteration is three things — create, drop materials, run the pipeline; materials go in, finalized requirements come out, copy them to dev, done.
