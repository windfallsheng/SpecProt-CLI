# SpecProt — Usage Scenarios

## Scenario 1: A fresh iteration, one run to freeze

The smoothest path: create → drop materials → one run.

```bash
specprot iteration create -n iteration-2026-Q3 -p web,backend -g "launch meeting room booking"
# drop discussion notes, screenshots, Word docs into iteration-2026-Q3/00-素材/{platform}/
specprot run -i iteration-2026-Q3 -m auto
```

The AI handoff stages (analyze/slice/deepen) emit `[SPECPROT_PROMPT]`; the host AI writes per the block guidance, and the pipeline continues after writing. After freeze, copy `04-交付/` into SpecCore's `010-requirements/` — the product side is done.

## Scenario 2: Multi-platform project, different structures per platform

The product drops templates per platform — build the template area first, then run the pipeline:

```
iteration-2026-Q3/00-素材/_templates/
├── web/REQUIREMENT.md      ← web-specific template
└── backend/REQUIREMENT.md  ← backend-specific template
```

At analyze, web writes per the web template and backend per the backend template; platforms without templates automatically use the system seven-section skeleton. A template only needs section headings plus a one-line hint.

## Scenario 3: Wrote a fragment — health-check on the spot

Self-check without running the pipeline:

```bash
specprot check -s "users book meeting rooms, roughly dozens of times a day"
```

You immediately see: which sections are missing, vague wording, which diagrams to add, whether any risk lens is hit. Revise and re-check until you see "🎉 pass".

## Scenario 4: Undecided between options — branch and compare first

A unit has two implementation paths; don't decide yet:

```bash
specprot schemes -i iteration-2026-Q3 -p web -f booking
```

Produces a multi-option comparison + recommendation. At freeze the recommended one enters the snapshot body, the rest go to an appendix — the decision leaves a trace without polluting the body.

## Scenario 5: A risky unit — adjudicate in depth

After check hits the "funds business lens", run deep adjudication on that unit:

```bash
specprot deepen -i iteration-2026-Q3 -p backend -f payment --phase review
```

The RISK three-column adjudication (risk / mitigation / verdict) is filled one by one. If the verdict is not cleared, the freeze gate blocks — deliberately, to prevent freezing with defects.

## Scenario 6: Requirement change — auto-reflow at freeze

Changed a frozen canonical requirement inside an iteration? Just mark the change:

```bash
specprot req change -r REQ-001 -i iteration-2026-Q4 -d "booking adds a reschedule feature"
```

When this iteration freezes, REQ-001 evolves automatically v1.0 → v1.1 with status locked — history preserved, evolution traceable.

## Scenario 7: Interrupted halfway

Resume from the breakpoint, not from scratch:

```bash
specprot run -i iteration-2026-Q3 --resume
```

Continues from the last unfinished stage; completed stages are not re-run.

## Scenario 8: No command memorization — talk in plain language

```bash
specprot ask "initialize the project"
specprot ask "create iteration Q4, platforms web and backend"
specprot ask "new requirement booking reschedule"
specprot ask "mark REQ-001 as review passed"
specprot ask "freeze iteration 2026-Q3"
```

When confidence is low, it lists candidates and names the missing parameters — just add one more sentence.
