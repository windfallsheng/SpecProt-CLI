# SpecProt — Quick Reference

## Command × Parameter Matrix

| Command | Required | Optional | Alias |
| :--- | :--- | :--- | :--- |
| `ask [words...]` | — | — | — |
| `run` | `-i` | `-p --from --to -m -y --resume` | r |
| `convert` | `-i` | `-p` | cv |
| `analyze` | `-i -p` | — | az |
| `slice` | `-i -p` | — | sl |
| `deepen` | `-i -p` | `-f --phase` | — |
| `assets` | `-i -p -f` | `-k` | — |
| `schemes` | `-i -p -f` | — | — |
| `iteration create` | `-n` | `-p -g -f -t` | cr |
| `iteration list` | — | — | ls |
| `iteration freeze` | `-n` | `--force` | fz |
| `req new` | `-n` | `-d -p -i` | add |
| `req adopt` | `-i -p -f` | `-pj` | — |
| `req change` | `-r -i` | `-d` | — |
| `req list` | — | `-i` | ls |
| `req show` | `-r` | `-p` | — |
| `req link` | `-r -i` | — | — |
| `req status` | `-r -s` | — | — |
| `check` | — | `-i -s -f -p -u` | ck |
| `prototype` | — | `-i -f -o` | pt |
| `design` | — | `-s -u -c -H -f -p --update -o` | ds |
| `init` | — | — | — |

## Status Enum (req status)

draft / in review / approved / frozen / in development / delivered / deprecated / on hold

## Pipeline Stage Enum

convert / analyze / slice / deepen / adopt / freeze

## Output Markers

| Marker | Meaning |
| :--- | :--- |
| `[SPECPROT_PROMPT]` | AI handoff block (the host AI writes per its guidance) |
| `[SPECPROT_STEP_DONE]` | Current step complete, continue in a new session |
| `[SPECPROT_NEXT_STEP]` | Next-step instruction and resume command |
| `[SPECPROT_NEEDS_INFO]` | Parameters missing — names what is needed |

## The Six Gates

scope confirmation · empty materials · empty skeleton · unresolved clarifications · unadjudicated risks · adoption confirmation

## The Seven Risk Lenses

funds business · financial compliance · privacy compliance · accessibility · content compliance · concurrency protection · state-machine completeness

## Template Priority

`{platform}/specific` > `root shared` > `system default`

Overridable: REQUIREMENT.md (platform level) / UNIT_REQUIREMENT.md (unit) / CLARIFY.md (clarifications).
Not overridable: OUTLINE four-part contract, RISK three-column adjudication (system-enforced structure).

## Directory Quick Lookup

| Directory | Role |
| :--- | :--- |
| `.speccore/GLOBAL/` | Global requirement layer (single source of truth) |
| `iteration-XXX/00-素材/{platform}/` | Material drop zone |
| `iteration-XXX/00-素材/_templates/` | Product template area (optional) |
| `iteration-XXX/{platform}/REQUIREMENT.md` | Platform requirement doc |
| `iteration-XXX/{platform}/features/{unit}/` | Functional unit |
| `iteration-XXX/04-交付/` | Frozen delivery mirror → SpecCore 010-requirements/ |

## Three Steps

```bash
specprot iteration create -n iteration-XXX -p web,backend   # create the iteration
# drop materials into iteration-XXX/00-素材/{platform}/
specprot run -i iteration-XXX -m interactive                # run the pipeline
```
