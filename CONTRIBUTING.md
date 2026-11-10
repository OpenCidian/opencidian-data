# Contributing

## Suggest a correction

Open an issue with the **Correction** form: the word or character, the pronunciation if the fix holds for one reading only, what's wrong, the suggested value, and your evidence (a dictionary and page, a link, or how the word is used).

Suggestions are **public** and credited to your GitHub name. The same form is used when a correction comes from the Hiểu Chữ Hán app or from an AI assistant through the OpenCidian MCP (labelled `from-app` or `from-ai`). Nobody's suggestion changes the data directly: a maintainer checks each one first.

## Turn a suggestion into a correction (maintainers)

Add one YAML file under `corrections/`, in a pull request that says `closes #<issue>`.

```yaml
# corrections/hanviet/办.yml
target: { char: "办" }              # a character (every word that has it), or { entry: "觉|覺|jiao4" } for one reading of one word
field: hanviet.readings             # char: hanviet.readings · entry: hanviet.<i>.readings, vi.senses, en.senses
set: ["biện", "bạn"]                # or add: [...] / remove: [...]
reason: Thiều Chửu lists bạn first; the reading in use today is biện
evidence: Thiều Chửu, Hán Việt tự điển, 辦
by: phucbm                          # who made the correction
issue: 12                           # the issue it came from, if any
date: 2026-11-10
```

The build applies the sources first, then the corrections. `npm run validate` checks:

- the file against `schema/correction.json`, and that the target exists;
- that values are well formed (Hán Việt syllables, NFC Unicode);
- that two files don't change the same field;
- corrections the sources already agree with (no-ops), so they can be deleted after a source update.

A fix to a Vietnamese meaning that holds for everyone can also go upstream to [CVDICT](https://github.com/ph0ngp/CVDICT), and an English one to [CC-CEDICT](https://cc-cedict.org/editor/editor.php). Label the issue `upstream`.

## Update a source

Edit `sources/<id>/source.json` (URL at the new commit or version, `sha256`, `retrieved`), or for CC-CEDICT run `npm run fetch-sources -- --update cc-cedict`. Then `npm run validate && npm test`, and look at `dist/report.json` for coverage changes and new no-op corrections.

## Code

TypeScript on Node 22, run with `tsx`. `npm run typecheck && npm test && npm run validate` must pass.
