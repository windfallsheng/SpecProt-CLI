# SpecProt — Product Operation Guide (Zero Tech)

> For product folks. No code knowledge needed. Every step tells you three things: **how to do it, where to do it, and what you will get**.

## You only do three things, start to finish

```
① Create an iteration ──► ② Drop in materials ──► ③ Run the pipeline
```

Everything else — turning materials into text, writing the doc, slicing units, checking risks, drawing diagrams, freezing — happens automatically.

## Step 1: Create an iteration

**How**: say one sentence to your AI assistant:

> "Create iteration Q3, goal: launch meeting room booking"

(Or type: `specprot iteration create -n iteration-Q3 -p web,backend`)

**Where**: the chat box of your AI coding tool, or a terminal.

**What you get**: a folder named `iteration-Q3` with everything ready inside:

```
iteration-Q3/
├── 00-素材/          ← where you drop materials (the important one!)
├── web/              ← home of the web requirement doc
├── backend/          ← home of the backend requirement doc
├── _shared/          ← cross-platform shared stuff
└── 04-交付/          ← what gets handed over in the end (ignore for now)
```

## Step 2: Drop in materials

**How**: **drag files into the folder** — discussion notes, meeting screenshots, Word/PDF, audio; all welcome:

```
iteration-Q3/00-素材/
├── web/      ← frontend-related stuff goes here
├── backend/  ← backend-related stuff goes here
└── shared/   ← things both sides use (business rules, field definitions) go here
```

**Where**: the file manager (Finder / Explorer).

**What you get**: nothing to manage — the pipeline automatically turns them into text and indexes the images.

## Step 3: Run the pipeline

**How**: say to your AI assistant:

> "Run the pipeline, interactive mode"

**Where**: the chat box of your AI coding tool.

**What you get**: six steps run in relay, each with visible output:

| Step | Output | Where you see it |
| :--- | :--- | :--- |
| ① Convert | Materials become text | `00-素材/converted/` |
| ② Analyze | **The full requirement doc** (seven sections: background/scenarios/functions/pages & APIs/fields/rules/acceptance) | `web/REQUIREMENT.md` |
| ③ Slice | Functional units (booking, payment…) | `web/features/` |
| ④ Deepen | Risk list + clarification list | RISK.md inside the unit directory |
| ⑤ Adopt | Requirements enter the "canon library" | `.speccore/GLOBAL/` |
| ⑥ Freeze | The delivery package takes shape | `04-交付/` |

**It will pause to ask you six things along the way** (by design — the pipeline checks on your behalf):

1. Is the scope right?
2. Are the materials empty?
3. Is the requirement skeleton filled?
4. Are pending clarifications resolved?
5. Are risks adjudicated?
6. Confirm adopting these requirements?

Answer and it continues; anything you can't answer means the requirement isn't thought through yet — a perfect chance to think it through.

## Step 4: Health-check anytime (optional but recommended)

**How**: after writing a requirement fragment, say anytime:

> "Check this: user pays the order, amount deducted from balance"

**Where**: the chat box of your AI coding tool.

**What you get**: a health report telling you directly:

```
🩺 Requirement Health Report
① Skeleton completeness   ⚠️ missing: pages/APIs, business rules, acceptance criteria
② Quality                 ⚠️ vague wording "roughly" / no acceptance criteria
③ Diagram suggestions     💡 suggest: business flowchart, page wireframe
④ Risk screening          ⚠️ hit the "funds business lens": payment, amount
⑤ Delta check             ✅ no duplicates

📊 Summary: skeleton ⚠️ · quality ⚠️ · 2 diagrams · risk ⚠️
```

Fill the gaps and re-check until you see "🎉 pass".

## Step 5: Hand over to development

**How**: when the pipeline finishes, copy the **whole `04-交付/` folder** to the dev team.

**Where**: the file manager (Finder / Explorer).

**What you get**: dev puts it into their `010-requirements/` directory and starts working. Your part on the product side is finished.

```
What's inside 04-交付/?
├── sources/     ← finalized requirement snapshots (dev's input)
├── converted/   ← materials already converted to text
└── assets/      ← prototypes, flowcharts, reference screenshots (links survive)
```

## FAQ

**Q: I don't want to memorize any command. Is that OK?**
Yes. Talk to the AI assistant the whole way:

> "Create iteration Q4" → "Run the pipeline" → "Mark REQ-001 as review passed" → "Freeze iteration Q4"

**Q: It was interrupted halfway?**
Say "continue" (`--resume`) — it picks up from where it stopped, no restart.

**Q: Requirements changed midway?**
Say "REQ-001 has a change: booking adds a reschedule feature". At freeze the version evolves automatically (v1.0 → v1.1); old versions are kept.

**Q: Can I define my own requirement doc format per platform?**
Yes. Drop template files into `00-素材/_templates/` (section headings + one-line hints). Your template when provided, system default otherwise.

**Q: Undecided between approaches and want to compare?**
Say "make two options for the booking feature and compare". It produces a comparison table; at freeze the recommended option enters the body, the rest stay as an appendix.

## One-Line Summary

Create an iteration, drop materials, run the pipeline — three things. Materials in, finalized requirements out; copy to dev and you're done.
